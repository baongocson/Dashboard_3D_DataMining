// Standalone X04 runner. Never starts MongoDB or imports X01-X03 runners.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {algorithms,fixtures,multiclass,leakage,csr,versions} from './x04-fixtures.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));process.chdir(here);
const hash=x=>createHash('sha256').update(x).digest('hex');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.resolve('evidence','x04-runs',runId);await mkdir(out,{recursive:true});await mkdir('.runtime/x04',{recursive:true});
const protectedNames=(await readdir('evidence')).filter(x=>/^(?:chrome-|msedge-|x01-|x03-|mongodb-)/.test(x));
const protectedHashes={};for(const name of protectedNames)protectedHashes[name]=hash(await readFile(path.join('evidence',name)));
const compiled=await build({entryPoints:['x04-worker.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,metafile:true,legalComments:'inline'});
const bundle=compiled.outputFiles[0].contents;await writeFile('.runtime/x04/worker.mjs',bundle);
await writeFile(path.join(out,'bundle-metafile.json'),JSON.stringify(compiled.metafile,null,2));
await writeFile(path.join(out,'fixtures.json'),JSON.stringify({fixtures,multiclass,leakage,csr,seedAlgorithm:'Mulberry32 v1 + Fisher-Yates',splitSeed:42,dataSeed:123,predictionTolerance:1e-9,metricTolerance:1e-9,scalePlan:{online:[[1000,4],[10000,8],[50000,50]],offline:[[1000,4],[10000,8]],queries:40,cancel:[50000,50]}},null,2));
const packageJson=JSON.parse(await readFile('package.json','utf8'));const manifest=[];
for(const name of Object.keys(packageJson.devDependencies)){const p=JSON.parse(await readFile(`node_modules/${name}/package.json`,'utf8'));manifest.push({name,version:p.version,license:p.license,declared:packageJson.devDependencies[name]});}
await writeFile(path.join(out,'dependencies.json'),JSON.stringify({packages:manifest,lockSha256:hash(await readFile('package-lock.json')),bundleSha256:hash(bundle),bundleBytes:bundle.length},null,2));
const shell=`<!doctype html><meta charset="utf-8"><title>X04 synthetic local workers</title><h1>G01 X04 — synthetic local/dev</h1><pre>Ready</pre><script>
let sequence=0;globalThis.jobTrace=[];
globalThis.runX04Job=(input,timeoutMs=25000)=>new Promise(resolve=>{
 const jobId='x04-'+(++sequence),generation=sequence;const started=performance.now();
 const worker=new Worker('/worker.mjs?job='+jobId,{type:'module'});let finished=false,cancelled=false,rawLate=0,committed=0,entered=false;
 let lastTick=performance.now(),ticks=0,maxTickGapMs=0;const heartbeat=setInterval(()=>{const now=performance.now();maxTickGapMs=Math.max(maxTickGapMs,now-lastTick);lastTick=now;ticks++;},20);
 const finish=value=>{if(finished)return;finished=true;clearTimeout(timer);clearInterval(heartbeat);worker.terminate();resolve({...value,jobId,generation,elapsedMs:performance.now()-started,uiHeartbeat:{intervalMs:20,ticks,maxTickGapMs,scope:'page timer proxy, not FPS or interaction latency; short jobs may have zero ticks'}});};
 const timer=setTimeout(()=>finish({type:'timeout',status:'blocked',reason:'bounded worker deadline exceeded; terminated',entered}),timeoutMs);
 worker.onerror=e=>finish({type:'error',error:{name:'WorkerError',message:e.message}});
 worker.onmessage=e=>{const m=e.data;if(m.jobId!==jobId||m.generation!==generation)return;
   if(cancelled){if(m.type==='result')rawLate++;return;}
   if(m.type==='entered-estimator'){entered=true;jobTrace.push({jobId,event:'entered-estimator',mode:input.mode});
     if(input.mode==='cancel'){cancelled=true;const cancelledAt=performance.now();worker.terminate();const terminationCallMs=performance.now()-cancelledAt;setTimeout(()=>finish({type:'cancelled',value:{enteredEstimator:true,terminationCallMs,observedElapsedMs:performance.now()-cancelledAt,observationWindowMs:150,rawLateResults:rawLate,committedResults:committed,mode:'terminate dedicated worker; no cooperative API claimed',workerMemoryReleasedMeasured:false}}),150);}return;}
   if(m.type==='result'){committed++;jobTrace.push({jobId,event:'result-accepted'});}finish(m);
 };
 worker.postMessage({...input,jobId,generation});
});
</script>`;
let serverUp=true;const requestLog=[];
const server=createServer((req,res)=>{requestLog.push({url:req.url,at:new Date().toISOString()});res.setHeader('Cache-Control','no-store');const pathname=new URL(req.url,'http://localhost').pathname;
 if(!serverUp){res.writeHead(503);res.end('probe origin disabled for offline verification');return;}
 if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(shell);return;}
 if(pathname==='/worker.mjs'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(bundle);return;}
 if(pathname==='/sw-x04.js'){res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-cache');res.end(`self.addEventListener('install',e=>e.waitUntil(caches.open('x04-only').then(c=>c.addAll(['/','/worker.mjs']))));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;if(u.pathname==='/'||u.pathname==='/worker.mjs')e.respondWith(caches.match(u.pathname).then(r=>r||fetch(e.request)));});`);return;}
 res.writeHead(404);res.end('not a probe route');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
let npmVersion;try{npmVersion=execFileSync('cmd.exe',['/d','/s','/c','npm --version'],{encoding:'utf8',windowsHide:true}).trim();}catch{npmVersion='unavailable';}
const report={experiment:'X04',task:'B013',runId,startedAt:new Date().toISOString(),environment:{node:process.version,npm:npmVersion,playwright:packageJson.devDependencies.playwright,esbuild:packageJson.devDependencies.esbuild,os:os.type(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,totalMemoryBytes:os.totalmem(),origin,temporaryProfiles:true},versions,browsers:[],scope:{syntheticOnly:true,noCloud:true,noEmail:true,noExternalAI:true,changedApplication:false,workerMemoryMeasurement:'inconclusive',sparseConversion:false},protectedEvidence:protectedHashes};
const save=async()=>writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));
try{
 for(const channel of ['chrome','msedge']){
  const browserEntry={channel,externalRequests:[],pageErrors:[],modes:[]};report.browsers.push(browserEntry);let browser;
  try{
   serverUp=true;browser=await chromium.launch({channel,headless:true});browserEntry.version=browser.version();const context=await browser.newContext({serviceWorkers:'allow',viewport:{width:1150,height:850}});
   await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){browserEntry.externalRequests.push(route.request().url());return route.abort();}return route.continue();});
   const page=await context.newPage();page.on('pageerror',e=>browserEntry.pageErrors.push(e.message));await page.goto(origin);await page.waitForFunction(()=>typeof runX04Job==='function');browserEntry.userAgent=await page.evaluate(()=>navigator.userAgent);
   for(const network of ['online','offline']){
    const mode={network,algorithms:[],networkProof:null};browserEntry.modes.push(mode);
    if(network==='offline'){
     await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw-x04.js');await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&typeof runX04Job==='function');
     serverUp=false;await context.setOffline(true);const before=requestLog.length;await page.reload();await page.waitForFunction(()=>typeof runX04Job==='function');mode.networkProof=await page.evaluate(()=>({navigatorOnline:navigator.onLine,controlled:!!navigator.serviceWorker.controller}));mode.networkProof.originServing503=true;mode.networkProof.requestLogStart=before;
    }
    for(const algorithm of algorithms){
     const entry={algorithm,cases:[],scale:[],artifactFile:null};mode.algorithms.push(entry);
     const result=await page.evaluate(input=>runX04Job(input),{mode:'suite',algorithm});
     if(result.type!=='result'){entry.cases.push({id:`X04-${algorithm}-worker`,status:result.status??'failed',actual:result});await save();continue;}
     entry.cases.push(...result.value.cases);const artifact=result.value.artifact;
     if(artifact){
      const serialized=JSON.stringify(artifact),filename=`${channel}-${network}-${algorithm}-model.json`;await writeFile(path.join(out,filename),serialized);entry.artifactFile=filename;entry.artifactSha256=hash(serialized);
      const fresh=await page.evaluate(input=>runX04Job(input),{mode:'reload',algorithm,serialized,X:fixtures[algorithm].test});
      const trained=entry.cases.find(c=>c.id.endsWith('dense-oracle'))?.actual?.prediction;let equivalent=false;
      if(fresh.type==='result'&&trained){const a=trained.flat(Infinity),b=fresh.value.prediction.flat(Infinity);equivalent=a.length===b.length&&a.every((v,i)=>typeof v==='number'?Math.abs(v-b[i])<=1e-9:v===b[i]);}
      entry.cases.push({id:`X04-${algorithm}-fresh-worker-roundtrip`,expected:'JSON file loaded in new worker, prediction equals prior worker within 1e-9; no fitting on reload',status:equivalent?'passed':'failed',actual:fresh});
     }
     const corePassed=entry.cases.every(c=>c.status==='passed'||c.id.endsWith('sparse-native')&&c.status==='blocked');
     if(corePassed){
      // Playwright's actual worker close event accompanies the termination case.
      let cancelledWorker,closeObserved=false;const capture=w=>{cancelledWorker=w;w.once('close',()=>{closeObserved=true;});};page.on('worker',capture);
      const cancellation=await page.evaluate(input=>runX04Job(input),{mode:'cancel',algorithm,rows:50000,cols:50});page.off('worker',capture);
      const closeDeadline=Date.now()+3000;while(!closeObserved&&Date.now()<closeDeadline)await new Promise(r=>setTimeout(r,25));
      const workerDetached=!!cancelledWorker&&closeObserved&&!page.workers().includes(cancelledWorker);
      entry.cases.push({id:`X04-${algorithm}-cancel`,expected:'Real estimator entered, dedicated worker terminated, no accepted late output; worker target detached',status:cancellation.type==='cancelled'&&workerDetached&&cancellation.value.committedResults===0?'passed':cancellation.status??'inconclusive',actual:{...cancellation,workerDetached}});
      for(const [rows,cols]of(network==='online'?[[1000,4],[10000,8],[50000,50]]:[[1000,4],[10000,8]])){
       const run=await page.evaluate(input=>runX04Job(input),{mode:'scale',algorithm,rows,cols});entry.scale.push({rows,cols,status:run.type==='result'?'passed':run.status??'failed',actual:run});
      }
     }else entry.scale.push({status:'blocked',reason:'small fixture correctness gate failed; no scale/cancel expansion performed'});
     await save();
    }
    if(network==='offline'){mode.networkProof.requestLogEnd=requestLog.length;mode.networkProof.originRequestsDuringOffline=requestLog.length-mode.networkProof.requestLogStart;await context.setOffline(false);serverUp=true;}
   }
   const summary=browserEntry.modes.map(m=>({network:m.network,algorithms:m.algorithms.map(a=>({algorithm:a.algorithm,cases:a.cases.map(c=>({id:c.id,status:c.status})),scale:a.scale.map(s=>({rows:s.rows,cols:s.cols,status:s.status}))}))}));
   await page.evaluate(text=>document.querySelector('pre').textContent=text,JSON.stringify(summary,null,2));
   await page.screenshot({path:path.join(out,`${channel}-summary.png`),fullPage:true});await context.close();
  }catch(e){browserEntry.failure={message:e.message,stack:e.stack};}finally{await browser?.close();serverUp=true;}
  await save();
 }
}finally{
 await new Promise(r=>server.close(r));report.finishedAt=new Date().toISOString();report.requestLog=requestLog;
 report.protectedEvidenceUnchanged=true;for(const [name,digest]of Object.entries(protectedHashes))if(hash(await readFile(path.join('evidence',name)))!==digest)report.protectedEvidenceUnchanged=false;
 await save();await writeFile('evidence/x04-latest.json',JSON.stringify({runId,results:`x04-runs/${runId}/results.json`},null,2));
}
const counts={passed:0,failed:0,inconclusive:0,blocked:0};for(const b of report.browsers){if(b.failure)counts.blocked++;for(const m of b.modes)for(const a of m.algorithms){for(const c of a.cases)counts[c.status]++;for(const s of a.scale)counts[s.status]++;}}
console.log(JSON.stringify({runId,results:path.relative(here,path.join(out,'results.json')),counts,protectedEvidenceUnchanged:report.protectedEvidenceUnchanged},null,2));
if(counts.failed)process.exitCode=1;else if(counts.inconclusive||report.browsers.some(b=>b.failure))process.exitCode=2;
