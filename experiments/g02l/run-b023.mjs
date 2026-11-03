import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
import {runB023Checks} from '../../tests/fixtures/b023.mjs';
await checkGenerated();const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02l/evidence/b023/'+runId;await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),bundle=await build({entryPoints:['experiments/g02l/b023-entry.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true});
const report={task:'B023',runId,environment:{node:process.version},cases:[],externalRequests:[],pageErrors:[],scope:'Pure estimator/preview/guard foundation with trusted synthetic estimator injection, no product operation enabled; offline mode tests loaded pure module, not SW reload'};
report.cases.push(...(await runB023Checks()).map(c=>({...c,runtime:'node'})));
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'");if(req.url==='/entry.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/entry.mjs"></script>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;report.environment.origin=origin;
try{for(const channel of ['chrome','msedge']){let browser;try{
 browser=await chromium.launch({channel,headless:true,args:['--disable-background-networking']});const context=await browser.newContext();
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();report.externalRequests.push(u.origin);return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push({browser:channel,message:e.message}));await page.goto(origin);await page.waitForFunction(()=>!!globalThis.runB023Checks);
 for(const mode of ['online','offline']){if(mode==='offline')await context.setOffline(true);const result=await page.evaluate(()=>globalThis.runB023Checks());report.cases.push(...result.map(c=>({...c,runtime:channel,version:browser.version(),mode})));}
 await context.close();
}catch(e){report.cases.push({id:'B023-harness',runtime:channel,status:'failed',actual:e.message});}finally{if(browser)await browser.close();}}}finally{await new Promise(r=>server.close(r));}
const fingerprints=report.cases.filter(c=>c.id==='B023-preview-permit'&&c.status==='passed').map(c=>c.actual.fingerprint);report.sharedFingerprint={observations:fingerprints.length,identical:new Set(fingerprints).size===1,sha256:fingerprints[0]};
if(fingerprints.length!==5||!report.sharedFingerprint.identical)report.cases.push({id:'B023-cross-runtime-fingerprint',status:'failed',actual:report.sharedFingerprint});
report.counts=Object.fromEntries(['passed','failed','blocked','inconclusive'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));report.sources={};
await writeFile(out+'/executed-bundle.mjs',bundle.outputFiles[0].contents,{flag:'wx'});
for(const p of new Set([...Object.keys(bundle.metafile.inputs).filter(p=>!p.includes('node_modules/')),'experiments/g02l/run-b023.mjs','packages/contracts/src/generated/build-manifest.json'])){const b=await readFile(p);report.sources[p]=hash(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=hash(await readFile(p));}}await inventory(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,counts:report.counts,sharedFingerprint:report.sharedFingerprint,failures:report.cases.filter(c=>c.status!=='passed'),pageErrors:report.pageErrors}));if(report.counts.failed)process.exitCode=1;
