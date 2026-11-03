import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateAck} from '../../apps/web/src/local/sync.ts';
import {assertSchema} from '../../packages/contracts/src/index.mjs';
import {collectVersionArtifacts,mutationHash} from '../../packages/data-format/src/index.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();
const projectId=randomUUID(),datasetId=randomUUID(),branchId=randomUUID(),manifestId=randomUUID(),chunkId=randomUUID();
const descriptor=(artifactId,purpose,dependencyArtifactIds=[])=>({artifactId,purpose,formatVersion:'table-jsonl-v1',mediaType:'application/json',sizeBytes:10,sha256:'a'.repeat(64),projectId,dependencyArtifactIds});
const artifacts=[descriptor(manifestId,'tableManifest',[chunkId]),descriptor(chunkId,'tableChunk')];
const first={schemaVersion:1,mutationId:randomUUID(),kind:'dataset.version.create',projectId,entityId:randomUUID(),baseRevision:0,dependencies:[],payload:{version:{schemaVersion:1,versionId:'',datasetId,branchId,parentVersionId:randomUUID(),sourceVersions:[],tableManifestId:manifestId,rowCount:2,columnCount:1,operationSnapshot:{operationId:'PREP.MISS_MEAN',configVersion:1,columnIds:[randomUUID()],params:{}}},expectedHead:{kind:'known',branchId,versionId:randomUUID(),revision:5},branch:{branchId,forkVersionId:null,reason:'initial'}},payloadHash:'0'.repeat(64)};
first.payload.version.versionId=first.entityId;first.payloadHash=await mutationHash(first,artifacts);
const second=structuredClone(first);second.mutationId=randomUUID();second.entityId=randomUUID();second.payload.version.versionId=second.entityId;second.payload.version.parentVersionId=first.entityId;second.dependencies=[first.mutationId];second.payload.expectedHead={kind:'dependency',branchId,fromMutationId:first.mutationId};second.payloadHash=await mutationHash(second,artifacts);
const snapshot={schemaVersion:1,batchId:randomUUID(),serverGeneration:randomUUID(),mutations:[first,second],artifacts,atomicGroups:[{groupId:randomUUID(),mutationIds:[first.mutationId,second.mutationId]}]};
const own=new Map(snapshot.mutations.map(m=>[m.mutationId,artifacts]));
const receipt=m=>({mutationId:m.mutationId,payloadHash:m.payloadHash,entityIds:[m.entityId],artifactIds:[manifestId,chunkId],revisions:[{entityId:m.entityId,revision:1}],outcome:'committed',conflictRefs:[]});
const ack=()=>({batchId:snapshot.batchId,status:'committed',acknowledged:snapshot.mutations.map(receipt),pending:[],rejected:[],cursor:null,serverGeneration:snapshot.serverGeneration,requestId:'test-b024'});
test('S11 declaration and ACK share primary strict schemas across Node/browser',()=>{
 assertSchema('sync-declaration.json',snapshot);assertSchema('sync-ack.json',ack());validateAck(snapshot,ack(),own);
 assert.throws(()=>assertSchema('sync-ack.json',{...ack(),secret:'not permitted'}),e=>e.code==='VALIDATION_FAILED');
});
test('Version descriptor preorder reconstructs exact business hash independently of global batch order',async()=>{
 const extra=descriptor(randomUUID(),'metrics'),reordered=[...artifacts].reverse().concat(extra);
 assert.deepEqual(collectVersionArtifacts(first,reordered),artifacts);
 assert.equal(await mutationHash(first,collectVersionArtifacts(first,reordered)),first.payloadHash);
 assert.throws(()=>collectVersionArtifacts(first,[...artifacts,artifacts[0]]),e=>e.code==='VALIDATION_FAILED');
 const cycle=structuredClone(artifacts);cycle[1].dependencyArtifactIds=[manifestId];
 assert.throws(()=>collectVersionArtifacts(first,cycle),e=>e.code==='INVALID_SOURCE');
});
test('ACK partition complete/disjoint, hash/generation exact, atomic group cannot be half ACKed',()=>{
 const edits=[
  [a=>a.acknowledged[0].mutationId=randomUUID(),'VALIDATION_FAILED'],
  [a=>a.acknowledged.pop(),'VALIDATION_FAILED'],
  [a=>a.pending.push({mutationId:first.mutationId,code:'ARTIFACT_NOT_READY',retryable:true}),'VALIDATION_FAILED'],
  [a=>a.acknowledged[0].payloadHash='f'.repeat(64),'IDEMPOTENCY_MISMATCH'],
  [a=>a.serverGeneration=randomUUID(),'RECONCILIATION_REQUIRED'],
  [a=>{a.acknowledged.pop();a.pending.push({mutationId:second.mutationId,code:'ARTIFACT_NOT_READY',retryable:true});a.status='partial';},'VALIDATION_FAILED']
 ];
 for(const[edit,code]of edits){const value=ack();edit(value);assert.throws(()=>validateAck(snapshot,value,own),e=>e.code===code);}
 const pending=ack();pending.acknowledged=[];pending.pending=snapshot.mutations.map(m=>({mutationId:m.mutationId,code:'ARTIFACT_NOT_READY',retryable:true}));pending.status='partial';
 validateAck(snapshot,pending,own);
});
