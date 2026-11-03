import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02l/evidence/b024-crash/'+runId,runtime=path.resolve('experiments/g02l/.runtime/b024-crash',runId);await mkdir(out,{recursive:true});await mkdir(runtime,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),bundle=await build({entryPoints:['experiments/g02l/b024-entry.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true});
const report={task:'B024',runId,environment:{node:process.version},method:'Owned Browser.crash during held fake transport after durable snapshot/gate, persistent profile same origin; no real server commit/delivery or deduplication claim',cases:[],cleanup:[]};
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/entry.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/entry.mjs"></script>');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;report.environment.origin=origin;
async function launch(channel,profile){const context=await chromium.launchPersistentContext(profile,{channel,headless:true,args:['--disable-background-networking']});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=context.pages()[0]??await context.newPage();await page.goto(origin);await page.waitForFunction(()=>!!globalThis.b024);return {context,page};}
try{for(const channel of ['chrome','msedge']){
 const profile=path.join(runtime,channel);let context;
 try{
  let opened=await launch(channel,profile);context=opened.context;const version=context.browser().version();
  const before=await opened.page.evaluate(async()=>{
   globalThis.fixture=await b024.setupB024(1);let entered;const started=new Promise(r=>entered=r);
   globalThis.running=fixture.sync.sync('user',async d=>{globalThis.declaration=d;entered();return new Promise(()=>{});}).catch(()=>{});
   await started;const state=await fixture.store.inspect('state','sync'),locks=await navigator.locks.query();
   return {ownerId:fixture.ownerId,namespace:fixture.namespace,declaration,gateBeforeCrash:state.syncGate,activeBatchId:state.activeBatchId,syncLocksHeld:locks.held.filter(x=>x.name==='dashboard:sync-lock:'+fixture.ownerId).length};
  });
  const browser=context.browser(),cdp=await browser.newBrowserCDPSession();let timer;const disconnected=new Promise((r,j)=>{browser.once('disconnected',r);timer=setTimeout(()=>j(Error('Owned process did not crash')),12000);});cdp.send('Browser.crash').catch(()=>{});try{await disconnected;}finally{clearTimeout(timer);}context=null;
  opened=await launch(channel,profile);context=opened.context;
  const actual=await opened.page.evaluate(async before=>{
   const store=await b024.LocalStore.open(before.ownerId,{namespace:before.namespace}),sync=new b024.SyncCoordinator(store);
   try{
    const recovered=await sync.initialize({network:'online',server:'reachable',auth:'valid'});let calls=0;
    await sync.sync('auto',async d=>{calls++;return b024.fakeAck(d);});const autoCalls=calls;
    const result=await sync.sync('user',async d=>{calls++;if(d.mutations[0].mutationId!==before.declaration.mutations[0].mutationId||d.mutations[0].payloadHash!==before.declaration.mutations[0].payloadHash)throw Error('Mutation identity rewritten');return b024.fakeAck(d);});
    let staleOldAckRejected=false;try{await sync.applyAck(before.declaration.batchId,b024.fakeAck(before.declaration));}catch(e){staleOldAckRejected=e.code==='PREVIEW_STALE';}
    return {gateBeforeCrash:before.gateBeforeCrash,syncLocksHeldBeforeCrash:before.syncLocksHeld,recoveredGate:recovered.syncGate,recoveredSync:recovered.sync,activeBatchCleared:recovered.activeBatchId===null,autoTransportCalls:autoCalls,userTransportCalls:calls-autoCalls,resultStatus:result.status,finalGate:(await store.inspect('state','sync')).syncGate,outbox:(await store.inspect('outbox')).map(o=>o.status),oldSnapshotStatus:(await store.inspect('state','snapshot:'+before.declaration.batchId)).status,mutationIdentityStable:true,staleOldAckRejected,serverDeduplicationProof:false};
   }finally{await sync.quiesce();store.close();}
  },before);
  const passed=actual.gateBeforeCrash==='awaitingUser'&&actual.syncLocksHeldBeforeCrash===1&&actual.recoveredGate==='awaitingUser'&&actual.recoveredSync==='failed'&&actual.activeBatchCleared&&actual.autoTransportCalls===0&&actual.userTransportCalls===1&&actual.resultStatus==='committed'&&actual.finalGate==='auto'&&actual.outbox.every(s=>s==='acknowledged')&&actual.oldSnapshotStatus==='failed'&&actual.staleOldAckRejected;
  report.cases.push({id:'B024-real-sync-owner-crash',browser:channel,version,status:passed?'passed':'failed',expected:'Durable awaiting gate survives actual process death; recover only after sync lock absent, no auto replay, explicit retry same identity, stale old ACK ignored/rejected',actual});
 }catch(e){report.cases.push({id:'B024-real-sync-owner-crash',browser:channel,status:'failed',actual:e.message});}
 finally{if(context)await context.close();report.cleanup.push({browser:channel,ownedContextClosed:true,profileRetained:profile});}
}}finally{await new Promise(r=>server.close(r));}
report.counts=Object.fromEntries(['passed','failed','blocked','inconclusive'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));report.sources={};await writeFile(out+'/executed-bundle.mjs',bundle.outputFiles[0].contents,{flag:'wx'});
for(const p of new Set([...Object.keys(bundle.metafile.inputs).filter(p=>!p.includes('node_modules/')),'experiments/g02l/run-b024-crash.mjs','packages/contracts/src/generated/build-manifest.json'])){const b=await readFile(p);report.sources[p]=sha(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await inventory(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,counts:report.counts,failures:report.cases.filter(c=>c.status!=='passed')}));if(report.counts.failed)process.exitCode=1;
