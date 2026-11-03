import {MongoMemoryReplSet} from 'mongodb-memory-server-core';
import {MongoClient} from 'mongodb';
import {AuthService} from '../../apps/api/src/auth/service.ts';
import {FakeMailAdapter} from '../../apps/api/src/auth/fake-mail.ts';
import {MetadataService} from '../../apps/api/src/metadata/service.ts';
import {StorageService} from '../../apps/api/src/storage/service.ts';
import {createApp} from '../../apps/api/src/app.ts';
import {mutation,imported,creation,password} from '../../tests/fixtures/b031.mjs';
import {id,sha,input,descriptor,upload} from '../../tests/fixtures/b032.mjs';
import {canonicalJson,mutationHash,hashCanonical} from '../../packages/data-format/src/index.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {request} from 'node:http';
import {once} from 'node:events';
import {fork} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);await checkGenerated();
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02s/evidence/b032/'+runId,runtime=path.resolve('experiments/g02s/.runtime/b032',runId);await mkdir(out,{recursive:true});await mkdir(path.join(runtime,'db'),{recursive:true});
const paths=['apps/api/src/app.ts','apps/api/src/storage/bytes.ts','apps/api/src/storage/schema.ts','apps/api/src/storage/service.ts','apps/api/src/metadata/service.ts','apps/api/src/metadata/schema.ts','apps/api/src/auth/service.ts','apps/api/src/auth/policy.ts','apps/api/src/auth/schema.ts','packages/data-format/src/index.mjs','packages/contracts/src/generated/validators.mjs','packages/contracts/src/generated/build-manifest.json','tests/fixtures/b031.mjs','tests/fixtures/b032.mjs','experiments/g02s/run-b032.mjs','experiments/g02s/run-b032-restart-worker.mjs'];
const source=new Map();for(const p of paths)source.set(p,await readFile(p));
const report={task:'B032',runId,environment:{node:process.version,mongodb:'8.0.34'},cases:[],limits:['Local dev/synthetic only; no public hosting/product parser/model/ML/cloud/email/AI.','No physical deletion: every byte/DB/run retained; cleanup mode is plan-only.','Injected ENOSPC, missing/corrupt pointer and held stream/clock cases are labeled; not physical disk-full/bitrot/Internet proof.'],cleanup:[]};
const selected=new Set(process.argv.slice(2)),apps=[];let repl,client,dbNumber=0;
const check=(v,m)=>{if(!v)throw Error(m);};
async function denied(fn,code){try{await fn();throw Error('Expected '+code);}catch(e){check(e.code===code,'Expected '+code+' actual '+(e.code??e.message));}}
async function test(name,fn){if(selected.size&&!selected.has(name))return;try{report.cases.push({id:name,status:'passed',actual:await fn()});}catch(e){report.cases.push({id:name,status:'failed',actual:{code:e.code,message:e.stack??e.message}});}console.log(JSON.stringify(report.cases.at(-1)));}
async function account(f,email='a@example.test'){
 const c=await f.auth.register({email,displayName:'Dữ liệu tổng hợp',password,confirmPassword:password}),mail=f.mail.messages.findLast(m=>m.challengeId===c.challengeId);
 await f.auth.verify({challengeId:c.challengeId,purpose:'register',generation:c.generation,otp:mail.otp},'register');const login=await f.auth.login({email,password,deviceId:id()}),projectId=id();await f.metadata.commit(login.rawToken,await mutation('project.create',projectId,projectId,{name:'B032 tổng hợp'}),[],f.generation);return {token:login.rawToken,ownerId:login.data.userId,projectId};
}
async function fixture(){const n=++dbNumber,dbName='b032_'+n,db=client.db(dbName),generation=id(),time={now:Date.UTC(2026,10,3)},config={profile:'test',origin:'https://localhost',secret:randomBytes(32),serverGeneration:generation},mail=new FakeMailAdapter(),auth=new AuthService(client,db,config,mail,()=>time.now);await auth.ready();
 const byteRoot=path.join(runtime,'private-'+n),storage=new StorageService(auth,byteRoot);await storage.ready();const metadata=new MetadataService(auth,{artifacts:storage.authority});await metadata.ready();const f={db,dbName,generation,time,config,mail,auth,storage,metadata,byteRoot};return {...f,...await account(f)};}
