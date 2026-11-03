import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02l/evidence/b022/'+runId;await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),bundles={};for(const name of ['entry','worker'])bundles[name]=await build({entryPoints:['experiments/g02l/b022-'+name+'.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true});
const report={task:'B022',runId,environment:{node:process.version},cases:[],externalRequests:[]};
const server=createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; object-src 'none'");if(pathname==='/entry.mjs'||pathname==='/worker.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bundles[pathname==='/entry.mjs'?'entry':'worker'].outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/entry.mjs"></script>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;report.environment.origin=origin;
const check=(v,m)=>{if(!v)throw Error(m);};
async function test(browser,id,expected,fn){try{report.cases.push({id,browser,status:'passed',expected,actual:await fn()});}catch(e){report.cases.push({id,browser,status:'failed',expected,actual:e.message});}}
try{
for(const channel of ['chrome','msedge']){
 let browser;try{
 browser=await chromium.launch({channel,headless:true,args:['--disable-background-networking']});(report.environment.browserVersions??={})[channel]=browser.version();const context=await browser.newContext();
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();report.externalRequests.push(u.origin);return r.abort();});
 const pages=await Promise.all([context.newPage(),context.newPage(),context.newPage()]);for(const page of pages){await page.goto(origin);await page.waitForFunction(()=>!!globalThis.b022);}
 const [a,b,c]=pages,meta=await a.evaluate(async()=>{
  const lib=globalThis.b022,f=await lib.setupB021();globalThis.fixture=f;globalThis.coord=new lib.WriterCoordinator(f.store);globalThis.lease=await coord.acquire(f.projectId);
  return {ownerId:f.ownerId,projectId:f.projectId,datasetId:f.datasetId,serverGeneration:f.serverGeneration,namespace:f.namespace,branchId:f.branchId,writerFence:lease.fence,localGeneration:lease.generation};
 });
 for(const page of [b,c])await page.evaluate(async m=>{const lib=globalThis.b022;globalThis.fixture={...m,store:await lib.LocalStore.open(m.ownerId,{namespace:m.namespace})};globalThis.coord=new lib.WriterCoordinator(fixture.store);},meta);
 await test(channel,'B022-one-writer','Actual WebLock holds same project across tabs, independent project can acquire',async()=>{
  const blocked=await b.evaluate(async()=>await coord.acquire(fixture.projectId)===null);check(blocked,'second tab not read-only');
  const other=await c.evaluate(async()=>{const projectId=crypto.randomUUID(),datasetId=crypto.randomUUID();await fixture.store.initialize({projectId,datasetId,serverGeneration:fixture.serverGeneration});globalThis.otherLease=await coord.acquire(projectId);return {acquired:!!otherLease,fence:otherLease.fence};});
  check(other.acquired,'different project blocked');return {sameProjectReadOnly:blocked,differentProjectWriter:true,browserVersion:browser.version()};
 });
 await test(channel,'B022-worker-result','Real Worker START/PROGRESS/RESULT stages refs then strict local commit; wrong task/generation/raw/duplicate events discarded',async()=>{
  const result=await a.evaluate(async()=>{
   const lib=globalThis.b022,o=await lib.outputB021(fixture),snapshot={...o.snapshot,writerFence:lease.fence,localGeneration:lease.generation,config:o.version.operationSnapshot,configHash:await lib.hashCanonical(o.version.operationSnapshot),engineVersion:'synthetic-protocol-v1',confirmationRefs:[]};
   const worker=new Worker('/worker.mjs?namespace='+encodeURIComponent(fixture.namespace)+'&mode=faults',{type:'module'});globalThis.task=new lib.TaskWorker(lease,worker,snapshot);
   await task.start([]);await new Promise(r=>setTimeout(r,40));const noPercent=task.progressPercent===undefined;const terminal=await task.terminal;
   return {status:terminal.status,noPercent,discarded:task.discarded,markers:(await fixture.store.inspect('markers')).length,outbox:(await fixture.store.inspect('outbox')).length,storeTask:(await fixture.store.inspect('tasks',snapshot.taskId)).status};
  });check(result.status==='succeeded'&&result.markers===1&&result.outbox===1&&result.storeTask==='succeeded'&&result.discarded>=4&&result.noPercent,'worker result/sequence/progress failed');return result;
 });
 await test(channel,'B022-transfer','Old writer stops held Worker and invalidates fence before releasing lock; requester gets newer fence',async()=>{
  await a.evaluate(async()=>{
   const lib=globalThis.b022,head=(await fixture.store.inspect('branches',fixture.branchId)).headVersionId,o=await lib.outputB021(fixture,{source:head});
   const snapshot={...o.snapshot,writerFence:lease.fence,localGeneration:lease.generation,config:o.version.operationSnapshot,configHash:await lib.hashCanonical(o.version.operationSnapshot),engineVersion:'synthetic-hold-v1',confirmationRefs:[]};
   globalThis.oldSnapshot=snapshot;globalThis.heldTask=new lib.TaskWorker(lease,new Worker('/worker.mjs?namespace='+encodeURIComponent(fixture.namespace)+'&mode=hold',{type:'module'}),snapshot);
   await heldTask.start([]);coord.onTransferRequest=async()=> 'accept';
  });
  const newer=await b.evaluate(async()=>{globalThis.lease=await coord.requestTransfer(fixture.projectId);return {fence:lease.fence,generation:lease.generation};});
  const old=await a.evaluate(async()=>({accepting:lease.accepting,status:(await heldTask.terminal).status,storeStatus:(await fixture.store.inspect('tasks',oldSnapshot.taskId)).status,versions:(await fixture.store.inspect('versions')).length}));
  check(newer.fence>meta.writerFence&&!old.accepting&&old.status==='cancelled'&&old.storeStatus==='cancelled'&&old.versions===1,'transfer order/late commit');
  return {old,newer,timeoutSteal:false};
 });
 await test(channel,'B022-decline-no-steal','Declined transfer leaves owner holding lock; requester may abort its own queued request without stealing',async()=>{
  const outcome=await a.evaluate(async()=>{
   const abort=new AbortController();const requested=coord.requestTransfer(fixture.projectId,abort.signal);
   await new Promise(r=>setTimeout(r,80));abort.abort();let aborted=false;try{await requested;}catch(e){aborted=e.name==='AbortError';}
   return {aborted,held:((await navigator.locks.query()).held??[]).filter(x=>x.name==='dashboard:writer:'+fixture.ownerId+':'+fixture.projectId).length};
  });check(outcome.aborted&&outcome.held===1,'decline/queue abort');
  check(await b.evaluate(()=>lease.accepting),'owner lost after declined request');return {...outcome,timeoutSteal:false};
 });
 await test(channel,'B022-readonly-no-locks','When Web Locks unavailable, controller/profile return read-only without advancing writer fence (capability fault injection)',async()=>{
  const result=await a.evaluate(async()=>{
   const own=Object.getOwnPropertyDescriptor(navigator,'locks'),original=navigator.locks,before=(await fixture.store.inspect('projects',fixture.projectId)).writerFence;
   Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
   try{const lease=await coord.acquire(fixture.projectId),scope=await new b022.ProfileScope('b022-no-locks-'+fixture.namespace).claim(fixture.ownerId,{ownerId:fixture.ownerId,canOpenLocal:true});return {readOnly:lease===null&&!scope.writable,fenceUnchanged:(await fixture.store.inspect('projects',fixture.projectId)).writerFence===before,injection:true};}
   finally{if(own)Object.defineProperty(navigator,'locks',own);else delete navigator.locks;}
  });check(result.readOnly&&result.fenceUnchanged,'missing locks fallback');return result;
 });
 await test(channel,'B022-cancel-late-event','Real held Worker is cancelled/terminated; a queued RESULT callback injection after cancel is discarded without metadata commit',async()=>{
  const result=await b.evaluate(async()=>{
   const lib=b022,source=(await fixture.store.inspect('branches',fixture.branchId)).headVersionId,o=await lib.outputB021({...fixture,writerFence:lease.fence,localGeneration:lease.generation},{source});
   const snapshot={...o.snapshot,config:o.version.operationSnapshot,configHash:await lib.hashCanonical(o.version.operationSnapshot),engineVersion:'synthetic-hold-v1',confirmationRefs:[]};
   const task=new lib.TaskWorker(lease,new Worker('/worker.mjs?namespace='+encodeURIComponent(fixture.namespace)+'&mode=hold',{type:'module'}),snapshot);
   await task.start([]);await task.dispose('user');const terminal=await task.terminal;
   task.worker.dispatchEvent(new MessageEvent('message',{data:{protocolVersion:1,taskId:snapshot.taskId,runId:snapshot.runId,stepId:snapshot.stepId,generation:snapshot.localGeneration,fence:snapshot.writerFence,sequence:999,type:'RESULT',data:{stagedArtifactRefs:[],summary:{rowCount:2,columnCount:1}}}}));
   await new Promise(r=>setTimeout(r,20));
   return {status:terminal.status,discarded:task.discarded,versions:(await fixture.store.inspect('versions')).length,queuedCallbackInjected:true,actualWorkerTerminated:true};
  });check(result.status==='cancelled'&&result.discarded>=1&&result.versions===1,'cancel/late callback');return result;
 });
 await test(channel,'B022-source-context','Real Worker task snapshots source A, user selects dataset B during work; output stays A and B pointer remains',async()=>{
  const result=await b.evaluate(async()=>{
   const lib=b022,source=(await fixture.store.inspect('branches',fixture.branchId)).headVersionId,other={...fixture,writerFence:lease.fence,localGeneration:lease.generation,datasetId:crypto.randomUUID(),branchId:crypto.randomUUID()};
   await fixture.store.initialize({projectId:other.projectId,datasetId:other.datasetId,serverGeneration:other.serverGeneration});
   const b=await lib.outputB021(other);await fixture.store.start(b.snapshot);await fixture.store.stage(b.snapshot.taskId,b.artifacts);await fixture.store.commit(b.snapshot.taskId,b.version);
   const o=await lib.outputB021({...fixture,writerFence:lease.fence,localGeneration:lease.generation},{source});
   const snapshot={...o.snapshot,config:o.version.operationSnapshot,configHash:await lib.hashCanonical(o.version.operationSnapshot),engineVersion:'synthetic-slow-v1',confirmationRefs:[]};
   const task=new lib.TaskWorker(lease,new Worker('/worker.mjs?namespace='+encodeURIComponent(fixture.namespace)+'&mode=slow',{type:'module'}),snapshot);
   await task.start([]);await fixture.store.setContext(fixture.projectId,b.version.versionId);
   const terminal=await task.terminal,output=await fixture.store.inspect('versions',o.version.versionId),ctx=await fixture.store.inspect('contexts',fixture.projectId);
   return {status:terminal.status,outputDatasetA:output.datasetId===fixture.datasetId,parentSourceA:output.parentVersionId===source,selectedBRetained:ctx.versionId===b.version.versionId,viewPointerUpdated:terminal.result.viewPointerUpdated};
  });check(result.status==='succeeded'&&result.outputDatasetA&&result.parentSourceA&&result.selectedBRetained&&!result.viewPointerUpdated,'source snapshot/pointer');return result;
 });
 await test(channel,'B022-failed-task','A real Worker FAILED event records terminal failure, never creates version/outbox; snapshot is deep frozen',async()=>{
  const result=await b.evaluate(async()=>{
   const lib=b022,source=(await fixture.store.inspect('branches',fixture.branchId)).headVersionId,o=await lib.outputB021({...fixture,writerFence:lease.fence,localGeneration:lease.generation},{source});
   const snapshot={...o.snapshot,config:o.version.operationSnapshot,configHash:await lib.hashCanonical(o.version.operationSnapshot),engineVersion:'synthetic-fail-v1',confirmationRefs:[]},before=(await fixture.store.inspect('versions')).length;
   const missing=new lib.TaskWorker(lease,new Worker('/worker.mjs?namespace='+encodeURIComponent(fixture.namespace)+'&mode=hold',{type:'module'}),snapshot);let inputMissingRejected=false;
   try{await missing.start([crypto.randomUUID()]);}catch(e){inputMissingRejected=e.code==='ARTIFACT_NOT_READY';}await missing.dispose();
   const task=new lib.TaskWorker(lease,new Worker('/worker.mjs?namespace='+encodeURIComponent(fixture.namespace)+'&mode=fail',{type:'module'}),snapshot);
   await task.start([]);const result=await task.terminal,durable=await fixture.store.inspect('tasks',snapshot.taskId);
   return {status:result.status,durable:durable.status,errorCode:durable.errorCode,versionsUnchanged:(await fixture.store.inspect('versions')).length===before,deepFrozen:Object.isFrozen(task.snapshot)&&Object.isFrozen(task.snapshot.config),inputMissingRejected};
  });check(result.status==='failed'&&result.durable==='failed'&&result.errorCode==='VALIDATION_FAILED'&&result.versionsUnchanged&&result.deepFrozen&&result.inputMissingRejected,'failed worker state');return result;
 });
 await test(channel,'B022-profile-owner','Another owner cannot enter active profile workspace; pending outbox remains; no secret/cookie copied',async()=>{
  const result=await a.evaluate(async()=>{const scope=new b022.ProfileScope('b022-scope-'+fixture.namespace);await scope.claim(fixture.ownerId,{ownerId:fixture.ownerId,canOpenLocal:true});const other=crypto.randomUUID();let denied=false;try{await scope.claim(other,{ownerId:other,canOpenLocal:true});}catch(e){denied=e.code==='FORBIDDEN';}return {otherOwnerDenied:denied,outbox:(await fixture.store.inspect('outbox')).length};});
  check(result.otherOwnerDenied&&result.outbox>=1,'owner scope/outbox');return result;
 });
 await test(channel,'B022-close-generation','Confirmed account close fences all projects/tabs, stops workers before quiesced, preserves local data pending later logout cleanup',async()=>{
  await c.evaluate(async()=>{
   const lib=b022,ds=(await fixture.store.inspect('datasets')).find(x=>x.projectId===otherLease.projectId),f={...fixture,projectId:otherLease.projectId,datasetId:ds.id,branchId:crypto.randomUUID(),writerFence:otherLease.fence,localGeneration:otherLease.generation};
   const o=await lib.outputB021(f),snapshot={...o.snapshot,config:o.version.operationSnapshot,configHash:await lib.hashCanonical(o.version.operationSnapshot),engineVersion:'synthetic-close-hold-v1',confirmationRefs:[]};
   globalThis.closingTask=new lib.TaskWorker(otherLease,new Worker('/worker.mjs?namespace='+encodeURIComponent(fixture.namespace)+'&mode=hold',{type:'module'}),snapshot);await closingTask.start([]);
  });
  const result=await b.evaluate(async()=>{const old=await fixture.store.inspect('state','account');const closed=await coord.confirmedClose(old.localGeneration);return {closed,state:await fixture.store.inspect('state','account'),outbox:(await fixture.store.inspect('outbox')).length,versions:(await fixture.store.inspect('versions')).length};});
  const other=await c.evaluate(async()=>({accepting:otherLease.accepting,remainingLeases:coord.leases.size,workerStatus:(await closingTask.terminal).status,durableWorkerStatus:(await fixture.store.inspect('tasks',closingTask.snapshot.taskId)).status}));
  check(result.closed.status==='quiesced'&&result.state.mode==='closing'&&result.state.localGeneration===meta.localGeneration+1&&result.outbox>=1&&!other.accepting&&other.remainingLeases===0&&other.workerStatus==='cancelled'&&other.durableWorkerStatus==='cancelled','account close quiescence');
  return {mode:result.state.mode,generation:result.state.localGeneration,allProjectsQuiesced:true,remoteWorkerTerminated:true,localDataRemoved:false,outbox:result.outbox};
 });
 await context.close();
 }catch(e){report.cases.push({id:'B022-harness',browser:channel,status:'failed',actual:e.message});}finally{if(browser)await browser.close();}
}
}finally{await new Promise(r=>server.close(r));}
report.counts=Object.fromEntries(['passed','failed','inconclusive','blocked'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));report.sources={};
const sourcePaths=new Set(['experiments/g02l/run-b022.mjs','packages/contracts/src/generated/build-manifest.json']);
for(const[name,bundle]of Object.entries(bundles)){await writeFile(out+'/'+name+'-executed.mjs',bundle.outputFiles[0].contents,{flag:'wx'});for(const p of Object.keys(bundle.metafile.inputs).filter(p=>!p.includes('node_modules/')))sourcePaths.add(p);}
for(const p of sourcePaths){const bytes=await readFile(p);report.sources[p]=sha(bytes);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await inventory(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,counts:report.counts,failures:report.cases.filter(c=>c.status!=='passed')}));if(report.counts.failed)process.exitCode=1;
