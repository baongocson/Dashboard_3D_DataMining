import test from 'node:test';
import assert from 'node:assert/strict';
import {id,imported} from '../fixtures/b031.mjs';
import {assertSchema} from '../../packages/contracts/src/index.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
import {readFile} from 'node:fs/promises';
await checkGenerated();
test('S10 intent strict imported/derived alternatives and stable logical IDs',async()=>{
 const f=await imported(id());assertSchema('metadata-intent-request.json',f.intent);
 for(const edit of [x=>x.file.size=20000001,x=>x.ownerId=id(),x=>delete x.file,x=>x.kind='join']){
  const value=structuredClone(f.intent);edit(value);assert.throws(()=>assertSchema('metadata-intent-request.json',value),e=>e.code==='VALIDATION_FAILED');
 }
 const join={...f.intent,kind:'join',sourceRefs:[{datasetId:id(),versionId:id(),role:'left',sourceOrder:0},{datasetId:id(),versionId:id(),role:'right',sourceOrder:1}]};delete join.file;assertSchema('metadata-intent-request.json',join);
});
test('S13 private DTOs reject database internals and paging has bounded validated query',()=>{
 const p={projectId:id(),name:'Tên trùng',revision:1,createdAtServer:new Date(0).toISOString(),updatedAtServer:new Date(0).toISOString()};
 assertSchema('metadata-project.json',p);assert.throws(()=>assertSchema('metadata-project.json',{...p,ownerId:id()}),e=>e.code==='VALIDATION_FAILED');
 for(const limit of ['1','99','100'])assertSchema('metadata-query.json',{limit});
 for(const value of [{limit:'101'},{limit:'0'},{limit:10},{ownerId:id()}])assert.throws(()=>assertSchema('metadata-query.json',value),e=>e.code==='VALIDATION_FAILED');
});
test('O03/O04 OpenAPI has eight private routes and every schema reference resolves locally',async()=>{
 const spec=JSON.parse(await readFile(new URL('../../packages/contracts/openapi/metadata.local.v1.json',import.meta.url),'utf8'));let refs=0,operations=0;
 function walk(v){if(Array.isArray(v))return v.forEach(walk);if(!v||typeof v!=='object')return;
  if(v.$ref){refs++;assert.ok(v.$ref.startsWith('#/'));let target=spec;for(const part of v.$ref.slice(2).split('/'))target=target?.[part.replaceAll('~1','/').replaceAll('~0','~')];assert.ok(target,'Unresolved '+v.$ref);}
  Object.values(v).forEach(walk);
 }walk(spec);
 for(const methods of Object.values(spec.paths))for(const operation of Object.values(methods)){operations++;assert.ok(operation.security[0].sessionCookie);}
 assert.equal(operations,8);assert.ok(refs>20);
});
