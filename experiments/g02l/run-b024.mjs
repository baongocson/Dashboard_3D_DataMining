import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02l/evidence/b024/'+runId;await mkdir(out,{recursive:true});const sha=b=>createHash('sha256').update(b).digest('hex');
const bundle=await build({entryPoints:['experiments/g02l/b024-entry.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true}),report={task:'B024',runId,environment:{node:process.version},cases:[],externalRequests:[],pageErrors:[],scope:'Client local gate/snapshot/ACK with fake transport; no HTTP server commit/receipt deduplication proof or product operation enabled'};
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'");if(req.url==='/entry.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/entry.mjs"></script>');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;report.environment.origin=origin;
try{for(const channel of ['chrome','msedge']){let browser;try{
 browser=await chromium.launch({channel,headless:true,args:['--disable-background-networking']});const context=await browser.newContext();
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();report.externalRequests.push(u.origin);return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push({browser:channel,message:e.message}));await page.goto(origin);await page.waitForFunction(()=>!!globalThis.b024);
 const cases=await page.evaluate(()=>globalThis.b024.runB024Checks());report.cases.push(...cases.map(c=>({...c,browser:channel,version:browser.version()})));
 let secondPage;
 try{
  const meta=await page.evaluate(async()=>{
   globalThis.multi=await b024.setupB024(1);let entered;const started=new Promise(r=>entered=r),hold=new Promise(r=>globalThis.releaseSync=r);
   globalThis.multiRun=multi.sync.sync('user',async d=>{globalThis.multiDeclaration=d;entered();await hold;return b024.fakeAck(d);}).then(value=>({ok:true,value}),e=>({ok:false,code:e.code}));
   await started;return {ownerId:multi.ownerId,namespace:multi.namespace,batchId:multiDeclaration.batchId};
  });
  secondPage=await context.newPage();await secondPage.goto(origin);await secondPage.waitForFunction(()=>!!globalThis.b024);
  const second=await secondPage.evaluate(async meta=>{
   globalThis.multiStore=await b024.LocalStore.open(meta.ownerId,{namespace:meta.namespace});globalThis.multiSync=new b024.SyncCoordinator(multiStore);await multiSync.initialize({network:'online',server:'reachable',auth:'valid'});
   let calls=0;const result=await multiSync.sync('user',async d=>{calls++;return b024.fakeAck(d);}),state=await multiStore.inspect('state','sync'),locks=await navigator.locks.query();
   await multiSync.report('offline');return {status:result.status,transportCalls:calls,activeNotRecoveredWhileLive:state.activeBatchId===meta.batchId,syncLocksHeld:locks.held.filter(x=>x.name==='dashboard:sync-lock:'+meta.ownerId).length};
  },meta);
  await page.evaluate(()=>releaseSync());const original=await page.evaluate(()=>multiRun);
  await secondPage.evaluate(()=>{multiSync.close();multiStore.close();});await secondPage.reload();await secondPage.waitForFunction(()=>!!globalThis.b024);
  await secondPage.evaluate(async meta=>{globalThis.multiStore=await b024.LocalStore.open(meta.ownerId,{namespace:meta.namespace});globalThis.multiSync=new b024.SyncCoordinator(multiStore);await multiSync.initialize({network:'online',server:'reachable',auth:'valid'});},meta);
  const empty=await secondPage.evaluate(async()=>{await multiSync.report('healthy');let calls=0;const r=await multiSync.sync('user',async d=>{calls++;return b024.fakeAck(d);});return {status:r.status,calls,gate:(await multiStore.inspect('state','sync')).syncGate};});
  await page.evaluate(async()=>{const o=await b024.outputB021(multi,{source:multi.outputs[0].version.versionId});await multi.lease.run(()=>b024.commitB021(multi,o));});
  const last=await secondPage.evaluate(async()=>{let calls=0;await multiSync.sync('auto',async d=>{calls++;return b024.fakeAck(d);});const autoCalls=calls,r=await multiSync.sync('user',async d=>{calls++;return b024.fakeAck(d);});return {autoCalls,totalCalls:calls,status:r.status,gate:r.syncGate,outbox:(await multiStore.inspect('outbox')).map(o=>o.status)};});
  const passed=second.status==='busy'&&second.transportCalls===0&&second.activeNotRecoveredWhileLive&&second.syncLocksHeld===1&&original.ok&&original.value.syncGate==='awaitingUser'&&empty.gate==='awaitingUser'&&empty.calls===0&&last.autoCalls===0&&last.totalCalls===1&&last.gate==='auto'&&last.outbox.every(s=>s==='acknowledged');
  report.cases.push({id:'B024-two-tab-coordinator',browser:channel,version:browser.version(),status:passed?'passed':'failed',expected:'One actual account sync lock independent of project writer; second tab sees busy, cannot recover live owner; durable outage survives actual reload/healthy/empty and needs explicit user retry',actual:{second,original,empty,last,actualReloadWithEmptyPending:true}});
 }catch(e){report.cases.push({id:'B024-two-tab-coordinator',browser:channel,status:'failed',actual:e.message});}
 finally{await page.evaluate(async()=>{if(globalThis.releaseSync)releaseSync();if(globalThis.multiRun)await multiRun;if(globalThis.multi)await b024.disposeB024(multi);}).catch(()=>{});if(secondPage){await secondPage.evaluate(()=>{globalThis.multiSync?.close();globalThis.multiStore?.close();}).catch(()=>{});await secondPage.close();}}
 await context.close();
}catch(e){report.cases.push({id:'B024-harness',browser:channel,status:'failed',actual:e.message});}finally{if(browser)await browser.close();}}}finally{await new Promise(r=>server.close(r));}
report.counts=Object.fromEntries(['passed','failed','inconclusive','blocked'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));report.sources={};await writeFile(out+'/executed-bundle.mjs',bundle.outputFiles[0].contents,{flag:'wx'});
for(const p of new Set([...Object.keys(bundle.metafile.inputs).filter(p=>!p.includes('node_modules/')),'experiments/g02l/run-b024.mjs','packages/contracts/src/generated/build-manifest.json'])){const b=await readFile(p);report.sources[p]=sha(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await inventory(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,counts:report.counts,failures:report.cases.filter(c=>c.status!=='passed'),pageErrors:report.pageErrors}));if(report.counts.failed)process.exitCode=1;
