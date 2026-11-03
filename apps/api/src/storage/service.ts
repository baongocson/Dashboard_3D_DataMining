import {randomBytes,randomUUID} from 'node:crypto';
import type {ClientSession} from 'mongodb';
import {assertSchema,parseJsonStrict} from '../../../../packages/contracts/src/index.mjs';
import {canonicalJson,assertColumns,assertRow} from '../../../../packages/data-format/src/index.mjs';
import limits from '../../../../packages/contracts/limits/local-dev.v1.json' with {type:'json'};
import type {AuthIdentity} from '../auth/service.ts';
import {AuthService} from '../auth/service.ts';
import {reject} from '../auth/policy.ts';
import {metadataCollections} from '../metadata/schema.ts';
import {RetainedByteStore} from './bytes.ts';
import type {ByteInput} from './bytes.ts';
import {storageCollections,prepareStorage} from './schema.ts';
type Value=Record<string,any>;
type AttachmentProof={ownerId:string;projectId:string;generation:string;records:Value[];version:Value};
const opaque=()=>randomBytes(32).toString('base64url');
export class StorageService {
 readonly auth:AuthService;readonly bytes:RetainedByteStore;readonly c;readonly metadata;readonly instanceId:string;
 private proofs=new WeakMap<object,AttachmentProof>();
 constructor(auth:AuthService,root:string,{instanceId=randomUUID()}={}){this.auth=auth;this.bytes=new RetainedByteStore(root);this.c=storageCollections(auth.db);this.metadata=metadataCollections(auth.db);this.instanceId=instanceId;}
 async ready(){await this.bytes.ready();await prepareStorage(this.auth.db);}
 private async guard(s:ClientSession,identity:AuthIdentity,projectId:string,generation:string,artifactId?:string){
  const ownerId=identity.user._id;
  const g=await this.auth.c.control.updateOne({_id:'server',serverGeneration:generation},{$inc:{storageFence:1}},{session:s});if(g.matchedCount!==1)reject('RECONCILIATION_REQUIRED',410);
  const project=await this.metadata.projects.findOne({_id:projectId,ownerId},{session:s});if(!project)reject('RESOURCE_NOT_FOUND',404);
  if(project.state!=='active'||await this.metadata.tombstones.findOne({ownerId,entityId:{$in:artifactId?[projectId,artifactId]:[projectId]}},{session:s}))reject('RESOURCE_DELETED',410);
  await this.metadata.projects.updateOne({_id:projectId,ownerId,state:'active'},{$inc:{dependencyFence:1}},{session:s});
 }
 private generation(identity:AuthIdentity){return this.auth.sessionView(identity).serverGeneration;}
 private async view(s:ClientSession,u:Value){
  const chunks=await this.c.chunks.find({uploadId:u._id},{session:s}).sort({index:1}).limit(65).toArray();
  const v={uploadId:u._id,artifactId:u.artifactId,chunkSizeBytes:limits.chunkMaxBytes,expiresAt:u.expiresAt.toISOString(),serverGeneration:u.serverGeneration,state:u.state,receivedChunks:chunks.map(c=>({index:c.index,offset:c.offset,length:c.length,sha256:c.sha256}))};assertSchema('storage-view.json',v);return v;
 }
 async declare(rawToken:string|undefined,input:Value){
  assertSchema('storage-request.json',input);const {descriptor:d,serverGeneration}=structuredClone(input);
  if(d.sizeBytes>(d.purpose==='source'?limits.inputSourceMaxBytes:limits.artifactMaxBytes))reject(d.purpose==='source'?'INPUT_FILE_TOO_LARGE':'ARTIFACT_LIMIT_EXCEEDED',413);
  if(d.dependencyArtifactIds.includes(d.artifactId))reject('INVALID_SOURCE');
  return this.auth.withFence(rawToken,async(s,identity)=>{
   await this.guard(s,identity,d.projectId,serverGeneration,d.artifactId);const ownerId=identity.user._id,now=this.auth.clock();
   const old=await this.c.artifacts.findOne({_id:d.artifactId},{session:s});
   if(old&&old.ownerId!==ownerId)reject('RESOURCE_NOT_FOUND',404);
   if(old&&(canonicalJson(old.descriptor)!==canonicalJson(d)||old.serverGeneration!==serverGeneration))reject('IDEMPOTENCY_MISMATCH',409);
   const existing=old?.activeUploadId?await this.c.uploads.findOne({_id:old.activeUploadId,ownerId,sessionId:identity.session._id,authEpoch:identity.session.authEpoch,expiresAt:{$gt:new Date(now)},state:{$ne:'cancelled'}},{session:s}):null;
   if(existing)return this.view(s,existing);
   const uploadId=opaque(),u={_id:uploadId,ownerId,projectId:d.projectId,artifactId:d.artifactId,sessionId:identity.session._id,authEpoch:identity.session.authEpoch,serverGeneration,expiresAt:new Date(now+limits.uploadExpiryMs),state:old&&['verified','ready'].includes(old.state)?'verified':'declared',createdAtServer:new Date(now),leaseId:null};
   await this.c.uploads.insertOne(u,{session:s});
   if(!old)await this.c.artifacts.insertOne({_id:d.artifactId,ownerId,projectId:d.projectId,serverGeneration,descriptor:d,state:'declared',activeUploadId:uploadId,byteRevision:0,attachFence:0,updatedAtServer:new Date(now)},{session:s});
   else await this.c.artifacts.updateOne({_id:d.artifactId},{$set:{activeUploadId:uploadId}},{session:s});
   return this.view(s,u);
  });
 }
 private async upload(s:ClientSession,identity:AuthIdentity,uploadId:string,write=false){
  if(!/^[A-Za-z0-9_-]{43}$/.test(uploadId))reject('VALIDATION_FAILED');
  const u=await this.c.uploads.findOne({_id:uploadId,ownerId:identity.user._id},{session:s});if(!u)reject('RESOURCE_NOT_FOUND',404);
  await this.guard(s,identity,u.projectId,u.serverGeneration,u.artifactId);
  const a=await this.c.artifacts.findOne({_id:u.artifactId,ownerId:identity.user._id,projectId:u.projectId},{session:s});if(!a)reject('ARTIFACT_NOT_READY');
  if(write){
   if(u.sessionId!==identity.session._id||u.authEpoch!==identity.session.authEpoch)reject('SESSION_REVOKED',401);
   if(u.expiresAt.getTime()<=this.auth.clock()||u.state==='cancelled'||a.activeUploadId!==u._id)reject('PREVIEW_STALE',409);
  }return {u,a};
 }
 async status(rawToken:string|undefined,uploadId:string){return this.auth.withFence(rawToken,async(s,identity)=>this.view(s,(await this.upload(s,identity,uploadId)).u));}
 private async acquire(rawToken:string|undefined,uploadId:string,state:'uploading'|'verifying'){
  return this.auth.withFence(rawToken,async(s,identity)=>{
   const {u,a}=await this.upload(s,identity,uploadId,true);if(a.state==='ready'||u.state==='verified')return {u,a,lease:null};
   const now=this.auth.clock();
   await this.c.control.updateOne({_id:'leaseFence'},{$inc:{fence:1}},{session:s});
   if(u.leaseId&&await this.c.leases.findOne({_id:u.leaseId,state:'active',until:{$gt:new Date(now)}},{session:s}))reject('DEPENDENCY_EXISTS',409);
   const account=await this.c.leases.countDocuments({ownerId:identity.user._id,state:'active',until:{$gt:new Date(now)}},{session:s}),instance=await this.c.leases.countDocuments({instanceId:this.instanceId,state:'active',until:{$gt:new Date(now)}},{session:s});
   if(account>=limits.perAccountConcurrentUploads||instance>=limits.perInstanceUploads)reject('RESOURCE_LIMIT_EXCEEDED',429);
   const lease={_id:opaque(),ownerId:identity.user._id,uploadId,instanceId:this.instanceId,state:'active',until:new Date(Math.min(u.expiresAt.getTime(),now+300000))};
   await this.c.leases.insertOne(lease,{session:s});await this.c.uploads.updateOne({_id:uploadId},{$set:{leaseId:lease._id,state}},{session:s});return {u,a,lease};
  });
 }
 private async release(leaseId:string|null){if(leaseId)await this.c.leases.updateOne({_id:leaseId,state:'active'},{$set:{state:'released',releasedAt:new Date(this.auth.clock())}});}
 private async confirm(s:ClientSession,identity:AuthIdentity,uploadId:string,lease:Value){
  const {u,a}=await this.upload(s,identity,uploadId,true);if(u.leaseId!==lease._id||!await this.c.leases.findOne({_id:lease._id,state:'active',until:{$gt:new Date(this.auth.clock())}},{session:s}))reject('PREVIEW_STALE',409);return {u,a};
 }
 async chunk(rawToken:string|undefined,uploadId:string,index:number,offset:number,length:number,sha256:string,input:ByteInput){
  if(!Number.isSafeInteger(index)||index<0||!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||! /^[a-f0-9]{64}$/.test(sha256))reject('VALIDATION_FAILED');
  if(length>limits.chunkMaxBytes)reject('PAYLOAD_TOO_LARGE',413);
  const active=await this.acquire(rawToken,uploadId,'uploading');
  try{
   const expected=Math.min(limits.chunkMaxBytes,active.a.descriptor.sizeBytes-index*limits.chunkMaxBytes);
   if(offset!==index*limits.chunkMaxBytes||expected<=0||length!==expected)reject('VALIDATION_FAILED');
   const prior=await this.c.chunks.findOne({uploadId,index});if(prior&&(prior.sha256!==sha256||prior.length!==length||prior.offset!==offset))reject('IDEMPOTENCY_MISMATCH',409);
   if(!active.lease){
    if(!prior)reject('ARTIFACT_NOT_READY');await this.bytes.check(input,length,sha256,limits.chunkMaxBytes);
    await this.auth.withFence(rawToken,(s,identity)=>this.upload(s,identity,uploadId,true));return {uploadId,index,sha256,received:true};
   }
   const stored=await this.bytes.put(input,length,sha256,limits.chunkMaxBytes);
   return await this.auth.withFence(rawToken,async(s,identity)=>{
    await this.confirm(s,identity,uploadId,active.lease!);
    // Stable logical chunk identity; new immutable attempt file can repair missing/corrupt staging bytes.
    await this.c.chunks.updateOne({uploadId,index},{$set:{ownerId:identity.user._id,offset,length,sha256,storageKey:stored.key},$setOnInsert:{_id:randomUUID()}},{upsert:true,session:s});
    await this.c.artifacts.updateOne({_id:active.a._id},{$set:{updatedAtServer:new Date(this.auth.clock())}},{session:s});
    return {uploadId,index,sha256,received:true};
   });
  }finally{await this.release(active.lease?._id??null);}
 }
 async complete(rawToken:string|undefined,uploadId:string){
  const active=await this.acquire(rawToken,uploadId,'verifying');if(!active.lease)return this.status(rawToken,uploadId);
  try{
   const chunks=await this.c.chunks.find({uploadId}).sort({index:1}).limit(65).toArray(),d=active.a.descriptor,count=Math.ceil(d.sizeBytes/limits.chunkMaxBytes);
   if(chunks.length!==count||chunks.some((c,i)=>c.index!==i||c.offset!==i*limits.chunkMaxBytes||c.length!==Math.min(limits.chunkMaxBytes,d.sizeBytes-c.offset)))reject('ARTIFACT_NOT_READY');
   const sealed=await this.bytes.assemble(chunks.map(c=>({key:c.storageKey,length:c.length,sha256:c.sha256})),d.sizeBytes,d.sha256);
   return await this.auth.withFence(rawToken,async(s,identity)=>{
    await this.confirm(s,identity,uploadId,active.lease!);
    await this.c.artifacts.updateOne({_id:d.artifactId,state:{$ne:'ready'}},{$set:{state:'verified',storageKey:sealed.key,updatedAtServer:new Date(this.auth.clock())},$inc:{byteRevision:1}},{session:s});
    const u={...active.u,state:'verified'};await this.c.uploads.updateOne({_id:uploadId},{$set:{state:'verified'}},{session:s});return this.view(s,u);
   });
  }finally{await this.release(active.lease._id);}
 }
 async cancel(rawToken:string|undefined,uploadId:string){return this.auth.withFence(rawToken,async(s,identity)=>{
  const {u,a}=await this.upload(s,identity,uploadId);if(u.sessionId!==identity.session._id||u.authEpoch!==identity.session.authEpoch)reject('SESSION_REVOKED',401);if(a.state==='ready')return {uploadId,state:'ready',bytesRetained:true};
  await this.c.uploads.updateOne({_id:uploadId},{$set:{state:'cancelled',cancelledAt:new Date(this.auth.clock()),leaseId:null}},{session:s});
  if(u.leaseId)await this.c.leases.updateOne({_id:u.leaseId},{$set:{state:'released'}},{session:s});return {uploadId,state:'cancelled',bytesRetained:true};
 });}
 readonly authority={
  prepare:async(ownerId:string,projectId:string,descriptors:Value[],mutation:Value,sourceHandles:object[]=[])=>this.prepareAttachment(ownerId,projectId,descriptors,mutation,sourceHandles),
  assertReady:async(s:ClientSession,scope:{ownerId:string;projectId:string},descriptors:Value[],handle?:object)=>{
   const proof=handle?this.proofs.get(handle):undefined;
   if(!proof||proof.ownerId!==scope.ownerId||proof.projectId!==scope.projectId||canonicalJson(proof.records.map(r=>r.descriptor))!==canonicalJson(descriptors))reject('ARTIFACT_NOT_READY');
   const generation=await this.auth.c.control.findOne({_id:'server'},{session:s});if(generation?.serverGeneration!==proof.generation)reject('RECONCILIATION_REQUIRED',410);
   for(const old of proof.records){const a=await this.c.artifacts.findOne({_id:old._id,ownerId:scope.ownerId,projectId:scope.projectId},{session:s});
    if(!a||!['verified','ready'].includes(a.state)||a.byteRevision!==old.byteRevision||a.storageKey!==old.storageKey||canonicalJson(a.descriptor)!==canonicalJson(old.descriptor)||a.serverGeneration!==proof.generation)reject('ARTIFACT_NOT_READY');
    if(!await this.metadata.refs.findOne({ownerId:scope.ownerId,projectId:scope.projectId,targetEntityId:a._id,targetEntityType:'artifact',strength:'hard'},{session:s}))reject('ARTIFACT_NOT_READY');
    await this.c.artifacts.updateOne({_id:a._id},{$set:{state:'ready',readyAt:new Date(this.auth.clock())},$inc:{attachFence:1}},{session:s});
   }
  }
 };
 private async prepareAttachment(ownerId:string,projectId:string,descriptors:Value[],mutation:Value,sourceHandles:object[]=[]){
  const generation=await this.auth.c.control.findOne({_id:'server'}),records=[];
  if(!Array.isArray(sourceHandles)||sourceHandles.length>limits.mutationsPerAtomicGroup)reject('VALIDATION_FAILED');
  const sources:AttachmentProof[]=[];for(const handle of sourceHandles){const p=this.proofs.get(handle);if(!p||p.ownerId!==ownerId||p.projectId!==projectId||p.generation!==generation?.serverGeneration)reject('INVALID_SOURCE');sources.push(p);}
  for(const d of descriptors){assertSchema('artifact-descriptor.json',d);const a=await this.c.artifacts.findOne({_id:d.artifactId,ownerId,projectId});
   if(!a||!['verified','ready'].includes(a.state)||a.serverGeneration!==generation?.serverGeneration||canonicalJson(a.descriptor)!==canonicalJson(d))reject('ARTIFACT_NOT_READY');
   const f=await this.bytes.openVerified(a.storageKey,d.sizeBytes,d.sha256);await f.close();records.push(a);
  }
  const v=mutation.kind==='dataset.create'?mutation.payload.initialVersion.version:mutation.kind==='dataset.version.create'?mutation.payload.version:null;
  if(!v)reject('UNSUPPORTED_OPERATION');
  const derived=mutation.kind==='dataset.create'&&mutation.payload.dataset.kind==='derived';
  if(derived){
   const intent=await this.metadata.intents.findOne({_id:mutation.payload.intentId,ownerId,projectId});if(!intent)reject('PREVIEW_STALE',409);
   const refs=v.sourceVersions;if(!v.rowLineageArtifactId||intent.request.kind==='join'&&(refs.length!==2||refs[0].role!=='left'||refs[1].role!=='right')||intent.request.kind==='concat'&&refs.some((r:Value)=>r.role!=='concat')||refs.some((r:Value,i:number)=>r.sourceOrder!==i))reject('INVALID_SOURCE');
  }
  await this.verifyTable(v,records,{ownerId,projectId,derived},sources);
  const handle=Object.freeze({});this.proofs.set(handle,{ownerId,projectId,generation:generation!.serverGeneration,records,version:structuredClone(v)});return handle;
 }
 private async verifyTable(v:Value,records:Value[],scope:{ownerId:string;projectId:string;derived:boolean},preparedSources:AttachmentProof[]=[]){
  const byId=new Map(records.map(r=>[r._id,r])),root=byId.get(v.tableManifestId);if(!root||root.descriptor.purpose!=='tableManifest'||root.descriptor.formatVersion!=='table-jsonl-v1')reject('INVALID_SOURCE');
  const manifest=parseJsonStrict(await this.bytes.json(root.storageKey,root.descriptor.sizeBytes,root.descriptor.sha256,limits.workerMemoryBudgetBytes));assertSchema('table-manifest.json',manifest);assertColumns(manifest.schema);
  if(manifest.rowCount!==v.rowCount||manifest.schema.length!==v.columnCount||v.rowCount>limits.outputRowMaxCount||v.columnCount>limits.featureMaxCount)reject('RESOURCE_LIMIT_EXCEEDED');
  if(canonicalJson(manifest.columnOrder)!==canonicalJson(manifest.schema.map((c:Value)=>c.columnId))||canonicalJson(root.descriptor.dependencyArtifactIds)!==canonicalJson(manifest.chunks.map((c:Value)=>c.artifactId)))reject('INVALID_SOURCE');
  for(const column of manifest.schema)for(const source of column.sourceColumns)if(!v.sourceVersions.some((r:Value)=>r.datasetId===source.datasetId&&r.versionId===source.versionId))reject('INVALID_SOURCE');
  const rowIds:string[]=[],seen=new Set<string>();let at=0;
  for(const part of manifest.chunks){const chunk=byId.get(part.artifactId);if(!chunk||chunk.descriptor.purpose!=='tableChunk'||chunk.descriptor.formatVersion!=='table-jsonl-v1'||chunk.descriptor.dependencyArtifactIds.length||chunk.descriptor.sha256!==part.sha256||chunk.descriptor.sizeBytes!==part.sizeBytes||part.rowStart!==at)reject('INVALID_SOURCE');let count=0;
   for await(const text of this.bytes.lines(chunk.storageKey,part.sizeBytes,part.sha256,limits.workerMemoryBudgetBytes/8)){const row=parseJsonStrict(text);assertRow(row,manifest.schema);if(seen.has(row.rowId))reject('INVALID_SOURCE');seen.add(row.rowId);rowIds.push(row.rowId);count++;if(rowIds.length>limits.outputRowMaxCount)reject('RESOURCE_LIMIT_EXCEEDED');}
   if(count!==part.rowCount)reject('INVALID_SOURCE');at+=count;
  }if(at!==manifest.rowCount)reject('INVALID_SOURCE');
  if(v.rowLineageArtifactId){const lineage=byId.get(v.rowLineageArtifactId);if(!lineage||lineage.descriptor.purpose!=='rowLineage'||lineage.descriptor.formatVersion!=='json-v1'||lineage.descriptor.dependencyArtifactIds.length)reject('INVALID_SOURCE');let i=0,tracked=rowIds.length*192;
   const sources=new Map<string,Set<string>>();
   for(const ref of v.sourceVersions){const key=ref.datasetId+':'+ref.versionId;if(sources.has(key))continue;
    const committed=await this.metadata.versions.findOne({_id:ref.versionId,ownerId:scope.ownerId,projectId:scope.projectId,datasetId:ref.datasetId});
    const staged=!committed?preparedSources.find(p=>p.version.versionId===ref.versionId&&p.version.datasetId===ref.datasetId):undefined;
    const version=committed?.content??staged?.version;if(!version)reject('INVALID_SOURCE');
    const sourceManifest=committed?await this.c.artifacts.findOne({_id:version.tableManifestId,ownerId:scope.ownerId,projectId:scope.projectId,state:'ready'}):staged!.records.find(r=>r._id===version.tableManifestId);if(!sourceManifest)reject('ARTIFACT_NOT_READY');
    const sourceTable=parseJsonStrict(await this.bytes.json(sourceManifest.storageKey,sourceManifest.descriptor.sizeBytes,sourceManifest.descriptor.sha256,limits.workerMemoryBudgetBytes));assertSchema('table-manifest.json',sourceTable);const rows=new Set<string>();
    for(const part of sourceTable.chunks){const chunk=committed?await this.c.artifacts.findOne({_id:part.artifactId,ownerId:scope.ownerId,projectId:scope.projectId,state:'ready'}):staged!.records.find(r=>r._id===part.artifactId);if(!chunk||chunk.descriptor.sha256!==part.sha256||chunk.descriptor.sizeBytes!==part.sizeBytes)reject('ARTIFACT_NOT_READY');
     for await(const text of this.bytes.lines(chunk.storageKey,part.sizeBytes,part.sha256,limits.workerMemoryBudgetBytes/8)){tracked+=128;if(tracked+text.length*4>limits.workerMemoryBudgetBytes)reject('RESOURCE_LIMIT_EXCEEDED');const row=parseJsonStrict(text);assertRow(row,sourceTable.schema);if(rows.has(row.rowId))reject('INVALID_SOURCE');rows.add(row.rowId);}
    }if(rows.size!==version.rowCount)reject('INVALID_SOURCE');sources.set(key,rows);
   }
   for await(const text of this.bytes.lines(lineage.storageKey,lineage.descriptor.sizeBytes,lineage.descriptor.sha256,limits.workerMemoryBudgetBytes/8)){if(tracked+text.length*4>limits.workerMemoryBudgetBytes)reject('RESOURCE_LIMIT_EXCEEDED');const row=parseJsonStrict(text);assertSchema('row-lineage.json',row);
    if(row.rowId!==rowIds[i++]||scope.derived&&(!row.sources.length||[...sources.values()].some(ids=>ids.has(row.rowId)))||row.sources.some((r:Value)=>!v.sourceVersions.some((source:Value)=>source.datasetId===r.datasetId&&source.versionId===r.versionId&&(source.role===undefined||source.role===r.role)&&(source.sourceOrder===undefined||source.sourceOrder===r.sourceOrder))||!sources.get(r.datasetId+':'+r.versionId)?.has(r.rowId)))reject('INVALID_SOURCE');
   }if(i!==rowIds.length)reject('INVALID_SOURCE');
  }
 }
 private async downloadable(s:ClientSession,identity:AuthIdentity,artifactId:string){
  const a=await this.c.artifacts.findOne({_id:artifactId,ownerId:identity.user._id},{session:s});if(!a)reject('RESOURCE_NOT_FOUND',404);await this.guard(s,identity,a.projectId,a.serverGeneration,a._id);if(a.state!=='ready')reject('ARTIFACT_NOT_READY');
  let live=false;const refs=this.metadata.refs.find({ownerId:identity.user._id,projectId:a.projectId,targetEntityId:artifactId,strength:'hard'},{session:s}).batchSize(16);
  try{for await(const ref of refs){const version=await this.metadata.versions.findOne({_id:ref.sourceEntityId,ownerId:identity.user._id,projectId:a.projectId},{session:s}),datasetId=version?.datasetId??ref.sourceEntityId,dataset=await this.metadata.datasets.findOne({_id:datasetId,ownerId:identity.user._id,projectId:a.projectId,state:'active'},{session:s});if(dataset&&!await this.metadata.tombstones.findOne({ownerId:identity.user._id,entityId:{$in:[datasetId,ref.sourceEntityId]}},{session:s})){live=true;break;}}}finally{await refs.close();}
  if(!live)reject('ARTIFACT_NOT_READY');return a;
 }
 async content(rawToken:string|undefined,artifactId:string){
  assertSchema('uuid.json',artifactId);const a=await this.auth.withFence(rawToken,(s,identity)=>this.downloadable(s,identity,artifactId)),file=await this.bytes.openVerified(a.storageKey,a.descriptor.sizeBytes,a.descriptor.sha256);
  try{await this.auth.withFence(rawToken,async(s,identity)=>{const current=await this.downloadable(s,identity,artifactId);if(current.storageKey!==a.storageKey||current.byteRevision!==a.byteRevision)reject('ARTIFACT_NOT_READY');});return {stream:file.createReadStream({start:0,autoClose:true}),sizeBytes:a.descriptor.sizeBytes,sha256:a.descriptor.sha256};}catch(e){await file.close();throw e;}
 }
 async cleanupPlan(rawToken:string|undefined,projectId:string,options:{limit?:number;cursor?:string}={}){
  assertSchema('uuid.json',projectId);assertSchema('storage-cleanup-query.json',options);const query=structuredClone(options),limit=query.limit??100;
  const start=await this.auth.withFence(rawToken,async(s,identity)=>{
   const ownerId=identity.user._id,generation=this.generation(identity);await this.guard(s,identity,projectId,generation);
   let afterId:string|undefined;
   if(query.cursor){const cursor=await this.c.inventoryCursors.findOne({_id:query.cursor,ownerId,projectId,serverGeneration:generation},{session:s});if(!cursor||cursor.expiresAt.getTime()<=this.auth.clock())reject('CURSOR_EXPIRED',410);afterId=cursor.afterId;}
   return {ownerId,generation,afterId};
  });
  // This is a live, advisory inventory, not a deletion token or an offline snapshot.
  // Do not hold the account transaction while scanning references/leases.
  const now=this.auth.clock(),entries=[],docs=await this.c.artifacts.find({ownerId:start.ownerId,projectId,...(start.afterId?{_id:{$gt:start.afterId}}:{})},{projection:{_id:1,state:1,activeUploadId:1,updatedAtServer:1}}).sort({_id:1}).limit(limit+1).toArray();
  for(const a of docs.slice(0,limit)){const ref=await this.metadata.refs.findOne({ownerId:start.ownerId,projectId,targetEntityId:a._id}),lease=await this.c.leases.findOne({uploadId:a.activeUploadId,state:'active',until:{$gt:new Date(now)}});entries.push({artifactId:a._id,eligibleForFuturePlan:a.state!=='ready'&&!ref&&!lease&&now-a.updatedAtServer.getTime()>=limits.stagingGraceMs,protectedReason:a.state==='ready'||ref?'reference':lease?'activeLease':now-a.updatedAtServer.getTime()<limits.stagingGraceMs?'grace':null});}
  const hasMore=docs.length>limit,nextCursor=hasMore?opaque():null;
  await this.auth.withFence(rawToken,async(s,identity)=>{
   if(identity.user._id!==start.ownerId)reject('FORBIDDEN',403);await this.guard(s,identity,projectId,start.generation);
   if(nextCursor)await this.c.inventoryCursors.insertOne({_id:nextCursor,ownerId:start.ownerId,projectId,serverGeneration:start.generation,afterId:docs[limit-1]._id,expiresAt:new Date(this.auth.clock()+1800000)},{session:s});
  });
  const result={mode:'retain-only',physicalDeletionEnabled:false,entries,hasMore,nextCursor};assertSchema('storage-cleanup-page.json',result);return result;
 }
}
