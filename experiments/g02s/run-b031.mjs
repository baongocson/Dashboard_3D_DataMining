import {MongoMemoryReplSet} from 'mongodb-memory-server-core';
import {MongoClient} from 'mongodb';
import {AuthService} from '../../apps/api/src/auth/service.ts';
import {FakeMailAdapter} from '../../apps/api/src/auth/fake-mail.ts';
import {MetadataService} from '../../apps/api/src/metadata/service.ts';
import {createApp} from '../../apps/api/src/app.ts';
import {id,password,mutation,imported,creation,nextVersion} from '../../tests/fixtures/b031.mjs';
import {canonicalJson,mutationHash,hashCanonical} from '../../packages/data-format/src/index.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
import {assertSchema} from '../../packages/contracts/src/index.mjs';
import {mkdir,writeFile,readFile,readdir,copyFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);await checkGenerated();
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02s/evidence/b031/'+stamp,runtime=path.resolve('experiments/g02s/.runtime/b031',stamp);
await mkdir(out,{recursive:true});await mkdir(path.join(runtime,'db'),{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),report={task:'B031',stamp,cases:[],environment:{node:process.version,mongodb:'8.0.34'},limits:['Synthetic artifact authority checks fixture metadata only, no server byte/storage proof; default artifact authority is unavailable.','No B033 HTTP batch/partial/conflict preservation or B041 parser/product adapters enabled.'],cleanup:[]};
const sourcePaths=['apps/api/src/app.ts','apps/api/src/metadata/schema.ts','apps/api/src/metadata/service.ts','apps/api/src/auth/service.ts','apps/api/src/auth/schema.ts','apps/api/src/auth/policy.ts','tests/fixtures/b031.mjs','experiments/g02s/run-b031.mjs','packages/contracts/src/generated/validators.mjs','packages/contracts/src/generated/build-manifest.json','packages/data-format/src/index.mjs'];
const sourceSnapshot=new Map();for(const p of sourcePaths)sourceSnapshot.set(p,await readFile(p));
const selected=new Set(process.argv.slice(2)),apps=[];let repl,client,dbNumber=0;
const check=(v,m)=>{if(!v)throw Error(m);};
async function denied(fn,code){try{await fn();throw Error('Expected '+code);}catch(e){check(e.code===code,'Expected '+code+' actual '+(e.code??e.message));}}
async function test(name,fn){if(selected.size&&!selected.has(name))return;try{report.cases.push({id:name,status:'passed',actual:await fn()});}catch(e){report.cases.push({id:name,status:'failed',actual:{code:e.code,message:e.stack??e.message}});}console.log(JSON.stringify(report.cases.at(-1)));}
async function login(f,email='a@example.test'){
 if(!await f.auth.c.users.findOne({canonicalEmail:email})){
  const c=await f.auth.register({email,displayName:'Tổng hợp',password,confirmPassword:password}),mail=f.mail.messages.findLast(m=>m.challengeId===c.challengeId);
  await f.auth.verify({challengeId:c.challengeId,purpose:'register',generation:c.generation,otp:mail.otp},'register');
 }return f.auth.login({email,password,deviceId:id()});
}
async function fixture(){
 const db=client.db('b031_'+(++dbNumber)),mail=new FakeMailAdapter(),time={now:Date.UTC(2026,10,3)},serverGeneration=id(),auth=new AuthService(client,db,{profile:'test',origin:'https://localhost',secret:randomBytes(32),serverGeneration},mail,()=>time.now);await auth.ready();
 const artifacts={assertReady:async(s,scope,descriptors)=>{for(const d of descriptors){const a=await db.collection('b031_synthetic_artifacts').findOne({_id:d.artifactId,ownerId:scope.ownerId,projectId:scope.projectId,state:'verified-fixture'}, {session:s});if(!a||canonicalJson(a.descriptor)!==canonicalJson(d))throw Object.assign(Error('Fixture artifact not ready'),{code:'ARTIFACT_NOT_READY'});}}};
 const metadata=new MetadataService(auth,{artifacts});await metadata.ready();const f={db,auth,mail,time,metadata,serverGeneration};f.login=await login(f);f.token=f.login.rawToken;f.ownerId=f.login.data.userId;
 f.projectId=id();f.projectMutation=await mutation('project.create',f.projectId,f.projectId,{name:'Dự án tổng hợp'});await metadata.commit(f.token,f.projectMutation,[],serverGeneration);return f;
}
async function addDataset(f){
 const data=await imported(f.projectId),grant=await f.metadata.importIntent(f.token,data.intent),m=await creation(f.projectId,data,grant);
 for(const a of data.artifacts)await f.db.collection('b031_synthetic_artifacts').insertOne({_id:a.artifactId,ownerId:f.ownerId,projectId:f.projectId,state:'verified-fixture',descriptor:a});
 const receipt=await f.metadata.commit(f.token,m,data.artifacts,f.serverGeneration);return {...data,grant,m,receipt};
}
function actor(app,token){let csrf,cookie='__Host-dashboard_session='+token;return {async call(url,body,headers={}){
 const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api/v1'+url,headers:{cookie,...(body===undefined?{}:{origin:'https://localhost','x-csrf-token':csrf,'content-type':'application/json'}),...headers},...(body===undefined?{}:{payload:body})});
 if(url==='/auth/csrf'){csrf=r.json().data.csrfToken;cookie+='; __Host-dashboard_csrf='+r.cookies.find(c=>c.name==='__Host-dashboard_csrf').value;}
 const j=r.json();assertSchema(j.error?'error-envelope.json':'success-envelope.json',j);return {status:r.statusCode,json:j,headers:r.headers};
 }};}
try{
 const binary=path.resolve('experiments/g01/.runtime/mongod-8.0.34.exe');report.environment.mongoBinarySha256=sha(await readFile(binary));
 repl=await MongoMemoryReplSet.create({binary:{systemBinary:binary,version:'8.0.34'},instanceOpts:[{dbPath:path.join(runtime,'db')}],replSet:{count:1,name:'b031rs',ip:'127.0.0.1',storageEngine:'wiredTiger'}});
 client=new MongoClient(repl.getUri());await client.connect();
 await test('B031-project-identity',async()=>{
  const f=await fixture(),before=await f.metadata.read(f.token,'project',f.projectId);
  const results=await Promise.all([f.metadata.commit(f.token,f.projectMutation,[],f.serverGeneration),f.metadata.commit(f.token,f.projectMutation,[],f.serverGeneration)]);
  check(canonicalJson(results[0])===canonicalJson(results[1])&&await f.metadata.c.projects.countDocuments({})===1,'stable concurrent replay');
  const changed=structuredClone(f.projectMutation);changed.payload.name='khác';changed.payloadHash=await mutationHash(changed,[]);await denied(()=>f.metadata.commit(f.token,changed,[],f.serverGeneration),'IDEMPOTENCY_MISMATCH');
  const rename=await mutation('project.rename',f.projectId,f.projectId,{name:'Đổi tên'},{baseRevision:1});await f.metadata.commit(f.token,rename,[],f.serverGeneration);
  const stale=await mutation('project.rename',f.projectId,f.projectId,{name:'cũ'},{baseRevision:1});await denied(()=>f.metadata.commit(f.token,stale,[],f.serverGeneration),'REVISION_CONFLICT');
  return {concurrentReplayStable:true,revisionBefore:before.revision,revisionAfter:(await f.metadata.read(f.token,'project',f.projectId)).revision};
 });
 await test('B031-composable-transaction-rollback',async()=>{
  const f=await fixture(),a=id(),b=id(),first=await mutation('project.create',a,a,{name:'A'}),second=await mutation('project.create',b,b,{name:'B'}),handles=await Promise.all([f.metadata.prepareMutation(first,[]),f.metadata.prepareMutation(second,[])]);
  // Mutating the original object cannot rewrite the private prepared business snapshot.
  first.payload.name='rewritten';
  await denied(()=>f.auth.withFence(f.token,async(s,identity)=>{await f.metadata.commitPrepared(s,identity,handles[0],f.serverGeneration);await f.metadata.commitPrepared(s,identity,{},f.serverGeneration);}), 'VALIDATION_FAILED');
  check(await f.metadata.c.projects.countDocuments({_id:a})===0&&await f.metadata.c.identities.countDocuments({mutationId:first.mutationId})===0,'group rollback identity and metadata');
  await f.auth.withFence(f.token,async(s,identity)=>{for(const h of handles)await f.metadata.commitPrepared(s,identity,h,f.serverGeneration);});
  check((await f.metadata.read(f.token,'project',a)).name==='A'&&await f.metadata.c.projects.countDocuments({_id:{$in:[a,b]}})===2,'prepared immutable/composed commit');
  return {atomicTwoMutationFoundation:true,rollbackMetadataAndIdentity:true,opaquePreparedHandle:true,HTTPBatchProof:false};
 });
 await test('B031-intent-expiry-renew',async()=>{
  const f=await fixture(),d=await imported(f.projectId),first=await f.metadata.importIntent(f.token,d.intent);check(await f.metadata.c.datasets.countDocuments({})===0,'intent no visibility');
  f.time.now+=1800000;const m=await creation(f.projectId,d,first);await denied(()=>f.metadata.commit(f.token,m,d.artifacts,f.serverGeneration),'PREVIEW_STALE');
  const renewed=await f.metadata.importIntent(f.token,d.intent);check(renewed.intentId===first.intentId,'stable logical intent');
  await denied(()=>f.metadata.importIntent(f.token,{...d.intent,configHash:'f'.repeat(64)}),'IDEMPOTENCY_MISMATCH');
  await denied(()=>f.metadata.importIntent(f.token,{...d.intent,logicalImportId:id()}),'IDEMPOTENCY_MISMATCH');
  const oldToken=f.token;const next=await login(f);f.token=next.rawToken;await denied(()=>f.metadata.importIntent(oldToken,d.intent),'SESSION_REVOKED');
  const again=await f.metadata.importIntent(f.token,d.intent);check(again.intentId===first.intentId,'session renewal same identity');
  return {intentDoesNotPublish:true,ttlMs:1800000,expiredRejected:true,renewKeepsId:true,newSessionRebindsAfterReauth:true};
 });
 await test('B031-version-chain-undo',async()=>{
  const f=await fixture(),d=await addDataset(f),v1=await nextVersion(f.projectId,d,d.version,d.m.mutationId);await f.metadata.commit(f.token,v1.m,v1.artifacts,f.serverGeneration);
  const v2=await nextVersion(f.projectId,d,v1.version,v1.m.mutationId);await f.metadata.commit(f.token,v2.m,v2.artifacts,f.serverGeneration);
  const v3=await nextVersion(f.projectId,d,v1.version,v1.m.mutationId,{fork:true});await f.metadata.commit(f.token,v3.m,v3.artifacts,f.serverGeneration);
  const branches=await f.metadata.list(f.token,'branches',d.dataset.datasetId),versions=await f.metadata.list(f.token,'versions',d.dataset.datasetId);
  check(versions.items.length===4&&branches.items.length===2,'four immutable versions two branches');
  check(branches.items.find(b=>b.branchId===d.version.branchId).headVersionId===v2.version.versionId,'old descendants kept');
  const reopened=await f.metadata.read(f.token,'version',v1.version.versionId);check(reopened.parentVersionId===d.version.versionId,'parent preserved');
  const intentReplay=await f.metadata.importIntent(f.token,d.intent);check(intentReplay.status==='alreadyCommitted'&&intentReplay.intentId===d.grant.intentId,'receipt before renew');
  return {versions:4,branches:2,serverHeadRevision:3,baseRevision:0,dependencyReceiptResolved:true,intentReplay:'alreadyCommitted'};
 });
 await test('B031-artifact-default-rollback',async()=>{
  const f=await fixture(),d=await imported(f.projectId),g=await f.metadata.importIntent(f.token,d.intent),m=await creation(f.projectId,d,g),without=new MetadataService(f.auth);
  await denied(()=>without.commit(f.token,m,d.artifacts,f.serverGeneration),'ARTIFACT_NOT_READY');
  for(const c of ['datasets','versions','branches','refs'])check(await f.metadata.c[c].countDocuments({})===0,'rollback '+c);
  check(await f.metadata.c.identities.countDocuments({mutationId:m.mutationId})===0,'no identity without ready refs');
  return {defaultAuthorityUnavailable:true,noPublishedDatasetVersionRefs:true,byteVerificationClaim:false};
 });
 await test('B031-owner-project-ref',async()=>{
  const f=await fixture(),d=await addDataset(f),other=await login(f,'b@example.test');await denied(()=>f.metadata.read(other.rawToken,'project',f.projectId),'RESOURCE_NOT_FOUND');
  await denied(()=>f.metadata.read(other.rawToken,'version',d.version.versionId),'RESOURCE_NOT_FOUND');
  const second=id();await f.metadata.commit(f.token,await mutation('project.create',second,second,{name:'Dự án tổng hợp'}),[],f.serverGeneration);
  const d2=await imported(second);d2.intent.kind='join';delete d2.intent.file;d2.intent.sourceRefs=[{datasetId:d.dataset.datasetId,versionId:d.version.versionId,role:'left',sourceOrder:0},{datasetId:d.dataset.datasetId,versionId:d.version.versionId,role:'right',sourceOrder:1}];
  await denied(()=>f.metadata.importIntent(f.token,d2.intent),'RESOURCE_NOT_FOUND');
  return {crossOwner404:true,crossProjectSourceDenied:true,duplicateNamesAllowed:true};
 });
 await test('B031-derived-lineage',async()=>{
  const f=await fixture(),left=await addDataset(f),right=await addDataset(f),d=await imported(f.projectId);
  d.dataset.kind='derived';d.dataset.sourceArtifactId=null;d.dataset.parseConfig={joinKind:'inner',nullMatch:false,duplicatePolicy:'allowWithConfirmation'};
  d.version.sourceVersions=[{datasetId:left.dataset.datasetId,versionId:left.version.versionId,role:'left',sourceOrder:0},{datasetId:right.dataset.datasetId,versionId:right.version.versionId,role:'right',sourceOrder:1}];
  d.initialVersion.version=d.version;d.configHash=await hashCanonical({parseConfig:d.dataset.parseConfig,operationSnapshot:d.version.operationSnapshot});
  d.intent.kind='join';delete d.intent.file;d.intent.sourceRefs=d.version.sourceVersions;d.intent.configHash=d.configHash;d.artifacts=d.artifacts.filter(a=>a.purpose!=='source');
  const grant=await f.metadata.importIntent(f.token,d.intent),m=await creation(f.projectId,d,grant);
  for(const a of d.artifacts)await f.db.collection('b031_synthetic_artifacts').insertOne({_id:a.artifactId,ownerId:f.ownerId,projectId:f.projectId,state:'verified-fixture',descriptor:a});
  await f.metadata.commit(f.token,m,d.artifacts,f.serverGeneration);
  const saved=await f.metadata.read(f.token,'version',d.version.versionId),refs=await f.metadata.c.refs.find({sourceEntityId:d.version.versionId,relation:'sourceVersion'}).sort({sourceOrder:1}).toArray();
  check(canonicalJson(saved.sourceVersions)===canonicalJson(d.version.sourceVersions)&&refs.length===2,'ordered multi-source lineage');
  check(await f.metadata.c.versions.countDocuments({})===3,'derived does not replace sources');
  return {datasets:3,orderedSources:2,noFakeSourceArtifact:true,numericalJoinVerified:false};
 });
 await test('B031-hash-immutable-head',async()=>{
  const f=await fixture(),d=await addDataset(f),stored=canonicalJson(await f.metadata.read(f.token,'version',d.version.versionId));
  const rename=await mutation('dataset.rename',f.projectId,d.dataset.datasetId,{name:'Tên mới'},{baseRevision:1});await f.metadata.commit(f.token,rename,[],f.serverGeneration);
  check(canonicalJson(await f.metadata.read(f.token,'version',d.version.versionId))===stored,'rename immutable snapshot');
  const n=await nextVersion(f.projectId,d,d.version,d.m.mutationId),bad=structuredClone(n.m);bad.payload.version.rowCount=99;await denied(()=>f.metadata.commit(f.token,bad,n.artifacts,f.serverGeneration),'HASH_MISMATCH');
  await f.metadata.commit(f.token,n.m,n.artifacts,f.serverGeneration);
  const stale=await nextVersion(f.projectId,d,d.version,d.m.mutationId);await denied(()=>f.metadata.commit(f.token,stale.m,stale.artifacts,f.serverGeneration),'REVISION_CONFLICT');
  check(await f.metadata.c.versions.countDocuments({})===2,'stale no overwrite');return {immutableVersion:true,hashMismatchRejected:true,staleHeadPreserved:true};
 });
 await test('B031-parent-DAG-branch-guards',async()=>{
  const f=await fixture(),d=await addDataset(f),n=await nextVersion(f.projectId,d,d.version,d.m.mutationId);await f.metadata.commit(f.token,n.m,n.artifacts,f.serverGeneration);
  const wrongParent=await nextVersion(f.projectId,d,d.version,n.m.mutationId);
  await denied(()=>f.metadata.commit(f.token,wrongParent.m,wrongParent.artifacts,f.serverGeneration),'INVALID_SOURCE');
  const initial=await nextVersion(f.projectId,d,d.version,d.m.mutationId,{fork:true});initial.m.payload.version.parentVersionId=null;initial.m.payload.version.sourceVersions=[];initial.m.payload.branch={branchId:initial.version.branchId,forkVersionId:null,reason:'initial'};initial.m.payloadHash=await mutationHash(initial.m,initial.artifacts);
  await denied(()=>f.metadata.commit(f.token,initial.m,initial.artifacts,f.serverGeneration),'INVALID_SOURCE');
  const cycle=await nextVersion(f.projectId,d,n.version,n.m.mutationId);cycle.m.payload.version.sourceVersions=[{datasetId:d.dataset.datasetId,versionId:cycle.version.versionId,role:'primary',sourceOrder:0}];cycle.m.payloadHash=await mutationHash(cycle.m,cycle.artifacts);
  await denied(()=>f.metadata.commit(f.token,cycle.m,cycle.artifacts,f.serverGeneration),'INVALID_SOURCE');
  check(await f.metadata.c.versions.countDocuments({})===2,'invalid DAG no write');return {nonHeadParentRejected:true,secondV0Rejected:true,selfCycleRejected:true};
 });
 await test('B031-fences-generation-deleted',async()=>{
  const f=await fixture(),d=await addDataset(f),n=await nextVersion(f.projectId,d,d.version,d.m.mutationId);
  await denied(()=>f.metadata.commit(f.token,n.m,n.artifacts,id()),'RECONCILIATION_REQUIRED');
  await f.metadata.c.tombstones.insertOne({_id:id(),ownerId:f.ownerId,entityType:'dataset',entityId:d.dataset.datasetId,projectId:f.projectId});
  await denied(()=>f.metadata.commit(f.token,n.m,n.artifacts,f.serverGeneration),'RESOURCE_DELETED');
  await denied(()=>f.metadata.importIntent(f.token,d.intent),'RESOURCE_DELETED');
  await f.auth.logout(f.token);await denied(()=>f.metadata.commit(f.token,n.m,n.artifacts,f.serverGeneration),'SESSION_REVOKED');
  check(await f.metadata.c.versions.countDocuments({})===1,'fences no new version');return {generationMismatch:true,tombstoneDenied:true,revokedDenied:true,originalVersionRetained:true};
 });
 await test('B031-version-revoke-ordering',async()=>{
  const f=await fixture(),d=await addDataset(f),n=await nextVersion(f.projectId,d,d.version,d.m.mutationId);
  // A real metadata transaction and logout both update the same session/user fence.
  const commit=f.metadata.commit(f.token,n.m,n.artifacts,f.serverGeneration);
  const receipt=await commit;await f.auth.logout(f.token);
  check(await f.metadata.c.versions.countDocuments({_id:n.version.versionId})===1,'commit before revoke retained');
  const late=await nextVersion(f.projectId,d,n.version,n.m.mutationId);await denied(()=>f.metadata.commit(f.token,late.m,late.artifacts,f.serverGeneration),'SESSION_REVOKED');
  check(await f.metadata.c.identities.countDocuments({mutationId:late.m.mutationId})===0,'after revoke no identity');
  return {realMetadataCommitBeforeRevoke:true,afterRevokeRejected:true,concurrentRaceClaim:false,committedIds:receipt.entityIds.length};
 });
 await test('B031-pagination-cursor',async()=>{
  const f=await fixture();for(let i=0;i<4;i++){const p=id();await f.metadata.commit(f.token,await mutation('project.create',p,p,{name:'Tên trùng'}),[],f.serverGeneration);}
  const all=[],first=await f.metadata.list(f.token,'projects',null,{limit:'2'});all.push(...first.items);let cursor=first.nextCursor;
  while(cursor){const next=await f.metadata.list(f.token,'projects',null,{limit:'2',cursor});all.push(...next.items);cursor=next.nextCursor;}
  check(all.length===5&&new Set(all.map(p=>p.projectId)).size===5,'bounded no duplicate paging');
  await denied(()=>f.metadata.list(f.token,'datasets',f.projectId,{cursor:first.nextCursor}),'CURSOR_EXPIRED');
  f.time.now+=1800000;await denied(()=>f.metadata.list(f.token,'projects',null,{cursor:first.nextCursor}),'CURSOR_EXPIRED');
  return {items:5,pageSize:2,opaqueCursorScopeAndExpiry:true,fullSnapshotClaim:false};
 });
 await test('B031-O03-O04-private-api',async()=>{
  const f=await fixture(),d=await addDataset(f),app=await createApp(f.auth,{metadata:f.metadata});apps.push(app);const a=actor(app,f.token);await a.call('/auth/csrf');
  for(const url of ['/projects','/projects/'+f.projectId,'/projects/'+f.projectId+'/datasets','/datasets/'+d.dataset.datasetId+'/versions','/datasets/'+d.dataset.datasetId+'/branches','/versions/'+d.version.versionId]){
   const r=await a.call(url);check(r.status===200&&r.headers['cache-control']==='no-store','route '+url);check(!JSON.stringify(r.json).includes('ownerId'),'no internal owner');
  }
  const p=id(),m=await mutation('project.create',p,p,{name:'API create'});check((await a.call('/projects',{serverGeneration:f.serverGeneration,mutation:m})).status===200,'project create same commit service');
  const intent=await imported(f.projectId);check((await a.call('/projects/'+f.projectId+'/import-intents',intent.intent)).status===200,'intent route');
  check((await a.call('/projects?limit=101')).status===422,'query limit guard');
  check((await a.call('/versions/'+d.version.versionId+'?ownerId='+id())).status===422,'unknown detail query rejected');
  const bare=await app.inject({url:'/api/v1/projects'});check(bare.statusCode===401,'private without session');
  check((await a.call('/projects',{serverGeneration:f.serverGeneration,mutation:m},{origin:'https://evil.invalid'})).status===403,'CSRF origin');
  return {getRoutes:6,postRoutes:2,private401:true,csrf403:true,noStore:true};
 });
 await test('B031-auth-only-regression',async()=>{
  const f=await fixture(),app=await createApp(f.auth);apps.push(app);const a=actor(app,f.token);
  check((await a.call('/auth/session')).status===200,'existing auth route');check((await a.call('/projects')).status===404,'metadata opt-in only');
  await a.call('/auth/csrf');check((await a.call('/auth/logout',{})).status===200,'existing csrf/logout route');
  const r=await a.call('/auth/session');check(r.status===401&&!r.headers['clear-site-data'],'revocation keeps local data policy');
  return {authOnlyFactoryPreserved:true,session200:true,logout200:true,revoked401:true,metadata404:true};
 });
}catch(e){report.fatal=e.stack??e.message;}
finally{
 for(const app of apps)await app.close();if(client)await client.close();if(repl)await repl.stop({doCleanup:false,force:false});report.cleanup.push({ownedMongoStopped:true,dbRetained:runtime});
 report.counts=Object.fromEntries(['passed','failed'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));report.sources={};
 report.sourcesUnchangedDuringRun=true;
 for(const [p,b]of sourceSnapshot){if(sha(await readFile(p))!==sha(b))report.sourcesUnchangedDuringRun=false;report.sources[p]=sha(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,b,{flag:'wx'});}
 if(!report.sourcesUnchangedDuringRun)report.fatal='Source changed during run; cannot accept this execution';
 await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};async function scan(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await scan(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await scan(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,counts:report.counts,fatal:report.fatal}));if(report.fatal||report.counts.failed)process.exitCode=1;
}
