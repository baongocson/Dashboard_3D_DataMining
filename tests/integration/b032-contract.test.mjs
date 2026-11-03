import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSchema} from '../../packages/contracts/src/index.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
import {id,descriptor} from '../fixtures/b032.mjs';
import {readFile} from 'node:fs/promises';
await checkGenerated();
test('S12 declaration strict descriptor/authority separation: client paths and ready flags rejected',()=>{
 const body={serverGeneration:id(),descriptor:descriptor(id(),Buffer.from('synthesis'))};assertSchema('storage-request.json',body);
 for(const edit of [x=>x.ownerId=id(),x=>x.storageKey='../private',x=>x.descriptor.ready=true,x=>x.descriptor.path='C:/data']){const v=structuredClone(body);edit(v);assert.throws(()=>assertSchema('storage-request.json',v),e=>e.code==='VALIDATION_FAILED');}
});
test('S12 upload view contains bounded metadata, opaque ID, no byte path or premature ready state',()=>{
 const v={uploadId:'A'.repeat(43),artifactId:id(),chunkSizeBytes:4194304,expiresAt:new Date(0).toISOString(),serverGeneration:id(),state:'verified',receivedChunks:[]};assertSchema('storage-view.json',v);
 for(const edit of [x=>x.state='ready',x=>x.uploadId='../private',x=>x.storageKey='private',x=>x.chunkSizeBytes=20000000]){const bad=structuredClone(v);edit(bad);assert.throws(()=>assertSchema('storage-view.json',bad),e=>e.code==='VALIDATION_FAILED');}
});
test('O05 OpenAPI six private routes have only resolved local schema refs',async()=>{
 const spec=JSON.parse(await readFile(new URL('../../packages/contracts/openapi/storage.local.v1.json',import.meta.url),'utf8'));let refs=0,operations=0;
 function walk(v){if(Array.isArray(v))return v.forEach(walk);if(!v||typeof v!=='object')return;if(v.$ref){refs++;assert.ok(v.$ref.startsWith('#/'));let target=spec;for(const p of v.$ref.slice(2).split('/'))target=target?.[p.replaceAll('~1','/').replaceAll('~0','~')];assert.ok(target,'Unresolved '+v.$ref);}Object.values(v).forEach(walk);}walk(spec);
 for(const methods of Object.values(spec.paths))for(const op of Object.values(methods)){operations++;assert.ok(op.security[0].sessionCookie);}
 assert.equal(operations,6);assert.ok(refs>20);
});
test('S12 inventory query/page schemas expose bounded continuation without deletion authority',()=>{
 for(const limit of [1,2,100])assertSchema('storage-cleanup-query.json',{limit,cursor:'A'.repeat(43)});
 for(const query of [{limit:0},{limit:101},{limit:1.5},{limit:'2'},{cursor:'../path'},{ownerId:id()}])assert.throws(()=>assertSchema('storage-cleanup-query.json',query),e=>e.code==='VALIDATION_FAILED');
 const page={mode:'retain-only',physicalDeletionEnabled:false,entries:[],hasMore:false,nextCursor:null};
 assertSchema('storage-cleanup-page.json',page);
 for(const edit of [x=>x.physicalDeletionEnabled=true,x=>x.storageKey='private',x=>x.nextCursor='../path']){const invalid=structuredClone(page);edit(invalid);assert.throws(()=>assertSchema('storage-cleanup-page.json',invalid),e=>e.code==='VALIDATION_FAILED');}
});
