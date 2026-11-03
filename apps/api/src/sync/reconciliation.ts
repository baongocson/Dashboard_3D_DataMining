import {randomBytes,createHash} from 'node:crypto';
import type {ClientSession} from 'mongodb';
import {assertSchema,assertJson} from '../../../../packages/contracts/src/index.mjs';
import {canonicalJson,hashCanonical} from '../../../../packages/data-format/src/index.mjs';
import limits from '../../../../packages/contracts/limits/local-dev.v1.json' with {type:'json'};
import {AuthService} from '../auth/service.ts';
import {AuthError,reject} from '../auth/policy.ts';
import {metadataCollections} from '../metadata/schema.ts';
import {StorageService} from '../storage/service.ts';
import {syncCollections,prepareSync} from './schema.ts';
import {projectReceipt} from './contracts.ts';
type Value=Record<string,any>;
const json=(v:any):string=>{const text=canonicalJson(v);if(typeof text!=='string')reject('VALIDATION_FAILED');return text;};
const opaque=()=>randomBytes(32).toString('base64url'),equal=(a:any,b:any)=>json(a)===json(b),sameIds=(a:string[],b:string[])=>equal([...a].sort(),[...b].sort());
function stale(code='RECONCILIATION_REQUIRED'):never{throw Object.assign(new AuthError(code,410),{details:{requiresNewSnapshot:true,requiresReconciliation:true}});}
export class ReconciliationService{
 readonly auth:AuthService;readonly storage:StorageService;readonly c;readonly metadata;
 constructor(auth:AuthService,storage:StorageService){if(storage.auth!==auth)throw Error('Shared authority required');this.auth=auth;this.storage=storage;this.c=syncCollections(auth.db);this.metadata=metadataCollections(auth.db);}
 async ready(){await prepareSync(this.auth.db);}
 private async generation(s:ClientSession,expected:string){const g=await this.auth.c.control.updateOne({_id:'server',serverGeneration:expected},{$inc:{syncFence:1}},{session:s});if(g.matchedCount!==1)stale();}
 private async scope(s:ClientSession,ownerId:string,ids:string[]){const states:Value={};for(const id of ids){const p=await this.metadata.projects.findOne({_id:id,ownerId},{session:s}),t=await this.metadata.tombstones.findOne({ownerId,entityId:id},{session:s});if(!p&&!t)reject('RESOURCE_NOT_FOUND',404);states[id]=!!t||!!p&&p.state!=='active';}return states;}
 private async deleted(s:ClientSession,ownerId:string,ids:string[]){return !!await this.metadata.tombstones.findOne({ownerId,entityId:{$in:ids}},{session:s});}
 private async entity(s:ClientSession,ownerId:string,k:Value){const collection=k.kind==='project'?this.metadata.projects:k.kind==='dataset'?this.metadata.datasets:k.kind==='version'?this.metadata.versions:this.metadata.branches;return collection.findOne({_id:k.entityId,ownerId,...(k.kind==='project'?{}:{projectId:k.projectId})},{session:s});}
 private async bindings(s:ClientSession,ownerId:string,request:Value,atPoint:boolean){
  const bindings:Value[]=[];for(const b of request.manifestBindings??[]){const h=await this.c.manifests.findOne({_id:b.manifestId,ownerId,projectId:b.projectId},{session:s});if(!h)reject('RESOURCE_NOT_FOUND',404);
   if(h.state!=='ready'||h.serverGeneration!==request.serverGeneration||h.snapshotHash!==b.snapshotHash||!Number.isSafeInteger(h.sequence)||h.sequence<0||!Number.isSafeInteger(h.metadataRevision)||h.metadataRevision<0)stale();if(h.expiresAt.getTime()<=this.auth.clock())stale('CURSOR_EXPIRED');
   if(atPoint){const p=await this.metadata.projects.findOne({_id:b.projectId,ownerId},{session:s});if((p?.changeSequence??0)!==h.sequence||(p?.metadataRevision??0)!==h.metadataRevision)stale();const deleted=!!await this.metadata.tombstones.findOne({ownerId,entityId:b.projectId},{session:s})||!!p&&p.state!=='active';if(deleted!==h.projectDeleted)stale();}
   bindings.push({projectId:b.projectId,manifestId:h._id,snapshotHash:h.snapshotHash,sequence:h.sequence,metadataRevision:h.metadataRevision,createdAt:h.createdAt.toISOString(),expiresAt:h.expiresAt.toISOString()});
  }return bindings.sort((a,b)=>a.projectId.localeCompare(b.projectId));
 }
 private async prove(s:ClientSession,ownerId:string,generation:string,m:Value,deletedProject:boolean){
  const row:Value={type:'mutation',projectId:m.projectId,id:m.mutationId,groupId:m.groupId,entityId:m.entityId,payloadHash:m.payloadHash,action:'requiresReconciliation',code:'RECONCILIATION_REQUIRED'};
  const hold=(code='RECONCILIATION_REQUIRED',action='requiresReconciliation')=>({row:{...row,action,code},evidence:null});
  if(deletedProject||await this.deleted(s,ownerId,[m.entityId,...m.targetIds,...m.artifactIds]))return hold('RESOURCE_DELETED','blockedDeleted');
  const identity=await this.metadata.identities.findOne({ownerId,mutationId:m.mutationId},{session:s});
  if(!identity){const kind=m.kind.startsWith('project.')?'project':m.kind==='dataset.version.create'?'version':'dataset',entity=await this.entity(s,ownerId,{...m,kind});if(entity&&['project.rename','dataset.rename'].includes(m.kind)){if(entity.revision!==m.baseRevision)return hold('REVISION_CONFLICT','conflict');return hold('MUTATION_NOT_REQUESTED','pending');}return hold(entity?'RECONCILIATION_REQUIRED':'MUTATION_NOT_REQUESTED',entity?'requiresReconciliation':'pending');}
  if(identity.projectId!==m.projectId||identity.entityId!==m.entityId||identity.canonicalHash!==m.payloadHash)return hold('IDEMPOTENCY_MISMATCH');
  if(identity.serverGeneration!==generation)return hold();
  const receipt=projectReceipt(identity.result,generation),branch=identity.result.branchResult;
  if(receipt.mutationId!==m.mutationId||receipt.payloadHash!==m.payloadHash||!sameIds(receipt.artifactIds,m.artifactIds)||!receipt.entityIds.includes(m.entityId))return hold('IDEMPOTENCY_MISMATCH');
  const targets=[...receipt.entityIds,...receipt.artifactIds,...receipt.conflictRefs.flatMap((r:Value)=>[r.entityId,r.conflictOf]),...[branch?.datasetId,branch?.declaredBranchId].filter(x=>typeof x==='string')];
  if(await this.deleted(s,ownerId,targets))return hold('RESOURCE_DELETED','blockedDeleted');
  const revisions=new Map<string,number>(receipt.revisions.map((r:Value)=>[r.entityId,r.revision]));if(revisions.size!==receipt.revisions.length||!sameIds([...revisions.keys()],receipt.entityIds))return hold();
  if(m.kind.startsWith('project.')){const p=await this.metadata.projects.findOne({_id:m.entityId,ownerId},{session:s});if(!p||p.state!=='active'||p.revision<(revisions.get(p._id)??Infinity)||!sameIds(receipt.entityIds,[p._id]))return hold();}
  else{
   const datasetId=m.kind==='dataset.version.create'?branch?.datasetId:m.entityId,d=await this.metadata.datasets.findOne({_id:datasetId,ownerId,projectId:m.projectId},{session:s});if(!d||d.state!=='active')return hold();
   if(m.kind==='dataset.rename'){if(d.revision<(revisions.get(d._id)??Infinity)||!sameIds(receipt.entityIds,[d._id]))return hold();}
   else{
    if(!branch)return hold();const v=await this.metadata.versions.findOne({_id:branch.versionId,ownerId,projectId:m.projectId,datasetId},{session:s}),b=await this.metadata.branches.findOne({_id:branch.branchId,ownerId,projectId:m.projectId,datasetId},{session:s});
    if(!v||!b||v.branchId!==b._id||v.contentHash!==m.payloadHash||v.revision<(revisions.get(v._id)??Infinity)||b.headRevision<(revisions.get(b._id)??Infinity))return hold();
    const expected=m.kind==='dataset.create'?[d._id,v._id,b._id]:[v._id,b._id];if(!sameIds(expected,receipt.entityIds)||m.kind==='dataset.create'&&(d.v0VersionId!==v._id||d.revision<(revisions.get(d._id)??Infinity)))return hold();
    for(const source of v.content.sourceVersions){if(await this.deleted(s,ownerId,[source.datasetId,source.versionId]))return hold('RESOURCE_DELETED','blockedDeleted');const parent=await this.metadata.datasets.findOne({_id:source.datasetId,ownerId,projectId:m.projectId},{session:s});if(parent&&parent.state!=='active')return hold('RESOURCE_DELETED','blockedDeleted');const prior=await this.metadata.versions.findOne({_id:source.versionId,ownerId,projectId:m.projectId,datasetId:source.datasetId},{session:s});if(!parent||!prior||!await this.metadata.refs.findOne({ownerId,projectId:m.projectId,sourceEntityId:v._id,targetEntityId:source.versionId,strength:'hard'},{session:s}))return hold();}
    for(const r of receipt.conflictRefs)if(r.kind!=='branch'||r.entityId!==b._id||r.conflictOf!==b.conflictOf)return hold();
   }
  }
  const artifacts:Value[]=[];for(const id of m.artifactIds){const a=await this.storage.c.artifacts.findOne({_id:id,ownerId,projectId:m.projectId,serverGeneration:generation,state:'ready'},{session:s});if(!a||!await this.metadata.refs.findOne({ownerId,projectId:m.projectId,targetEntityId:id,targetEntityType:'artifact',strength:'hard'},{session:s}))return hold();artifacts.push(a);}
  return {row:{...row,action:'ackProven',code:null,receipt},evidence:{identityId:identity._id,receipt,artifacts}};
 }
 async create(rawToken:string|undefined,input:Value){
  assertSchema('sync-reconciliation-request.json',input);const request=structuredClone(input);if(Buffer.byteLength(json(request))>limits.metadataBodyMaxBytes)reject('PAYLOAD_TOO_LARGE',413);
  const projects=new Set<string>(request.projectIds),seen=new Set<string>(),groups=new Map<string,string[]>();
  for(const [type,items,key]of [['entity',request.knownEntities,'entityId'],['artifact',request.knownArtifacts,'artifactId'],['mutation',request.pending,'mutationId']] as const)for(const item of items){const id=type+':'+item[key];if(!projects.has(item.projectId)||seen.has(id)||type==='entity'&&item.kind==='project'&&item.entityId!==item.projectId)reject('VALIDATION_FAILED');seen.add(id);}
  if(request.manifestBindings){const ids=request.manifestBindings.map((b:Value)=>b.projectId);if(new Set(ids).size!==ids.length||!sameIds(ids,request.projectIds))reject('VALIDATION_FAILED');}
  for(const m of request.pending){const group=groups.get(m.groupId)??[];group.push(m.mutationId);if(group.length>20)reject('VALIDATION_FAILED');groups.set(m.groupId,group);}
  await this.auth.identity(rawToken);const requestHash=await hashCanonical(request),id=opaque();let ownerId:string|undefined;
  try{
   const captured=await this.auth.withFence(rawToken,async(s,identity)=>{
    ownerId=identity.user._id;await this.generation(s,request.serverGeneration);const states=await this.scope(s,ownerId,request.projectIds),now=this.auth.clock();if(await this.c.reconciliations.findOne({ownerId,state:'building',expiresAt:{$gt:new Date(now)}},{session:s}))reject('RESOURCE_LIMIT_EXCEEDED');
    const manifestBindings=await this.bindings(s,ownerId,request,true),expiresAt=new Date(Math.min(now+1800000,...manifestBindings.map(b=>Date.parse(b.expiresAt))));const header={_id:id,ownerId,serverGeneration:request.serverGeneration,requestHash,request,scopeStates:states,manifestBindings,createdAt:new Date(now),expiresAt,state:'building'};await this.c.reconciliations.insertOne(header,{session:s});const rows:Value[]=[],candidates:Value[]=[];
    for(const k of request.knownEntities){const d=await this.entity(s,ownerId,k),deleted=states[k.projectId]||await this.deleted(s,ownerId,[k.entityId]),revision=d?(k.kind==='branch'?d.headRevision:d.revision):null,hash=d?.contentHash??null;rows.push({type:'entity',projectId:k.projectId,id:k.entityId,comparison:deleted?'deleted':!d?'missing':revision===k.revision&&(k.payloadHash===null||hash===k.payloadHash)?'same':'different',serverRevision:deleted?null:revision,serverHash:deleted?null:hash});}
    for(const k of request.knownArtifacts){const a=await this.storage.c.artifacts.findOne({_id:k.artifactId,ownerId,projectId:k.projectId},{session:s}),deleted=states[k.projectId]||await this.deleted(s,ownerId,[k.artifactId]);rows.push({type:'artifact',projectId:k.projectId,id:k.artifactId,comparison:deleted?'deleted':!a?'missing':a.descriptor.sha256===k.sha256&&a.descriptor.sizeBytes===k.sizeBytes?'same':'different',serverRevision:null,serverHash:deleted?null:a?.descriptor.sha256??null});}
    for(const m of request.pending)candidates.push({summary:m,...await this.prove(s,ownerId,request.serverGeneration,m,states[m.projectId])});return {header,rows,candidates};
   });
   // Actual byte proof outside the snapshot transaction, no upload/entity mutation.
   for(const c of captured.candidates)if(c.evidence){try{for(const a of c.evidence.artifacts){const file=await this.storage.bytes.openVerified(a.storageKey,a.descriptor.sizeBytes,a.descriptor.sha256);await file.close();}c.row.proofAt=new Date(this.auth.clock()).toISOString();}catch(e){if(!(e instanceof AuthError))throw e;c.evidence=null;c.row={...c.row,action:'requiresReconciliation',code:e.code};delete c.row.receipt;}}
   const byId=new Map<string,Value>(captured.candidates.map(c=>[c.summary.mutationId,c]));for(const members of groups.values())if(members.some(id=>byId.get(id)!.row.action!=='ackProven'))for(const id of members){const c=byId.get(id)!;if(c.row.action==='ackProven'){c.row={...c.row,action:'requiresReconciliation',code:'RECONCILIATION_REQUIRED'};delete c.row.receipt;delete c.row.proofAt;c.evidence=null;}}
   const rows=[...captured.rows,...captured.candidates.map(c=>c.row)],hash=createHash('sha256');hash.update(json({id,requestHash,serverGeneration:request.serverGeneration,createdAt:captured.header.createdAt.toISOString(),manifestBindings:captured.header.manifestBindings})+'\n');let estimated=0;
   for(const row of rows){assertSchema('sync-reconciliation-types.json',row);assertJson(row);const text=json(row);if(Buffer.byteLength(text)>limits.metadataBodyMaxBytes-4096)reject('RESOURCE_LIMIT_EXCEEDED');estimated+=Buffer.byteLength(text)*4;if(estimated>limits.workerMemoryBudgetBytes)reject('RESOURCE_LIMIT_EXCEEDED');hash.update(text+'\n');}const snapshotHash=hash.digest('hex');
   await this.auth.withFence(rawToken,async(s,identity)=>{
    if(identity.user._id!==ownerId)reject('RESOURCE_NOT_FOUND',404);await this.generation(s,request.serverGeneration);if(!equal(await this.scope(s,ownerId!,request.projectIds),captured.header.scopeStates))stale();if(captured.header.expiresAt.getTime()<=this.auth.clock())stale('CURSOR_EXPIRED');
    if(!equal(await this.bindings(s,ownerId!,request,true),captured.header.manifestBindings))stale();
    for(const c of captured.candidates)if(c.evidence)await this.revalidate(s,ownerId!,request.serverGeneration,c.summary,c.evidence);
    if(rows.length)await this.c.reconciliationRows.insertMany(rows.map((row,position)=>({_id:opaque(),reconciliationId:id,position,row})),{session:s});
    await this.c.reconciliations.updateOne({_id:id,ownerId,state:'building'},{$set:{state:'ready',snapshotHash,totalCount:rows.length,proofs:captured.candidates.filter(c=>c.evidence).map(c=>({summary:c.summary,evidence:c.evidence}))}},{session:s});
   });return this.read(rawToken,id,{});
  }catch(e){if(ownerId)await this.c.reconciliations.updateOne({_id:id,ownerId,state:'building'},{$set:{state:'failed',failureCode:e instanceof AuthError?e.code:'RECONCILIATION_REQUIRED'}});throw e;}
 }
 private async revalidate(s:ClientSession,ownerId:string,generation:string,m:Value,evidence:Value){const current=await this.prove(s,ownerId,generation,m,false);if(!current.evidence||!equal(current.evidence.receipt,evidence.receipt)||current.evidence.identityId!==evidence.identityId)stale();
  if(current.evidence.artifacts.length!==evidence.artifacts.length)stale();for(let i=0;i<evidence.artifacts.length;i++){const a=evidence.artifacts[i],b=current.evidence.artifacts[i];if(a.storageKey!==b.storageKey||a.byteRevision!==b.byteRevision||!equal(a.descriptor,b.descriptor))stale();}}
 async read(rawToken:string|undefined,id:string,query:Value={}){
  if(!/^[A-Za-z0-9_-]{43}$/.test(id))reject('VALIDATION_FAILED');assertSchema('sync-reconciliation-query.json',query);const q=structuredClone(query);
  return this.auth.withFence(rawToken,async(s,identity)=>{
   const ownerId=identity.user._id,h=await this.c.reconciliations.findOne({_id:id,ownerId},{session:s});if(!h)reject('RESOURCE_NOT_FOUND',404);await this.generation(s,h.serverGeneration);if(!Array.isArray(h.manifestBindings))stale();if(h.state!=='ready'||h.expiresAt.getTime()<=this.auth.clock())stale('CURSOR_EXPIRED');if(!equal(await this.scope(s,ownerId,h.request.projectIds),h.scopeStates))stale();
   const manifestBindings=await this.bindings(s,ownerId,h.request,false);if(!equal(manifestBindings,h.manifestBindings??[]))stale();
   let offset=0;if(q.cursor){const c=await this.c.reconciliationCursors.findOne({_id:q.cursor,ownerId,reconciliationId:id,serverGeneration:h.serverGeneration,expiresAt:{$gt:new Date(this.auth.clock())}},{session:s});if(!c)stale('CURSOR_EXPIRED');offset=c.offset;}
   const docs=await this.c.reconciliationRows.find({reconciliationId:id,position:{$gte:offset}},{session:s}).sort({position:1}).limit(h.request.pageSize).toArray(),rows:Value[]=[];let bytes=0;
   for(const doc of docs){const size=Buffer.byteLength(json(doc.row));if(bytes+size>limits.metadataBodyMaxBytes-4096)break;bytes+=size;rows.push(doc.row);}
   if(offset<h.totalCount&&!rows.length)stale();const groups=new Set(rows.filter(r=>r.type==='mutation'&&r.action==='ackProven').map(r=>r.groupId));
   for(const group of groups){const proofs=h.proofs.filter((p:Value)=>p.summary.groupId===group);if(proofs.length!==h.request.pending.filter((m:Value)=>m.groupId===group).length)stale();for(const proof of proofs)await this.revalidate(s,ownerId,h.serverGeneration,proof.summary,proof.evidence);}
   const next=offset+rows.length;let nextCursor:string|null=null;if(next<h.totalCount){let c=await this.c.reconciliationCursors.findOne({ownerId,reconciliationId:id,offset:next},{session:s});if(!c){c={_id:opaque(),ownerId,reconciliationId:id,offset:next,serverGeneration:h.serverGeneration,expiresAt:h.expiresAt};await this.c.reconciliationCursors.insertOne(c,{session:s});}nextCursor=c._id;}
   const page={reconciliationId:id,serverGeneration:h.serverGeneration,snapshotHash:h.snapshotHash,requestHash:h.requestHash,createdAt:h.createdAt.toISOString(),expiresAt:h.expiresAt.toISOString(),coverage:'submittedSummaries',completeServerManifest:false,manifestBound:manifestBindings.length>0,manifestBindings,requiresUserReview:true,mutationsApplied:false,offset,totalCount:h.totalCount,pageSize:h.request.pageSize,rows,nextCursor,complete:next===h.totalCount};assertSchema('sync-reconciliation-page.json',page);if(Buffer.byteLength(json(page))>limits.metadataBodyMaxBytes)reject('RESOURCE_LIMIT_EXCEEDED');return page;
  });
 }
}
