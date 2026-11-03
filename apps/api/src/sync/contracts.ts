import {assertSchema,assertVersionCreateMutation,assertJson,fail} from '../../../../packages/contracts/src/index.mjs';
import {canonicalJson,mutationHash,hashCanonical} from '../../../../packages/data-format/src/index.mjs';
import limits from '../../../../packages/contracts/limits/local-dev.v1.json' with {type:'json'};
type Value=Record<string,any>;
export function projectReceipt(result:Value,generation:string){
 if(!result||typeof result!=='object'||Array.isArray(result))fail('VALIDATION_FAILED');
 const {mutationId,payloadHash,entityIds,artifactIds,revisions,outcome,conflictRefs}=result;
 const receipt={mutationId,payloadHash,entityIds,artifactIds,revisions,outcome,conflictRefs};
 assertSchema('sync-ack.json',{batchId:mutationId,status:'committed',acknowledged:[receipt],pending:[],rejected:[],cursor:null,serverGeneration:generation,requestId:'receipt-validation'});return receipt;
}
export const PREPARATION_KINDS=Object.freeze(['project.create','project.rename','dataset.create','dataset.rename','dataset.version.create']);
function freeze<T>(value:T):T {if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function ordered(ids:string[],dependencies:Map<string,Set<string>>){
 const remaining=new Set(ids),result:string[]=[];
 while(remaining.size){let progress=false;for(const id of ids)if(remaining.has(id)&&[...(dependencies.get(id)??[])].every(dep=>!remaining.has(dep))){remaining.delete(id);result.push(id);progress=true;}if(!progress)fail('VALIDATION_FAILED',{reason:'dependencyCycle'});}
 return result;
}
// Typed table graph order matches shared collectVersionArtifacts. It is bounded
// and nonrecursive: manifest -> ordered leaf table chunks -> optional leaf lineage.
function versionArtifacts(m:Value,byId:Map<string,Value>){
 assertVersionCreateMutation(m);const v=m.payload.version;
 const get=(id:string)=>{const d=byId.get(id);if(!d||d.projectId!==m.projectId)fail('INVALID_SOURCE');return d;};
 const root=get(v.tableManifestId);if(root.purpose!=='tableManifest'||root.formatVersion!=='table-jsonl-v1')fail('INVALID_SOURCE');
 const result=[root];
 for(const id of root.dependencyArtifactIds){const d=get(id);if(d.purpose!=='tableChunk'||d.formatVersion!=='table-jsonl-v1'||d.dependencyArtifactIds.length)fail('INVALID_SOURCE');result.push(d);}
 if(v.rowLineageArtifactId){const d=get(v.rowLineageArtifactId);if(d.purpose!=='rowLineage'||d.formatVersion!=='json-v1'||d.dependencyArtifactIds.length)fail('INVALID_SOURCE');result.push(d);}
 if(v.parentVersionId&&!v.sourceVersions.some((s:Value)=>s.datasetId===v.datasetId&&s.versionId===v.parentVersionId))fail('INVALID_SOURCE');
 return result;
}
async function ownArtifacts(m:Value,byId:Map<string,Value>){
 if(!PREPARATION_KINDS.includes(m.kind))fail('UNSUPPORTED_OPERATION');
 if(m.mutationId===m.entityId||m.mutationId===m.projectId||m.dependencies.includes(m.mutationId))fail('VALIDATION_FAILED');
 if(['project.create','project.rename','dataset.rename'].includes(m.kind)){
  assertSchema('metadata-name-payload.json',m.payload);
  if(m.kind.startsWith('project.')&&m.entityId!==m.projectId||m.kind==='project.create'&&m.baseRevision!==0)fail('VALIDATION_FAILED');
  return [];
 }
 if(m.kind==='dataset.version.create')return versionArtifacts(m,byId);
 assertSchema('metadata-dataset-create.json',m.payload);
 const {dataset:d,initialVersion:p}=m.payload;
 if(m.baseRevision!==0||m.entityId!==d.datasetId||d.v0VersionId!==p.version.versionId||d.defaultBranchId!==p.version.branchId||p.version.datasetId!==d.datasetId||p.version.parentVersionId!==null||p.expectedHead.kind!=='known'||p.expectedHead.versionId!==null||p.expectedHead.revision!==0||p.branch.reason!=='initial')fail('INVALID_SOURCE');
 if(await hashCanonical({parseConfig:d.parseConfig,operationSnapshot:p.version.operationSnapshot})!==m.payload.configHash)fail('HASH_MISMATCH');
 const typed=versionArtifacts({...m,kind:'dataset.version.create',entityId:d.v0VersionId,payload:p},byId);
 if(d.kind==='derived'){if(d.sourceArtifactId!==null)fail('INVALID_SOURCE');return typed;}
 const source=byId.get(d.sourceArtifactId);
 if(!source||source.projectId!==m.projectId||source.purpose!=='source'||source.dependencyArtifactIds.length)fail('INVALID_SOURCE');
 if(source.sizeBytes>limits.inputSourceMaxBytes)fail('INPUT_FILE_TOO_LARGE',{limit:limits.inputSourceMaxBytes});
 return [source,...typed];
}
/**
 * Pure contract preparation. No auth/DB/storage/transport, no server acceptance.
 * External dependencies are unresolved IDs for later authoritative receipt checks.
 */
export async function prepareDeclaration(input:Value){
 assertSchema('sync-declaration.json',input);
 const encoded=canonicalJson(input);if(typeof encoded!=='string')fail('VALIDATION_FAILED');
 if(Buffer.byteLength(encoded,'utf8')>limits.metadataBodyMaxBytes)fail('PAYLOAD_TOO_LARGE',{limit:limits.metadataBodyMaxBytes});
 const declaration=structuredClone(input),mutations=new Map<string,Value>(),artifacts=new Map<string,Value>(),membership=new Map<string,string>();
 for(const m of declaration.mutations){const old=mutations.get(m.mutationId);if(old)fail(old.payloadHash!==m.payloadHash?'IDEMPOTENCY_MISMATCH':'VALIDATION_FAILED');mutations.set(m.mutationId,m);}
 for(const d of declaration.artifacts){const old=artifacts.get(d.artifactId);if(old)fail(canonicalJson(old)!==canonicalJson(d)?'IDEMPOTENCY_MISMATCH':'VALIDATION_FAILED');const source=d.purpose==='source',max=source?limits.inputSourceMaxBytes:limits.artifactMaxBytes;if(d.sizeBytes>max)fail(source?'INPUT_FILE_TOO_LARGE':'ARTIFACT_LIMIT_EXCEEDED',{limit:max});artifacts.set(d.artifactId,d);}
 const groupIds:string[]=[],groups=new Map<string,Value>();
 for(const group of declaration.atomicGroups){
  if(groups.has(group.groupId))fail('VALIDATION_FAILED');groups.set(group.groupId,group);groupIds.push(group.groupId);
  for(const id of group.mutationIds){if(!mutations.has(id)||membership.has(id))fail('VALIDATION_FAILED');membership.set(id,group.groupId);}
 }
 if(membership.size!==mutations.size)fail('VALIDATION_FAILED');
 const mutationDependencies=new Map<string,Set<string>>(),groupDependencies=new Map<string,Set<string>>(),external=new Set<string>(),byMutation:Record<string,Value[]>={},usedArtifacts=new Set<string>();
 for(const m of declaration.mutations){
  const own=await ownArtifacts(m,artifacts);if(await mutationHash(m,own)!==m.payloadHash)fail('HASH_MISMATCH');byMutation[m.mutationId]=own;for(const d of own)usedArtifacts.add(d.artifactId);
  const deps=new Set<string>(),group=membership.get(m.mutationId)!;
  if(!groupDependencies.has(group))groupDependencies.set(group,new Set());
  for(const id of m.dependencies){const dep=mutations.get(id);if(!dep){external.add(id);continue;}if(dep.projectId!==m.projectId)fail('INVALID_SOURCE');deps.add(id);const from=membership.get(id)!;if(from!==group)groupDependencies.get(group)!.add(from);}
  mutationDependencies.set(m.mutationId,deps);
 }
 if(usedArtifacts.size!==artifacts.size)fail('VALIDATION_FAILED',{reason:'unreferencedArtifact'});
 const mutationOrder=ordered([...mutations.keys()],mutationDependencies),groupOrder=ordered(groupIds,groupDependencies);
 const orderedGroups=groupOrder.map(groupId=>({groupId,mutationIds:mutationOrder.filter(id=>membership.get(id)===groupId)}));
 return freeze({declaration,batchSnapshotHash:await hashCanonical(declaration),orderedGroups,externalDependencyIds:[...external],ownArtifactsByMutation:byMutation});
}
/**
 * Pure ACK assembly from future authoritative runtime outcomes, never a commit.
 * Caller must supply results obtained under actual server fences/transactions.
 */
export async function assembleAck(input:Value,results:Value[],options:{serverGeneration:string;requestId:string;cursor?:string|null}){
 assertJson(results);
 if(!Array.isArray(results))fail('VALIDATION_FAILED');
 const outcomes=structuredClone(results),settings={serverGeneration:options.serverGeneration,requestId:options.requestId,cursor:options.cursor??null};
 assertJson(settings);assertSchema('uuid.json',settings.serverGeneration);
 const prepared=await prepareDeclaration(input),snapshot=prepared.declaration;
 if(settings.serverGeneration!==snapshot.serverGeneration)fail('RECONCILIATION_REQUIRED');
 const byId=new Map<string,Value>(),members=new Map<string,Value>(snapshot.mutations.map((m:Value)=>[m.mutationId,m]));
 for(const result of outcomes){
  if(!result||typeof result!=='object'||Array.isArray(result))fail('VALIDATION_FAILED');
  const id=result.kind==='acknowledged'?result.receipt?.mutationId:result.mutationId;
  if(!members.has(id)||byId.has(id)||!['acknowledged','pending','rejected'].includes(result.kind))fail('VALIDATION_FAILED');
  byId.set(id,result);
 }
 if(byId.size!==members.size)fail('VALIDATION_FAILED');
 const acknowledged:Value[]=[],pending:Value[]=[],rejected:Value[]=[];
 for(const m of snapshot.mutations){const result=byId.get(m.mutationId)!;
  if(result.kind==='pending'){pending.push({mutationId:m.mutationId,code:result.code,retryable:result.retryable});continue;}
  if(result.kind==='rejected'){rejected.push({mutationId:m.mutationId,code:result.code});continue;}
  const {mutationId,payloadHash,entityIds,artifactIds,revisions,outcome,conflictRefs}=result.receipt;
  const publicReceipt={mutationId,payloadHash,entityIds,artifactIds,revisions,outcome,conflictRefs};
  assertSchema('sync-ack.json',{batchId:snapshot.batchId,status:'committed',acknowledged:[publicReceipt],pending:[],rejected:[],cursor:null,serverGeneration:settings.serverGeneration,requestId:settings.requestId});
  if(payloadHash!==m.payloadHash)fail('IDEMPOTENCY_MISMATCH');
  if(!Array.isArray(entityIds)||!Array.isArray(artifactIds)||!Array.isArray(revisions)||!Array.isArray(conflictRefs))fail('VALIDATION_FAILED');
  if(new Set(revisions.map((r:Value)=>r.entityId)).size!==revisions.length)fail('VALIDATION_FAILED');
  const own=prepared.ownArtifactsByMutation[m.mutationId].map(d=>d.artifactId);
  if(canonicalJson([...artifactIds].sort())!==canonicalJson([...own].sort()))fail('VALIDATION_FAILED');
  if(outcome==='committed'&&(!entityIds.includes(m.entityId)||conflictRefs.length))fail('VALIDATION_FAILED');
  if(outcome==='conflictPreserved'&&(!conflictRefs.length||!entityIds.includes(m.entityId)&&!conflictRefs.some((r:Value)=>r.conflictOf===m.entityId&&entityIds.includes(r.entityId))))fail('VALIDATION_FAILED');
  // Explicit public projection drops internal branchResult/storage/fence fields.
  acknowledged.push(publicReceipt);
 }
 for(const group of snapshot.atomicGroups){const count=group.mutationIds.filter((id:string)=>byId.get(id)!.kind==='acknowledged').length;if(count!==0&&count!==group.mutationIds.length)fail('VALIDATION_FAILED');}
 const status=acknowledged.length===members.size?'committed':!acknowledged.length&&!pending.length?'rejected':'partial';
 const ack={batchId:snapshot.batchId,status,acknowledged,pending,rejected,cursor:settings.cursor,serverGeneration:settings.serverGeneration,requestId:settings.requestId};
 assertSchema('sync-ack.json',ack);return freeze(ack);
}
/**
 * Pure ID-only commit selection. Required receipts remain unresolved: runtime
 * must query them under owner/project/generation/session fences before writes.
 */
export async function prepareCommitRequest(input:Value,body:Value,context:{batchId:string;serverGeneration:string}){
 assertSchema('sync-commit-request.json',body);const request=structuredClone(body),route={batchId:context.batchId,serverGeneration:context.serverGeneration};
 assertSchema('uuid.json',route.batchId);assertSchema('uuid.json',route.serverGeneration);
 const prepared=await prepareDeclaration(input),declaration=prepared.declaration;
 if(route.batchId!==declaration.batchId)fail('RESOURCE_NOT_FOUND');
 if(route.serverGeneration!==declaration.serverGeneration||request.serverGeneration!==declaration.serverGeneration)fail('RECONCILIATION_REQUIRED');
 const selected=new Set<string>(request.mutationIds),members=new Map<string,Value>(declaration.mutations.map((m:Value)=>[m.mutationId,m]));
 for(const id of selected)if(!members.has(id))fail('VALIDATION_FAILED',{reason:'undeclaredMutation'});
 for(const group of declaration.atomicGroups){const count=group.mutationIds.filter((id:string)=>selected.has(id)).length;if(count!==0&&count!==group.mutationIds.length)fail('VALIDATION_FAILED',{reason:'partialAtomicGroup'});}
 const requestedGroups=prepared.orderedGroups.filter(group=>selected.has(group.mutationIds[0]));
 const requestedMutationIds=requestedGroups.flatMap(group=>group.mutationIds),required=new Map<string,Value>();
 for(const id of requestedMutationIds){const mutation=members.get(id)!;
  for(const dependencyId of mutation.dependencies){if(selected.has(dependencyId))continue;
   const dependency=members.get(dependencyId);
   // A receipt from project A can never satisfy a requirement from project B.
   const key=mutation.projectId+':'+dependencyId;
   if(!required.has(key))required.set(key,{projectId:mutation.projectId,mutationId:dependencyId,expectedPayloadHash:dependency?.payloadHash??null,reason:dependency?'outsideRequest':'outsideBatch'});
  }
 }
 return freeze({batchId:declaration.batchId,serverGeneration:declaration.serverGeneration,batchSnapshotHash:prepared.batchSnapshotHash,request,requestedGroups,requestedMutationIds,requiredReceipts:[...required.values()]});
}
/**
 * Pure declaration-plan projection from future authoritative storage findings.
 * Artifact presence is not metadata commit, receipt, or fresh server byte proof.
 */
export async function assembleDeclarationPlan(input:Value,findings:Value[],options:{serverGeneration:string}){
 assertJson(findings);if(!Array.isArray(findings))fail('VALIDATION_FAILED');
 const captured=structuredClone(findings),generation=options?.serverGeneration;assertSchema('uuid.json',generation);
 const prepared=await prepareDeclaration(input),declaration=prepared.declaration;
 if(generation!==declaration.serverGeneration)fail('RECONCILIATION_REQUIRED');
 const artifacts=new Map<string,Value>(declaration.artifacts.map((a:Value)=>[a.artifactId,a])),mutations=new Set<string>(declaration.mutations.map((m:Value)=>m.mutationId)),byArtifact=new Map<string,Value>(),byMutation=new Map<string,Value>();
 for(const finding of captured){
  if(!finding||typeof finding!=='object'||Array.isArray(finding))fail('VALIDATION_FAILED');
  let id:string,value:Value;
  if(finding.kind==='needsUpload'){
   const u=finding.upload;if(!u||typeof u!=='object'||Array.isArray(u))fail('VALIDATION_FAILED');
   const upload={uploadId:u.uploadId,artifactId:u.artifactId,chunkSizeBytes:u.chunkSizeBytes,expiresAt:u.expiresAt,serverGeneration:u.serverGeneration,state:u.state,receivedChunks:u.receivedChunks};
   id=upload.artifactId;value={kind:'needsUpload',upload};
  }else if(finding.kind==='alreadyPresent'){
   const a=finding.artifact;if(!a||typeof a!=='object'||Array.isArray(a))fail('VALIDATION_FAILED');
   const artifact={artifactId:a.artifactId,sha256:a.sha256,sizeBytes:a.sizeBytes,state:a.state};id=artifact.artifactId;value={kind:'alreadyPresent',artifact};
  }else if(finding.kind==='rejected'){
   const rejection={target:finding.target,id:finding.id,code:finding.code};id=rejection.id;value={kind:'rejected',rejection};
   if(rejection.target==='mutation'){if(!mutations.has(id)||byMutation.has(id))fail('VALIDATION_FAILED');byMutation.set(id,rejection);continue;}
   if(rejection.target!=='artifact')fail('VALIDATION_FAILED');
  }else fail('VALIDATION_FAILED');
  if(!artifacts.has(id)||byArtifact.has(id))fail('VALIDATION_FAILED');byArtifact.set(id,value);
 }
 if(byArtifact.size!==artifacts.size)fail('VALIDATION_FAILED',{reason:'incompleteArtifactPlan'});
 const needsUpload:Value[]=[],alreadyPresent:Value[]=[],rejected:Value[]=[];
 for(const d of declaration.artifacts){const value=byArtifact.get(d.artifactId)!;if(value.kind==='needsUpload')needsUpload.push(value.upload);else if(value.kind==='alreadyPresent')alreadyPresent.push(value.artifact);else rejected.push(value.rejection);}
 for(const m of declaration.mutations)if(byMutation.has(m.mutationId))rejected.push(byMutation.get(m.mutationId)!);
 const plan={batchId:declaration.batchId,serverGeneration:generation,needsUpload,alreadyPresent,rejected};assertSchema('sync-declaration-plan.json',plan);
 const uploadIds=new Set<string>();
 for(const u of needsUpload){
  if(uploadIds.has(u.uploadId))fail('VALIDATION_FAILED');uploadIds.add(u.uploadId);
  if(u.serverGeneration!==generation)fail('RECONCILIATION_REQUIRED');
  const d=artifacts.get(u.artifactId)!,count=Math.ceil(d.sizeBytes/limits.chunkMaxBytes),seen=new Set<number>();
  for(const c of u.receivedChunks){if(seen.has(c.index)||c.index>=count||c.offset!==c.index*limits.chunkMaxBytes||c.length!==Math.min(limits.chunkMaxBytes,d.sizeBytes-c.offset))fail('VALIDATION_FAILED');seen.add(c.index);}
 }
 for(const a of alreadyPresent){const d=artifacts.get(a.artifactId)!;if(a.sha256!==d.sha256||a.sizeBytes!==d.sizeBytes)fail('IDEMPOTENCY_MISMATCH');}
 const encoded=canonicalJson(plan);if(typeof encoded!=='string')fail('VALIDATION_FAILED');if(Buffer.byteLength(encoded,'utf8')>limits.metadataBodyMaxBytes)fail('PAYLOAD_TOO_LARGE',{limit:limits.metadataBodyMaxBytes});
 return freeze(plan);
}
/** Pure replay policy over hypothetical authoritative observations; never a write permit. */
export async function prepareReceiptReplay(input:Value,observation:Value,context:{ownerId:string;mutationId:string;serverGeneration:string;serverNow:number}){
 assertJson(observation);assertJson(context);
 const observed=structuredClone(observation),settings=structuredClone(context);
 const record=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const timestamp=(v:any)=>Number.isSafeInteger(v)&&v>=0&&v<=8640000000000000;
 if(!record(settings)||!record(observed)||!Object.hasOwn(observed,'receipt')||!Object.hasOwn(observed,'identity'))fail('VALIDATION_FAILED');
 for(const field of ['ownerId','mutationId','serverGeneration'])assertSchema('uuid.json',settings[field as keyof typeof settings]);
 if(!timestamp(settings.serverNow))fail('VALIDATION_FAILED');
 const prepared=await prepareDeclaration(input),declaration=prepared.declaration;
 if(settings.serverGeneration!==declaration.serverGeneration)fail('RECONCILIATION_REQUIRED');
 const mutation=declaration.mutations.find((m:Value)=>m.mutationId===settings.mutationId);
 if(!mutation)fail('VALIDATION_FAILED');
 const base={mutationId:mutation.mutationId,serverGeneration:settings.serverGeneration};
 for(const item of [observed.receipt,observed.identity])if(item!==null){
  if(!record(item)||!timestamp(item.committedAt)||item.committedAt>settings.serverNow||typeof item.canonicalHash!=='string'||!/^[a-f0-9]{64}$/.test(item.canonicalHash))fail('VALIDATION_FAILED');
  for(const field of ['ownerId','projectId','mutationId','serverGeneration'])assertSchema('uuid.json',item[field]);
  if(item.ownerId!==settings.ownerId||item.projectId!==mutation.projectId)fail('RESOURCE_NOT_FOUND');
  if(item.mutationId!==mutation.mutationId)fail('VALIDATION_FAILED');
  if(item.canonicalHash!==mutation.payloadHash)fail('IDEMPOTENCY_MISMATCH');
  if(item.serverGeneration!==settings.serverGeneration)fail('RECONCILIATION_REQUIRED');
 }
 if(observed.identity!==null&&observed.identity.entityId!==mutation.entityId)fail('IDEMPOTENCY_MISMATCH');
 if(observed.receipt===null&&observed.identity===null)return freeze({...base,status:'unresolved',reason:'noCommitProof'});
 const reconcile=(reason:string)=>freeze({...base,status:'requiresReconciliation',code:'RECONCILIATION_REQUIRED',reason});
 if(observed.receipt===null)return reconcile('receiptMissing');
 const stored=observed.receipt;
 // Retention is logical only: this function never expires or deletes a record.
 if(!timestamp(stored.expiresAt)||stored.expiresAt-stored.committedAt<90*86400000)fail('VALIDATION_FAILED');
 if(settings.serverNow>=stored.expiresAt)return reconcile('receiptExpired');
 if(observed.identity===null)return reconcile('identityMissing');
 if(observed.identity.committedAt!==stored.committedAt)fail('RECONCILIATION_REQUIRED');
 const single={...declaration,mutations:[mutation],artifacts:prepared.ownArtifactsByMutation[mutation.mutationId],atomicGroups:[{groupId:declaration.atomicGroups.find((g:Value)=>g.mutationIds.includes(mutation.mutationId)).groupId,mutationIds:[mutation.mutationId]}]};
 const options={serverGeneration:settings.serverGeneration,requestId:'pure-receipt-replay'};
 const outputs=await Promise.all([stored.result,observed.identity.result].map(result=>assembleAck(single,[{kind:'acknowledged',receipt:result}],options)));
 const [replay,identity]=outputs.map(ack=>ack.acknowledged[0]);
 if(canonicalJson(replay)!==canonicalJson(identity))fail('RECONCILIATION_REQUIRED');
 // This projects one receipt, not an ACK for the surrounding atomic group/batch.
 return freeze({...base,status:'replayPrepared',receipt:replay});
}