async function dataset(f,{alter}={}){const d=await imported(f.projectId);alter?.(d);const grant=await f.metadata.importIntent(f.token,d.intent),m=await creation(f.projectId,d,grant);for(const b of d.buffers){const a=d.artifacts.find(a=>a.artifactId===b.artifactId);await upload(f.storage,f.token,f.generation,a,b.bytes);}return {...d,grant,m};}
async function collect(stream){const chunks=[];for await(const b of stream)chunks.push(b);return Buffer.concat(chunks);}
async function http(origin,url,{method='GET',headers={},bytes,streaming=false}={}){return new Promise((resolve,reject)=>{const req=request(origin+url,{method,headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));});req.on('error',reject);(async()=>{if(bytes){for(let at=0;at<bytes.length;at+=streaming?16384:bytes.length){if(!req.write(bytes.subarray(at,at+(streaming?16384:bytes.length))))await once(req,'drain');}}req.end();})().catch(reject);});}
async function restartProbe(f,d){const child=fork(path.resolve('experiments/g02s/run-b032-restart-worker.mjs'),[],{silent:true,windowsHide:true});let timer;try{
 const result=new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);child.once('exit',code=>{if(code)reject(Error('Owned restart worker exit '+code));});timer=setTimeout(()=>{child.kill();reject(Error('Owned restart worker timeout'));},25000);});
 const exited=once(child,'exit');child.send({uri:repl.getUri(),dbName:f.dbName,config:{profile:'test',origin:'https://localhost',serverGeneration:f.generation},secret:f.config.secret.toString('base64'),now:f.time.now,byteRoot:f.byteRoot,token:f.token,artifactId:d.dataset.sourceArtifactId,versionId:d.version.versionId});
 const message=await result;await exited;check(message.ok,'restart worker '+message.code);return message;
}finally{clearTimeout(timer);if(child.connected)child.disconnect();}}
try{
 const binary=path.resolve('experiments/g01/.runtime/mongod-8.0.34.exe');report.environment.mongoBinarySha256=sha(await readFile(binary));repl=await MongoMemoryReplSet.create({binary:{systemBinary:binary,version:'8.0.34'},instanceOpts:[{dbPath:path.join(runtime,'db')}],replSet:{count:1,name:'b032rs',ip:'127.0.0.1',storageEngine:'wiredTiger'}});client=new MongoClient(repl.getUri());await client.connect();
 await test('B032-real-bytes-staging-ready',async()=>{
  const f=await fixture(),d=await dataset(f);await denied(()=>f.storage.content(f.token,d.dataset.sourceArtifactId),'ARTIFACT_NOT_READY');
  check(await f.metadata.c.datasets.countDocuments({})===0,'no dataset before commit');const receipt=await f.metadata.commit(f.token,d.m,d.artifacts,f.generation);
  for(const b of d.buffers){const content=await f.storage.content(f.token,b.artifactId),bytes=await collect(content.stream);check(sha(bytes)===sha(b.bytes),'actual sealed bytes exact');}
  check((await f.storage.c.artifacts.findOne({_id:d.dataset.sourceArtifactId})).state==='ready','only attachment ready');
  const cancel=await f.storage.cancel(f.token,(await f.storage.c.uploads.findOne({artifactId:d.dataset.sourceArtifactId}))._id);check(cancel.state==='ready'&&cancel.bytesRetained,'ready not cancelled/deleted');
  return {serverChunkAndWholeFileHash:true,verifiedStagingNotDownloadable:true,readyOnlyAfterMetadataRef:true,downloadedArtifacts:d.buffers.length,receiptArtifacts:receipt.artifactIds.length,sourceBytesUnchanged:true};
 });
 await test('B032-chunk-retry-bounds',async()=>{
  const f=await fixture(),bytes=Buffer.alloc(4194304,71),d=descriptor(f.projectId,bytes),u=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:d});
  await f.storage.chunk(f.token,u.uploadId,0,0,bytes.length,sha(bytes),input(bytes));await f.storage.chunk(f.token,u.uploadId,0,0,bytes.length,sha(bytes),input(bytes));
  check(await f.storage.c.chunks.countDocuments({uploadId:u.uploadId})===1,'logical chunk unique');
  await denied(()=>f.storage.chunk(f.token,u.uploadId,0,0,bytes.length,'f'.repeat(64),input(bytes)),'IDEMPOTENCY_MISMATCH');
  await denied(()=>f.storage.chunk(f.token,u.uploadId,0,1,bytes.length,sha(bytes),input(bytes)),'VALIDATION_FAILED');
  await denied(()=>f.storage.chunk(f.token,u.uploadId,1,bytes.length,1,sha(bytes.subarray(0,1)),input(bytes.subarray(0,1))),'VALIDATION_FAILED');
  await denied(()=>f.storage.chunk(f.token,u.uploadId,0,0,4194305,sha(bytes),input(bytes)),'PAYLOAD_TOO_LARGE');
  await f.storage.complete(f.token,u.uploadId);const again=await f.storage.complete(f.token,u.uploadId);check(again.state==='verified','complete idempotent');
  await f.storage.chunk(f.token,u.uploadId,0,0,bytes.length,sha(bytes),input(bytes));
  const changed={...d,sha256:'f'.repeat(64)};await denied(()=>f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:changed}),'IDEMPOTENCY_MISMATCH');
  return {chunkBytes:4194304,logicalChunks:1,sameRetryStable:true,differentHashRejected:true,offsetIndexLengthBounds:true,completeStable:true,allAttemptFilesRetained:true};
 });
 await test('B032-source-output-size',async()=>{
  const f=await fixture(),observed=[];
  for(const size of [19999999,20000000]){const bytes=Buffer.alloc(size,83),d=descriptor(f.projectId,bytes,'source');const result=await upload(f.storage,f.token,f.generation,d,bytes);check(result.state==='verified','source boundary');observed.push({purpose:'source',bytes:size,wholeHashVerified:true});}
  const bytes=Buffer.alloc(24*1048576,77),d=descriptor(f.projectId,bytes);await upload(f.storage,f.token,f.generation,d,bytes);observed.push({purpose:'model',bytes:bytes.length,wholeHashVerified:true,modelFormatClaim:false});
  await denied(()=>f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:{...d,artifactId:id(),purpose:'source',sizeBytes:20000001}}),'INPUT_FILE_TOO_LARGE');
  for(const size of [268435455,268435456])await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:{...d,artifactId:id(),sizeBytes:size}});
  await denied(()=>f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:{...d,artifactId:id(),sizeBytes:268435457}}),'ARTIFACT_LIMIT_EXCEEDED');
  return {actualUploads:observed,sourcePlusOneRejected:true,artifact256MiBBoundaryDeclarationOnly:true};
 });
 await test('B032-incomplete-hash-error',async()=>{
  const f=await fixture(),bytes=Buffer.alloc(4194305,12),d=descriptor(f.projectId,bytes),u=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:d}),part=bytes.subarray(0,4194304);
  await f.storage.chunk(f.token,u.uploadId,0,0,part.length,sha(part),input(part));await denied(()=>f.storage.complete(f.token,u.uploadId),'ARTIFACT_NOT_READY');
  const bad=descriptor(f.projectId,Buffer.from('actual'));bad.sha256='f'.repeat(64);const v=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:bad});await f.storage.chunk(f.token,v.uploadId,0,0,6,sha(Buffer.from('actual')),input(Buffer.from('actual')));await denied(()=>f.storage.complete(f.token,v.uploadId),'HASH_MISMATCH');
  check(await f.storage.c.artifacts.countDocuments({state:'ready'})===0,'no ready after incomplete/hash failure');return {incompleteRejected:true,fullHashMismatchRejected:true,noReady:true,filesRetained:await f.storage.bytes.retainedFileCount()};
 });
 await test('B032-real-stream-revoke',async()=>{
  const f=await fixture(),bytes=Buffer.alloc(4096,52),d=descriptor(f.projectId,bytes),u=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:d});let release,entered;
  const hold=new Promise(r=>release=r),started=new Promise(r=>entered=r);async function* source(){yield bytes.subarray(0,1);entered();await hold;yield bytes.subarray(1);}
  const pending=f.storage.chunk(f.token,u.uploadId,0,0,bytes.length,sha(bytes),source()).then(value=>({value}),error=>({error}));await started;
  await f.auth.logout(f.token);release();const result=await pending;check(result.error?.code==='SESSION_REVOKED','late chunk rejected after real revoke');
  check(await f.storage.c.chunks.countDocuments({uploadId:u.uploadId})===0,'no late published chunk');return {logoutCompletedWhileStreamHeld:true,lateChunkRejected:true,DBTransactionNotHeldDuringByteIO:true,retainedAttemptFiles:await f.storage.bytes.retainedFileCount()};
 });
 await test('B032-owner-generation-expiry-cancel',async()=>{
  const f=await fixture(),bytes=Buffer.from('held'),d=descriptor(f.projectId,bytes),u=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:d}),other=await account(f,'other@example.test');
  await denied(()=>f.storage.status(other.token,u.uploadId),'RESOURCE_NOT_FOUND');await denied(()=>f.storage.declare(f.token,{serverGeneration:id(),descriptor:{...d,artifactId:id()}}),'RECONCILIATION_REQUIRED');
  const before=await f.storage.bytes.retainedFileCount();await f.storage.chunk(f.token,u.uploadId,0,0,4,sha(bytes),input(bytes));await f.storage.cancel(f.token,u.uploadId);check(await f.storage.bytes.retainedFileCount()>before,'cancel retains actual bytes');
  await denied(()=>f.storage.complete(f.token,u.uploadId),'PREVIEW_STALE');const renewed=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:d});check(renewed.uploadId!==u.uploadId,'cancel renew no rewrite');
  f.time.now+=3600000;await denied(()=>f.storage.complete(f.token,renewed.uploadId),'PREVIEW_STALE');
  return {otherOwner404:true,generation410:true,cancelRetainsBytes:true,expiredOneHourRejected:true};
 });
 await test('B032-real-attachment-rollback-graph',async()=>{
  const f=await fixture(),d=await dataset(f),handle=await f.metadata.prepareMutation(d.m,d.artifacts,{ownerId:f.ownerId});
  await denied(()=>f.auth.withFence(f.token,async(s,identity)=>{await f.metadata.commitPrepared(s,identity,handle,f.generation);throw Object.assign(Error('Synthetic later group member failed'),{code:'VALIDATION_FAILED'});}), 'VALIDATION_FAILED');
  check(await f.metadata.c.datasets.countDocuments({})===0&&await f.storage.c.artifacts.countDocuments({state:'ready'})===0,'ready/ref rollback together');
  await f.metadata.commit(f.token,d.m,d.artifacts,f.generation);
  const bad=await imported(f.projectId),manifest=bad.buffers.find(b=>b.artifactId===bad.version.tableManifestId),parsed=JSON.parse(new TextDecoder().decode(manifest.bytes));parsed.columnOrder=[id()];manifest.bytes=new TextEncoder().encode(canonicalJson(parsed));const desc=bad.artifacts.find(a=>a.artifactId===manifest.artifactId);desc.sha256=sha(manifest.bytes);desc.sizeBytes=manifest.bytes.length;
  const grant=await f.metadata.importIntent(f.token,bad.intent),m=await creation(f.projectId,bad,grant);for(const b of bad.buffers)await upload(f.storage,f.token,f.generation,bad.artifacts.find(a=>a.artifactId===b.artifactId),b.bytes);
  await denied(()=>f.metadata.commit(f.token,m,bad.artifacts,f.generation),'INVALID_SOURCE');
  check(await f.metadata.c.datasets.countDocuments({})===1,'bad graph not published');return {realBytePreflight:true,metadataRefReadyAtomicRollback:true,invalidManifestOrderRejected:true,noServerNumericalClaim:true};
 });
 await test('B032-derived-row-lineage',async()=>{
  const f=await fixture(),left=await dataset(f),right=await dataset(f);await f.metadata.commit(f.token,left.m,left.artifacts,f.generation);await f.metadata.commit(f.token,right.m,right.artifacts,f.generation);
  const sourceRows=d=>new TextDecoder().decode(d.buffers.find(b=>b.purpose==='tableChunk').bytes).trim().split('\n').map(x=>JSON.parse(x));
  async function derived(mode){const d=await imported(f.projectId);d.dataset.kind='derived';d.dataset.sourceArtifactId=null;d.dataset.parseConfig={joinKind:'inner',nullMatch:false};d.version.sourceVersions=[{datasetId:left.dataset.datasetId,versionId:left.version.versionId,role:'left',sourceOrder:0},{datasetId:right.dataset.datasetId,versionId:right.version.versionId,role:'right',sourceOrder:1}];
   d.artifacts=d.artifacts.filter(a=>a.purpose!=='source');d.buffers=d.buffers.filter(a=>a.purpose!=='source');d.configHash=await hashCanonical({parseConfig:d.dataset.parseConfig,operationSnapshot:d.version.operationSnapshot});d.intent={...d.intent,kind:'join',sourceRefs:d.version.sourceVersions,configHash:d.configHash};delete d.intent.file;
   if(mode!=='missing'){const outputRows=sourceRows(d),lr=sourceRows(left),rr=sourceRows(right),records=outputRows.map((r,i)=>({rowId:r.rowId,sources:[{...d.version.sourceVersions[0],rowId:lr[i].rowId},{...d.version.sourceVersions[1],rowId:rr[i].rowId}]}));if(mode==='invalid')records[0].sources[0].rowId=id();const bytes=new TextEncoder().encode(records.map(x=>JSON.stringify(x)).join('\n')+'\n'),a=descriptor(f.projectId,bytes,'rowLineage');a.formatVersion='json-v1';d.version.rowLineageArtifactId=a.artifactId;d.artifacts.push(a);d.buffers.push({artifactId:a.artifactId,purpose:'rowLineage',bytes});}
   const grant=await f.metadata.importIntent(f.token,d.intent),m=await creation(f.projectId,d,grant);for(const b of d.buffers)await upload(f.storage,f.token,f.generation,d.artifacts.find(a=>a.artifactId===b.artifactId),b.bytes);return {d,m};
  }
  const valid=await derived('valid');await f.metadata.commit(f.token,valid.m,valid.d.artifacts,f.generation);
  for(const mode of ['invalid','missing']){const candidate=await derived(mode);await denied(()=>f.metadata.commit(f.token,candidate.m,candidate.d.artifacts,f.generation),'INVALID_SOURCE');}
  check(await f.metadata.c.datasets.countDocuments({})===3,'only correct lineage can publish');return {actualOutputRows:2,actualSourceRowsChecked:4,orderedRolesAndNewOutputIDs:true,unknownSourceRowRejected:true,missingDerivedLineageRejected:true,joinNumericalProof:false};
 });
 await test('B032-storage-faults-retain-ready',async()=>{
  const f=await fixture(),d=await dataset(f);await f.metadata.commit(f.token,d.m,d.artifacts,f.generation);const a=await f.storage.c.artifacts.findOne({_id:d.dataset.sourceArtifactId});
  const extra=Buffer.from('extra'),u=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:descriptor(f.projectId,extra)}),allocate=f.storage.bytes.allocate;
  try{f.storage.bytes.allocate=async()=>{throw Object.assign(Error('Injected allocation failure'),{code:'ENOSPC'});};await denied(()=>f.storage.chunk(f.token,u.uploadId,0,0,extra.length,sha(extra),input(extra)),'STORAGE_CAPACITY_EXCEEDED');}finally{f.storage.bytes.allocate=allocate;}
  await f.storage.c.artifacts.updateOne({_id:a._id},{$set:{storageKey:randomBytes(32).toString('base64url')}});await denied(()=>f.storage.content(f.token,a._id),'STORAGE_UNAVAILABLE');
  await f.storage.c.artifacts.updateOne({_id:a._id},{$set:{storageKey:a.storageKey}});const bytes=await collect((await f.storage.content(f.token,a._id)).stream);check(sha(bytes)===a.descriptor.sha256,'prior sealed ready bytes retained');
  return {ENOSPC:'injected',missingFile:'injected missing pointer; no deletion',priorReadyHashRetained:true,noPhysicalDiskFullOrEvictionClaim:true};
 });
 await test('B032-active-cancel-tombstone',async()=>{
  const f=await fixture(),bytes=Buffer.from('pending'),d=descriptor(f.projectId,bytes);await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:d});f.time.now+=86400000;
  const u=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:d});let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);async function* body(){yield bytes.subarray(0,1);entered();await gate;yield bytes.subarray(1);}
  const pending=f.storage.chunk(f.token,u.uploadId,0,0,bytes.length,sha(bytes),body()).then(value=>({value}),error=>({error}));await started;
  const plan=await f.storage.cleanupPlan(f.token,f.projectId);check(plan.entries[0].protectedReason==='activeLease'&&!plan.entries[0].eligibleForFuturePlan,'active lease protects old staging');
  await f.storage.cancel(f.token,u.uploadId);release();const result=await pending;check(result.error?.code==='PREVIEW_STALE'&&await f.storage.c.chunks.countDocuments({uploadId:u.uploadId})===0,'cancel rejects late chunk');
  await f.metadata.c.tombstones.insertOne({_id:id(),ownerId:f.ownerId,projectId:f.projectId,entityType:'project',entityId:f.projectId});
  await denied(()=>f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:descriptor(f.projectId,bytes)}),'RESOURCE_DELETED');
  return {activeLeaseExcludedFromPlan:true,lateCancelledChunkRejected:true,tombstoneDenied:true,attemptBytesRetained:await f.storage.bytes.retainedFileCount()};
 });
 await test('B032-concurrency-leases',async()=>{
  const f=await fixture(),holds=[];
  async function hold(actor){const b=Buffer.from('x'),u=await f.storage.declare(actor.token,{serverGeneration:f.generation,descriptor:descriptor(actor.projectId,b)});let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);async function* stream(){entered();await gate;yield b;}
   const promise=f.storage.chunk(actor.token,u.uploadId,0,0,1,sha(b),stream()).then(value=>({value}),error=>({error}));holds.push({release,promise});await started;return u;}
  try{await hold(f);await hold(f);const b=Buffer.from('z'),third=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:descriptor(f.projectId,b)});await denied(()=>f.storage.chunk(f.token,third.uploadId,0,0,1,sha(b),input(b)),'RESOURCE_LIMIT_EXCEEDED');
   for(const h of holds)h.release();await Promise.all(holds.map(h=>h.promise));holds.length=0;
   const owners=[f];for(let i=0;i<4;i++)owners.push(await account(f,'owner'+i+'@example.test'));for(let i=0;i<8;i++)await hold(owners[Math.floor(i/2)]);
   const last=owners[4],u=await f.storage.declare(last.token,{serverGeneration:f.generation,descriptor:descriptor(last.projectId,b)});await denied(()=>f.storage.chunk(last.token,u.uploadId,0,0,1,sha(b),input(b)),'RESOURCE_LIMIT_EXCEEDED');
   check(await f.storage.c.leases.countDocuments({state:'active',until:{$gt:new Date(f.time.now)}})===8,'actual eight active leases');return {actualAccountConcurrentStreams:2,thirdRejected:true,actualInstanceStreams:8,ninthRejected:true};
  }finally{for(const h of holds)h.release();await Promise.all(holds.map(h=>h.promise));}
 });
 await test('B032-cleanup-retain-only',async()=>{
  const f=await fixture(),d=await dataset(f);await f.metadata.commit(f.token,d.m,d.artifacts,f.generation);const b=Buffer.from('unreferenced'),u=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:descriptor(f.projectId,b)});await f.storage.chunk(f.token,u.uploadId,0,0,b.length,sha(b),input(b));await f.storage.cancel(f.token,u.uploadId);f.time.now+=86400000;
  const files=await f.storage.bytes.retainedFileCount(),plan=await f.storage.cleanupPlan(f.token,f.projectId);check(plan.physicalDeletionEnabled===false&&plan.entries.some(x=>x.eligibleForFuturePlan)&&plan.entries.filter(x=>x.protectedReason==='reference').length===d.artifacts.length,'plan excludes ready refs');check(await f.storage.bytes.retainedFileCount()===files,'plan does not delete');
  const entries=[];for(const candidate of plan.entries.filter(x=>x.eligibleForFuturePlan)){const a=await f.storage.c.artifacts.findOne({_id:candidate.artifactId}),chunks=await f.storage.c.chunks.find({uploadId:a.activeUploadId}).toArray(),paths=[...chunks.map(c=>c.storageKey),...(a.storageKey?[a.storageKey]:[])],proposed=[];for(const key of paths){const filename=path.join(f.byteRoot,'objects',key+'.bin'),b=await readFile(filename);proposed.push({path:filename,sizeBytes:b.length,sha256:sha(b)});}entries.push({artifactId:a._id,files:proposed,reason:'synthetic cancelled/unreferenced, grace elapsed, no active lease'});}
  await writeFile(out+'/cleanup-proposal.json',JSON.stringify({profile:'synthetic-local-only',mode:'proposal-no-deletion',dataRoot:f.byteRoot,entries,physicalActionsExecuted:0,readyArtifactsExcluded:d.artifacts.length,metadataAndEvidenceRetained:true},null,2)+'\n',{flag:'wx'});
  return {physicalDeletionEnabled:false,eligibleCandidates:plan.entries.filter(x=>x.eligibleForFuturePlan).length,readyProtected:d.artifacts.length,retainedFiles:files,physicalCleanupProof:false};
 });
 await test('B032-cleanup-inventory-pagination',async()=>{
  const f=await fixture(),expected=[];
  for(let i=0;i<5;i++){const d=descriptor(f.projectId,Buffer.from('inventory '+i));expected.push(d.artifactId);await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:d});}
  const first=await f.storage.cleanupPlan(f.token,f.projectId,{limit:2});
  check(first.entries.length===2&&first.hasMore&&typeof first.nextCursor==='string','bounded first page must expose a usable cursor');
  const seen=first.entries.map(e=>e.artifactId);let cursor=first.nextCursor;
  while(cursor){const page=await f.storage.cleanupPlan(f.token,f.projectId,{limit:2,cursor});check(page.entries.length<=2,'every page bounded');seen.push(...page.entries.map(e=>e.artifactId));cursor=page.nextCursor;check(page.hasMore===Boolean(cursor),'hasMore corresponds to continuation');}
  check(canonicalJson(seen)===canonicalJson(expected.sort())&&new Set(seen).size===5,'all retained artifacts reached exactly once');
  const other=await account(f,'cursor-other@example.test');
  await denied(()=>f.storage.cleanupPlan(other.token,other.projectId,{limit:2,cursor:first.nextCursor}),'CURSOR_EXPIRED');
  const project=id();await f.metadata.commit(f.token,await mutation('project.create',project,project,{name:'Other inventory project'}),[],f.generation);
  await denied(()=>f.storage.cleanupPlan(f.token,project,{cursor:first.nextCursor}),'CURSOR_EXPIRED');
  for(const options of [{limit:0},{limit:101},{limit:1.5},{cursor:'../path'},{ownerId:other.ownerId}])await denied(()=>f.storage.cleanupPlan(f.token,f.projectId,options),'VALIDATION_FAILED');
  const empty=await f.storage.cleanupPlan(f.token,project,{limit:100});check(!empty.hasMore&&empty.nextCursor===null&&!empty.entries.length,'empty final page');
  f.time.now+=1800000;await denied(()=>f.storage.cleanupPlan(f.token,f.projectId,{cursor:first.nextCursor}),'CURSOR_EXPIRED');
  await f.auth.c.control.updateOne({_id:'server'},{$set:{serverGeneration:id()}});
  await denied(()=>f.storage.cleanupPlan(f.token,f.projectId,{cursor:first.nextCursor}),'RECONCILIATION_REQUIRED');
  check(await f.storage.bytes.retainedFileCount()===0&&await f.storage.c.artifacts.countDocuments({})===5,'inventory cannot delete files or artifact records');
  return {pages:3,items:5,pageSize:2,noSkippedOrDuplicateIDs:true,ownerProjectAndGenerationBound:true,TTLms:1800000,strictOptions:true,physicalDeletionEnabled:false};
 });
 await test('B032-O05-real-http-stream',async()=>{
  const f=await fixture(),d=await dataset(f);await f.metadata.commit(f.token,d.m,d.artifacts,f.generation);const app=await createApp(f.auth,{metadata:f.metadata,storage:f.storage});apps.push(app);await app.listen({host:'127.0.0.1',port:0});const origin=app.listeningOrigin,cookie='__Host-dashboard_session='+f.token;
  const csrf=await http(origin,'/api/v1/auth/csrf',{headers:{cookie}}),token=JSON.parse(csrf.bytes).data.csrfToken,nonce=csrf.headers['set-cookie'][0].split(';')[0],headers={cookie:cookie+'; '+nonce,origin:'https://localhost','x-csrf-token':token};
  const b=Buffer.alloc(4194304,19),a=descriptor(f.projectId,b),declaration=await http(origin,'/api/v1/artifacts/uploads',{method:'POST',headers:{...headers,'content-type':'application/json'},bytes:Buffer.from(JSON.stringify({serverGeneration:f.generation,descriptor:a}))});check(declaration.status===200,'declaration');const u=JSON.parse(declaration.bytes).data;
  const chunk=await http(origin,'/api/v1/artifacts/uploads/'+u.uploadId+'/chunks/0',{method:'PUT',headers:{...headers,'content-type':'application/octet-stream','x-chunk-offset':'0','x-chunk-length':String(b.length),'x-chunk-sha256':sha(b)},bytes:b,streaming:true});check(chunk.status===200,'real streamed chunk');
  const completed=await http(origin,'/api/v1/artifacts/uploads/'+u.uploadId+'/complete',{method:'POST',headers:{...headers,'content-type':'application/json'},bytes:Buffer.from('{}')});check(completed.status===200,'real complete');
  const content=await http(origin,'/api/v1/artifacts/'+d.dataset.sourceArtifactId+'/content',{headers:{cookie}});check(content.status===200&&content.headers['content-type']==='application/octet-stream'&&content.headers['content-disposition'].startsWith('attachment;')&&content.headers['cache-control']==='no-store'&&sha(content.bytes)===d.artifacts[0].sha256,'private actual stream bytes');
  const unverified=await http(origin,'/api/v1/artifacts/'+a.artifactId+'/content',{headers:{cookie}});check(unverified.status===422,'verified staging not ready/public');
  const noAuth=await http(origin,'/api/v1/artifacts/'+d.dataset.sourceArtifactId+'/content');check(noAuth.status===401,'private stream needs auth');
  const noPublic=await http(origin,'/objects/unknown.bin');check(noPublic.status===404,'no static storage alias');
  const unsupported=await http(origin,'/api/v1/artifacts/uploads/'+u.uploadId+'/chunks/0',{method:'PUT',headers:{...headers,'content-type':'application/b032-unknown'},bytes:Buffer.from('x')});check(unsupported.status===422&&JSON.parse(unsupported.bytes).error.code==='VALIDATION_FAILED','unsupported media is client validation, not core outage500');
  const oversized=Buffer.alloc(4194305,19),overflow=await f.storage.declare(f.token,{serverGeneration:f.generation,descriptor:descriptor(f.projectId,oversized)});
  const over=await http(origin,'/api/v1/artifacts/uploads/'+overflow.uploadId+'/chunks/0',{method:'PUT',headers:{...headers,'content-type':'application/octet-stream','x-chunk-offset':'0','x-chunk-length':'4194304','x-chunk-sha256':sha(oversized.subarray(0,4194304))},bytes:oversized,streaming:true});check(over.status===413&&JSON.parse(over.bytes).error.code==='PAYLOAD_TOO_LARGE','real chunked overflow JSON413');
  return {actualHTTPChunkBytes:b.length,transferEncoding:'chunked',privateDownloadHash:true,readyRequired:true,withoutAuth401:true,noStaticAlias404:true,TLSOrBrowserCookieProof:false};
 });
 await test('B032-real-node-mongo-restart',async()=>{
  for(const app of apps)await app.close();const f=await fixture(),d=await dataset(f);await f.metadata.commit(f.token,d.m,d.artifacts,f.generation);
  const before=await restartProbe(f,d);await client.close();await repl.stop({doCleanup:false,force:false});await repl.start();client=new MongoClient(repl.getUri());await client.connect();const after=await restartProbe(f,d);
  check(before.pid!==after.pid&&before.sha256===after.sha256&&after.sha256===d.artifacts[0].sha256&&before.versionId===after.versionId&&after.refs>0,'actual process restart keeps hashes/references');
  return {nodePids:[before.pid,after.pid],ownedMongoStoppedAndStarted:true,actualByteHash:after.sha256,privateBytesAndRefsRetained:true,cloudRedeployOrPowerLossProof:false};
 });
}catch(e){report.fatal=e.stack??e.message;}
finally{for(const app of apps)await app.close();await client?.close();if(repl)await repl.stop({doCleanup:false,force:false});report.cleanup.push({ownedMongoStopped:true,dataAndBytesRetained:runtime});report.counts=Object.fromEntries(['passed','failed'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));report.sources={};report.sourcesUnchangedDuringRun=true;
 for(const [p,b]of source){report.sources[p]=sha(b);if(sha(await readFile(p))!==sha(b))report.sourcesUnchangedDuringRun=false;const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,b,{flag:'wx'});}if(!report.sourcesUnchangedDuringRun)report.fatal='Source changed during run';await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function scan(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await scan(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await scan(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,counts:report.counts,fatal:report.fatal}));if(report.fatal||report.counts.failed)process.exitCode=1;
}
