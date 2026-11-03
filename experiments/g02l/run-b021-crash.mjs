import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02l/evidence/b021-crash/'+runId,runtime=path.resolve('experiments/g02l/.runtime/b021-crash',runId);
await mkdir(out,{recursive:true});await mkdir(runtime,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),check=(v,m)=>{if(!v)throw Error(m);};
const bundle=await build({entryPoints:['experiments/g02l/b021-entry.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true}),bytes=bundle.outputFiles[0].contents;
const report={task:'B021',runId,environment:{node:process.version,os:os.platform()+' '+os.release()},method:'Real owned Chromium browser process crash via Browser.crash CDP, persistent disposable profile; same-origin local server retained across restart. No process matching/kill, profile deletion or system disk fill.',cases:[],cleanup:[]};
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/entry.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bytes);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/entry.mjs"></script>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;report.environment.origin=origin;
async function open(channel,profile) {const context=await chromium.launchPersistentContext(profile,{channel,headless:true,args:['--disable-background-networking']});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=context.pages()[0]??await context.newPage();await page.goto(origin);await page.waitForFunction(()=>!!globalThis.b021);return {context,page};}
try {
 for(const channel of ['chrome','msedge'])for(const phase of ['beforeMetadata','afterMarker']) {
  const profile=path.join(runtime,channel+'-'+phase);let context;
  try{
   let opened=await open(channel,profile);context=opened.context;const page=opened.page,version=context.browser().version();
   const state=await page.evaluate(async phase=>{
    const b=globalThis.b021,f=await b.setupB021(),a=await b.outputB021(f);await b.commitB021(f,a);
    const next=await b.outputB021(f,{source:a.version.versionId,value:5});await b.stageB021(f,next);
    if(phase==='afterMarker')await f.store.commit(next.snapshot.taskId,next.version);
    return {ownerId:f.ownerId,projectId:f.projectId,namespace:f.namespace,oldVersionId:a.version.versionId,newVersionId:next.version.versionId,taskId:next.snapshot.taskId,newCommitId:next.snapshot.commitId,mutationId:next.snapshot.mutationId,expectedHash:(await f.store.inspect('outbox',next.snapshot.mutationId))?.mutation.payloadHash??null};
   },phase);
   const browser=context.browser(),cdp=await browser.newBrowserCDPSession();
   let timer;const disconnected=new Promise((resolve,reject)=>{browser.once('disconnected',resolve);timer=setTimeout(()=>reject(Error('Owned browser did not crash')),12000);});
   cdp.send('Browser.crash').catch(()=>{});
   try{await disconnected;}finally{clearTimeout(timer);}
   context=null;opened=await open(channel,profile);context=opened.context;
   const actual=await opened.page.evaluate(async({state,phase})=>{
    const store=await globalThis.b021.LocalStore.open(state.ownerId,{namespace:state.namespace});
    try{
     const fence=await store.advanceWriter(state.projectId),recovery=await store.recover(state.projectId,fence.writerFence);
     const versions=await store.inspect('versions'),markers=await store.inspect('markers'),outbox=await store.inspect('outbox'),history=await store.inspect('history'),task=await store.inspect('tasks',state.taskId);
     const target=phase==='afterMarker'?state.newVersionId:state.oldVersionId,opened=await store.openVersion(target);
     const record=outbox.find(x=>x.id===state.mutationId),expected=phase==='afterMarker'?2:1;
     return {counts:{versions:versions.length,markers:markers.length,outbox:outbox.length,history:history.length},expectedCount:expected,taskStatus:task.status,recovery,opened:opened.status,newVersionPresent:versions.some(x=>x.id===state.newVersionId),hashStable:phase==='afterMarker'?record?.mutation.payloadHash===state.expectedHash:true,committedFlagExposedBeforeCrash:phase==='afterMarker'};
    }finally{store.close();}
   },{state,phase});
   check(Object.values(actual.counts).every(n=>n===actual.expectedCount),'Atomic recovery record counts');
   check(actual.opened==='ready'&&actual.hashStable,'Reopen and outbox hash');
   check(actual.taskStatus===(phase==='afterMarker'?'succeeded':'interrupted'),'Recovered task status');
   check(actual.newVersionPresent===(phase==='afterMarker'),'Incomplete output visibility');
   report.cases.push({id:'B021-real-crash-'+phase,browser:channel,version,status:'passed',expected:phase==='beforeMetadata'?'Staged bytes only; old output remains, running task interrupted, no new marker/outbox/version':'Strict metadata commit survives browser process crash; version/history/marker/outbox match, no task rerun',actual});
  }catch(e){report.cases.push({id:'B021-real-crash-'+phase,browser:channel,status:'failed',actual:e.message});}
  finally{if(context)await context.close();report.cleanup.push({browser:channel,phase,ownedContextClosed:true,profileRetained:profile});}
 }
}finally{await new Promise(r=>server.close(r));}
report.counts=Object.fromEntries(['passed','failed','blocked','inconclusive'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));
await writeFile(out+'/executed-bundle.mjs',bytes,{flag:'wx'});report.sources={};for(const p of [...Object.keys(bundle.metafile.inputs).filter(p=>!p.includes('node_modules/')),'experiments/g02l/run-b021-crash.mjs','packages/contracts/src/generated/build-manifest.json']){const b=await readFile(p);report.sources[p]=sha(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await inventory(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,counts:report.counts,failures:report.cases.filter(c=>c.status!=='passed')}));if(report.counts.failed)process.exitCode=1;
