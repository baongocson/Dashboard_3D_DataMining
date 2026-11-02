import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright';
import canonicalize from 'canonicalize';
import {runX01,scaleFixture,check} from './shared.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));process.chdir(here);
const evidence=path.resolve('evidence');await mkdir(evidence,{recursive:true});
const stamp=new Date().toISOString();let revision=1;
const serverRequests=[];
const server=createServer(async(req,res)=>{
  serverRequests.push({path:req.url,at:new Date().toISOString()});res.setHeader('Cache-Control','no-store');
  try {
    if(req.url==='/sw.js') {
      res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-cache');
      res.end(`const VERSION=${revision}; self.addEventListener('install',e=>e.waitUntil(caches.open('g01-shell-'+VERSION).then(c=>c.addAll(['/','/probe.mjs','/shared.mjs','/canonicalize.mjs']))));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});`);return;
    }
    if(req.url==='/') {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>G01 isolated synthetic probes</title><h1>G01 X01–X02 local/dev</h1><pre></pre><script type="module" src="/probe.mjs"></script>');return;}
    if(req.url==='/scale-worker.mjs') {res.setHeader('Content-Type','text/javascript');res.end(`import {scaleFixture} from '/shared.mjs'; onmessage=async e=>{try{postMessage({ok:true,value:await scaleFixture(e.data)});}catch(err){postMessage({ok:false,error:err.message});}};`);return;}
    const routes={'/probe.mjs':'probe.mjs','/shared.mjs':'shared.mjs','/canonicalize.mjs':'node_modules/canonicalize/lib/canonicalize.js'};
    if(!routes[req.url]) {res.writeHead(404);res.end('Not found');return;}
    res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile(routes[req.url]));
  } catch(e){res.writeHead(500);res.end(e.message);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const report={experiment:'X01-X02',startedAt:stamp,environment:{node:process.version,os:os.type(),release:os.release(),arch:os.arch(),totalMemory:os.totalmem(),cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,origin,synthetic:true,canonicalize:'5.1.0',playwright:'1.64.1'},node:{},browsers:[]};
report.node.x01=await runX01(canonicalize);report.node.scale=[];
for(const n of [10000,50000]){const before=process.memoryUsage();const actual=await scaleFixture(n);report.node.scale.push({...actual,nodeMemoryBefore:before,nodeMemoryAfter:process.memoryUsage()});}
async function pageReady(context){const p=await context.newPage();await p.goto(origin);await p.waitForFunction(()=>globalThis.probe?.ready);return p;}
try {
  for(const channel of ['chrome','msedge']) {
    revision=1;const entry={channel,x01:[],x02:[],scale:[],externalRequests:[],consoleErrors:[]};report.browsers.push(entry);
    let browser;
    const test=async(id,expected,fn)=>{try{const actual=await fn();entry.x02.push({id,expected,status:actual?.inconclusive?'inconclusive':'passed',actual});}catch(e){entry.x02.push({id,expected,status:'failed',actual:e.message});}};
    try {
      browser=await chromium.launch({channel,headless:true,args:['--enable-precise-memory-info']});entry.version=browser.version();
      const context=await browser.newContext({serviceWorkers:'allow',viewport:{width:1100,height:760}});
      await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){entry.externalRequests.push(route.request().url());return route.abort();}return route.continue();});
      context.on('page',p=>p.on('pageerror',e=>entry.consoleErrors.push(e.message)));
      let a=await pageReady(context);entry.userAgent=await a.evaluate(()=>navigator.userAgent);
      entry.capabilities=await a.evaluate(()=>({secureContext:isSecureContext,webLocks:!!navigator.locks,indexedDB:!!indexedDB,opfs:!!navigator.storage.getDirectory,serviceWorker:'serviceWorker'in navigator,memoryMeasurement:'memory'in performance}));
      entry.x01=await a.evaluate(()=>probe.runX01());
      for(const item of entry.x01){const node=report.node.x01.find(x=>x.id===item.id);if(item.status==='passed'&&JSON.stringify(item.actual)!==JSON.stringify(node.actual)){item.status='failed';item.crossRuntimeMismatch=true;}}
      for(const n of [10000,50000]) {
        const measured=await a.evaluate(n=>new Promise((resolve,reject)=>{const w=new Worker('/scale-worker.mjs',{type:'module'});w.onmessage=e=>{w.terminate();e.data.ok?resolve(e.data.value):reject(new Error(e.data.error));};w.onerror=e=>{w.terminate();reject(new Error(e.message));};w.postMessage(n);}),n);
        const expected=report.node.scale.find(x=>x.rows===n);check(measured.sourceHash===expected.sourceHash&&measured.tableHash===expected.tableHash,'scale hash cross-runtime mismatch');entry.scale.push(measured);
      }
      let b=await pageReady(context);
      await test('X02-01','Exactly one Web Lock writer across two pages',async()=>{const first=await a.evaluate(()=>probe.acquire());const second=await b.evaluate(()=>probe.acquire());check(first&&!second,'two writers');return {first,second};});
      await test('X02-02','Real IndexedDB abort does not publish version/history/outbox/head',async()=>{
        await a.evaluate(()=>probe.commit('v1'));const actual=await a.evaluate(async()=>{let aborted=false;try{await probe.commit('v-bad',{abort:true});}catch{aborted=true;}return {aborted,version:await probe.read('versions','v-bad')??null,history:await probe.read('history','v-bad')??null,outbox:await probe.read('outbox','v-bad')??null,head:await probe.read('state','head')};});
        check(actual.aborted&&!actual.version&&!actual.history&&!actual.outbox&&actual.head==='v1','partial abort');return actual;
      });
      await test('X02-03','Page close before commit leaves only staging, recovery marks interrupted and does not resume',async()=>{
        await a.evaluate(()=>probe.stage('interrupted'));await a.close();a=await pageReady(context);const recovered=await a.evaluate(()=>probe.recover());check(recovered.head==='v1'&&recovered.interrupted.includes('interrupted')&&!recovered.resumed,'recovery');return recovered;
      });
      await test('X02-04','Close after transaction commit before UI acknowledgement restores committed v2 with outbox/history',async()=>{
        check(await a.evaluate(()=>probe.acquire()),'writer after dead page');await a.evaluate(()=>probe.commit('v2'));await a.close();a=await pageReady(context);
        const actual=await a.evaluate(async()=>({head:await probe.read('state','head'),version:await probe.read('versions','v2'),history:await probe.read('history','v2'),outbox:await probe.read('outbox','v2')}));check(actual.head==='v2'&&actual.version.complete&&actual.history.status==='succeeded'&&!actual.outbox.synced,'lost commit');return actual;
      });
      await test('X02-05','Handoff increments fence; old writer cannot commit after release',async()=>{
        check(await a.evaluate(()=>probe.acquire()),'writer missing');const oldFence=await a.evaluate(()=>probe.getFence());await a.evaluate(()=>probe.release());
        check(await b.evaluate(()=>probe.acquire()),'handoff failed');let rejected=false;try{await a.evaluate(f=>probe.commit('stale',{expectedFence:f}),oldFence);}catch(e){rejected=e.message.includes('WRITER_FENCE_LOST');}
        const newFence=await b.evaluate(()=>probe.getFence());check(rejected&&newFence>oldFence,'stale fence accepted');return {oldFence,newFence,rejected};
      });
      await test('X02-06','Account generation invalidation rejects late result; dirty local blocks other-owner switch',async()=>{
        await b.evaluate(()=>probe.logout());let generationRejected=false;try{await b.evaluate(()=>probe.commit('late',{expectedEpoch:0}));}catch(e){generationRejected=e.message.includes('GENERATION_MISMATCH');}
        let ownerSwitchBlocked=false;try{await b.evaluate(()=>probe.switchOwner());}catch(e){ownerSwitchBlocked=e.message.includes('ACCOUNT_SWITCH_BLOCKED_DIRTY');}
        check(generationRejected&&ownerSwitchBlocked,'owner/generation');return {generationRejected,ownerSwitchBlocked,scope:'prototype gate, not full authentication/logout UI'};
      });
      await test('X02-07','Sync gate and unsynced outbox survive page reload',async()=>{await a.evaluate(()=>probe.setGate());await a.reload();await a.waitForFunction(()=>globalThis.probe?.ready);const actual=await a.evaluate(async()=>({gate:await probe.read('state','syncGate'),outboxCount:(await probe.list('outbox')).length}));check(actual.gate==='awaitingUser'&&actual.outboxCount===2,'gate/outbox');return actual;});
      await test('X02-08','10 MiB IDB Blob and OPFS write/read hashes identical; byte orphan not published after page close',async()=>{
        const actual=await a.evaluate(()=>probe.storage(10*1024*1024));await a.close();a=await pageReady(context);const orphan=await a.evaluate(()=>probe.opfsOrphan());check(orphan.exists&&!orphan.published,'orphan published');return {...actual,orphan};
      });
      await test('X02-09','Browser-enforced small quota rejects real IndexedDB write and preserves head/outbox',async()=>{
        const cdp=await context.newCDPSession(a);
        try {
          await cdp.send('Storage.overrideQuotaForOrigin',{origin,quotaSize:1024});
          const cdpUsage=await cdp.send('Storage.getUsageAndQuota',{origin});
          const actual=await a.evaluate(async()=>{let name=null;try{await probe.put('staging','quota-real',new Blob([new Uint8Array(2*1024*1024)]));}catch(e){name=e.name;}return {name,head:await probe.read('state','head'),outboxCount:(await probe.list('outbox')).length,browserEstimate:await navigator.storage.estimate(),quotaOverrideBytes:1024,attemptedWriteBytes:2*1024*1024,physicalDiskExhausted:false};});
          check(actual.head==='v2'&&actual.outboxCount===2,'prior data changed');
          if(actual.name!=='QuotaExceededError')return {...actual,cdpUsage,inconclusive:true,reason:'Quota override did not induce the required browser error; no claim of actual quota-failure handling.'};
          return {...actual,cdpUsage};
        }finally{await cdp.send('Storage.overrideQuotaForOrigin',{origin});await cdp.detach();}
      });
      await test('X02-12','Actual renderer crash before commit releases writer and recovers incomplete staging without publishing it',async()=>{
        await b.evaluate(()=>probe.release());const crasher=await pageReady(context);check(await crasher.evaluate(()=>probe.acquire()),'crash writer unavailable');await crasher.evaluate(()=>probe.stage('renderer-crash'));
        const cdp=await context.newCDPSession(crasher);const crashed=crasher.waitForEvent('crash');cdp.send('Page.crash').catch(()=>{});await crashed;await crasher.close();
        check(await a.evaluate(()=>probe.acquire()),'dead renderer held lock');const actual=await a.evaluate(()=>probe.recover());check(actual.interrupted.includes('renderer-crash')&&actual.head==='v2'&&!actual.resumed,'crash recovery');return {...actual,actualRendererCrash:true,wholeBrowserProcessKilled:false};
      });
      await test('X02-10','SW update waits while pages are controlled and unsynced outbox remains',async()=>{
        await a.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});await a.reload();await a.waitForFunction(()=>globalThis.probe?.ready&&!!navigator.serviceWorker.controller);
        revision=2;await a.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
        // Poll the actual registration in one evaluation, rather than observing
        // an asynchronous predicate through the automation polling boundary.
        const actual=await a.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();const until=performance.now()+5000;while(!reg.waiting&&performance.now()<until)await new Promise(r=>setTimeout(r,25));return {waiting:!!reg.waiting,waitingState:reg.waiting?.state??null,installingState:reg.installing?.state??null,activeState:reg.active?.state??null,controlled:!!navigator.serviceWorker.controller,head:await probe.read('state','head'),outboxCount:(await probe.list('outbox')).length};});check(actual.waiting&&actual.head==='v2'&&actual.outboxCount===2,'SW/outbox '+JSON.stringify(actual));return actual;
      });
      await test('X02-11','Browser network disabled: cached shell/modules reload and existing local data remain usable',async()=>{
        await context.setOffline(true);await a.reload();await a.waitForFunction(()=>globalThis.probe?.ready);const actual=await a.evaluate(async()=>({offline:!navigator.onLine,head:await probe.read('state','head'),gate:await probe.read('state','syncGate'),outboxCount:(await probe.list('outbox')).length,controlled:!!navigator.serviceWorker.controller}));
        check(actual.offline&&actual.head==='v2'&&actual.gate==='awaitingUser'&&actual.outboxCount===2&&actual.controlled,'offline reload');await context.setOffline(false);return actual;
      });
      await a.evaluate(text=>document.querySelector('pre').textContent=text,JSON.stringify({browser:entry.channel,version:entry.version,x01:entry.x01.map(x=>({id:x.id,status:x.status})),x02:entry.x02.map(x=>({id:x.id,status:x.status})),scope:'synthetic local/dev; no production readiness'},null,2));
      await a.screenshot({path:path.join(evidence,`${channel}-summary.png`),fullPage:true});
      await context.close();
    }catch(e){entry.failure=e.stack;}finally{await browser?.close();}
    await writeFile(path.join(evidence,`${channel}-results.json`),JSON.stringify(entry,null,2));
  }
}finally{
  report.finishedAt=new Date().toISOString();report.serverRequests=serverRequests;
  await writeFile(path.join(evidence,'x01-x02-results.json'),JSON.stringify(report,null,2));
  await new Promise(r=>server.close(r));
}
const failures=report.node.x01.filter(x=>x.status==='failed').length+report.browsers.reduce((n,b)=>n+Number(!!b.failure)+[...b.x01,...b.x02].filter(x=>x.status==='failed').length,0);
const inconclusive=report.browsers.reduce((n,b)=>n+b.x02.filter(x=>x.status==='inconclusive').length,0);
console.log(JSON.stringify({evidence:'evidence/x01-x02-results.json',failures,inconclusive,browsers:report.browsers.map(b=>({channel:b.channel,version:b.version,x01:b.x01.length,x02:b.x02.length,failure:b.failure?.split('\n')[0]}))},null,2));
if(failures)process.exitCode=1;else if(inconclusive)process.exitCode=2;
