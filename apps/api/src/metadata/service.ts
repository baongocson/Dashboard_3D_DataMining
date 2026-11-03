import {randomUUID,randomBytes} from 'node:crypto';
import type {ClientSession} from 'mongodb';
import {assertSchema,assertVersionCreateMutation} from '../../../../packages/contracts/src/index.mjs';
import {canonicalJson,hashCanonical,mutationHash,collectVersionArtifacts} from '../../../../packages/data-format/src/index.mjs';
import {AuthService} from '../auth/service.ts';
import type {AuthIdentity} from '../auth/service.ts';
import type {RecordDoc} from '../auth/schema.ts';
import {reject} from '../auth/policy.ts';
import {metadataCollections,prepareMetadata} from './schema.ts';
type Value=Record<string,any>;
export type ArtifactAuthority={prepare?:(ownerId:string,projectId:string,descriptors:Value[],mutation:Value,sourceHandles?:object[])=>Promise<object>;assertReady:(s:ClientSession,scope:{ownerId:string;projectId:string},descriptors:Value[],proof?:object)=>Promise<void>};
type ReadKind='projects'|'datasets'|'versions'|'branches';
const opaque=()=>randomBytes(32).toString('base64url');
const projectView=(p:RecordDoc)=>({projectId:p._id,name:p.name,revision:p.revision,createdAtServer:p.createdAtServer.toISOString(),updatedAtServer:p.updatedAtServer.toISOString()});
const datasetView=(d:RecordDoc)=>({datasetId:d._id,projectId:d.projectId,name:d.name,kind:d.kind,sourceArtifactId:d.sourceArtifactId,parseConfig:d.parseConfig,v0VersionId:d.v0VersionId,defaultBranchId:d.defaultBranchId,revision:d.revision,createdAtServer:d.createdAtServer.toISOString(),updatedAtServer:d.updatedAtServer.toISOString()});
const versionView=(v:RecordDoc)=>({...v.content,branchId:v.branchId,...(v.branchId!==v.content.branchId?{declaredBranchId:v.content.branchId}:{}),projectId:v.projectId,revision:v.revision,contentHash:v.contentHash,createdAtServer:v.createdAtServer.toISOString()});
const branchView=(b:RecordDoc)=>({branchId:b._id,projectId:b.projectId,datasetId:b.datasetId,forkVersionId:b.forkVersionId,headVersionId:b.headVersionId,headRevision:b.headRevision,reason:b.reason,conflictOf:b.conflictOf??null});
export class MetadataService {
 readonly auth:AuthService;readonly c;private artifacts?:ArtifactAuthority;
 private preserveVersionConflicts:boolean;
 private prepared=new WeakMap<object,{mutation:Value;artifacts:Value[];ownerId?:string;proof?:object}>();
 constructor(auth:AuthService,{artifacts,preserveVersionConflicts=false}:{artifacts?:ArtifactAuthority;preserveVersionConflicts?:boolean}={}){this.auth=auth;this.c=metadataCollections(auth.db);this.artifacts=artifacts;this.preserveVersionConflicts=preserveVersionConflicts;}
 async ready(){await prepareMetadata(this.auth.db);}
 private async generation(s:ClientSession,expected:string){
  assertSchema('uuid.json',expected);
  const result=await this.auth.c.control.updateOne({_id:'server',serverGeneration:expected},{$inc:{metadataFence:1}},{session:s});
  if(result.matchedCount!==1)reject('RECONCILIATION_REQUIRED',410);
 }
 private async deleted(s:ClientSession,ownerId:string,ids:string[]){
  if(await this.c.tombstones.findOne({ownerId,entityId:{$in:ids}},{session:s}))reject('RESOURCE_DELETED',410);
 }
 private async project(s:ClientSession,ownerId:string,id:string,write=false){
  await this.deleted(s,ownerId,[id]);const p=await this.c.projects.findOne({_id:id,ownerId},{session:s});
  if(!p)reject('RESOURCE_NOT_FOUND',404);if(p.state!=='active')reject('RESOURCE_DELETED',410);
  if(write)await this.c.projects.updateOne({_id:id,ownerId,state:'active'},{$inc:{dependencyFence:1}},{session:s});return p;
 }
 private async dataset(s:ClientSession,ownerId:string,id:string,projectId?:string){
  const d=await this.c.datasets.findOne({_id:id,ownerId,...(projectId?{projectId}:{})},{session:s});
  if(!d)reject('RESOURCE_NOT_FOUND',404);await this.project(s,ownerId,d.projectId);await this.deleted(s,ownerId,[id]);
  if(d.state!=='active')reject('RESOURCE_DELETED',410);return d;
 }
 private async source(s:ClientSession,ownerId:string,projectId:string,ref:Value){
  await this.dataset(s,ownerId,ref.datasetId,projectId);await this.deleted(s,ownerId,[ref.versionId]);
  const v=await this.c.versions.findOne({_id:ref.versionId,ownerId,projectId,datasetId:ref.datasetId},{session:s});
  if(!v)reject('INVALID_SOURCE');return v;
 }
 private async sources(s:ClientSession,ownerId:string,projectId:string,refs:Value[]){
  const results=[];const seen=new Set<string>();
  for(const [i,ref]of refs.entries()){
   if(ref.sourceOrder!==undefined&&ref.sourceOrder!==i||seen.has(ref.versionId+':'+ref.role))reject('INVALID_SOURCE');seen.add(ref.versionId+':'+ref.role);
   const v=await this.source(s,ownerId,projectId,ref);results.push({datasetId:v.datasetId,versionId:v._id,revision:v.revision});
  }return results;
 }
 async importIntent(rawToken:string|undefined,input:Value){
  assertSchema('metadata-intent-request.json',input);const body=structuredClone(input),fingerprint=canonicalJson(body);
  if(new Set([body.projectId,body.logicalImportId,body.datasetId,body.versionId,body.mutationId]).size!==5)reject('VALIDATION_FAILED');
  return this.auth.withFence(rawToken,async(s,{user,session})=>{
   const ownerId=user._id;await this.generation(s,this.auth.sessionView({user,session}).serverGeneration);await this.project(s,ownerId,body.projectId,true);
   const old=await this.c.intents.findOne({ownerId,logicalImportId:body.logicalImportId},{session:s});
   if(old&&old.fingerprint!==fingerprint)reject('IDEMPOTENCY_MISMATCH',409);
   const reserved=await this.c.intents.findOne({ownerId,$or:[{mutationId:body.mutationId},{datasetId:body.datasetId},{versionId:body.versionId}]},{session:s});
   if(reserved&&reserved._id!==old?._id)reject('IDEMPOTENCY_MISMATCH',409);
   await this.deleted(s,ownerId,[body.datasetId,body.versionId]);
   const receipt=await this.c.identities.findOne({ownerId,mutationId:body.mutationId},{session:s});
   if(receipt&&(!old||receipt.entityId!==body.datasetId||receipt.projectId!==body.projectId))reject('IDEMPOTENCY_MISMATCH',409);
   const now=this.auth.clock(),sourceRevisions=await this.sources(s,ownerId,body.projectId,body.sourceRefs??[]);
   if(old&&old.serverGeneration!==this.auth.sessionView({user,session}).serverGeneration)reject('RECONCILIATION_REQUIRED',410);
   if(!receipt){
    if(await this.c.datasets.findOne({_id:body.datasetId},{session:s})||await this.c.versions.findOne({_id:body.versionId},{session:s}))reject('RECONCILIATION_REQUIRED',410);
    await this.deleted(s,ownerId,[body.datasetId,body.versionId]);
   }
   const intentId=old?old._id:opaque(),expiresAt=new Date(now+1800000);
   if(!receipt)await this.c.intents.updateOne({_id:intentId},{$set:{ownerId,projectId:body.projectId,logicalImportId:body.logicalImportId,mutationId:body.mutationId,datasetId:body.datasetId,versionId:body.versionId,fingerprint,request:body,sourceRevisions,sessionId:session._id,authEpoch:session.authEpoch,expiresAt,serverGeneration:this.auth.sessionView({user,session}).serverGeneration}},{upsert:true,session:s});
   const response={intentId,logicalImportId:body.logicalImportId,expiresAt:(receipt?old!.expiresAt:expiresAt).toISOString(),serverNow:new Date(now).toISOString(),sourceRevisions,status:receipt?'alreadyCommitted':'granted',committedMutationId:receipt?body.mutationId:null};
   assertSchema('metadata-intent-response.json',response);return response;
  });
 }
 private descriptors(m:Value,artifacts:Value[]){
  if(m.kind==='dataset.version.create')return collectVersionArtifacts(m,artifacts);
  if(m.kind==='dataset.create'){
   assertSchema('metadata-dataset-create.json',m.payload);const {dataset:d,initialVersion:p}=m.payload;
   const synthetic={...m,kind:'dataset.version.create',entityId:p.version.versionId,payload:p};
   const versionArtifacts=collectVersionArtifacts(synthetic,artifacts);
   if(d.kind==='imported'){
    const source=artifacts.find(a=>a.artifactId===d.sourceArtifactId);if(!source||source.purpose!=='source'||source.projectId!==m.projectId||source.sizeBytes>20000000||source.dependencyArtifactIds.length)reject('INVALID_SOURCE');
    return [source,...versionArtifacts];
   }
   if(d.sourceArtifactId!==null)reject('INVALID_SOURCE');return versionArtifacts;
  }
  if(artifacts.length)reject('VALIDATION_FAILED');return [];
 }
 // Composable local-dev commit foundation. B033 owns HTTP batch/ACK and conflict preservation.
 // The default has no artifact authority: dataset/version commits fail closed until B032 is wired.
 async prepareMutation(input:Value,artifacts:Value[],{ownerId,sourceHandles=[]}:{ownerId?:string;sourceHandles?:object[]}={}):Promise<object>{
  if(!Array.isArray(sourceHandles)||sourceHandles.length>20)reject('VALIDATION_FAILED');const capturedSources=[...sourceHandles];
  const m=structuredClone(input),declared=structuredClone(artifacts);assertSchema('mutation-envelope.json',m);
  if(m.mutationId===m.entityId||m.mutationId===m.projectId)reject('VALIDATION_FAILED');
  if(m.dependencies.includes(m.mutationId))reject('VALIDATION_FAILED');
  const supported=['project.create','project.rename','dataset.create','dataset.rename','dataset.version.create'];
  if(!supported.includes(m.kind))reject('UNSUPPORTED_OPERATION');
  if(['project.create','project.rename','dataset.rename'].includes(m.kind))assertSchema('metadata-name-payload.json',m.payload);
  const own=this.descriptors(m,declared);if(await mutationHash(m,own)!==m.payloadHash)reject('HASH_MISMATCH');
  if(m.kind==='dataset.create'&&await hashCanonical({parseConfig:m.payload.dataset.parseConfig,operationSnapshot:m.payload.initialVersion.version.operationSnapshot})!==m.payload.configHash)reject('HASH_MISMATCH');
  let proof:object|undefined;if(own.length&&this.artifacts?.prepare){
   if(!ownerId)reject('AUTH_REQUIRED',401);
   const proofs:object[]=[];for(const handle of capturedSources){const source=this.prepared.get(handle);if(!source||source.ownerId!==ownerId||source.mutation.projectId!==m.projectId)reject('INVALID_SOURCE');if(source.proof)proofs.push(source.proof);}
   proof=await this.artifacts.prepare(ownerId,m.projectId,own,m,proofs);
  }
  const handle=Object.freeze({});this.prepared.set(handle,{mutation:m,artifacts:own,ownerId,proof});return handle;
 }
 async commit(rawToken:string|undefined,input:Value,artifacts:Value[],serverGeneration:string){
  const identity=await this.auth.identity(rawToken),prepared=await this.prepareMutation(input,artifacts,{ownerId:identity.user._id});
  return this.auth.withFence(rawToken,(s,identity)=>this.commitPrepared(s,identity,prepared,serverGeneration));
 }
 // B033 can compose multiple prepared mutations in one auth.withFence transaction.
 // Handles expose no mutable business content; hashing is completed before this method.
 async commitPrepared(s:ClientSession,identity:AuthIdentity,handle:object,serverGeneration:string){
   const prepared=this.prepared.get(handle);if(!prepared||!s.inTransaction())reject('VALIDATION_FAILED');
   const {mutation:m,artifacts:own}=prepared;
   if(prepared.ownerId&&prepared.ownerId!==identity.user._id)reject('FORBIDDEN',403);
   const ownerId=identity.user._id;await this.generation(s,serverGeneration);
   // Tombstones precede replay: a durable identity must not resurrect deleted resources.
   await this.deleted(s,ownerId,[m.projectId,m.entityId]);
   if(m.kind!=='project.create')await this.project(s,ownerId,m.projectId,true);
   const prior=await this.c.identities.findOne({ownerId,mutationId:m.mutationId},{session:s});
   if(prior){if(prior.canonicalHash!==m.payloadHash||prior.projectId!==m.projectId||prior.serverGeneration!==serverGeneration)reject('IDEMPOTENCY_MISMATCH',409);return prior.result;}
   for(const id of m.dependencies){const dep=await this.c.identities.findOne({ownerId,projectId:m.projectId,mutationId:id,serverGeneration},{session:s});if(!dep)reject('RECONCILIATION_REQUIRED',410);}
   let result:Value;const now=new Date(this.auth.clock());
   if(m.kind==='project.create'){
    if(m.baseRevision!==0||m.projectId!==m.entityId)reject('VALIDATION_FAILED');
    if(await this.c.projects.findOne({_id:m.entityId},{session:s}))reject('IDEMPOTENCY_MISMATCH',409);
    await this.c.projects.insertOne({_id:m.entityId,ownerId,schemaVersion:1,name:m.payload.name,state:'active',revision:1,dependencyFence:0,createdAtServer:now,updatedAtServer:now},{session:s});
    result={entityIds:[m.entityId],artifactIds:[],revisions:[{entityId:m.entityId,revision:1}]};
   }else if(m.kind==='project.rename'||m.kind==='dataset.rename'){
    const project=m.kind==='project.rename';if(project&&m.entityId!==m.projectId)reject('INVALID_SOURCE');
    const entity=project?await this.project(s,ownerId,m.entityId):await this.dataset(s,ownerId,m.entityId,m.projectId),collection=project?this.c.projects:this.c.datasets;
    if(entity.revision!==m.baseRevision)reject('REVISION_CONFLICT',409);
    await collection.updateOne({_id:m.entityId,ownerId,revision:m.baseRevision},{$set:{name:m.payload.name,updatedAtServer:now},$inc:{revision:1}},{session:s});
    result={entityIds:[m.entityId],artifactIds:[],revisions:[{entityId:m.entityId,revision:entity.revision+1}]};
   }else if(m.kind==='dataset.create'){
    const {dataset:d,initialVersion:p}=m.payload;
    if(m.baseRevision!==0||m.entityId!==d.datasetId||d.v0VersionId!==p.version.versionId||d.defaultBranchId!==p.version.branchId||p.version.datasetId!==d.datasetId||p.version.parentVersionId!==null||p.expectedHead.kind!=='known'||p.expectedHead.versionId!==null||p.expectedHead.revision!==0||p.branch.reason!=='initial')reject('INVALID_SOURCE');
    const intent=await this.c.intents.findOne({_id:m.payload.intentId,ownerId,projectId:m.projectId,mutationId:m.mutationId},{session:s});
    if(!intent||intent.expiresAt.getTime()<=this.auth.clock()||intent.sessionId!==identity.session._id||intent.authEpoch!==identity.session.authEpoch||intent.serverGeneration!==serverGeneration)reject('PREVIEW_STALE',409);
    const r=intent.request;
    if(r.logicalImportId!==m.payload.logicalImportId||r.configHash!==m.payload.configHash||r.datasetId!==d.datasetId||r.versionId!==d.v0VersionId||canonicalJson(r.sourceRefs??[])!==canonicalJson(p.version.sourceVersions)||((r.kind==='import')!==(d.kind==='imported')))reject('IDEMPOTENCY_MISMATCH',409);
    if(d.kind==='imported'&&own[0].sizeBytes!==r.file.size)reject('INVALID_SOURCE');
    if(await this.c.datasets.findOne({_id:d.datasetId},{session:s}))reject('IDEMPOTENCY_MISMATCH',409);
    await this.c.datasets.insertOne({_id:d.datasetId,...d,ownerId,projectId:m.projectId,schemaVersion:1,state:'active',revision:1,createdAtServer:now,updatedAtServer:now},{session:s});
    result=await this.version(s,identity,{...m,kind:'dataset.version.create',entityId:d.v0VersionId,payload:p},own.filter(a=>a.purpose!=='source'),serverGeneration);
    result={...result,entityIds:[d.datasetId,...result.entityIds],artifactIds:own.map(a=>a.artifactId),revisions:[{entityId:d.datasetId,revision:1},...result.revisions]};
    // Source artifact also participates in readiness and references, never just metadata visibility.
    if(d.kind==='imported')await this.reference(s,ownerId,m.projectId,d.datasetId,d.sourceArtifactId,'artifact','source',0);
   }else if(m.kind==='dataset.version.create')result=await this.version(s,identity,m,own,serverGeneration,this.preserveVersionConflicts);
   else reject('UNSUPPORTED_OPERATION');
   if(own.length){if(!this.artifacts)reject('ARTIFACT_NOT_READY');await this.artifacts.assertReady(s,{ownerId,projectId:m.projectId},own,prepared.proof);}
   const receipt={mutationId:m.mutationId,payloadHash:m.payloadHash,...result,outcome:result.outcome??'committed',conflictRefs:result.conflictRefs??[]};
   await this.c.identities.insertOne({_id:randomUUID(),ownerId,projectId:m.projectId,entityId:m.entityId,mutationId:m.mutationId,kind:m.kind,canonicalHash:m.payloadHash,serverGeneration,result:receipt,committedAt:now},{session:s});
   const changed=await this.c.projects.findOneAndUpdate({_id:m.projectId,ownerId,state:'active'},{$inc:{metadataRevision:1}},{session:s,returnDocument:'after'});
   if(!changed)reject('RESOURCE_DELETED',410);if(!Number.isSafeInteger(changed.metadataRevision)||changed.metadataRevision<0)reject('RESOURCE_LIMIT_EXCEEDED');
   return receipt;
 }
 private async reference(s:ClientSession,ownerId:string,projectId:string,from:string,to:string,type:string,relation:string,sourceOrder:number){
  await this.c.refs.insertOne({_id:randomUUID(),ownerId,projectId,sourceEntityId:from,sourceRevision:1,targetEntityId:to,targetEntityType:type,relation,strength:'hard',sourceOrder},{session:s});
 }
 private async version(s:ClientSession,identity:AuthIdentity,m:Value,own:Value[],serverGeneration:string,preserveConflict=false){
  assertVersionCreateMutation(m);const ownerId=identity.user._id,{version:v,expectedHead:head,branch}=m.payload;
  if(new Set([m.projectId,v.datasetId,v.versionId,v.branchId,v.tableManifestId]).size!==5)reject('INVALID_SOURCE');
  const dataset=await this.dataset(s,ownerId,v.datasetId,m.projectId);await this.deleted(s,ownerId,[v.versionId,v.branchId]);
  if(await this.c.versions.findOne({_id:v.versionId},{session:s}))reject('IDEMPOTENCY_MISMATCH',409);
  await this.sources(s,ownerId,m.projectId,v.sourceVersions);
  if(v.parentVersionId){await this.source(s,ownerId,m.projectId,{datasetId:v.datasetId,versionId:v.parentVersionId});if(!v.sourceVersions.some((r:Value)=>r.versionId===v.parentVersionId&&r.datasetId===v.datasetId))reject('INVALID_SOURCE');}
  if(branch.forkVersionId)await this.source(s,ownerId,m.projectId,{datasetId:v.datasetId,versionId:branch.forkVersionId});
  let expectedVersion=head.versionId,expectedRevision=head.revision,targetBranchId=v.branchId;
  if(head.kind==='dependency'){
   const prior=await this.c.identities.findOne({ownerId,projectId:m.projectId,mutationId:head.fromMutationId,serverGeneration},{session:s});if(!prior)reject('RECONCILIATION_REQUIRED',410);
   const resolved=prior.result.branchResult;
   if(!resolved||(resolved.declaredBranchId??resolved.branchId)!==head.branchId||resolved.datasetId!==v.datasetId)reject('INVALID_SOURCE');
   targetBranchId=resolved.branchId;expectedVersion=resolved.versionId;expectedRevision=resolved.revision;
  }
  const declared=await this.c.branches.findOne({_id:v.branchId},{session:s}),current=targetBranchId===v.branchId?declared:await this.c.branches.findOne({_id:targetBranchId},{session:s});
  for(const b of [declared,current])if(b&&(b.ownerId!==ownerId||b.projectId!==m.projectId||b.datasetId!==v.datasetId))reject('INVALID_SOURCE');
  await this.deleted(s,ownerId,[targetBranchId]);
  if(declared&&(declared.forkVersionId!==branch.forkVersionId||declared.reason!==branch.reason))reject('INVALID_SOURCE');
  if(!declared&&branch.reason==='syncConflict')reject('INVALID_SOURCE');
  if(targetBranchId!==v.branchId&&(!current||current.reason!=='syncConflict'||!current.conflictOf))reject('INVALID_SOURCE');
  const mismatch=(current?.headVersionId??null)!==expectedVersion||(current?.headRevision??0)!==expectedRevision;
  let actualBranchId=targetBranchId,conflict:Value|null=null;
  if(mismatch){
   if(!preserveConflict)reject('REVISION_CONFLICT',409);
   // Empty/new branch claims never authorize overwriting or manufacturing a conflict.
   if(expectedVersion===null||expectedRevision===0)reject('INVALID_SOURCE');
   if(!current||expectedRevision>=current.headRevision)reject('RECONCILIATION_REQUIRED',410);
   await this.source(s,ownerId,m.projectId,{datasetId:v.datasetId,versionId:expectedVersion});
   if(v.parentVersionId!==expectedVersion)reject('INVALID_SOURCE');
   if(head.kind==='known'){
    const history=await this.c.identities.findOne({ownerId,projectId:m.projectId,serverGeneration,'result.branchResult.datasetId':v.datasetId,'result.branchResult.branchId':targetBranchId,'result.branchResult.versionId':expectedVersion,'result.branchResult.revision':expectedRevision},{session:s});
    if(!history)reject('RECONCILIATION_REQUIRED',410);
   }
   actualBranchId=randomUUID();
   conflict={conflictOf:targetBranchId,serverVersionId:current.headVersionId,serverRevision:current.headRevision,baseVersionId:expectedVersion,baseRevision:expectedRevision,sourceSnapshot:structuredClone(v.sourceVersions)};
  }else{
   if(current&&v.parentVersionId!==current.headVersionId)reject('INVALID_SOURCE');
   if(!current&&branch.reason==='undoContinuation'&&v.parentVersionId!==branch.forkVersionId)reject('INVALID_SOURCE');
   if(!current&&branch.reason==='initial'&&v.parentVersionId!==null)reject('INVALID_SOURCE');
   if(!current&&branch.reason==='initial'&&(dataset.v0VersionId!==v.versionId||dataset.defaultBranchId!==v.branchId))reject('INVALID_SOURCE');
  }
  const now=new Date(this.auth.clock()),revision=conflict?1:(current?.headRevision??0)+1;
  await this.c.versions.insertOne({_id:v.versionId,ownerId,projectId:m.projectId,datasetId:v.datasetId,branchId:actualBranchId,parentVersionId:v.parentVersionId,content:v,contentHash:m.payloadHash,revision:1,schemaVersion:1,createdAtServer:now},{session:s});
  if(conflict)await this.c.branches.insertOne({_id:actualBranchId,ownerId,projectId:m.projectId,datasetId:v.datasetId,forkVersionId:v.parentVersionId,headVersionId:v.versionId,headRevision:revision,reason:'syncConflict',conflictOf:targetBranchId},{session:s});
  else if(current){
   const update=await this.c.branches.updateOne({_id:targetBranchId,ownerId,projectId:m.projectId,datasetId:v.datasetId,headVersionId:current.headVersionId,headRevision:current.headRevision},{$set:{headVersionId:v.versionId,headRevision:revision}},{session:s});if(update.modifiedCount!==1)reject('REVISION_CONFLICT',409);
  }else await this.c.branches.insertOne({_id:actualBranchId,ownerId,projectId:m.projectId,datasetId:v.datasetId,forkVersionId:branch.forkVersionId,headVersionId:v.versionId,headRevision:revision,reason:branch.reason,conflictOf:null},{session:s});
  for(const [i,r]of v.sourceVersions.entries())await this.reference(s,ownerId,m.projectId,v.versionId,r.versionId,'version','sourceVersion',i);
  for(const [i,a]of own.entries())await this.reference(s,ownerId,m.projectId,v.versionId,a.artifactId,'artifact','versionArtifact',i);
  return {entityIds:[v.versionId,actualBranchId],artifactIds:own.map(a=>a.artifactId),revisions:[{entityId:v.versionId,revision:1},{entityId:actualBranchId,revision}],outcome:conflict?'conflictPreserved':'committed',conflictRefs:conflict?[{kind:'branch',entityId:actualBranchId,conflictOf:targetBranchId}]:[],branchResult:{datasetId:v.datasetId,declaredBranchId:v.branchId,branchId:actualBranchId,versionId:v.versionId,revision,...(conflict?{conflict}: {})}};
 }

