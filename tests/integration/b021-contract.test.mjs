import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assertVersionCreateMutation} from '../../packages/contracts/src/index.mjs';
import {mutationHash} from '../../packages/data-format/src/index.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();
const branchId=randomUUID(),versionId=randomUUID(),datasetId=randomUUID(),sourceId=randomUUID(),mutationId=randomUUID();
const version={schemaVersion:1,versionId,datasetId,branchId,parentVersionId:sourceId,sourceVersions:[{datasetId,versionId:sourceId,role:'primary',sourceOrder:0}],tableManifestId:randomUUID(),rowCount:2,columnCount:1,operationSnapshot:{operationId:'PREP.MISS_MEAN',configVersion:1,columnIds:[randomUUID()],params:{}}};
const mutation={schemaVersion:1,mutationId,kind:'dataset.version.create',projectId:randomUUID(),entityId:versionId,baseRevision:0,dependencies:[],payload:{version,expectedHead:{kind:'known',branchId,versionId:sourceId,revision:5},branch:{branchId,forkVersionId:null,reason:'initial'}},payloadHash:'0'.repeat(64)};
test('A separates entity create revision0 from known server head revision5',()=>{
 assert.equal(assertVersionCreateMutation(mutation),mutation);
 assert.throws(()=>assertVersionCreateMutation({...mutation,baseRevision:5}),e=>e.code==='VALIDATION_FAILED');
});
test('A immutable offline chain encodes dependency membership and exact branch',async()=>{
 const dependency=randomUUID(),next=structuredClone(mutation);next.dependencies=[dependency];next.payload.expectedHead={kind:'dependency',branchId,fromMutationId:dependency};
 assertVersionCreateMutation(next);const snapshot=JSON.stringify(next),h=await mutationHash(next);
 assert.equal(await mutationHash({...next,payloadHash:'a'.repeat(64)}),h);assert.equal(JSON.stringify(next),snapshot);
 const missing=structuredClone(next);missing.dependencies=[];assert.throws(()=>assertVersionCreateMutation(missing),e=>e.code==='VALIDATION_FAILED');
 const wrong=structuredClone(next);wrong.payload.expectedHead.branchId=randomUUID();assert.throws(()=>assertVersionCreateMutation(wrong),e=>e.code==='VALIDATION_FAILED');
 const self=structuredClone(next);self.dependencies.push(self.mutationId);assert.throws(()=>assertVersionCreateMutation(self),e=>e.code==='VALIDATION_FAILED');
});
test('Expected server head is business-hashed; local revision is not substituted',async()=>{
 const other=structuredClone(mutation);other.payload.expectedHead.revision=6;
 assert.notEqual(await mutationHash(other),await mutationHash(mutation));
 const empty=structuredClone(mutation);empty.payload.expectedHead.versionId=null;
 assert.throws(()=>assertVersionCreateMutation(empty),e=>e.code==='VALIDATION_FAILED');
 empty.payload.expectedHead.revision=0;assert.throws(()=>assertVersionCreateMutation(empty),e=>e.code==='VALIDATION_FAILED'); // parent cannot create initial empty branch.
});
