import {assertSchema,assertVersionCreateMutation,fail,parseJsonStrict,ERROR_CATALOG} from '../../../../packages/contracts/src/index.mjs';
import {canonicalJson,hashBytes,hashCanonical,mutationHash,decodeTable,decodeLineage} from '../../../../packages/data-format/src/index.mjs';
import {openDatabase,transaction,request,STORES} from './idb.ts';
import type {LocalRecord,Store} from './idb.ts';
type Snapshot=Record<string,any>;
type StagedArtifact={descriptor:Record<string,any>;bytes:Uint8Array};
export class LocalStore {
 readonly db:IDBDatabase;
 readonly ownerId:string;
 private constructor(db:IDBDatabase,ownerId:string){this.db=db;this.ownerId=ownerId;}
 static async open(ownerId:string,options:{namespace?:string;factory?:IDBFactory}={}) {
   assertSchema('uuid.json',ownerId);return new LocalStore(await openDatabase(ownerId,options.namespace,options.factory),ownerId);
 }
 close(){this.db.close();}
 private async get(tx:IDBTransaction,store:Store,id:string):Promise<LocalRecord|undefined>{return request(tx.objectStore(store).get(id));}
 private async gate(tx:IDBTransaction,s:Snapshot) {
   if(s.ownerId!==this.ownerId)fail('FORBIDDEN');
   const state=await this.get(tx,'state','account'),project=await this.get(tx,'projects',s.projectId);
   if(!state||state.localGeneration!==s.localGeneration||state.mode!=='open')fail('SESSION_REVOKED');
   if(!project||project.ownerId!==this.ownerId||project.state!=='active')fail('RESOURCE_DELETED');
   if(project.writerFence!==s.writerFence)fail('WRITER_FENCE_LOST');
   const ds=await this.get(tx,'datasets',s.datasetId);
   if(!ds||ds.ownerId!==this.ownerId||ds.projectId!==s.projectId||ds.state!=='active')fail('INVALID_SOURCE');
   return {state,project,dataset:ds};
 }
 // Caller has established offline entitlement/account identity; B022 owns actual lock/gate orchestration.
 async initialize({projectId,datasetId,serverGeneration}:{projectId:string;datasetId:string;serverGeneration:string}) {
   for(const id of [projectId,datasetId,serverGeneration])assertSchema('uuid.json',id);
   return transaction(this.db,['state','projects','datasets'],'readwrite',async tx=>{
     const old=await this.get(tx,'state','account');
     if(!old)tx.objectStore('state').add({id:'account',ownerId:this.ownerId,localGeneration:1,mode:'open',serverGeneration});
     else if(old.ownerId!==this.ownerId||old.serverGeneration!==serverGeneration)fail('RECONCILIATION_REQUIRED');
     const project=await this.get(tx,'projects',projectId);
     if(!project)tx.objectStore('projects').add({id:projectId,ownerId:this.ownerId,state:'active',writerFence:0});
     else if(project.ownerId!==this.ownerId||project.state!=='active')fail('RESOURCE_DELETED');
     const ds=await this.get(tx,'datasets',datasetId);
     if(!ds)tx.objectStore('datasets').add({id:datasetId,ownerId:this.ownerId,projectId,state:'active'});
     else if(ds.ownerId!==this.ownerId||ds.projectId!==projectId||ds.state!=='active')fail('INVALID_SOURCE');
   });
 }
 async advanceWriter(projectId:string) {
   return (await transaction(this.db,['projects','state'],'readwrite',async tx=>{
     const p=await this.get(tx,'projects',projectId),state=await this.get(tx,'state','account');
     if(!p||p.ownerId!==this.ownerId||p.state!=='active'||state?.mode!=='open')fail('FORBIDDEN');
     const fence=p.writerFence+1;tx.objectStore('projects').put({...p,writerFence:fence});
     return {writerFence:fence,localGeneration:state.localGeneration};
   })).value;
 }
 async invalidateWriter(projectId:string,expectedFence:number) {
   return transaction(this.db,['projects'],'readwrite',async tx=>{
     const p=await this.get(tx,'projects',projectId);
     if(!p||p.ownerId!==this.ownerId||p.writerFence!==expectedFence)fail('WRITER_FENCE_LOST');
     tx.objectStore('projects').put({...p,writerFence:p.writerFence+1});
   });
 }
 async closeAccount(expectedGeneration:number) {
   return transaction(this.db,['state'],'readwrite',async tx=>{
     const state=await this.get(tx,'state','account');
     if(!state||state.ownerId!==this.ownerId||state.localGeneration!==expectedGeneration)fail('SESSION_REVOKED');
     tx.objectStore('state').put({...state,mode:'closing',localGeneration:state.localGeneration+1});
     return {localGeneration:state.localGeneration+1};
   });
 }
 async inspect(store:Store,id?:string):Promise<any> {
   return (await transaction<any>(this.db,[store],'readonly',tx=>id?this.get(tx,store,id):request(tx.objectStore(store).getAll()))).value;
 }
 async start(snapshot:Snapshot,contextSourceVersionId:string|null=snapshot.sourceVersionId) {
   assertSchema('config' in snapshot?'execution-snapshot.json':'local-snapshot.json',snapshot);const s=structuredClone(snapshot),fingerprint=await hashCanonical(s);
   return transaction(this.db,['state','projects','datasets','tasks','contexts'],'readwrite',async tx=>{
     await this.gate(tx,s);const old=await this.get(tx,'tasks',s.taskId);
     if(old){if(old.snapshotHash!==fingerprint)fail('IDEMPOTENCY_MISMATCH');return;}
     tx.objectStore('tasks').add({id:s.taskId,ownerId:this.ownerId,projectId:s.projectId,snapshot:s,snapshotHash:fingerprint,status:'running'});
     const ctx=await this.get(tx,'contexts',s.projectId);
     if(!ctx)tx.objectStore('contexts').add({id:s.projectId,ownerId:this.ownerId,revision:s.contextRevisionAtStart,versionId:contextSourceVersionId});
   });
 }
 async setContext(projectId:string,versionId:string|null) {
   assertSchema('uuid.json',projectId);if(versionId!==null)assertSchema('uuid.json',versionId);
   return transaction(this.db,['contexts','versions'],'readwrite',async tx=>{
     if(versionId){const v=await this.get(tx,'versions',versionId);if(!v||v.ownerId!==this.ownerId||v.projectId!==projectId)fail('INVALID_SOURCE');}
     const old=await this.get(tx,'contexts',projectId);if(!old)fail('INVALID_SOURCE');
     tx.objectStore('contexts').put({...old,revision:old.revision+1,versionId});
   });
 }
 async stage(taskId:string,inputs:StagedArtifact[]) {
   assertSchema('uuid.json',taskId);if(!inputs.length)fail('VALIDATION_FAILED');
   const prepared:StagedArtifact[]=[];
   for(const input of inputs) {
     if(!(input.bytes instanceof Uint8Array))fail('VALIDATION_FAILED');
     const descriptor=structuredClone(input.descriptor),bytes=new Uint8Array(input.bytes);
     assertSchema('artifact-descriptor.json',descriptor);
     if(descriptor.sizeBytes!==bytes.byteLength||await hashBytes(bytes)!==descriptor.sha256)fail('HASH_MISMATCH');
     prepared.push({descriptor,bytes});
   }
   return transaction(this.db,['state','projects','datasets','tasks','artifacts','bytes','staging'],'readwrite',async tx=>{
     const task=await this.get(tx,'tasks',taskId);if(!task)fail('INVALID_SOURCE');await this.gate(tx,task.snapshot);
     if(task.status!=='running')fail('PREVIEW_STALE');
     for(const {descriptor:d,bytes}of prepared) {
       if(d.projectId!==task.projectId)fail('FORBIDDEN');
       const old=await this.get(tx,'artifacts',d.artifactId);
       if(old){if(old.descriptor.sha256!==d.sha256||canonicalJson(old.descriptor)!==canonicalJson(d))fail('IDEMPOTENCY_MISMATCH');continue;}
       tx.objectStore('bytes').add({id:d.artifactId,ownerId:this.ownerId,projectId:task.projectId,bytes});
       tx.objectStore('artifacts').add({id:d.artifactId,ownerId:this.ownerId,projectId:task.projectId,descriptor:d,state:'staged',taskId});
       tx.objectStore('staging').add({id:d.artifactId,taskId,projectId:task.projectId,ownerId:this.ownerId,sha256:d.sha256});
     }
   });
 }
 async cancel(taskId:string) {
   return (await transaction(this.db,['tasks','markers'],'readwrite',async tx=>{
     const task=await this.get(tx,'tasks',taskId);if(!task)fail('INVALID_SOURCE');
     const marker=await this.get(tx,'markers',task.snapshot.commitId);
     if(marker)return {status:'tooLate',commitId:marker.id};
     if(task.status==='running')tx.objectStore('tasks').put({...task,status:'cancelled'});
     return {status:'cancelled',taskId,commitId:null};
   })).value;
 }
 async failTask(taskId:string,code:string) {
   if(!ERROR_CATALOG.some(e=>e.category==='error'&&e.code===code))code='VALIDATION_FAILED';
   return transaction(this.db,['tasks','markers'],'readwrite',async tx=>{
     const task=await this.get(tx,'tasks',taskId);if(!task)return;
     if(await this.get(tx,'markers',task.snapshot.commitId))return;
     if(task.status==='running')tx.objectStore('tasks').put({...task,status:'failed',errorCode:code});
   });
 }
 private async prepare(taskId:string,version:Snapshot) {
   assertSchema('local-version-input.json',version);
   const task=await this.inspect('tasks',taskId) as LocalRecord;if(!task)fail('INVALID_SOURCE');
   const selected=new Map<string,LocalRecord>(),loading=new Set<string>();
   const load=async(id:string):Promise<LocalRecord>=>{
     if(loading.has(id))fail('INVALID_SOURCE');
     if(selected.has(id))return selected.get(id)!;
     const a=await this.inspect('artifacts',id) as LocalRecord,b=await this.inspect('bytes',id) as LocalRecord;
     if(!a||!b||a.ownerId!==this.ownerId||a.projectId!==task.projectId||b.projectId!==task.projectId||(a.state!=='ready'&&a.taskId!==taskId))fail('ARTIFACT_NOT_READY');
     const record={...a,bytes:b.bytes};selected.set(id,record);
     loading.add(id);for(const ref of a.descriptor.dependencyArtifactIds)await load(ref);loading.delete(id);return record;
   };
   const manifest=await load(version.tableManifestId);
   if(manifest.descriptor.purpose!=='tableManifest')fail('INVALID_SOURCE');
   const parsed=parseJsonStrict(new TextDecoder('utf-8',{fatal:true}).decode(manifest.bytes));
   assertSchema('table-manifest.json',parsed);
   const chunks=await Promise.all(parsed.chunks.map((c:Record<string,any>)=>load(c.artifactId)));
   if(parsed.chunks.some((c:Record<string,any>,i:number)=>chunks[i].descriptor.purpose!=='tableChunk'||chunks[i].descriptor.sha256!==c.sha256||chunks[i].descriptor.sizeBytes!==c.sizeBytes))fail('INVALID_SOURCE');
   const chunkIds=parsed.chunks.map((c:Record<string,any>)=>c.artifactId);
   if(canonicalJson(manifest.descriptor.dependencyArtifactIds)!==canonicalJson(chunkIds))fail('INVALID_SOURCE');
   const rows=await decodeTable(parsed,chunks.map((x:LocalRecord)=>({artifactId:x.id,bytes:x.bytes})));
   if(rows.length!==version.rowCount||parsed.schema.length!==version.columnCount)fail('INVALID_SOURCE');
   if(version.rowLineageArtifactId){const lineage=await load(version.rowLineageArtifactId);if(lineage.descriptor.purpose!=='rowLineage')fail('INVALID_SOURCE');const records=decodeLineage(lineage.bytes);if(records.length!==rows.length||records.some((x:Record<string,any>,i:number)=>x.rowId!==rows[i].rowId||x.sources.some((ref:Record<string,any>)=>!version.sourceVersions.some((source:Record<string,any>)=>source.datasetId===ref.datasetId&&source.versionId===ref.versionId))))fail('INVALID_SOURCE');}
   for(const a of selected.values())if(a.descriptor.sizeBytes!==a.bytes.byteLength||await hashBytes(a.bytes)!==a.descriptor.sha256)fail('HASH_MISMATCH');
   return {task,artifacts:[...selected.values()].map(({bytes,...a})=>a)};
 }
 async commit(taskId:string,input:Snapshot) {
   // All hashing/decoding finishes before the readwrite transaction.
   const version=structuredClone(input),prepared=await this.prepare(taskId,version),s=prepared.task.snapshot;
   if(version.versionId!==s.outputVersionId||version.datasetId!==s.datasetId||version.parentVersionId!==s.sourceVersionId||version.branchId!==s.branchId||canonicalJson(version.sourceVersions)!==canonicalJson(s.sourceRefs))fail('INVALID_SOURCE');
   if(s.config&&canonicalJson(version.operationSnapshot)!==canonicalJson(s.config))fail('IDEMPOTENCY_MISMATCH');
   const descriptors=prepared.artifacts.map(a=>a.descriptor);
   const existingBranch=await this.inspect('branches',s.branchId) as LocalRecord|undefined;
   // Precompute both branches. The transaction chooses based only on local head state.
   const candidates=new Map();
   for(const fork of [false,true]) {
     if(fork&&s.sourceVersionId===null)continue;
     const branchId=fork?s.fallbackBranchId:s.branchId,output:Snapshot={...version,branchId};
     const expectedHead=fork?{kind:'known',branchId,versionId:null,revision:0}:s.expectedHead;
     const branch=fork?{branchId,forkVersionId:s.sourceVersionId,reason:'undoContinuation'}:
       {branchId,forkVersionId:existingBranch?.forkVersionId??s.sourceVersionId,reason:existingBranch?.reason??(s.sourceVersionId?'undoContinuation':'initial')};
     if(existingBranch&&!fork)branch.forkVersionId=existingBranch.forkVersionId;
     const mutation={schemaVersion:1,mutationId:s.mutationId,kind:'dataset.version.create',projectId:s.projectId,entityId:output.versionId,baseRevision:0,dependencies:s.dependencyMutationIds,payload:{version:output,expectedHead,branch},payloadHash:'0'.repeat(64)};
     assertVersionCreateMutation(mutation);mutation.payloadHash=await mutationHash(mutation,descriptors);
     candidates.set(fork,{version:output,mutation,branch});
   }
   const committed=await transaction(this.db,[...STORES],'readwrite',async tx=>{
     const task=await this.get(tx,'tasks',taskId);if(!task||task.snapshotHash!==prepared.task.snapshotHash)fail('PREVIEW_STALE');
     await this.gate(tx,s);
     const old=await this.get(tx,'markers',s.commitId);
     if(old){if(old.taskId!==taskId||old.versionId!==version.versionId||old.payloadHash!==candidates.get(old.branchId!==s.branchId)?.mutation.payloadHash)fail('IDEMPOTENCY_MISMATCH');return {status:'localCommitted',commitId:old.id,entityIds:[old.versionId],artifactIds:old.artifactIds,outboxIds:[old.mutationId],alreadyCommitted:true,viewPointerUpdated:false};}
     if(task.status==='cancelled')return {status:'cancelled',taskId,commitId:null};
     if(task.status!=='running')fail('PREVIEW_STALE');
     const head=await this.get(tx,'branches',s.branchId);
     const fork=(head?.headVersionId??null)!==s.expectedLocalHeadVersionId||(head?.localHeadRevision??0)!==s.expectedLocalHeadRevision||!!head&&head.headVersionId!==s.sourceVersionId;
     const chosen=candidates.get(fork),branchId=chosen.version.branchId;
     if(fork&&!s.sourceVersionId)fail('REVISION_CONFLICT');
     if(fork&&await this.get(tx,'branches',branchId))fail('REVISION_CONFLICT');
     if(await this.get(tx,'versions',version.versionId)||await this.get(tx,'outbox',s.mutationId)||await this.get(tx,'markers',s.commitId))fail('IDEMPOTENCY_MISMATCH');
     for(const ref of [s.sourceVersionId,...s.sourceRefs.map((r:Record<string,any>)=>r.versionId)].filter(Boolean)){
       const source=await this.get(tx,'versions',ref);
       if(!source||source.ownerId!==this.ownerId||source.projectId!==s.projectId)fail('INVALID_SOURCE');
       if(ref===s.sourceVersionId&&source.datasetId!==s.datasetId)fail('INVALID_SOURCE');
     }
     for(const ref of s.sourceRefs){const source=await this.get(tx,'versions',ref.versionId);if(source?.datasetId!==ref.datasetId)fail('INVALID_SOURCE');}
     for(const dep of s.dependencyMutationIds){const o=await this.get(tx,'outbox',dep);if(!o||o.ownerId!==this.ownerId||o.projectId!==s.projectId||o.status==='blockedDeleted')fail('INVALID_SOURCE');}
     for(const a of prepared.artifacts){
       const current=await this.get(tx,'artifacts',a.id),b=await this.get(tx,'bytes',a.id);
       if(!current||!b||current.descriptor.sha256!==a.descriptor.sha256||b.bytes.byteLength!==a.descriptor.sizeBytes||(current.state!=='ready'&&current.taskId!==taskId))fail('ARTIFACT_NOT_READY');
       tx.objectStore('artifacts').put({...current,state:'ready',referenced:true});
     }
     const stored={...chosen.version,id:version.versionId,ownerId:this.ownerId,projectId:s.projectId,mutationId:s.mutationId,commitId:s.commitId};
     tx.objectStore('versions').add(stored);
     const nextHead={...(fork?{}:head),id:branchId,ownerId:this.ownerId,projectId:s.projectId,datasetId:s.datasetId,headVersionId:version.versionId,localHeadRevision:(fork?0:head?.localHeadRevision??0)+1,forkVersionId:chosen.branch.forkVersionId,reason:chosen.branch.reason};
     tx.objectStore('branches').put(nextHead);
     const artifactIds=prepared.artifacts.map(a=>a.id),createdAtClient=new Date().toISOString();
     const marker={id:s.commitId,commitId:s.commitId,taskId,ownerId:this.ownerId,projectId:s.projectId,versionId:version.versionId,branchId,artifactIds,mutationId:s.mutationId,payloadHash:chosen.mutation.payloadHash,createdAtClient};assertSchema('local-commit-marker.json',marker);
     const outbox={id:s.mutationId,ownerId:this.ownerId,projectId:s.projectId,mutation:chosen.mutation,artifactDescriptors:descriptors,serverGeneration:s.serverGeneration,status:'pending',commitId:s.commitId};assertSchema('local-outbox.json',outbox);
     tx.objectStore('markers').add(marker);tx.objectStore('outbox').add(outbox);
     tx.objectStore('history').add({id:s.commitId,ownerId:this.ownerId,projectId:s.projectId,versionId:version.versionId,branchId});
     tx.objectStore('steps').add({id:s.stepId,runId:s.runId,ownerId:this.ownerId,projectId:s.projectId,status:'succeeded',commitId:s.commitId,versionId:version.versionId});
     tx.objectStore('tasks').put({...task,status:'succeeded',commitId:s.commitId});
     const ctx=await this.get(tx,'contexts',s.projectId),update=ctx?.revision===s.contextRevisionAtStart&&ctx?.versionId===s.sourceVersionId;
     if(update&&ctx)tx.objectStore('contexts').put({...ctx,revision:ctx.revision+1,versionId:version.versionId});
     return {status:'localCommitted',commitId:s.commitId,entityIds:[version.versionId],artifactIds,outboxIds:[s.mutationId],alreadyCommitted:false,viewPointerUpdated:update};
   });
   const result=committed.value.status==='localCommitted'?{...committed.value,durability:committed.durability}:committed.value;
   assertSchema('local-commit-result.json',result);return result;
 }
 async recover(projectId:string,currentFence:number) {
   return (await transaction(this.db,['state','projects','tasks','markers'],'readwrite',async tx=>{
     const project=await this.get(tx,'projects',projectId),state=await this.get(tx,'state','account');
     if(!project||project.ownerId!==this.ownerId||project.writerFence!==currentFence)fail('WRITER_FENCE_LOST');
     const tasks=await request(tx.objectStore('tasks').getAll()),recovered=[];
     for(const t of tasks.filter(t=>t.projectId===projectId&&t.ownerId===this.ownerId)){
       const marker=await this.get(tx,'markers',t.snapshot.commitId);
       if(marker){recovered.push({taskId:t.id,status:'succeeded',commitId:marker.id});continue;}
       if(t.status==='running'&&(t.snapshot.writerFence!==currentFence||t.snapshot.localGeneration!==state?.localGeneration)){
         tx.objectStore('tasks').put({...t,status:'interrupted'});recovered.push({taskId:t.id,status:'interrupted'});
       }
     }return recovered;
   })).value;
 }
 async openVersion(versionId:string) {
   const v=await this.inspect('versions',versionId) as LocalRecord;if(!v||v.ownerId!==this.ownerId)fail('RESOURCE_NOT_FOUND');
   try{
     const task=await this.inspect('tasks',(await this.inspect('markers',v.commitId) as LocalRecord).taskId) as LocalRecord;
     const {id,ownerId,projectId,mutationId,commitId,...input}=v;
     await this.prepare(task.id,input);
     return {status:'ready',version:v};
   }catch(e){return {status:'resourceMissing',version:v,code:(e as {code?:string}).code??'ARTIFACT_NOT_READY'};}
 }
}
