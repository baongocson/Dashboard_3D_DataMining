import {randomBytes,randomUUID} from 'node:crypto';
import {assertJson,assertSchema} from '../../../../packages/contracts/src/index.mjs';
import {AuthService} from '../auth/service.ts';
import {reject} from '../auth/policy.ts';
import {metadataCollections} from '../metadata/schema.ts';
import type {RecordDoc} from '../auth/schema.ts';
type Value=Record<string,any>;
// These are the relations actually written by the accepted metadata foundation.
// Future resource writers must add a typed policy before their refs can be read.
const policies=Object.freeze({source:{target:'artifact',strength:'hard'},sourceVersion:{target:'version',strength:'hard'},versionArtifact:{target:'artifact',strength:'hard'}});
const opaque=()=>randomBytes(32).toString('base64url');
export class ReferenceService {
 readonly auth:AuthService;readonly metadata;readonly cursors;
 constructor(auth:AuthService){this.auth=auth;this.metadata=metadataCollections(auth.db);this.cursors=auth.db.collection<RecordDoc>('resource_reference_cursors');}
 async ready(){await this.cursors.createIndex({ownerId:1,expiresAt:1},{name:'reference_cursor_owner_expiry'});}
 async incoming(rawToken:string|undefined,input:Value){
  assertJson(input);const body=structuredClone(input),keys=Object.keys(body);if(keys.some(k=>!['projectId','entityId','entityType','serverGeneration','limit','cursor'].includes(k)))reject('VALIDATION_FAILED');
  for(const k of ['projectId','entityId','serverGeneration'])assertSchema('uuid.json',body[k]);
  if(!['project','dataset','version','artifact'].includes(body.entityType))reject('UNSUPPORTED_OPERATION');
  const limit=body.limit??20;if(!Number.isInteger(limit)||limit<1||limit>100)reject('VALIDATION_FAILED');
  if(body.cursor!==undefined&&(typeof body.cursor!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(body.cursor)))reject('VALIDATION_FAILED');
  return this.auth.withFence(rawToken,async(s,{user})=>{
   const ownerId=user._id,c=this.metadata,scope={ownerId,projectId:body.projectId};
   const generation=await this.auth.c.control.updateOne({_id:'server',serverGeneration:body.serverGeneration},{$inc:{referenceReadFence:1}},{session:s});if(generation.matchedCount!==1)reject('RECONCILIATION_REQUIRED',410);
   const project=await c.projects.findOne({_id:body.projectId,ownerId},{session:s});if(!project)reject('RESOURCE_NOT_FOUND',404);
   if(project.state!=='active'||await c.tombstones.findOne({ownerId,entityId:{$in:[body.projectId,body.entityId]}},{session:s}))reject('RESOURCE_DELETED',410);
   const collection=body.entityType==='project'?c.projects:body.entityType==='dataset'?c.datasets:body.entityType==='version'?c.versions:this.auth.db.collection<RecordDoc>('artifacts');
   const target=await collection.findOne({_id:body.entityId,ownerId,...(body.entityType==='project'?{}:{projectId:body.projectId})},{session:s});
   if(!target||body.entityType==='project'&&body.entityId!==body.projectId)reject('RESOURCE_NOT_FOUND',404);
   if(target.datasetId&&await c.tombstones.findOne({ownerId,entityId:target.datasetId},{session:s}))reject('RESOURCE_DELETED',410);
   if(target.state==='deleted')reject('RESOURCE_DELETED',410);
   let lastId:string|undefined;
   let cursorExpiry:number|undefined;
   if(body.cursor){const cursor=await this.cursors.findOne({_id:body.cursor,...scope,entityId:body.entityId,entityType:body.entityType,serverGeneration:body.serverGeneration,limit},{session:s});if(!cursor)reject('RESOURCE_NOT_FOUND',404);if(cursor.expiresAt.getTime()<=this.auth.clock())reject('CURSOR_EXPIRED',410);lastId=cursor.lastId;cursorExpiry=cursor.expiresAt.getTime();}
   const refs=await c.refs.find({...scope,targetEntityId:body.entityId,...(lastId?{_id:{$gt:lastId}}:{})},{session:s,projection:{_id:1,sourceEntityId:1,sourceRevision:1,targetEntityType:1,relation:1,strength:1,sourceOrder:1}}).sort({_id:1}).limit(limit+1).toArray();
   const items=[];for(const ref of refs.slice(0,limit)){
    const policy=policies[ref.relation as keyof typeof policies];if(!policy||policy.target!==body.entityType||ref.targetEntityType!==body.entityType||ref.strength!==policy.strength)reject('RECONCILIATION_REQUIRED',410);
    assertSchema('uuid.json',ref.sourceEntityId);if(!Number.isSafeInteger(ref.sourceRevision)||ref.sourceRevision<1||!Number.isSafeInteger(ref.sourceOrder)||ref.sourceOrder<0)reject('RECONCILIATION_REQUIRED',410);
    // Current producers are datasets(source) and immutable versions(other relations).
    const sourceCollection=ref.relation==='source'?c.datasets:c.versions,source=await sourceCollection.findOne({_id:ref.sourceEntityId,...scope},{session:s});
    if(!source||source.revision<ref.sourceRevision||source.state==='deleted'||await c.tombstones.findOne({ownerId,entityId:{$in:[ref.sourceEntityId,...(source.datasetId?[source.datasetId]:[])]}},{session:s}))reject('RECONCILIATION_REQUIRED',410);
    if(ref.relation==='source'&&source.sourceArtifactId!==body.entityId||ref.relation==='sourceVersion'&&source.content?.sourceVersions?.[ref.sourceOrder]?.versionId!==body.entityId)reject('RECONCILIATION_REQUIRED',410);
    items.push({referenceId:ref._id,sourceEntityId:ref.sourceEntityId,sourceRevision:ref.sourceRevision,relation:ref.relation,strength:policy.strength,sourceOrder:ref.sourceOrder});
   }
   const hasMore=refs.length>limit,now=this.auth.clock(),expiresAt=new Date(cursorExpiry??now+1800000),nextCursor=hasMore?opaque():null;
   const page={projectId:body.projectId,entityId:body.entityId,entityType:body.entityType,serverGeneration:body.serverGeneration,coverage:'registeredMetadataRelations',snapshot:false,authorizesDeletion:false,items,hasMore,nextCursor,expiresAt:expiresAt.toISOString()};
   if(Buffer.byteLength(JSON.stringify(page))>1048576)reject('PAYLOAD_TOO_LARGE',413);
   if(nextCursor)await this.cursors.insertOne({_id:nextCursor,...scope,entityId:body.entityId,entityType:body.entityType,serverGeneration:body.serverGeneration,limit,lastId:refs[limit-1]._id,expiresAt,requestId:randomUUID()},{session:s});
   return page;
  });
 }
}
