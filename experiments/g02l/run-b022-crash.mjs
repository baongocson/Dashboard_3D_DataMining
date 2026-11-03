import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02l/evidence/b022-crash/'+runId,runtime=path.resolve('experiments/g02l/.runtime/b022-crash',runId);await mkdir(out,{recursive:true});await mkdir(runtime,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),bundles={};for(const name of ['entry','worker'])bundles[name]=await build({entryPoints:['experiments/g02l/b022-'+name+'.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true});
const report={task:'B022',runId,environment:{node:process.version},method:'Owned Browser.crash while WebLock and dedicated Worker held; persistent synthetic profile reopened at same origin; no process name kill/profile deletion',cases:[],cleanup:[]};
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');if(p==='/entry.mjs'||p==='/worker.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bundles[p==='/entry.mjs'?'entry':'worker'].outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><script type="module" src="/entry.mjs"></script>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;report.environment.origin=origin;
async function launch(channel,profile){const context=await chromium.launchPersistentContext(profile,{channel,headless:true,args:['--disable-background-networking']});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=context.pages()[0]??await context.newPage();await page.goto(origin);await page.waitForFunction(()=>!!globalThis.b022);return {context,page};}
try{
for(const channel of ['chrome','msedge']){
 const profile=path.join(runtime,channel);let context;
 try{
  let opened=await launch(channel,profile);context=opened.context;const version=context.browser().version();
  const state=await opened.page.evaluate(async()=>{
   const lib=b022,f=await lib.setupB021(),coord=new lib.WriterCoordinator(f.store),lease=await coord.acquire(f.projectId);
   const a=await lib.outputB021({...f,writerFence:lease.fence,localGeneration:lease.generation});
   const build=async(o)=>({...o.snapshot,config:o.version.operationSnapshot,configHash:await lib.hashCanonical(o.version.operationSnapshot),engineVersion:'synthetic-crash-v1',confirmationRefs:[]});
   const first=new lib.TaskWorker(lease,new Worker('/worker.mjs?namespace='+encodeURIComponent(f.namespace),{type:'module'}),await build(a));await first.start([]);const complete=await first.terminal;if(complete.status!=='succeeded')throw Error('Baseline Worker did not commit');
   const next=await lib.outputB021({...f,writerFence:lease.fence,localGeneration:lease.generation},{source:a.version.versionId}),snapshot=await build(next);
   globalThis.heldTask=new lib.TaskWorker(lease,new Worker('/worker.mjs?namespace='+encodeURIComponent(f.namespace)+'&mode=hold',{type:'module'}),snapshot);await heldTask.start([]);
   const locks=await navigator.locks.query(),held=locks.held.filter(x=>x.name==='dashboard:writer:'+f.ownerId+':'+f.projectId).length;
   return {ownerId:f.ownerId,projectId:f.projectId,namespace:f.namespace,oldFence:lease.fence,taskId:snapshot.taskId,snapshot,heldBeforeCrash:held};
  });
  const browser=context.browser(),cdp=await browser.newBrowserCDPSession();let timer;
  const disconnected=new Promise((r,j)=>{browser.once('disconnected',r);timer=setTimeout(()=>j(Error('Owned browser crash timeout')),12000);});cdp.send('Browser.crash').catch(()=>{});try{await disconnected;}finally{clearTimeout(timer);}context=null;
  opened=await launch(channel,profile);context=opened.context;
  const actual=await opened.page.evaluate(async state=>{
   const lib=b022,store=await lib.LocalStore.open(state.ownerId,{namespace:state.namespace}),coord=new lib.WriterCoordinator(store),lease=await coord.acquire(state.projectId);
   const task=await store.inspect('tasks',state.taskId),versions=await store.inspect('versions'),outbox=await store.inspect('outbox');
   const w=new Worker('/worker.mjs?namespace='+encodeURIComponent(state.namespace)+'&mode=hold',{type:'module'});let staleRejected=false;
   try{new lib.TaskWorker(lease,w,state.snapshot);}catch(e){staleRejected=e.code==='WRITER_FENCE_LOST';}finally{w.terminate();}
   const locks=await navigator.locks.query(),held=locks.held.filter(x=>x.name==='dashboard:writer:'+state.ownerId+':'+state.projectId).length;
   const result={newFence:lease.fence,oldFence:state.oldFence,taskStatus:task.status,versions:versions.length,outbox:outbox.length,staleWorkerRejected:staleRejected,heldBeforeCrash:state.heldBeforeCrash,heldAfterRecovery:held,autoResume:false};
   await coord.dispose();store.close();return result;
  },state);
  const passed=actual.newFence>actual.oldFence&&actual.taskStatus==='interrupted'&&actual.versions===1&&actual.outbox===1&&actual.staleWorkerRejected&&actual.heldBeforeCrash===1&&actual.heldAfterRecovery===1;
  report.cases.push({id:'B022-real-owner-crash',browser:channel,version,status:passed?'passed':'failed',expected:'Actual held WebLock dies with process; new lease increases fence, interrupted task not resumed, old worker snapshot rejected, prior output/outbox retained',actual});
 }catch(e){report.cases.push({id:'B022-real-owner-crash',browser:channel,status:'failed',actual:e.message});}
 finally{if(context)await context.close();report.cleanup.push({browser:channel,profileRetained:profile,ownedContextClosed:true});}
}
}finally{await new Promise(r=>server.close(r));}
report.counts=Object.fromEntries(['passed','failed','inconclusive','blocked'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));report.sources={};const sourcePaths=new Set(['experiments/g02l/run-b022-crash.mjs','packages/contracts/src/generated/build-manifest.json']);
for(const[name,bundle]of Object.entries(bundles)){await writeFile(out+'/'+name+'-executed.mjs',bundle.outputFiles[0].contents,{flag:'wx'});for(const p of Object.keys(bundle.metafile.inputs).filter(p=>!p.includes('node_modules/')))sourcePaths.add(p);}
for(const p of sourcePaths){const b=await readFile(p);report.sources[p]=sha(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await inventory(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,counts:report.counts,failures:report.cases.filter(c=>c.status!=='passed')}));if(report.counts.failed)process.exitCode=1;
