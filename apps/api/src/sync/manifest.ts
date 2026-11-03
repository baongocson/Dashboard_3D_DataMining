import {randomBytes,createHash} from 'node:crypto';
import type {ClientSession} from 'mongodb';
import type {RecordDoc} from '../auth/schema.ts';
import {assertSchema} from '../../../../packages/contracts/src/index.mjs';
import {canonicalJson,hashCanonical} from '../../../../packages/data-format/src/index.mjs';
import limits from '../../../../packages/contracts/limits/local-dev.v1.json' with {type:'json'};
import {AuthService} from '../auth/service.ts';
import {AuthError,reject} from '../auth/policy.ts';
import {metadataCollections} from '../metadata/schema.ts';
import {StorageService} from '../storage/service.ts';
import {syncCollections,prepareSync} from './schema.ts';
type Value=Record<string,any>;
export const MANIFEST_KINDS=Object.freeze(['project','dataset','version','branch','artifact','reference','conflict','tombstone']);
const opaque=()=>randomBytes(32).toString('base64url');
const json=(v:any):string=>{const text=canonicalJson(v);if(typeof text!=='string')reject('VALIDATION_FAILED');return text;};
function stale(code='RECONCILIATION_REQUIRED'):never{throw Object.assign(new AuthError(code,410),{details:{requiresNewSnapshot:true,requiresReconciliation:true}});}
const project=(p:Value)=>({projectId:p._id,name:p.name,revision:p.revision,createdAtServer:p.createdAtServer.toISOString(),updatedAtServer:p.updatedAtServer.toISOString()});
const dataset=(d:Value)=>({datasetId:d._id,projectId:d.projectId,name:d.name,kind:d.kind,sourceArtifactId:d.sourceArtifactId,parseConfig:d.parseConfig,v0VersionId:d.v0VersionId,defaultBranchId:d.defaultBranchId,revision:d.revision,createdAtServer:d.createdAtServer.toISOString(),updatedAtServer:d.updatedAtServer.toISOString()});
const version=(v:Value)=>({...v.content,branchId:v.branchId,...(v.branchId!==v.content.branchId?{declaredBranchId:v.content.branchId}:{}),projectId:v.projectId,revision:v.revision,contentHash:v.contentHash,createdAtServer:v.createdAtServer.toISOString()});
const branch=(b:Value)=>({branchId:b._id,projectId:b.projectId,datasetId:b.datasetId,forkVersionId:b.forkVersionId,headVersionId:b.headVersionId,headRevision:b.headRevision,reason:b.reason,conflictOf:b.conflictOf??null});
export class ManifestService{
 readonly auth:AuthService;readonly storage:StorageService;readonly c;readonly metadata;
 constructor(auth:AuthService,storage:StorageService){if(storage.auth!==auth)throw Error('Shared authority required');this.auth=auth;this.storage=storage;this.c=syncCollections(auth.db);this.metadata=metadataCollections(auth.db);}
 async ready(){await prepareSync(this.auth.db);}
 private async generation(s:ClientSession,expected:string){const g=await this.auth.c.control.updateOne({_id:'server',serverGeneration:expected},{$inc:{syncFence:1}},{session:s});if(g.matchedCount!==1)stale();}
 private async scope(s:ClientSession,ownerId:string,projectId:string){const p=await this.metadata.projects.findOne({_id:projectId,ownerId},{session:s}),t=await this.metadata.tombstones.findOne({ownerId,entityId:projectId},{session:s});if(!p&&!t)reject('RESOURCE_NOT_FOUND',404);return {project:p,deleted:!!t||!!p&&p.state!=='active'};}
 private async live(rawToken:string|undefined,h:Value){return this.auth.withFence(rawToken,async(s,identity)=>{if(identity.user._id!==h.ownerId)reject('RESOURCE_NOT_FOUND',404);await this.generation(s,h.serverGeneration);if(h.expiresAt.getTime()<=this.auth.clock())stale('CURSOR_EXPIRED');if((await this.scope(s,h.ownerId,h.projectId)).deleted!==h.projectDeleted)stale();return true;});}
 private targets(row:Value){const v=row.value;switch(row.type){case'project':return[v.projectId];case'dataset':return[v.datasetId];case'version':return[v.versionId,v.datasetId];case'branch':return[v.branchId,v.datasetId];case'artifact':return[v.descriptor.artifactId];case'reference':return[v.sourceEntityId,v.targetEntityId];case'conflict':return[v.conflictOf,v.localCopyRef.branchId,v.localCopyRef.versionId,v.serverRef.branchId,v.serverRef.versionId];default:return[v.entityId];}}
 private async deleted(s:ClientSession,ownerId:string,projectDeleted:boolean,row:Value){if(projectDeleted||row.type==='tombstone')return true;if(await this.metadata.tombstones.findOne({ownerId,entityId:{$in:this.targets(row)}},{session:s}))return true;
  const datasetId=['version','branch'].includes(row.type)?row.value.datasetId:row.type==='dataset'?row.value.datasetId:null;
  if(datasetId){const d=await this.metadata.datasets.findOne({_id:datasetId,ownerId,projectId:row.value.projectId},{session:s});if(!d)stale();if(d.state!=='active')return true;}return false;}
 private async tombstoneProject(s:ClientSession,ownerId:string,t:Value){if(t.projectId)return t.projectId;
  const p=await this.metadata.projects.findOne({_id:t.entityId,ownerId},{session:s});if(p)return p._id;
  for(const collection of [this.metadata.datasets,this.metadata.versions,this.metadata.branches,this.storage.c.artifacts,this.c.conflicts]){const d=await collection.findOne({_id:t.entityId,ownerId},{session:s});if(d)return d.projectId;}
  // A legacy project tombstone is self-scoped even if its project row is gone.
  if(t.entityType==='project')return t.entityId;stale();
 }
 async create(rawToken:string|undefined,projectId:string,input:Value){
  assertSchema('uuid.json',projectId);assertSchema('project-manifest-request.json',input);const request=structuredClone(input),requestHash=await hashCanonical({projectId,...request}),id=opaque();let header:Value|undefined,snapshot:ClientSession|undefined;
  try{
   header=await this.auth.withFence(rawToken,async(s,identity)=>{await this.generation(s,request.serverGeneration);const scope=await this.scope(s,identity.user._id,projectId),now=this.auth.clock();if(await this.c.manifests.findOne({ownerId:identity.user._id,state:'building',expiresAt:{$gt:new Date(now)}},{session:s}))reject('RESOURCE_LIMIT_EXCEEDED');const h={_id:id,ownerId:identity.user._id,projectId,serverGeneration:request.serverGeneration,requestHash,pageSize:request.pageSize,createdAt:new Date(now),expiresAt:new Date(now+1800000),state:'building',projectDeleted:scope.deleted};await this.c.manifests.insertOne(h,{session:s});return h;});
   const h=header;snapshot=this.auth.client.startSession({snapshot:true,causalConsistency:false});
   const control=await this.auth.c.control.findOne({_id:'server'},{session:snapshot});if(control?.serverGeneration!==h.serverGeneration)stale();if(!snapshot.snapshotEnabled||snapshot.inTransaction())stale();
   const scope=await this.scope(snapshot,h.ownerId,projectId);if(scope.deleted!==h.projectDeleted)stale();const p=scope.project;
   const latest=await this.c.changes.find({ownerId:h.ownerId,projectId},{session:snapshot}).sort({sequence:-1}).limit(1).next();const sequence=p?.changeSequence??latest?.sequence??0;if(!Number.isSafeInteger(sequence)||sequence<0||latest&&latest.sequence>sequence)stale();
   const metadataRevision=p?.metadataRevision===undefined?0:p.metadataRevision;if(!Number.isSafeInteger(metadataRevision)||metadataRevision<0)stale();
   const hash=createHash('sha256');hash.update(json({manifestId:id,projectId,serverGeneration:h.serverGeneration,requestHash,createdAt:h.createdAt.toISOString(),sequence,metadataRevision,resourceKinds:MANIFEST_KINDS})+'\n');
   let position=0,buffer:RecordDoc[]=[],bufferBytes=0,maxBufferedRows=0,maxBufferedBytes=0;
   const flush=async()=>{if(!buffer.length)return;await this.live(rawToken,h);await this.c.manifestRows.insertMany(buffer);buffer=[];bufferBytes=0;};
   const emit=async(row:Value)=>{if((row.type==='artifact'?row.value.descriptor.projectId:row.value.projectId)!==projectId)stale();row.deleted=await this.deleted(snapshot!,h.ownerId,h.projectDeleted,row);assertSchema('project-manifest-types.json',row);const text=json(row),bytes=Buffer.byteLength(text);if(bytes>limits.metadataBodyMaxBytes-4096||position>=Number.MAX_SAFE_INTEGER)reject('RESOURCE_LIMIT_EXCEEDED');if(buffer.length>=100||bufferBytes+bytes>limits.metadataBodyMaxBytes)await flush();hash.update(text+'\n');buffer.push({_id:opaque(),manifestId:id,position:position++,row});bufferBytes+=bytes;maxBufferedRows=Math.max(maxBufferedRows,buffer.length);maxBufferedBytes=Math.max(maxBufferedBytes,bufferBytes);};
   if(p)await emit({type:'project',deleted:false,value:project(p)});
   const filters={ownerId:h.ownerId,projectId};
   const sources:Array<{type:string;collection:any;filter:Value;view:(d:Value)=>Value}>=[
    {type:'dataset',collection:this.metadata.datasets,filter:filters,view:dataset},{type:'version',collection:this.metadata.versions,filter:filters,view:version},{type:'branch',collection:this.metadata.branches,filter:filters,view:branch},
    {type:'artifact',collection:this.storage.c.artifacts,filter:filters,view:a=>({descriptor:a.descriptor,state:a.state,byteAvailability:'notChecked'})},
    {type:'reference',collection:this.metadata.refs,filter:filters,view:r=>({projectId:r.projectId,sourceEntityId:r.sourceEntityId,sourceRevision:r.sourceRevision,targetEntityId:r.targetEntityId,targetEntityType:r.targetEntityType,relation:r.relation,strength:r.strength,sourceOrder:r.sourceOrder})},
    {type:'conflict',collection:this.c.conflicts,filter:filters,view:c=>({conflictId:c._id,projectId:c.projectId,mutationId:c.mutationId,kind:c.kind,conflictOf:c.conflictOf,serverRef:c.serverRef,localCopyRef:c.localCopyRef,baseRevision:c.baseRevision,baseVersionId:c.baseVersionId,serverRevision:c.serverRevision,sourceSnapshot:c.sourceSnapshot,state:c.state,serverGeneration:c.serverGeneration,createdAt:c.createdAt.toISOString()})}
   ];
   for(const source of sources){const cursor=source.collection.find(source.filter,{session:snapshot}).sort({_id:1}).batchSize(16);try{for await(const d of cursor)await emit({type:source.type,deleted:false,value:source.view(d)});}finally{await cursor.close();}}
   const tombstones=this.metadata.tombstones.find({ownerId:h.ownerId,$or:[{projectId},{projectId:{$exists:false}}]},{session:snapshot}).sort({_id:1}).batchSize(16);
   try{for await(const t of tombstones){const scope=t.entityId===projectId?projectId:await this.tombstoneProject(snapshot,h.ownerId,t);if(scope!==projectId)continue;await emit({type:'tombstone',deleted:true,value:{projectId,entityId:t.entityId,entityType:t.entityType??null,revision:t.deletionRevision??t.revision??null,deletedAt:t.deletedAt instanceof Date?t.deletedAt.toISOString():t.deletedAt??null}});}}finally{await tombstones.close();}
   await flush();const snapshotHash=hash.digest('hex');await snapshot.endSession();snapshot=undefined;
   await this.auth.withFence(rawToken,async(s,identity)=>{if(identity.user._id!==h.ownerId)reject('RESOURCE_NOT_FOUND',404);await this.generation(s,h.serverGeneration);if(h.expiresAt.getTime()<=this.auth.clock())stale('CURSOR_EXPIRED');if((await this.scope(s,h.ownerId,projectId)).deleted!==h.projectDeleted)stale();const update=await this.c.manifests.updateOne({_id:id,ownerId:h.ownerId,state:'building'},{$set:{state:'ready',snapshotHash,sequence,metadataRevision,totalCount:position,materialization:{maxBufferedRows,maxBufferedBytes,readBatchSize:16,snapshotSessionEnabled:true,snapshotReadOutsideTransaction:true}}},{session:s});if(update.modifiedCount!==1)stale();});
   return await this.read(rawToken,id,{});
  }catch(error){const e=error as any;const failure=[246,286].includes(e?.code)?Object.assign(new AuthError('CURSOR_EXPIRED',410),{details:{requiresNewSnapshot:true,requiresReconciliation:true}}):error;
   if(header)await this.c.manifests.updateOne({_id:id,ownerId:header.ownerId,state:'building'},{$set:{state:'failed',failureCode:failure instanceof AuthError?failure.code:'RECONCILIATION_REQUIRED'}});throw failure;
  }finally{await snapshot?.endSession();}
 }
 async read(rawToken:string|undefined,id:string,query:Value={}){
  if(!/^[A-Za-z0-9_-]{43}$/.test(id))reject('VALIDATION_FAILED');assertSchema('sync-reconciliation-query.json',query);const q=structuredClone(query);
  return this.auth.withFence(rawToken,async(s,identity)=>{const h=await this.c.manifests.findOne({_id:id,ownerId:identity.user._id},{session:s});if(!h)reject('RESOURCE_NOT_FOUND',404);await this.generation(s,h.serverGeneration);if(!Number.isSafeInteger(h.metadataRevision)||h.metadataRevision<0)stale();if(h.state!=='ready'||h.expiresAt.getTime()<=this.auth.clock())stale('CURSOR_EXPIRED');if((await this.scope(s,h.ownerId,h.projectId)).deleted!==h.projectDeleted)stale();
   let offset=0;if(q.cursor){const c=await this.c.manifestCursors.findOne({_id:q.cursor,ownerId:h.ownerId,manifestId:id,serverGeneration:h.serverGeneration,expiresAt:{$gt:new Date(this.auth.clock())}},{session:s});if(!c)stale('CURSOR_EXPIRED');offset=c.offset;}
   const docs=await this.c.manifestRows.find({manifestId:id,position:{$gte:offset}},{session:s}).sort({position:1}).limit(h.pageSize).toArray(),rows:Value[]=[];let bytes=0;
   for(const d of docs){const size=Buffer.byteLength(json(d.row));if(bytes+size>limits.metadataBodyMaxBytes-4096)break;if(await this.deleted(s,h.ownerId,h.projectDeleted,d.row)!==d.row.deleted)stale();rows.push(d.row);bytes+=size;}
   if(offset<h.totalCount&&!rows.length)stale();const next=offset+rows.length;let nextCursor:string|null=null;
   if(next<h.totalCount){let c=await this.c.manifestCursors.findOne({ownerId:h.ownerId,manifestId:id,offset:next},{session:s});if(!c){c={_id:opaque(),ownerId:h.ownerId,manifestId:id,offset:next,serverGeneration:h.serverGeneration,expiresAt:h.expiresAt};await this.c.manifestCursors.insertOne(c,{session:s});}nextCursor=c._id;}
   const page={manifestId:id,projectId:h.projectId,serverGeneration:h.serverGeneration,requestHash:h.requestHash,snapshotHash:h.snapshotHash,createdAt:h.createdAt.toISOString(),expiresAt:h.expiresAt.toISOString(),projectDeleted:h.projectDeleted,sequence:h.sequence,metadataRevision:h.metadataRevision,resourceKinds:[...MANIFEST_KINDS],completeServerManifest:true,bytesVerified:false,referenceClosureVerified:false,mutationsApplied:false,offset,totalCount:h.totalCount,pageSize:h.pageSize,rows,nextCursor,complete:next===h.totalCount};assertSchema('project-manifest-page.json',page);if(Buffer.byteLength(json(page))>limits.metadataBodyMaxBytes)reject('RESOURCE_LIMIT_EXCEEDED');return page;
  });
 }
}
