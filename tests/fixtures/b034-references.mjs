import {fixture,dataset,account} from './b033-runtime.mjs';
import {batch} from './b033-contract.mjs';
import {nextVersion,mutation,id} from './b031.mjs';
import {ReferenceService} from '../../apps/api/src/resources/references.ts';
const check=(v,m)=>{if(!v)throw Error(m);};
async function denied(fn,code){try{await fn();throw Error('Expected '+code);}catch(e){check(e.code===code,'Expected '+code+' actual '+(e.code??e.message));}}
export async function runChecks(client,runtime,test){
 let n=0;
 const commit=async(f,m,artifacts)=>{const s={...batch([m],{artifacts}),serverGeneration:f.generation};await f.sync.declare(f.token,s);const ack=await f.sync.commit(f.token,s.batchId,{serverGeneration:f.generation,mutationIds:[m.mutationId]},{requestId:'b034-reference-fixture'});check(ack.status==='committed','actual fixture commit');return ack;};
 async function fresh(){const f=await fixture(client,runtime,++n),d=await dataset(f,{uploaded:true});await commit(f,d.m,d.artifacts);for(let i=0;i<3;i++){const v=await nextVersion(f.projectId,d,d.version,d.m.mutationId);await commit(f,v.m,v.artifacts);}const references=new ReferenceService(f.auth);await references.ready();return {...f,d,references,q:{projectId:f.projectId,entityId:d.version.versionId,entityType:'version',serverGeneration:f.generation,limit:1}};}
 const counts=async f=>JSON.stringify({projects:await f.metadata.c.projects.countDocuments({}),versions:await f.metadata.c.versions.countDocuments({}),refs:await f.metadata.c.refs.countDocuments({}),receipts:await f.sync.c.receipts.countDocuments({}),files:await f.storage.bytes.retainedFileCount()});
 await test('B034-reference-real-pages-no-domain-write',async()=>{
  const f=await fresh(),before=await counts(f),all=[];let page=await f.references.incoming(f.token,f.q),expiresAt=page.expiresAt;while(true){all.push(...page.items);check(page.snapshot===false&&!page.authorizesDeletion&&page.items.length===1&&page.expiresAt===expiresAt,'bounded live fixed-expiry page');if(!page.hasMore)break;page=await f.references.incoming(f.token,{...f.q,cursor:page.nextCursor});}
  check(all.length===3&&new Set(all.map(r=>r.referenceId)).size===3&&all.every(r=>r.strength==='hard')&&await counts(f)===before,'complete real incoming refs, no domain/byte writes');return {actualPrivateByteVersions:4,incomingReferences:3,live:true,authorizesDeletion:false,noDomainWrite:true};
 });
 await test('B034-reference-cursor-expiry-scope-capture',async()=>{
  const f=await fresh(),body={...f.q},pending=f.references.incoming(f.token,body);body.entityId=id();const p=await pending;check(p.entityId===f.q.entityId,'captured before await');await denied(()=>f.references.incoming(f.token,{...f.q,limit:2,cursor:p.nextCursor}),'RESOURCE_NOT_FOUND');const other=await account(f,'b034-other@example.test');await denied(()=>f.references.incoming(other.token,f.q),'RESOURCE_NOT_FOUND');
  f.time.now=Date.parse(p.expiresAt);await denied(()=>f.references.incoming(f.token,{...f.q,cursor:p.nextCursor}),'CURSOR_EXPIRED');check(await f.references.cursors.countDocuments({_id:p.nextCursor})===1,'expired record retained');return {capturedInput:true,cursorScopeAndLimitBound:true,exactExpiry:true,retained:true};
 });
 await test('B034-reference-generation-session-tombstones',async()=>{
  for(const fault of ['generation','session','dataset','target']){const f=await fresh(),before=await counts(f);if(fault==='generation')await f.auth.c.control.updateOne({_id:'server'},{$set:{serverGeneration:id()}});else if(fault==='session')await f.auth.logout(f.token);else await f.metadata.c.tombstones.insertOne({_id:id(),ownerId:f.ownerId,entityId:fault==='dataset'?f.d.dataset.datasetId:f.q.entityId});await denied(()=>f.references.incoming(f.token,f.q),fault==='generation'?'RECONCILIATION_REQUIRED':fault==='session'?'SESSION_REVOKED':'RESOURCE_DELETED');check(await counts(f)===before,'fault no domain writes');}return {generation:true,revokedSession:true,ancestorAndTargetDeleted:true,noDomainWrite:true};
 });
 await test('B034-reference-policy-corruption-fails-closed',async()=>{
  for(const field of ['strength','relation','sourceEntityId']){const f=await fresh(),filter={ownerId:f.ownerId,targetEntityId:f.q.entityId},ref=await f.metadata.c.refs.findOne(filter);await f.metadata.c.refs.updateOne({_id:ref._id},{$set:{[field]:field==='strength'?'historical':field==='relation'?'unregisteredRelation':id()}});await denied(()=>f.references.incoming(f.token,{...f.q,limit:100}),'RECONCILIATION_REQUIRED');check(await f.metadata.c.refs.countDocuments(filter)===3,'corrupt evidence retained');}return {fixedStrength:true,unknownRelationHeld:true,missingSourceHeld:true,noRepairOrDelete:true};
 });
 await test('B034-reference-artifact-pointer-rename-and-bounds',async()=>{
  const f=await fresh(),source=f.d.artifacts.find(a=>a.purpose==='source'),q={...f.q,entityId:source.artifactId,entityType:'artifact'};let page=await f.references.incoming(f.token,q);check(page.items.length===1&&page.items[0].relation==='source','actual source artifact ref');const rename=await mutation('dataset.rename',f.projectId,f.d.dataset.datasetId,{name:'Đổi tên giữ source'},{baseRevision:1});await commit(f,rename,[]);page=await f.references.incoming(f.token,q);check(page.items.length===1,'unrelated rename preserves immutable source reference');for(const limit of [0,101,1.5])await denied(()=>f.references.incoming(f.token,{...q,limit}),'VALIDATION_FAILED');await denied(()=>f.references.incoming(f.token,{...q,strength:'historical'}),'VALIDATION_FAILED');await denied(()=>f.references.incoming(f.token,{...q,entityType:'chart'}),'UNSUPPORTED_OPERATION');return {realArtifactTarget:true,renameDoesNotInvalidateSource:true,strictBounds:true,noClientStrength:true,futureTypesUnavailable:true};
 });
}
