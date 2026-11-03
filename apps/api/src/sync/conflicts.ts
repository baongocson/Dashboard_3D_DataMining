import {randomBytes} from 'node:crypto';
import {assertSchema} from '../../../../packages/contracts/src/index.mjs';
import limits from '../../../../packages/contracts/limits/local-dev.v1.json' with {type:'json'};
import {AuthService} from '../auth/service.ts';
import {AuthError,reject} from '../auth/policy.ts';
import {metadataCollections} from '../metadata/schema.ts';
import {syncCollections} from './schema.ts';
type Value=Record<string,any>;
function stale(code='RECONCILIATION_REQUIRED'):never{throw Object.assign(new AuthError(code,410),{details:{requiresReconciliation:true,requiresNewSnapshot:true}});}
/** Explicitly live, bounded listing; full reconciliation uses immutable manifests instead. */
export class ConflictService{
 readonly auth:AuthService;readonly c;readonly metadata;
 constructor(auth:AuthService){this.auth=auth;this.c=syncCollections(auth.db);this.metadata=metadataCollections(auth.db);}
 async list(rawToken:string|undefined,projectId:string,input:Value){
  assertSchema('uuid.json',projectId);assertSchema('sync-conflicts-query.json',input);const query=structuredClone(input);
  return this.auth.withFence(rawToken,async(s,identity)=>{
   const ownerId=identity.user._id,p=await this.metadata.projects.findOne({_id:projectId,ownerId},{session:s});if(!p)reject('RESOURCE_NOT_FOUND',404);
   if(p.state!=='active'||await this.metadata.tombstones.findOne({ownerId,entityId:projectId},{session:s}))stale('RESOURCE_DELETED');
   const generation=this.auth.sessionView(identity).serverGeneration;
   if((await this.auth.c.control.updateOne({_id:'server',serverGeneration:generation},{$inc:{syncFence:1}},{session:s})).matchedCount!==1)stale();
   let after:string|undefined,pageSize=query.limit??20,expiresAt=new Date(this.auth.clock()+1800000);
   if(query.cursor){const c=await this.c.conflictCursors.findOne({_id:query.cursor,ownerId,projectId},{session:s});if(!c||c.expiresAt.getTime()<=this.auth.clock())stale('CURSOR_EXPIRED');if(c.serverGeneration!==generation)stale();if(query.limit!==undefined&&query.limit!==c.pageSize)reject('VALIDATION_FAILED');after=c.after;pageSize=c.pageSize;expiresAt=c.expiresAt;}
   const docs=await this.c.conflicts.find({ownerId,projectId,serverGeneration:generation,...(after?{_id:{$gt:after}}:{})},{session:s}).sort({_id:1}).limit(pageSize+1).toArray(),items:Value[]=[];let bytes=0;
   for(const c of docs.slice(0,pageSize)){
    const ids=[c.conflictOf,c.localCopyRef?.branchId,c.localCopyRef?.versionId,c.serverRef?.versionId,...(c.sourceSnapshot??[]).flatMap((r:Value)=>[r.datasetId,r.versionId])];if(await this.metadata.tombstones.findOne({ownerId,entityId:{$in:ids}},{session:s}))stale('RESOURCE_DELETED');
    for(const id of [c.conflictOf,c.localCopyRef?.branchId]){const b=await this.metadata.branches.findOne({_id:id,ownerId,projectId},{session:s});if(!b)stale();const d=await this.metadata.datasets.findOne({_id:b.datasetId,ownerId,projectId},{session:s});if(!d||d.state!=='active'||await this.metadata.tombstones.findOne({ownerId,entityId:b.datasetId},{session:s}))stale('RESOURCE_DELETED');}
    const row={type:'conflict',deleted:false,value:{conflictId:c._id,projectId:c.projectId,mutationId:c.mutationId,kind:c.kind,conflictOf:c.conflictOf,serverRef:c.serverRef,localCopyRef:c.localCopyRef,baseRevision:c.baseRevision,baseVersionId:c.baseVersionId,serverRevision:c.serverRevision,sourceSnapshot:c.sourceSnapshot,state:c.state,serverGeneration:c.serverGeneration,createdAt:c.createdAt.toISOString()}};
    assertSchema('project-manifest-types.json',row);const size=Buffer.byteLength(JSON.stringify(row));if(size>limits.metadataBodyMaxBytes-4096)stale();if(bytes+size>limits.metadataBodyMaxBytes-4096)break;items.push(row);bytes+=size;
   }
   let nextCursor:string|null=null;if(docs.length>items.length){if(!items.length)stale();nextCursor=randomBytes(32).toString('base64url');await this.c.conflictCursors.insertOne({_id:nextCursor,ownerId,projectId,serverGeneration:generation,after:items.at(-1)!.value.conflictId,pageSize,expiresAt},{session:s});}
   const page={projectId,serverGeneration:generation,snapshot:false,pageSize,expiresAt:expiresAt.toISOString(),items,nextCursor};assertSchema('sync-conflicts-page.json',page);return page;
  });
 }
}
