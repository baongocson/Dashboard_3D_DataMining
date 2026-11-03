import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02l/evidence/b021/'+runId;
await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),bundle=await build({entryPoints:['experiments/g02l/b021-entry.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true});
const worker=bundle.outputFiles[0].contents,report={task:'B021',runId,environment:{node:process.version,os:os.platform()+' '+os.release(),cpu:os.cpus()[0].model,esbuild:'0.28.2',playwright:'1.64.1'},cases:[],browserErrors:[],externalRequests:[],bundle:{bytes:worker.length,sha256:hash(worker),modules:Object.keys(bundle.metafile.inputs)},scope:'Synthetic local storage kernel; no UI/import/ML operations enabled; B022 actual writer controller still pending.'};
const shell='<!doctype html><meta charset="utf-8"><title>B021 kernel checks</title><h1>B021 · IndexedDB local kernel</h1><pre id="result">Running</pre><script type="module" src="/entry.mjs"></script>';
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'");if(req.url==='/entry.mjs'){res.setHeader('Content-Type','text/javascript');res.end(worker);}else if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(shell);}else{res.writeHead(404);res.end('missing');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;report.environment.origin=origin;
try {
 for(const channel of ['chrome','msedge']) {
  let browser;try{
   browser=await chromium.launch({channel,headless:true,args:['--disable-background-networking']});const context=await browser.newContext();
   await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===origin)await route.continue();else{report.externalRequests.push({browser:channel,origin:url.origin});await route.abort();}});
   const page=await context.newPage();page.on('pageerror',e=>report.browserErrors.push({browser:channel,message:e.message}));await page.goto(origin);await page.waitForFunction(()=>!!globalThis.b021);
   const result=await page.evaluate(()=>navigator.locks.request('b021-harness-owner-lock',{mode:'exclusive'},()=>globalThis.b021.runB021Checks()));
   report.cases.push(...result.map(c=>({...c,browser:channel,version:browser.version()})));
   const quota=await page.evaluate(async()=>{
    if(!navigator.storageBuckets)return {status:'inconclusive',actual:'StorageBuckets unavailable; native quota not inferred'};
    const bucket=await navigator.storageBuckets.open('b021-'+crypto.randomUUID(),{quota:1048576}),b=globalThis.b021;
    const f=await b.setupB021({factory:bucket.indexedDB}),a=await b.outputB021(f);try{
     await b.commitB021(f,a);const oldHead=await f.store.inspect('branches',f.branchId),next=await b.outputB021(f,{source:a.version.versionId});await f.store.start(next.snapshot);
     const bytes=new Uint8Array(2097152);for(let offset=0;offset<bytes.length;offset+=65536)crypto.getRandomValues(bytes.subarray(offset,offset+65536));
     const descriptor={artifactId:crypto.randomUUID(),purpose:'metrics',formatVersion:'json-v1',mediaType:'application/json',sizeBytes:bytes.length,sha256:await b.hashBytes(bytes),projectId:f.projectId,dependencyArtifactIds:[]};
     let error;try{await f.store.stage(next.snapshot.taskId,[{descriptor,bytes}]);}catch(e){error=e.name;}
     const preserved=(await f.store.inspect('branches',f.branchId)).headVersionId===oldHead.headVersionId&&(await f.store.inspect('versions')).length===1&&(await f.store.inspect('outbox')).length===1&&!await f.store.inspect('bytes',descriptor.artifactId);
     return {status:error==='QuotaExceededError'&&preserved?'passed':'failed',actual:{nativeError:error,attemptedBytes:bytes.length,bucketQuota:1048576,oldHeadVersionOutboxPreserved:preserved,physicalDiskFilled:false}};
    }finally{f.store.close();}
   });report.cases.push({id:'B021-native-quota',browser:channel,version:browser.version(),expected:'Native quota during stage keeps prior committed head/version/outbox and no incomplete byte',...quota});
   await page.evaluate(r=>{document.querySelector('#result').textContent=JSON.stringify(r,null,2);}, {runId,browser:channel,version:browser.version(),cases:report.cases.filter(c=>c.browser===channel)});
   await page.screenshot({path:out+'/'+channel+'.png',fullPage:true});await context.close();
  }catch(e){report.cases.push({id:'B021-browser-harness',browser:channel,status:'failed',actual:e.message});}
  finally{if(browser)await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
report.counts=Object.fromEntries(['passed','failed','blocked','inconclusive'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));
await writeFile(out+'/executed-bundle.mjs',worker,{flag:'wx'});await writeFile(out+'/metafile.json',JSON.stringify(bundle.metafile,null,2)+'\n',{flag:'wx'});
const sources=[...Object.keys(bundle.metafile.inputs).filter(p=>!p.includes('node_modules/')),'experiments/g02l/run-b021.mjs','packages/contracts/src/generated/build-manifest.json','docs/adr/ADR-B021-01-version-head.md'];report.sources={};
for(const p of new Set(sources)){const b=await readFile(p);report.sources[p]=hash(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=hash(await readFile(p));}}await inventory(out);
await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,counts:report.counts,failures:report.cases.filter(c=>c.status!=='passed'),browserErrors:report.browserErrors}));if(report.counts.failed)process.exitCode=1;
