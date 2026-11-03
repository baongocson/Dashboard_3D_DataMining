import {createRequire} from 'node:module';
import {chromium} from '../g01/node_modules/playwright/index.mjs';
import {MongoMemoryReplSet} from 'mongodb-memory-server-core';
import {MongoClient} from 'mongodb';
import {createServer} from 'node:https';
import {request as proxyRequest} from 'node:http';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../../apps/api/src/app.ts';
import {ConflictService} from '../../apps/api/src/sync/conflicts.ts';
import {fixture,dataset} from '../../tests/fixtures/b033-runtime.mjs';
import {batch} from '../../tests/fixtures/b033-contract.mjs';
import {password,nextVersion} from '../../tests/fixtures/b031.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
const {build}=createRequire(new URL('../g02l/package.json',import.meta.url))('esbuild');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const generated=await checkGenerated(),runId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02s/evidence/b033-browser/'+runId,runtime=path.resolve('experiments/g02s/.runtime/b033-browser',runId);
await mkdir(out,{recursive:true});await mkdir(path.join(runtime,'db'),{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),check=(v,m)=>{if(!v)throw Error(m);};
const sources=new Map();async function tree(dir){for(const f of await readdir(dir,{withFileTypes:true})){if(['node_modules','evidence','.runtime'].includes(f.name))continue;const p=path.join(dir,f.name);if(f.isDirectory())await tree(p);else sources.set(p,await readFile(p));}}
for(const dir of ['apps/api/src','apps/web/src/local','packages/contracts','packages/data-format','tests/fixtures'])await tree(dir);
for(const p of ['experiments/g02s/run-b033-browser.mjs','experiments/g02s/b033-browser-entry.ts','experiments/g02s/B033-plan.md','experiments/g02s/package.json','experiments/g02s/package-lock.json','apps/api/package.json','apps/api/package-lock.json','experiments/g02l/package.json','experiments/g02l/package-lock.json'])sources.set(p,await readFile(p));
const bundle=await build({entryPoints:['experiments/g02s/b033-browser-entry.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,metafile:true});
const report={task:'B033',phase:'fixtureBrowserRealLocalHTTP',runId,generated,environment:{node:process.version,mongodb:'8.0.34',TLS:'Owned self-signed loopback proxy; ignoreHTTPSErrors in retained fixture profiles only; no OS trust change.'},cases:[],externalRequests:[],pageErrors:[],cleanup:[],fullTaskAccepted:false,productAdapterEnabled:false,physicalDeletionExecuted:false,limits:['Only fixture transport, unchanged LocalStore/WriterCoordinator/SyncCoordinator and actual local server.','Explicit baseline fixture hydration from actual HTTP receipt/version/byte hashes, not local import commit/full offline readiness.','Synthetic data/FakeMail only; all browser profiles, DBs and bytes retained. No external services.']};
const warnings=[],stderr=process.stderr.write.bind(process.stderr);process.stderr.write=(chunk,...args)=>{warnings.push(String(chunk));return stderr(chunk,...args);};
let repl,client,proxy,apiOrigin,n=0;const apps=[];const selected=new Set(process.argv.slice(2).filter(x=>!x.startsWith('--browser='))),channels=process.argv.find(x=>x.startsWith('--browser='))?.slice(10).split(',')??['chrome','msedge'];
check(channels.every(c=>['chrome','msedge'].includes(c)),'Known installed browser channel required');
const serverBatch=(f,mutations,artifacts)=>({...batch(mutations,{artifacts}),serverGeneration:f.generation});
async function serverCommit(f,s){await f.sync.declare(f.token,s);const ack=await f.sync.commit(f.token,s.batchId,{serverGeneration:f.generation,mutationIds:s.mutations.map(m=>m.mutationId)},{requestId:'b033-browser-server-fixture'});check(ack.status==='committed','actual fixture server baseline');return ack;}
const state=page=>page.evaluate(()=>b033.summary());
const counts=async f=>({versions:await f.metadata.c.versions.countDocuments({}),identities:await f.metadata.c.identities.countDocuments({}),receipts:await f.sync.c.receipts.countDocuments({}),changes:await f.sync.c.changes.countDocuments({}),branches:await f.metadata.c.branches.countDocuments({}),conflicts:await f.sync.c.conflicts.countDocuments({}),retainedFiles:await f.storage.bytes.retainedFileCount()});
try{
 const key=path.join(runtime,'key.pem'),cert=path.join(runtime,'cert.pem'),cp=spawnSync('C:/msys64/ucrt64/bin/openssl.exe',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',key,'-out',cert,'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],{encoding:'utf8',windowsHide:true});if(cp.status!==0)throw Error('Scoped self-signed fixture certificate generation failed');
 report.environment.certificateSha256=sha(await readFile(cert));const binary=path.resolve('experiments/g01/.runtime/mongod-8.0.34.exe');report.environment.mongoBinarySha256=sha(await readFile(binary));
 repl=await MongoMemoryReplSet.create({binary:{systemBinary:binary,version:'8.0.34'},instanceOpts:[{dbPath:path.join(runtime,'db')}],replSet:{count:1,name:'b033browserrs',ip:'127.0.0.1',storageEngine:'wiredTiger'}});client=new MongoClient(repl.getUri());await client.connect();
 proxy=createServer({key:await readFile(key),cert:await readFile(cert)},(req,res)=>{
  if(req.url.startsWith('/api/v1/')){if(!apiOrigin){res.writeHead(503);res.end();return;}const upstream=proxyRequest(apiOrigin+req.url,{method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({fixtureProxyFailure:true}));});req.pipe(upstream);return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'");if(req.url==='/entry.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);}else if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>B033 local fixture</title><script type="module" src="/entry.mjs"></script>');}else{res.writeHead(404);res.end();}
 });await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const origin='https://127.0.0.1:'+proxy.address().port;report.environment.origin=origin;
 for(const channel of channels){let context;try{
  const profile=path.join(runtime,'profiles',channel);context=await chromium.launchPersistentContext(profile,{channel,headless:true,ignoreHTTPSErrors:true,args:['--disable-background-networking','--disable-component-update','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']});const version=context.browser()?.version()??await context.newPage().then(async p=>{const version=await p.evaluate(()=>navigator.userAgent);await p.close();return version;});
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin)await route.continue();else{report.externalRequests.push({browser:channel,origin:u.origin});await route.abort();}});
  async function test(id,fn){if(selected.size&&!selected.has(id))return;let page,f,input,app;try{
   f=await fixture(client,runtime,++n);f.config.origin=origin;const d=await dataset(f,{uploaded:true});await serverCommit(f,serverBatch(f,[d.m],d.artifacts));
   app=await createApp(f.auth,{metadata:f.metadata,storage:f.storage,localSync:{sync:f.sync,reconciliation:f.reconciliation,manifest:f.manifest,changefeed:f.changefeed,conflicts:new ConflictService(f.auth)}});apps.push(app);await app.listen({host:'127.0.0.1',port:0});apiOrigin=app.listeningOrigin;
   page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push({browser:channel,id,message:e.message}));await page.goto(origin);await page.waitForFunction(()=>!!globalThis.b033);
   input={ownerId:f.ownerId,projectId:f.projectId,datasetId:d.dataset.datasetId,versionId:d.version.versionId,branchId:d.version.branchId,serverGeneration:f.generation,namespace:'b033-browser-'+runId+'-'+n,email:'a@example.test',password,mutation:d.m,artifacts:d.artifacts};
   await page.evaluate(input=>b033.init(input),input);const cookie=(await context.cookies()).find(c=>c.name==='__Host-dashboard_session');check(cookie?.httpOnly&&cookie.secure&&cookie.sameSite==='Lax'&&cookie.path==='/','actual browser cookie security');check(await page.evaluate(()=>!document.cookie.includes('dashboard_session')&&isSecureContext&&!!navigator.locks),'browser HttpOnly and secure WebLocks');f.token=cookie.value;
   const actual=await fn({f,d,page,input,context});report.cases.push({id,browser:channel,version,status:'passed',actual});
  }catch(e){report.cases.push({id,browser:channel,version,status:'failed',actual:{code:e.code,message:e.stack??e.message}});}finally{
   if(page){await page.evaluate(async()=>{globalThis.b033ReleaseACK?.();await globalThis.b033Pending;await b033.dispose();}).catch(()=>{});await page.close();}if(app){await app.close();apps.splice(apps.indexOf(app),1);}apiOrigin=undefined;
  }console.log(JSON.stringify(report.cases.at(-1)));}
  await test('B033-browser-local-commit-ACK-new-members',async({f,page})=>{
   const a=await page.evaluate(()=>b033.addOutput({value:1})),b=await page.evaluate(()=>b033.addOutput({value:2})),before=await state(page),serverBefore=await counts(f);check(a.status==='localCommitted'&&b.status==='localCommitted'&&before.outbox.filter(o=>o.status==='pending').length===2&&serverBefore.versions===1,'local committed distinct from server synced');
   const first=await page.evaluate(()=>b033.run('user',{addAfterACK:true})),middle=await state(page);check(first.ok&&first.value.acknowledged===2&&middle.outbox.filter(o=>o.status==='pending').length===1&&middle.sync.sync!=='synced','real ACK excludes new local member');
   const last=await page.evaluate(()=>b033.run('user')),after=await state(page),server=await counts(f),newId=after.outbox.find(o=>o.id!==a.mutationId&&o.id!==b.mutationId&&o.mutation.kind==='dataset.version.create').mutation.entityId;
   check(last.ok&&after.outbox.every(o=>o.status==='acknowledged')&&after.sync.sync==='synced'&&after.sync.syncGate==='auto'&&server.versions===4&&server.receipts===4,'actual ACK application and gate');check((await page.evaluate(id=>b033.reopenVersion(id),newId)).status==='ready','new local committed bytes reopen');
   return {actualSecureBrowserCookies:true,actualIndexedDBKernelOutputs:3,localCommittedBeforeServer:true,actualUploadedBytes:after.metrics.uploadedBytes,actualACKsApplied:3,newMemberExcludedFromEarlierACK:true,serverCounts:server,clientSynced:true,gate:'auto',retainedLocalByteRecords:after.byteRecords};
  });
  await test('B033-browser-lost-response-reload-replay',async({f,page,input})=>{
   const local=await page.evaluate(()=>b033.addOutput()),before=await state(page),failed=await page.evaluate(()=>b033.run('user',{ignoreCommittedResponse:true})),committed=await counts(f);
   check(!failed.ok&&committed.versions===2&&(await state(page)).outbox.find(o=>o.id===local.mutationId).status==='pending','ignored real response retains pending');
   await page.evaluate(()=>b033.dispose());await page.reload();await page.waitForFunction(()=>!!globalThis.b033);await page.evaluate(input=>b033.resume(input),input);
   const recovered=await state(page);check(recovered.sync.syncGate==='awaitingUser'&&recovered.metrics.transportCalls===0,'reload never resends');
   await page.evaluate(()=>b033.report('healthy'));await page.evaluate(()=>b033.run('auto'));check((await state(page)).metrics.transportCalls===0,'auto gated');
   const replay=await page.evaluate(()=>b033.run('user')),after=await state(page),server=await counts(f);check(replay.ok&&server.versions===committed.versions&&server.receipts===committed.receipts&&after.outbox.find(o=>o.id===local.mutationId).status==='acknowledged','explicit replay applies stable receipt');
   check(after.outbox.find(o=>o.id===local.mutationId).mutation.payloadHash===before.outbox.find(o=>o.id===local.mutationId).mutation.payloadHash,'immutable hash');return {ignoredActualCommittedResponse:true,reloadAutoResend:false,stableReplay:true,server};
  });
  await test('B033-browser-partial-explicit-resume',async({f,page})=>{
   const a=await page.evaluate(()=>b033.addOutput()),b=await page.evaluate(()=>b033.addOutput({value:5}));
   const partial=await page.evaluate(ids=>b033.run('user',{skipArtifactIds:ids}),b.artifacts),middle=await state(page);check(partial.ok&&middle.outbox.find(o=>o.id===a.mutationId).status==='acknowledged'&&middle.outbox.find(o=>o.id===b.mutationId).status==='pending'&&middle.sync.syncGate==='awaitingUser','real missing-byte partial');
   const done=await page.evaluate(()=>b033.run('user')),after=await state(page);check(done.ok&&after.outbox.every(o=>o.status==='acknowledged')&&(await counts(f)).versions===3,'explicit upload resume');return {partialACK:true,explicitResume:true,retainedLocalBytes:after.byteRecords};
  });
  await test('B033-browser-real-head-conflict',async({f,d,page})=>{
   const local=await page.evaluate(()=>b033.addOutput()),before=await state(page),server=await nextVersion(f.projectId,d,d.version,d.m.mutationId);
   await serverCommit(f,serverBatch(f,[server.m],server.artifacts));
   const result=await page.evaluate(()=>b033.run('user')),after=await state(page),receipt=await f.sync.c.receipts.findOne({mutationId:local.mutationId}),branch=await f.metadata.c.branches.findOne({_id:d.version.branchId});
   check(result.ok&&receipt&&after.outbox.find(o=>o.id===local.mutationId).status==='acknowledged','conflict authoritative ACK');check(branch.headVersionId===server.version.versionId&&JSON.stringify(before.contexts)===JSON.stringify(after.contexts)&&JSON.stringify(before.branches)===JSON.stringify(after.branches),'no implicit pointer or head rebind');check((await counts(f)).conflicts===1,'actual conflict retained');return {actualConflict:true,serverHeadPreserved:true,clientPointersPreserved:true};
  });
  await test('B033-browser-logout-reauth-gate',async({page,input})=>{
   const local=await page.evaluate(()=>b033.addOutput()),before=await state(page);await page.evaluate(()=>b033.api('/auth/logout',{method:'POST',body:{}}));const failed=await page.evaluate(()=>b033.run('user')),held=await state(page);check(!failed.ok&&held.outbox.find(o=>o.id===local.mutationId).status==='pending'&&held.byteRecords===before.byteRecords,'logout retains local bytes');
   await page.evaluate(input=>b033.login(input),input);await page.evaluate(()=>b033.report('reauthenticated'));await page.evaluate(()=>b033.report('healthy'));const calls=(await state(page)).metrics.transportCalls;await page.evaluate(()=>b033.run('auto'));check((await state(page)).metrics.transportCalls===calls,'reauth no automatic resend');const done=await page.evaluate(()=>b033.run('user'));check(done.ok&&(await state(page)).outbox.every(o=>o.status==='acknowledged'),'explicit reauth sync');return {actualLogout:true,localPreserved:true,reauthAutoResend:false};
  });
  for(const fault of ['generation','deleted'])await test('B033-browser-hold-'+fault,async({f,d,page})=>{
   const local=await page.evaluate(()=>b033.addOutput()),before=await state(page),serverBefore=await counts(f);
   if(fault==='generation')await f.auth.c.control.updateOne({_id:'server'},{$set:{serverGeneration:randomUUID()}});else await f.metadata.c.tombstones.insertOne({_id:randomUUID(),ownerId:f.ownerId,entityId:d.dataset.datasetId,projectId:f.projectId});
   const result=await page.evaluate(()=>b033.run('user')),after=await state(page),server=await counts(f);check(after.outbox.find(o=>o.id===local.mutationId).status==='pending'&&after.byteRecords===before.byteRecords&&JSON.stringify(after.versions)===JSON.stringify(before.versions)&&server.versions===serverBefore.versions&&server.receipts===serverBefore.receipts,'fault retains immutable local work without server commit');check(after.sync.syncGate==='awaitingUser','fault never auto-opens gate');return {fault,injectedServerMetadataFault:true,result,localIDsAndBytesRetained:true,noNewReceipt:true,blockedDeletedUIApplied:false};
  });
  await test('B033-browser-late-ACK-closed',async({f,page})=>{
   const local=await page.evaluate(()=>b033.addOutput());await page.evaluate(()=>{globalThis.b033Pending=b033.run('user',{holdAfterACK:true});});await page.waitForFunction(()=>!!globalThis.b033HeldACK);check((await counts(f)).versions===2,'actual commit before held ACK');await page.evaluate(()=>b033.closeSync());await page.evaluate(()=>globalThis.b033ReleaseACK());const result=await page.evaluate(()=>globalThis.b033Pending),after=await state(page);check(!result.ok&&after.outbox.find(o=>o.id===local.mutationId).status==='pending','closed coordinator rejects late ACK');return {actualServerCommit:true,lateACKApplied:false,retainedLocalBytes:after.byteRecords};
  });
 }catch(e){report.cases.push({id:'B033-browser-harness',browser:channel,status:'failed',actual:{message:e.stack??e.message}});}finally{if(context)await context.close();report.cleanup.push({browser:channel,persistentProfileRetained:path.join(runtime,'profiles',channel)});}}
}catch(e){report.fatal=e.stack??e.message;}
finally{
 for(const app of apps)await app.close();if(proxy)await new Promise(r=>proxy.close(r));await client?.close();if(repl)await repl.stop({doCleanup:false,force:false});process.stderr.write=stderr;report.runtimeWarnings=warnings;report.gracefulMongoStopProven=!warnings.some(x=>x.includes('SIGKILL'));report.cleanup.push({ownedServersStopped:true,DBAndBytesRetained:runtime});report.counts=Object.fromEntries(['passed','failed'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));report.sources={};report.sourcesUnchangedDuringRun=true;
 for(const[p,b]of sources){report.sources[p.replaceAll('\\','/')]=sha(b);if(sha(await readFile(p))!==sha(b))report.sourcesUnchangedDuringRun=false;const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,b,{flag:'wx'});}await writeFile(out+'/executed-bundle.mjs',bundle.outputFiles[0].contents,{flag:'wx'});if(!report.sourcesUnchangedDuringRun)report.fatal='Source changed during execution';await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function scan(dir){for(const file of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,file.name);if(file.isDirectory())await scan(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await scan(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,counts:report.counts,fatal:report.fatal,externalRequests:report.externalRequests,pageErrors:report.pageErrors}));if(report.fatal||report.counts.failed||!report.counts.passed||report.externalRequests.length||report.pageErrors.length)process.exitCode=1;
}

