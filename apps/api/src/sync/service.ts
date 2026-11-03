import {randomUUID} from 'node:crypto';
import type {ClientSession} from 'mongodb';
import {assertSchema,assertJson} from '../../../../packages/contracts/src/index.mjs';
import {canonicalJson} from '../../../../packages/data-format/src/index.mjs';
import {AuthService} from '../auth/service.ts';
import type {AuthIdentity} from '../auth/service.ts';
import type {RecordDoc} from '../auth/schema.ts';
import {reject,AuthError} from '../auth/policy.ts';
import {MetadataService} from '../metadata/service.ts';
import {metadataCollections} from '../metadata/schema.ts';
import {StorageService} from '../storage/service.ts';
import {prepareDeclaration,assembleDeclarationPlan,prepareCommitRequest,assembleAck,projectReceipt} from './contracts.ts';
import {syncCollections,prepareSync} from './schema.ts';
type Value=Record<string,any>;
export class SyncService {
 readonly auth:AuthService;readonly storage:StorageService;readonly c;readonly metadata;
 readonly mutations:MetadataService;
 constructor(auth:AuthService,storage:StorageService){
  if(storage.auth!==auth)throw Error('Sync requires the same authoritative auth/DB instance');
  this.auth=auth;this.storage=storage;this.c=syncCollections(auth.db);this.metadata=metadataCollections(auth.db);this.mutations=new MetadataService(auth,{artifacts:storage.authority,preserveVersionConflicts:true});
 }
 async ready(){await this.mutations.ready();await prepareSync(this.auth.db);}
 private async generationFence(s:ClientSession,generation:string){
  const g=await this.auth.c.control.updateOne({_id:'server',serverGeneration:generation},{$inc:{syncFence:1}},{session:s});if(g.matchedCount!==1)reject('RECONCILIATION_REQUIRED',410);
 }
 private async guard(s:ClientSession,identity:AuthIdentity,declaration:Value){
  const ownerId=identity.user._id;
  await this.generationFence(s,declaration.serverGeneration);
  const ids=[...new Set<string>(declaration.mutations.flatMap((m:Value)=>[m.projectId,m.entityId,...(m.kind==='dataset.version.create'?[m.payload.version.datasetId]:[])]).concat(declaration.artifacts.map((a:Value)=>a.artifactId)))];
  if(await this.metadata.tombstones.findOne({ownerId,entityId:{$in:ids}},{session:s}))reject('RESOURCE_DELETED',410);
  for(const projectId of new Set<string>(declaration.mutations.map((m:Value)=>m.projectId))){
   const p=await this.metadata.projects.findOne({_id:projectId},{session:s});
   if(p){if(p.ownerId!==ownerId)reject('RESOURCE_NOT_FOUND',404);if(p.state!=='active')reject('RESOURCE_DELETED',410);await this.metadata.projects.updateOne({_id:projectId,ownerId,state:'active'},{$inc:{dependencyFence:1}},{session:s});}
   else if(!declaration.mutations.some((m:Value)=>m.kind==='project.create'&&m.projectId===projectId))reject('RESOURCE_NOT_FOUND',404);
  }
 }
 private notExpired(batch:RecordDoc){if(batch.expiresAt.getTime()<=this.auth.clock())reject('CURSOR_EXPIRED',410);}
 private async load(s:ClientSession,identity:AuthIdentity,batchId:string){
  const b=await this.c.batches.findOne({ownerId:identity.user._id,batchId},{session:s});if(!b)reject('RESOURCE_NOT_FOUND',404);this.notExpired(b);await this.generationFence(s,b.serverGeneration);return b;
 }
 private async batch(s:ClientSession,identity:AuthIdentity,batchId:string){
  const b=await this.c.batches.findOne({ownerId:identity.user._id,batchId},{session:s});if(!b)reject('RESOURCE_NOT_FOUND',404);
  await this.guard(s,identity,b.declaration);this.notExpired(b);return b;
 }
 /** Retained immutable declaration first; upload/byte work is outside its transaction. */
 async declare(rawToken:string|undefined,input:Value){
  // Authenticate before potentially expensive untrusted canonical hash validation.
  assertJson(input);const captured=structuredClone(input);
  await this.auth.identity(rawToken);const prepared=await prepareDeclaration(captured),d=prepared.declaration;
  const retained=await this.auth.withFence(rawToken,async(s,identity)=>{
   await this.guard(s,identity,d);
   const old=await this.c.batches.findOne({ownerId:identity.user._id,batchId:d.batchId},{session:s});
   if(old){if(old.snapshotHash!==prepared.batchSnapshotHash)reject('IDEMPOTENCY_MISMATCH',409);this.notExpired(old);return old;}
   const now=this.auth.clock(),row={_id:randomUUID(),ownerId:identity.user._id,batchId:d.batchId,serverGeneration:d.serverGeneration,snapshotHash:prepared.batchSnapshotHash,declaration:structuredClone(d),state:'declared',createdAt:new Date(now),expiresAt:new Date(now+1800000)};
   await this.c.batches.insertOne(row,{session:s});return row;
  });
  return this.plan(rawToken,retained.batchId);
 }
 async read(rawToken:string|undefined,batchId:string){
  assertSchema('uuid.json',batchId);
  return this.auth.withFence(rawToken,async(s,identity)=>{const b=await this.batch(s,identity,batchId);return {declaration:structuredClone(b.declaration),snapshotHash:b.snapshotHash,state:b.state,createdAt:b.createdAt.toISOString(),expiresAt:b.expiresAt.toISOString()};});
 }
 async plan(rawToken:string|undefined,batchId:string){
  assertSchema('uuid.json',batchId);
  const captured=await this.auth.withFence(rawToken,(s,identity)=>this.batch(s,identity,batchId)),d=captured.declaration,findings:Value[]=[],proofs:Value[]=[];
  for(const descriptor of d.artifacts){
   const a=await this.auth.withFence(rawToken,async(s,identity)=>{
    await this.batch(s,identity,batchId);const old=await this.storage.c.artifacts.findOne({_id:descriptor.artifactId},{session:s});
    if(old&&(old.ownerId!==identity.user._id||old.projectId!==descriptor.projectId))reject('RESOURCE_NOT_FOUND',404);
    if(old&&(old.serverGeneration!==d.serverGeneration||canonicalJson(old.descriptor)!==canonicalJson(descriptor)))reject('IDEMPOTENCY_MISMATCH',409);
    return old;
   });
   if(a&&['verified','ready'].includes(a.state)){
    // Actual full-byte hash is read outside any Mongo transaction.
    const file=await this.storage.bytes.openVerified(a.storageKey,descriptor.sizeBytes,descriptor.sha256);await file.close();
    proofs.push(a);findings.push({kind:'alreadyPresent',artifact:{artifactId:descriptor.artifactId,sha256:descriptor.sha256,sizeBytes:descriptor.sizeBytes,state:a.state}});
   }else{
    const upload=await this.storage.declare(rawToken,{serverGeneration:d.serverGeneration,descriptor});
    // A concurrent complete requires a fresh byte check rather than trusting its flag.
    if(upload.state==='verified')reject('ARTIFACT_NOT_READY');
    findings.push({kind:'needsUpload',upload});
   }
  }
  const result=await assembleDeclarationPlan(d,findings,{serverGeneration:d.serverGeneration});
  await this.auth.withFence(rawToken,async(s,identity)=>{
   const current=await this.batch(s,identity,batchId);if(current.snapshotHash!==captured.snapshotHash)reject('IDEMPOTENCY_MISMATCH',409);
   for(const old of proofs){const a=await this.storage.c.artifacts.findOne({_id:old._id,ownerId:identity.user._id,projectId:old.projectId},{session:s});
    if(!a||a.state!==old.state||a.byteRevision!==old.byteRevision||a.storageKey!==old.storageKey||a.serverGeneration!==d.serverGeneration||canonicalJson(a.descriptor)!==canonicalJson(old.descriptor))reject('ARTIFACT_NOT_READY');
    if(a.state==='ready'&&!await this.metadata.refs.findOne({ownerId:identity.user._id,projectId:a.projectId,targetEntityId:a._id,targetEntityType:'artifact',strength:'hard'},{session:s}))reject('ARTIFACT_NOT_READY');
    await this.storage.c.artifacts.updateOne({_id:a._id},{$inc:{attachFence:1}},{session:s});
   }
   for(const f of findings)if(f.kind==='needsUpload'){
    const u=await this.storage.c.uploads.findOne({_id:f.upload.uploadId,ownerId:identity.user._id,sessionId:identity.session._id,authEpoch:identity.session.authEpoch,serverGeneration:d.serverGeneration,expiresAt:{$gt:new Date(this.auth.clock())},state:{$in:['declared','uploading','verifying']}},{session:s});
    const a=u?await this.storage.c.artifacts.findOne({_id:u.artifactId,ownerId:identity.user._id,activeUploadId:u._id},{session:s}):null;if(!u||!a)reject('ARTIFACT_NOT_READY');
   }
  });return result;
 }
 private publicReceipt(result:Value,generation:string){
  return projectReceipt(result,generation);
 }
 private async replay(s:ClientSession,ownerId:string,m:Value,generation:string){
  const identity=await this.metadata.identities.findOne({ownerId,mutationId:m.mutationId},{session:s}),receipt=await this.c.receipts.findOne({ownerId,mutationId:m.mutationId},{session:s});
  for(const r of [identity,receipt])if(r){
   if(r.projectId!==m.projectId||r.canonicalHash!==m.payloadHash)reject('IDEMPOTENCY_MISMATCH',409);
   if(r.serverGeneration!==generation)reject('RECONCILIATION_REQUIRED',410);
  }
  if(!identity&&!receipt)return null;
  if(!identity||!receipt||identity.entityId!==m.entityId||receipt.replayUntil.getTime()<=this.auth.clock()||receipt.replayUntil.getTime()-receipt.committedAt.getTime()<90*86400000||receipt.committedAt.getTime()!==identity.committedAt.getTime())reject('RECONCILIATION_REQUIRED',410);
  const result=this.publicReceipt(receipt.result,generation),proof=this.publicReceipt(identity.result,generation);
  if(result.mutationId!==m.mutationId||result.payloadHash!==m.payloadHash||canonicalJson(result)!==canonicalJson(proof))reject('RECONCILIATION_REQUIRED',410);
  const branch=identity.result.branchResult,targets=[...result.entityIds,...result.artifactIds,...result.conflictRefs.flatMap((r:Value)=>[r.entityId,r.conflictOf]),...[branch?.datasetId,branch?.declaredBranchId].filter((id)=>typeof id==='string')];
  if(await this.metadata.tombstones.findOne({ownerId,entityId:{$in:targets}},{session:s}))reject('RESOURCE_DELETED',410);
  if(branch){
   const dataset=await this.metadata.datasets.findOne({_id:branch.datasetId,ownerId,projectId:m.projectId},{session:s}),actual=await this.metadata.branches.findOne({_id:branch.branchId,ownerId,projectId:m.projectId,datasetId:branch.datasetId},{session:s});
   if(dataset?.state!=='active'||!actual)reject('RECONCILIATION_REQUIRED',410);
  }
  return result;
 }
 /** Real fenced replay lookup. Missing/expired authority never becomes a new write. */
 async receipt(rawToken:string|undefined,mutationId:string,serverGeneration:string){
  assertSchema('uuid.json',mutationId);assertSchema('uuid.json',serverGeneration);
  return this.auth.withFence(rawToken,async(s,identity)=>{
   await this.generationFence(s,serverGeneration);const proof=await this.metadata.identities.findOne({ownerId:identity.user._id,mutationId},{session:s});if(!proof)reject('RESOURCE_NOT_FOUND',404);
   const m={projectId:proof.projectId,entityId:proof.entityId,mutationId,payloadHash:proof.canonicalHash};
   await this.guard(s,identity,{serverGeneration,mutations:[m],artifacts:(proof.result.artifactIds??[]).map((artifactId:string)=>({artifactId}))});
   const receipt=await this.replay(s,identity.user._id,m,serverGeneration);if(!receipt)reject('RECONCILIATION_REQUIRED',410);return {serverGeneration,receipt};
  });
 }
 /** Prepare hashes/byte proofs outside transactions; commit one whole group at a time. */
 async commit(rawToken:string|undefined,batchId:string,body:Value,{requestId}:{requestId:string}){
  assertSchema('uuid.json',batchId);assertSchema('sync-commit-request.json',body);const request=structuredClone(body),responseId=requestId;
  if(typeof responseId!=='string'||!(/^[A-Za-z0-9_-]{1,128}$/).test(responseId))reject('VALIDATION_FAILED');
  const captured=await this.auth.withFence(rawToken,(s,identity)=>this.load(s,identity,batchId)),declaration=captured.declaration;
  const selection=await prepareCommitRequest(declaration,request,{batchId,serverGeneration:captured.serverGeneration}),prepared=await prepareDeclaration(declaration),byId=new Map<string,Value>(declaration.mutations.map((m:Value)=>[m.mutationId,m])),outcomes=new Map<string,Value>();
  const expectedFailures=new Set(['ARTIFACT_NOT_READY','STORAGE_UNAVAILABLE','STORAGE_CAPACITY_EXCEEDED','PREVIEW_STALE','INVALID_SOURCE','HASH_MISMATCH','IDEMPOTENCY_MISMATCH','REVISION_CONFLICT','RECONCILIATION_REQUIRED','DEPENDENCY_NOT_READY','RESOURCE_DELETED','RESOURCE_NOT_FOUND','VALIDATION_FAILED']);
  for(const group of selection.requestedGroups){
   const members=group.mutationIds.map((id:string)=>byId.get(id)!),scope={serverGeneration:captured.serverGeneration,mutations:members,artifacts:[...new Map<string,Value>(members.flatMap((m:Value)=>prepared.ownArtifactsByMutation[m.mutationId]).map((a:Value)=>[a.artifactId,a])).values()]},handles=new Map<string,object>();
   try{
    const identity=await this.auth.identity(rawToken);
    for(const m of members){
     // Avoid byte preflight for a retained commit. Authority is rechecked in the transaction.
     const old=await this.metadata.identities.findOne({ownerId:identity.user._id,mutationId:m.mutationId});
     if(!old)handles.set(m.mutationId,await this.mutations.prepareMutation(m,prepared.ownArtifactsByMutation[m.mutationId],{ownerId:identity.user._id,sourceHandles:[...handles].filter(([id])=>byId.get(id)!.projectId===m.projectId).map(([,handle])=>handle)}));
    }
    const receipts=await this.auth.withFence(rawToken,async(s,identity)=>{
     const b=await this.load(s,identity,batchId);if(b.snapshotHash!==captured.snapshotHash)reject('IDEMPOTENCY_MISMATCH',409);await this.guard(s,identity,scope);
     const ids=new Set<string>(group.mutationIds),result:Value[]=[];
     // All external group dependencies must already have durable commit authority.
     for(const m of members)for(const depId of m.dependencies)if(!ids.has(depId)){
      const dep=await this.metadata.identities.findOne({ownerId:identity.user._id,projectId:m.projectId,mutationId:depId},{session:s});
      if(!dep)reject(byId.has(depId)?'DEPENDENCY_NOT_READY':'RECONCILIATION_REQUIRED',410);
      if(dep.serverGeneration!==captured.serverGeneration)reject('RECONCILIATION_REQUIRED',410);
      if(byId.has(depId)&&dep.canonicalHash!==byId.get(depId)!.payloadHash)reject('IDEMPOTENCY_MISMATCH',409);
     }
     for(const m of members){
      let receipt=await this.replay(s,identity.user._id,m,captured.serverGeneration);
      if(!receipt){
       const handle=handles.get(m.mutationId);if(!handle)reject('RECONCILIATION_REQUIRED',410);
       const committed=await this.mutations.commitPrepared(s,identity,handle,captured.serverGeneration),proof=await this.metadata.identities.findOne({ownerId:identity.user._id,mutationId:m.mutationId},{session:s});if(!proof)reject('RECONCILIATION_REQUIRED',410);
       receipt=this.publicReceipt(committed,captured.serverGeneration);
       const conflict=committed.branchResult?.conflict;
       if(conflict)await this.c.conflicts.insertOne({_id:randomUUID(),ownerId:identity.user._id,projectId:m.projectId,mutationId:m.mutationId,kind:'branch',conflictOf:conflict.conflictOf,serverRef:{branchId:conflict.conflictOf,versionId:conflict.serverVersionId},localCopyRef:{branchId:committed.branchResult.branchId,versionId:committed.branchResult.versionId},baseRevision:conflict.baseRevision,baseVersionId:conflict.baseVersionId,serverRevision:conflict.serverRevision,sourceSnapshot:conflict.sourceSnapshot,state:'unresolved',serverGeneration:captured.serverGeneration,createdAt:new Date(this.auth.clock())},{session:s});
       await this.c.receipts.insertOne({_id:randomUUID(),ownerId:identity.user._id,projectId:m.projectId,mutationId:m.mutationId,canonicalHash:m.payloadHash,serverGeneration:captured.serverGeneration,result:committed,committedAt:proof.committedAt,replayUntil:new Date(proof.committedAt.getTime()+90*86400000)},{session:s});
       const project=await this.metadata.projects.findOneAndUpdate({_id:m.projectId,ownerId:identity.user._id,state:'active'},{$inc:{changeSequence:1}},{session:s,returnDocument:'after'});if(!project)reject('RESOURCE_DELETED',410);
       if(!Number.isSafeInteger(project.changeSequence)||project.changeSequence<0)reject('RESOURCE_LIMIT_EXCEEDED');
       await this.c.changes.insertOne({_id:randomUUID(),ownerId:identity.user._id,projectId:m.projectId,sequence:project.changeSequence,metadataRevision:project.metadataRevision,mutationId:m.mutationId,kind:m.kind,entityIds:receipt.entityIds,revisions:receipt.revisions,serverGeneration:captured.serverGeneration,createdAt:new Date(this.auth.clock())},{session:s});
      }result.push(receipt);
     }
     const completed=new Set<string>(b.completedGroupIds??[]);completed.add(group.groupId);
     await this.c.batches.updateOne({_id:b._id},{$set:{completedGroupIds:[...completed],state:completed.size===declaration.atomicGroups.length?'committed':'partial'}},{session:s});return result;
    });
    for(const receipt of receipts)outcomes.set(receipt.mutationId,{kind:'acknowledged',receipt});
   }catch(e){
    // Unknown failures propagate, preserving any earlier committed groups for replay.
    if(!(e instanceof AuthError)||!expectedFailures.has(e.code))throw e;
    const pending=['ARTIFACT_NOT_READY','STORAGE_UNAVAILABLE','STORAGE_CAPACITY_EXCEEDED','PREVIEW_STALE','REVISION_CONFLICT','RECONCILIATION_REQUIRED','DEPENDENCY_NOT_READY'].includes(e.code);
    for(const m of members)outcomes.set(m.mutationId,pending?{kind:'pending',mutationId:m.mutationId,code:e.code,retryable:['ARTIFACT_NOT_READY','DEPENDENCY_NOT_READY','STORAGE_UNAVAILABLE','STORAGE_CAPACITY_EXCEEDED'].includes(e.code)}:{kind:'rejected',mutationId:m.mutationId,code:e.code});
   }
  }
  for(const m of declaration.mutations)if(!outcomes.has(m.mutationId))outcomes.set(m.mutationId,{kind:'pending',mutationId:m.mutationId,code:'MUTATION_NOT_REQUESTED',retryable:false});
  const ack=await assembleAck(declaration,[...outcomes.values()],{serverGeneration:captured.serverGeneration,requestId:responseId,cursor:null});
  await this.auth.withFence(rawToken,async(s,identity)=>{
   await this.load(s,identity,batchId);
   const acknowledged=declaration.mutations.filter((m:Value)=>outcomes.get(m.mutationId)?.kind==='acknowledged');
   if(acknowledged.length)await this.guard(s,identity,{serverGeneration:captured.serverGeneration,mutations:acknowledged,artifacts:acknowledged.flatMap((m:Value)=>prepared.ownArtifactsByMutation[m.mutationId])});
   for(const m of acknowledged){const r=await this.replay(s,identity.user._id,m,captured.serverGeneration);if(!r||canonicalJson(r)!==canonicalJson(outcomes.get(m.mutationId)!.receipt))reject('RECONCILIATION_REQUIRED',410);}
  });return ack;
 }
}
