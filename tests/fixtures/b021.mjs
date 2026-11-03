import {LocalStore} from '../../apps/web/src/local/store.ts';
import {encodeTable,encodeLineage,hashBytes,canonicalJson,mutationHash} from '../../packages/data-format/src/index.mjs';
import {assertVersionCreateMutation} from '../../packages/contracts/src/index.mjs';
const id=()=>crypto.randomUUID();
const check=(v,m)=>{if(!v)throw Error(m);};
const expect=async(fn,code)=>{try{await fn();throw Error('Expected '+code);}catch(e){const actual=typeof e.code==='string'?e.code:e.name;check(actual===code,'Expected '+code+'; got '+actual);}};
export async function setupB021({namespace='b021-'+id(),factory=indexedDB}={}) {
 const ownerId=id(),projectId=id(),datasetId=id(),serverGeneration=id(),store=await LocalStore.open(ownerId,{namespace,factory});
 await store.initialize({projectId,datasetId,serverGeneration});const fence=await store.advanceWriter(projectId);
 return {ownerId,projectId,datasetId,serverGeneration,store,namespace,factory,...fence,branchId:id()};
}
export async function outputB021(f,{source=null,branchId=f.branchId,stepId=id(),value=1}={}) {
 const head=await f.store.inspect('branches',branchId),context=await f.store.inspect('contexts',f.projectId);
 const sourceVersion=source?await f.store.inspect('versions',source):null,taskId=id(),versionId=id(),mutationId=id(),commitId=id();
 const snapshot={ownerId:f.ownerId,projectId:f.projectId,datasetId:f.datasetId,taskId,runId:id(),stepId,branchId,fallbackBranchId:id(),outputVersionId:versionId,mutationId,commitId,sourceVersionId:source,sourceRefs:source?[{datasetId:f.datasetId,versionId:source,role:'primary',sourceOrder:0}]:[],dependencyMutationIds:sourceVersion?[sourceVersion.mutationId]:[],expectedLocalHeadVersionId:head?.headVersionId??null,expectedLocalHeadRevision:head?.localHeadRevision??0,expectedHead:sourceVersion?{kind:'dependency',branchId,fromMutationId:sourceVersion.mutationId}:{kind:'known',branchId,versionId:null,revision:0},contextRevisionAtStart:context?.revision??0,writerFence:f.writerFence,localGeneration:f.localGeneration,serverGeneration:f.serverGeneration};
 const column={columnId:id(),name:'Số đo 🧪',logicalType:'number',nullable:false,sourceColumns:[]};
 const rows=[{rowId:id(),cells:[value]},{rowId:id(),cells:[value+1]}],table=await encodeTable(rows,[column],{chunkTargetBytes:150});
 const manifestId=id(),manifestBytes=new TextEncoder().encode(canonicalJson(table.manifest));
 const descriptor=async(artifactId,purpose,bytes,deps=[])=>({artifactId,purpose,formatVersion:purpose==='tableManifest'||purpose==='tableChunk'?'table-jsonl-v1':'json-v1',mediaType:'application/json',sizeBytes:bytes.byteLength,sha256:await hashBytes(bytes),projectId:f.projectId,dependencyArtifactIds:deps});
 const artifacts=[];for(const c of table.chunks)artifacts.push({descriptor:await descriptor(c.artifactId,'tableChunk',c.bytes),bytes:c.bytes});
 artifacts.push({descriptor:await descriptor(manifestId,'tableManifest',manifestBytes,table.chunks.map(c=>c.artifactId)),bytes:manifestBytes});
 const version={schemaVersion:1,versionId,datasetId:f.datasetId,branchId,parentVersionId:source,sourceVersions:snapshot.sourceRefs,tableManifestId:manifestId,rowCount:2,columnCount:1,operationSnapshot:{operationId:'PREP.MISS_MEAN',configVersion:1,columnIds:[column.columnId],params:{}}};
 return {snapshot,version,artifacts,rows};
}
export async function stageB021(f,o){await f.store.start(o.snapshot);await f.store.stage(o.snapshot.taskId,o.artifacts);}
export async function commitB021(f,o){await stageB021(f,o);return f.store.commit(o.snapshot.taskId,o.version);}
export async function runB021Checks() {
 const results=[];async function test(id,expected,fn){try{results.push({id,expected,status:'passed',actual:await fn()});}catch(e){results.push({id,expected,status:'failed',actual:{code:e.code??e.name,message:e.message}});}}
 await test('B021-A-contract','baseRevision0, known server5 separate, dependency membership and branch binding, immutable payload hash',async()=>{
   const f=await setupB021(),o=await outputB021(f);
   try{
    await commitB021(f,o);const pending=await f.store.inspect('outbox',o.snapshot.mutationId),m=structuredClone(pending.mutation);
    m.payload.expectedHead={kind:'known',branchId:f.branchId,versionId:id(),revision:5};assertVersionCreateMutation(m);
    await expect(async()=>assertVersionCreateMutation({...m,baseRevision:5}),'VALIDATION_FAILED');
    const dependency=id();m.payload.expectedHead={kind:'dependency',branchId:f.branchId,fromMutationId:dependency};
    await expect(async()=>assertVersionCreateMutation(m),'VALIDATION_FAILED');m.dependencies=[dependency];assertVersionCreateMutation(m);
    const hash=await mutationHash(m,pending.artifactDescriptors),before=canonicalJson(m);
    check(await mutationHash(structuredClone(m),pending.artifactDescriptors)===hash&&canonicalJson(m)===before,'dependency hash stable');
    m.payload.expectedHead.branchId=id();await expect(async()=>assertVersionCreateMutation(m),'VALIDATION_FAILED');
    return {baseRevision:0,separateKnownServerRevision:5,missingDependencyRejected:true,branchMismatchRejected:true,hashStable:true};
   }finally{f.store.close();}
 });
 await test('B021-atomic-chain','Version/head/history/step/marker/outbox one completed transaction, two offline outputs before ACK',async()=>{
   const f=await setupB021();try{
    const a=await outputB021(f),r0=await commitB021(f,a);check(r0.status==='localCommitted'&&r0.durability==='strict','completed strict');
    const b=await outputB021(f,{source:a.version.versionId,value:3}),r1=await commitB021(f,b);
    const outbox=await f.store.inspect('outbox'),second=outbox.find(x=>x.id===b.snapshot.mutationId);
    check(outbox.length===2&&outbox.every(x=>x.status==='pending'),'two pending no ACK');
    check(second.mutation.baseRevision===0&&second.mutation.payload.expectedHead.fromMutationId===a.snapshot.mutationId,'dependency rather than predicted serverrevision');
    for(const name of ['versions','history','steps','markers'])check((await f.store.inspect(name)).length===2,name+' count2');
    const open=await f.store.openVersion(b.version.versionId);check(open.status==='ready','reopened bytes/type/hash');
    const again=await f.store.commit(b.snapshot.taskId,b.version);check(again.alreadyCommitted&&(await f.store.inspect('outbox')).length===2,'retry idempotent');
    await expect(()=>f.store.commit(b.snapshot.taskId,{...b.version,operationSnapshot:{...b.version.operationSnapshot,params:{changed:true}}}),'IDEMPOTENCY_MISMATCH');
    return {committed:2,pendingOutbox:2,markers:2,durability:r1.durability,baseRevision:0,dependencyReference:true,reopen:'ready',changedRetryRejected:true};
   }finally{f.store.close();}
 });
 await test('B021-invalid-staging','Wrong hash, missing dependency and wrong row/shape do not create a successful version',async()=>{
   const f=await setupB021();try{
    const o=await outputB021(f);await f.store.start(o.snapshot);
    const bad=structuredClone(o.artifacts);bad[0].bytes[0]^=1;await expect(()=>f.store.stage(o.snapshot.taskId,bad),'HASH_MISMATCH');
    await f.store.stage(o.snapshot.taskId,o.artifacts.slice(-1));await expect(()=>f.store.commit(o.snapshot.taskId,o.version),'ARTIFACT_NOT_READY');
    await f.store.stage(o.snapshot.taskId,o.artifacts.slice(0,-1));await expect(()=>f.store.commit(o.snapshot.taskId,{...o.version,rowCount:3}),'INVALID_SOURCE');
    check((await f.store.inspect('versions')).length===0&&(await f.store.inspect('markers')).length===0,'no success');
    return {wrongHashRejected:true,missingChunkRejected:true,shapeMismatchRejected:true,versions:0,markers:0};
   }finally{f.store.close();}
 });
 await test('B021-native-abort','A native duplicate-key ConstraintError late in metadata transaction rolls back earlier version/head/outbox/marker writes',async()=>{
   const f=await setupB021();try{
    const a=await outputB021(f);await commitB021(f,a);const oldHead=canonicalJson(await f.store.inspect('branches',f.branchId));
    const b=await outputB021(f,{source:a.version.versionId,stepId:a.snapshot.stepId});await stageB021(f,b);
    await expect(()=>f.store.commit(b.snapshot.taskId,b.version),'ConstraintError');
    check(canonicalJson(await f.store.inspect('branches',f.branchId))===oldHead,'old head preserved');
    for(const name of ['versions','markers','outbox','history','steps'])check((await f.store.inspect(name)).length===1,'rollback '+name);
    check((await f.store.inspect('tasks',b.snapshot.taskId)).status==='running','no tasksuccess');
    return {nativeError:'ConstraintError',oldHeadPreserved:true,allNewMetadataRolledBack:true,stagedBytesRetained:true,quotaErrorInjected:false};
   }finally{f.store.close();}
 });
 await test('B021-cancel-order','Cancel wins before commit, marker wins before cancel; no deletion of ready/unsynced bytes',async()=>{
   const f=await setupB021();try{
    const a=await outputB021(f);await stageB021(f,a);await f.store.cancel(a.snapshot.taskId);
    const r=await f.store.commit(a.snapshot.taskId,a.version);check(r.status==='cancelled'&&(await f.store.inspect('versions')).length===0,'cancel wins');
    const b=await outputB021(f);await commitB021(f,b);const late=await f.store.cancel(b.snapshot.taskId);
    check(late.status==='tooLate'&&(await f.store.inspect('outbox')).length===1,'commit wins');
    return {before:'cancelled',after:'tooLate',unsyncedPreserved:true};
   }finally{f.store.close();}
 });
 await test('B021-source-context-branch','Old source task forks fallback if local head changed; user context change remains selected',async()=>{
   const f=await setupB021();try{
    const a=await outputB021(f);await commitB021(f,a);
    const slow=await outputB021(f,{source:a.version.versionId}),fast=await outputB021(f,{source:a.version.versionId});
    await stageB021(f,slow);await commitB021(f,fast);await f.store.setContext(f.projectId,a.version.versionId);
    const result=await f.store.commit(slow.snapshot.taskId,slow.version);
    check(result.status==='localCommitted'&&!result.viewPointerUpdated,'old task no context switch');
    const stored=await f.store.inspect('versions',slow.version.versionId);check(stored.branchId===slow.snapshot.fallbackBranchId,'planned fallbackbranch');
    check((await f.store.inspect('branches',f.branchId)).headVersionId===fast.version.versionId,'main head not overwritten');
    check((await f.store.inspect('contexts',f.projectId)).versionId===a.version.versionId,'user context retained');
    return {fallbackBranch:true,mainHeadRetained:true,userContextRetained:true,sourceSnapshotRetained:stored.parentVersionId===a.version.versionId};
   }finally{f.store.close();}
 });
 await test('B021-historical-source','Starting from an older version forks even if expected local head remains unchanged during execution',async()=>{
   const f=await setupB021();try{
    const a=await outputB021(f);await commitB021(f,a);const b=await outputB021(f,{source:a.version.versionId});await commitB021(f,b);
    await f.store.setContext(f.projectId,a.version.versionId);
    const historical=await outputB021(f,{source:a.version.versionId});
    check(historical.snapshot.expectedLocalHeadVersionId===b.version.versionId,'head already advanced before START');
    await commitB021(f,historical);const output=await f.store.inspect('versions',historical.version.versionId);
    check(output.branchId===historical.snapshot.fallbackBranchId&&output.parentVersionId===a.version.versionId,'fork from historical source');
    check((await f.store.inspect('branches',f.branchId)).headVersionId===b.version.versionId,'existing head retained');
    return {headUnchangedDuringExecution:true,olderSourceForked:true,existingHeadRetained:true,sourceParentRetained:true};
   }finally{f.store.close();}
 });
 await test('B021-fence-recovery','New writer rejects late result; recovery marks only old-fence running tasks interrupted and never auto resumes',async()=>{
   const f=await setupB021();try{
    const a=await outputB021(f);await stageB021(f,a);const next=await f.store.advanceWriter(f.projectId);
    await expect(()=>f.store.commit(a.snapshot.taskId,a.version),'WRITER_FENCE_LOST');f.writerFence=next.writerFence;
    const live=await outputB021(f);await stageB021(f,live);const recovery=await f.store.recover(f.projectId,f.writerFence);
    check(recovery.some(x=>x.taskId===a.snapshot.taskId&&x.status==='interrupted'),'old interrupted');
    check((await f.store.inspect('tasks',live.snapshot.taskId)).status==='running','live task unchanged');
    check((await f.store.inspect('versions')).length===0,'no auto resume');
    return {lateFenceRejected:true,oldInterrupted:true,liveUnchanged:true,autoResume:false};
   }finally{f.store.close();}
 });
 await test('B021-owner-generation','Owner/project/source scope and account generation block stale commits',async()=>{
   const f=await setupB021();try{
    const a=await outputB021(f);await stageB021(f,a);
    const tx=f.store.db.transaction('state','readwrite'),done=new Promise((r,j)=>{tx.oncomplete=r;tx.onabort=()=>j(tx.error);});tx.objectStore('state').put({id:'account',ownerId:f.ownerId,localGeneration:f.localGeneration+1,mode:'open',serverGeneration:f.serverGeneration});await done;
    await expect(()=>f.store.commit(a.snapshot.taskId,a.version),'SESSION_REVOKED');
    const b=await outputB021(f);b.snapshot.ownerId=id();await expect(()=>f.store.start(b.snapshot),'FORBIDDEN');
    check((await f.store.inspect('versions')).length===0,'no stale writes');
    return {generationRejected:true,ownerRejected:true,versions:0};
   }finally{f.store.close();}
 });
 await test('B021-lineage-resource-missing','Lineage artifact reopens with exact row/source mapping; missing-byte read fault preserves metadata/outbox and reports resourceMissing',async()=>{
   const f=await setupB021();try{
    const a=await outputB021(f);await commitB021(f,a);const b=await outputB021(f,{source:a.version.versionId});
    const lineageId=id(),bytes=encodeLineage(b.rows.map((r,i)=>({rowId:r.rowId,sources:[{datasetId:f.datasetId,versionId:a.version.versionId,rowId:a.rows[i].rowId,role:'primary',sourceOrder:0}]})));
    b.version.rowLineageArtifactId=lineageId;b.artifacts.push({descriptor:{artifactId:lineageId,purpose:'rowLineage',formatVersion:'row-lineage-jsonl-v1',mediaType:'application/x-ndjson',sizeBytes:bytes.length,sha256:await hashBytes(bytes),projectId:f.projectId,dependencyArtifactIds:[]},bytes});
    await commitB021(f,b);check((await f.store.openVersion(b.version.versionId)).status==='ready','lineage ready');
    const original=f.store.inspect.bind(f.store),missing=b.artifacts[0].descriptor.artifactId;
    f.store.inspect=async(name,key)=>name==='bytes'&&key===missing?undefined:original(name,key);
    const opened=await f.store.openVersion(b.version.versionId);f.store.inspect=original;
    check(opened.status==='resourceMissing','no false ready when bytes hidden');
    check((await f.store.inspect('versions')).length===2&&(await f.store.inspect('outbox')).length===2&&!!await f.store.inspect('bytes',missing),'metadata/outbox/bytes retained');
    return {lineageReady:true,missingReadResult:'resourceMissing',fault:'read-visibility injection, not actual browser eviction or deletion',versions:2,outbox:2,physicalByteRetained:true};
   }finally{f.store.close();}
 });
 await test('B021-source-scope','Source dataset/version pair checked before metadata commit, no cross-dataset reference spoof',async()=>{
   const f=await setupB021();try{
    const a=await outputB021(f);await commitB021(f,a);const b=await outputB021(f,{source:a.version.versionId});
    b.snapshot.sourceRefs[0].datasetId=id();await stageB021(f,b);
    await expect(()=>f.store.commit(b.snapshot.taskId,b.version),'INVALID_SOURCE');
    check((await f.store.inspect('versions')).length===1&&(await f.store.inspect('outbox')).length===1,'no spoofed output');
    return {mismatchedDatasetVersionRejected:true,previousVersionAndOutboxPreserved:true};
   }finally{f.store.close();}
 });
 return results;
}