 async read(rawToken:string|undefined,kind:'project'|'version',id:string){
  assertSchema('uuid.json',id);return this.auth.withFence(rawToken,async(s,identity)=>{
   const {user}=identity;await this.generation(s,this.auth.sessionView(identity).serverGeneration);
   if(kind==='project')return projectView(await this.project(s,user._id,id));
   const v=await this.c.versions.findOne({_id:id,ownerId:user._id},{session:s});if(!v)reject('RESOURCE_NOT_FOUND',404);
   await this.dataset(s,user._id,v.datasetId);await this.deleted(s,user._id,[id]);return versionView(v);
  });
 }
 async list(rawToken:string|undefined,kind:ReadKind,scopeId:string|null,query:Value={}){
  assertSchema('metadata-query.json',query);if(scopeId)assertSchema('uuid.json',scopeId);if(query.branchId&&kind!=='versions')reject('VALIDATION_FAILED');
  return this.auth.withFence(rawToken,async(s,identity)=>{
   const {user}=identity;await this.generation(s,this.auth.sessionView(identity).serverGeneration);
   const ownerId=user._id,limit=Number(query.limit??'50'),filter:Value={ownerId},scope={kind,scopeId,branchId:query.branchId??null};
   if(kind==='datasets'){if(!scopeId)reject('INVALID_SOURCE');await this.project(s,ownerId,scopeId);filter.projectId=scopeId;filter.state='active';}
   if(kind==='versions'||kind==='branches'){if(!scopeId)reject('INVALID_SOURCE');await this.dataset(s,ownerId,scopeId);filter.datasetId=scopeId;}
   if(kind==='projects')filter.state='active';if(query.branchId)filter.branchId=query.branchId;
   if(query.cursor){const c=await this.c.cursors.findOne({_id:query.cursor,ownerId},{session:s});if(!c||c.expiresAt.getTime()<=this.auth.clock()||canonicalJson(c.scope)!==canonicalJson(scope))reject('CURSOR_EXPIRED',410);filter._id={$gt:c.afterId};}
   const docs=await this.c[kind].find(filter,{session:s}).sort({_id:1}).limit(limit+1).toArray(),hasMore=docs.length>limit,items=docs.slice(0,limit).map(kind==='projects'?projectView:kind==='datasets'?datasetView:kind==='versions'?versionView:branchView);
   let nextCursor=null;if(hasMore){nextCursor=opaque();await this.c.cursors.insertOne({_id:nextCursor,ownerId,scope,afterId:docs[limit-1]._id,expiresAt:new Date(this.auth.clock()+1800000)},{session:s});}
   const page={items,nextCursor};assertSchema('metadata-page.json',page);return page;
  });
 }
}
