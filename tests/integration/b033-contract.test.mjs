import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDeclaration,assembleAck,prepareCommitRequest,assembleDeclarationPlan,prepareReceiptReplay} from '../../apps/api/src/sync/contracts.ts';
import {validateAck} from '../../apps/web/src/local/sync.ts';
import {batch,rename,id,versionFixture,rehash,commitRequest,uploadFinding,presentFinding} from '../fixtures/b033-contract.mjs';
import {assertSchema} from '../../packages/contracts/src/index.mjs';
import {canonicalJson,mutationHash,collectVersionArtifacts} from '../../packages/data-format/src/index.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();
const denied=(fn,code)=>assert.rejects(fn,e=>e.code===code);
test('B033-contract strict typed metadata and unavailable kinds',async()=>{
 const m=await rename();await prepareDeclaration(batch([m]));
 const extra=structuredClone(m);extra.payload.ownerId=id();await denied(()=>prepareDeclaration(batch([extra])),'VALIDATION_FAILED');
 const unavailable={...m,kind:'workflow.save'};await rehash(unavailable);await denied(()=>prepareDeclaration(batch([unavailable])),'UNSUPPORTED_OPERATION');
 await denied(()=>prepareDeclaration({...batch([m]),ownerId:id()}),'VALIDATION_FAILED');
});
test('B033-contract per-mutation descriptors match shared hash despite global batch order',async()=>{
 const f=await versionFixture(),b=batch([f.next.m,f.m],{artifacts:[...f.data.artifacts].reverse()}),p=await prepareDeclaration(b);
 assert.deepEqual(p.orderedGroups.map(g=>g.mutationIds[0]),[f.m.mutationId,f.next.m.mutationId]);
 assert.deepEqual(p.ownArtifactsByMutation[f.m.mutationId],f.data.artifacts);
 const shared=collectVersionArtifacts(f.next.m,b.artifacts);assert.deepEqual(p.ownArtifactsByMutation[f.next.m.mutationId],shared);
 assert.equal(await mutationHash(f.next.m,shared),f.next.m.payloadHash);
});
test('B033-contract changed business hash and duplicate mutation identity rejected',async()=>{
 const m=await rename(),changed=structuredClone(m);changed.payload.name='changed';await denied(()=>prepareDeclaration(batch([changed])),'HASH_MISMATCH');
 await denied(()=>prepareDeclaration(batch([m,structuredClone(m)])),'VALIDATION_FAILED');
 const other=structuredClone(m);other.payloadHash='f'.repeat(64);await denied(()=>prepareDeclaration(batch([m,other])),'IDEMPOTENCY_MISMATCH');
});
test('B033-contract artifacts unique, referenced, typed leaf graph and scoped',async()=>{
 const f=await versionFixture(),a=f.data.artifacts,b=batch([f.m],{artifacts:a});
 await denied(()=>prepareDeclaration({...b,artifacts:[...a,a[0]]}),'VALIDATION_FAILED');
 const mismatch=structuredClone(a[0]);mismatch.sha256='f'.repeat(64);await denied(()=>prepareDeclaration({...b,artifacts:[...a,mismatch]}),'IDEMPOTENCY_MISMATCH');
 const extra={...a[0],artifactId:id(),purpose:'metrics'};await denied(()=>prepareDeclaration({...b,artifacts:[...a,extra]}),'VALIDATION_FAILED');
 const cross=structuredClone(a);cross[1].projectId=id();await denied(()=>prepareDeclaration({...b,artifacts:cross}),'INVALID_SOURCE');
 const cycle=structuredClone(a);cycle.find(d=>d.purpose==='tableChunk').dependencyArtifactIds=[f.data.version.tableManifestId];await denied(()=>prepareDeclaration({...b,artifacts:cycle}),'INVALID_SOURCE');
 for(const sizeBytes of [20000001,268435457]){const oversized=structuredClone(a);oversized[0].sizeBytes=sizeBytes;await denied(()=>prepareDeclaration({...b,artifacts:oversized}),'INPUT_FILE_TOO_LARGE');}
 await denied(()=>prepareDeclaration({...b,artifacts:[...a,{...extra,sizeBytes:268435457}]}),'ARTIFACT_LIMIT_EXCEEDED');
});
test('B033-contract atomic membership is exact disjoint complete and nonempty',async()=>{
 const p=id(),a=await rename(p),b=await rename(p),v=batch([a,b]);
 await denied(()=>prepareDeclaration({...v,atomicGroups:[]}),'VALIDATION_FAILED');
 await denied(()=>prepareDeclaration({...v,atomicGroups:[{groupId:id(),mutationIds:[a.mutationId]}]}),'VALIDATION_FAILED');
 await denied(()=>prepareDeclaration({...v,atomicGroups:[...v.atomicGroups,{groupId:id(),mutationIds:[a.mutationId]}]}),'VALIDATION_FAILED');
 await denied(()=>prepareDeclaration({...v,atomicGroups:[{groupId:id(),mutationIds:[a.mutationId,id()]}]}),'VALIDATION_FAILED');
 const duplicate=structuredClone(v);duplicate.atomicGroups[1].groupId=duplicate.atomicGroups[0].groupId;await denied(()=>prepareDeclaration(duplicate),'VALIDATION_FAILED');
});
test('B033-contract100batch/20group bounds enforced without history count cap',async()=>{
 const p=id(),mutations=[];for(let i=0;i<101;i++)mutations.push(await rename(p,[],'synthetic '+i));
 const groups=n=>Array.from({length:Math.ceil(n/20)},(_,i)=>({groupId:id(),mutationIds:mutations.slice(i*20,Math.min(n,(i+1)*20)).map(m=>m.mutationId)}));
 assert.equal((await prepareDeclaration(batch(mutations.slice(0,100),{groups:groups(100)}))).declaration.mutations.length,100);
 await denied(()=>prepareDeclaration(batch(mutations,{groups:groups(101)})),'VALIDATION_FAILED');
 await denied(()=>prepareDeclaration(batch(mutations.slice(0,21),{groups:[{groupId:id(),mutationIds:mutations.slice(0,21).map(m=>m.mutationId)}]})),'VALIDATION_FAILED');
});
test('B033-contract topological group/member order preserves dependency IDs',async()=>{
 const p=id(),a=await rename(p),b=await rename(p,[a.mutationId]),c=await rename(p,[b.mutationId]),g1=id(),g2=id();
 const declaration=batch([c,b,a],{groups:[{groupId:g2,mutationIds:[c.mutationId]},{groupId:g1,mutationIds:[b.mutationId,a.mutationId]}]}),prepared=await prepareDeclaration(declaration);
 assert.deepEqual(prepared.orderedGroups,[{groupId:g1,mutationIds:[a.mutationId,b.mutationId]},{groupId:g2,mutationIds:[c.mutationId]}]);
 assert.deepEqual(prepared.declaration.mutations[0].dependencies,[b.mutationId]);
});
test('B033-contract self/mutation cycles and collapsed atomic group cycles rejected',async()=>{
 const p=id(),a=await rename(p),b=await rename(p);a.dependencies=[a.mutationId];await rehash(a);await denied(()=>prepareDeclaration(batch([a])),'VALIDATION_FAILED');
 a.dependencies=[b.mutationId];b.dependencies=[a.mutationId];await rehash(a);await rehash(b);await denied(()=>prepareDeclaration(batch([a,b])),'VALIDATION_FAILED');
 const x=await rename(p),y=await rename(p,[x.mutationId]),z=await rename(p,[y.mutationId]);await denied(()=>prepareDeclaration(batch([x,y,z],{groups:[{groupId:id(),mutationIds:[x.mutationId,z.mutationId]},{groupId:id(),mutationIds:[y.mutationId]}]})),'VALIDATION_FAILED');
});
test('B033-contract cross-project dependency denied; external IDs remain unresolved',async()=>{
 const a=await rename(),b=await rename(id(),[a.mutationId]);await denied(()=>prepareDeclaration(batch([a,b])),'INVALID_SOURCE');
 const external=id(),m=await rename(id(),[external]),p=await prepareDeclaration(batch([m]));assert.deepEqual(p.externalDependencyIds,[external]);
 assert.equal('committed' in p,false);assert.deepEqual(p.declaration.mutations[0].dependencies,[external]);
});
test('B033-contract dataset V0/branch/intent config binding is typed, no storage proof',async()=>{
 const f=await versionFixture(),bad=structuredClone(f.m);bad.payload.initialVersion.version.datasetId=id();await denied(()=>prepareDeclaration(batch([bad],{artifacts:f.data.artifacts})),'INVALID_SOURCE');
 const config=structuredClone(f.m);config.payload.configHash='f'.repeat(64);await denied(()=>prepareDeclaration(batch([config],{artifacts:f.data.artifacts})),'HASH_MISMATCH');
 const head=structuredClone(f.next.m);head.payload.expectedHead.branchId=id();await denied(()=>prepareDeclaration(batch([head],{artifacts:f.next.artifacts})),'VALIDATION_FAILED');
});
test('B033-contract exact1MiB canonical declaration boundary',async()=>{
 const f=await versionFixture();f.m.payload.dataset.parseConfig.text='';await rehash(f.m,f.data.artifacts);const b=batch([f.m],{artifacts:f.data.artifacts}),base=Buffer.byteLength(canonicalJson(b),'utf8');
 for(const delta of [-1,0,1]){const v=structuredClone(b);v.mutations[0].payload.dataset.parseConfig.text='x'.repeat(1048576-base+delta);await rehash(v.mutations[0],f.data.artifacts);assert.equal(Buffer.byteLength(canonicalJson(v),'utf8'),1048576+delta);if(delta===1)await denied(()=>prepareDeclaration(v),'PAYLOAD_TOO_LARGE');else await prepareDeclaration(v);}
});
test('B033-contract immutable snapshot; transport identity/generation not mutation hash',async()=>{
 const m=await rename(),expectedName=m.payload.name,b=batch([m]),p=await prepareDeclaration(b);b.mutations[0].payload.name='edited';assert.equal(p.declaration.mutations[0].payload.name,expectedName);
 assert.ok(Object.isFrozen(p.declaration.mutations[0].payload));assert.throws(()=>p.declaration.mutations[0].payload.name='mutate',TypeError);
 const alternate={...structuredClone(p.declaration),batchId:id(),serverGeneration:id()},q=await prepareDeclaration(alternate);
 assert.notEqual(q.batchSnapshotHash,p.batchSnapshotHash);assert.equal(q.declaration.mutations[0].payloadHash,p.declaration.mutations[0].payloadHash);
});
const receipt=(m,artifacts=[])=>({mutationId:m.mutationId,payloadHash:m.payloadHash,entityIds:[m.entityId],artifactIds:artifacts.map(d=>d.artifactId),revisions:[{entityId:m.entityId,revision:1}],outcome:'committed',conflictRefs:[],branchResult:{internal:true},storageKey:'never-public'});
test('B033-contract ACK public projection agrees with client validator and keeps internal fields private',async()=>{
 const f=await versionFixture(),b=batch([f.m],{artifacts:f.data.artifacts}),p=await prepareDeclaration(b),result={kind:'acknowledged',receipt:receipt(f.m,f.data.artifacts)},ack=await assembleAck(b,[result],{serverGeneration:b.serverGeneration,requestId:'b033-contract'});
 validateAck(b,ack,new Map(Object.entries(p.ownArtifactsByMutation)));assert.equal(ack.status,'committed');
 assert.equal('branchResult'in ack.acknowledged[0],false);assert.equal('storageKey'in ack.acknowledged[0],false);
 result.receipt.entityIds.push(id());assert.equal(ack.acknowledged[0].entityIds.length,1);assert.ok(Object.isFrozen(ack.acknowledged[0]));
});
test('B033-contract ACK partition exact complete, unknown/new IDs and partial atomic ACK rejected',async()=>{
 const p=id(),a=await rename(p),b=await rename(p),s=batch([a,b]),options={serverGeneration:s.serverGeneration,requestId:'b033-contract'},one={kind:'acknowledged',receipt:receipt(a)},two={kind:'pending',mutationId:b.mutationId,code:'ARTIFACT_NOT_READY',retryable:true};
 const partial=await assembleAck(s,[one,two],options);assert.equal(partial.status,'partial');validateAck(s,partial,new Map([[a.mutationId,[]],[b.mutationId,[]]]));
 await denied(()=>assembleAck(s,[one],options),'VALIDATION_FAILED');
 await denied(()=>assembleAck(s,[one,one,two],options),'VALIDATION_FAILED');
 await denied(()=>assembleAck(s,[one,{...two,mutationId:id()}],options),'VALIDATION_FAILED');
 const grouped={...s,atomicGroups:[{groupId:id(),mutationIds:[a.mutationId,b.mutationId]}]};await denied(()=>assembleAck(grouped,[one,two],options),'VALIDATION_FAILED');
});
test('B033-contract ACK hash/artifact/generation exact; invalid receipt shape not emitted',async()=>{
 const m=await rename(),s=batch([m]),options={serverGeneration:s.serverGeneration,requestId:'b033-contract'},r=receipt(m);
 await denied(()=>assembleAck(s,[{kind:'acknowledged',receipt:{...r,payloadHash:'f'.repeat(64)}}],options),'IDEMPOTENCY_MISMATCH');
 await denied(()=>assembleAck(s,[{kind:'acknowledged',receipt:{...r,artifactIds:[id()]}}],options),'VALIDATION_FAILED');
 await denied(()=>assembleAck(s,[{kind:'acknowledged',receipt:r}],{...options,serverGeneration:id()}),'RECONCILIATION_REQUIRED');
 await denied(()=>assembleAck(s,[{kind:'acknowledged',receipt:{...r,revisions:[...r.revisions,...r.revisions]}}],options),'VALIDATION_FAILED');
  await denied(()=>assembleAck(s,[{kind:'acknowledged',receipt:{...r,revisions:[null]}}],options),'VALIDATION_FAILED');
  await denied(()=>assembleAck(s,[{kind:'acknowledged',receipt:{...r,outcome:'conflictPreserved',conflictRefs:[null]}}],options),'VALIDATION_FAILED');
 await denied(()=>assembleAck(s,[{kind:'acknowledged',receipt:{...r,outcome:'invented'}}],options),'VALIDATION_FAILED');
});
test('B033-contract preserved conflict is ACKable but ACK assembly does not mutate input or bind pointers',async()=>{
 const m=await rename(),s=batch([m]),options={serverGeneration:s.serverGeneration,requestId:'b033-contract'},r=receipt(m),copy=id();r.outcome='conflictPreserved';r.entityIds=[copy];r.conflictRefs=[{kind:'copy',entityId:copy,conflictOf:m.entityId}];
 const before=canonicalJson(s),ack=await assembleAck(s,[{kind:'acknowledged',receipt:r}],options);validateAck(s,ack,new Map([[m.mutationId,[]]]));assert.equal(canonicalJson(s),before);
 const rejected=await assembleAck(s,[{kind:'rejected',mutationId:m.mutationId,code:'RESOURCE_DELETED'}],options);assert.equal(rejected.status,'rejected');assert.equal(rejected.acknowledged.length,0);
});
const commitContext=declaration=>({batchId:declaration.batchId,serverGeneration:declaration.serverGeneration});
test('B033-commit ID-only request selects declared whole groups in dependency order',async()=>{
 const p=id(),a=await rename(p),b=await rename(p,[a.mutationId]),s=batch([b,a]),before=canonicalJson(s),body=commitRequest(s),plan=await prepareCommitRequest(s,body,commitContext(s));
 assert.deepEqual(plan.requestedMutationIds,[a.mutationId,b.mutationId]);assert.equal(plan.requestedGroups.length,2);
 assert.deepEqual(plan.requiredReceipts,[]);assert.equal(canonicalJson(s),before);assert.deepEqual(plan.request,body);
 assert.equal('committed'in plan,false);assert.equal('acknowledged'in plan,false);
});
test('B033-commit rejects unknown duplicate empty oversized and partial-group IDs',async()=>{
 const p=id(),a=await rename(p),b=await rename(p),s=batch([a,b],{groups:[{groupId:id(),mutationIds:[a.mutationId,b.mutationId]}]}),context=commitContext(s);
 for(const ids of [[id()],[a.mutationId,a.mutationId],[],Array.from({length:101},id),[a.mutationId]])await denied(()=>prepareCommitRequest(s,commitRequest(s,ids),context),'VALIDATION_FAILED');
 const plan=await prepareCommitRequest(s,commitRequest(s,[b.mutationId,a.mutationId]),context);assert.equal(plan.requestedGroups.length,1);assert.equal(plan.requestedMutationIds.length,2);
});
test('B033-commit forbids payload/artifact/group/receipt/owner overrides',async()=>{
 const m=await rename(),s=batch([m]),context=commitContext(s),body=commitRequest(s);
 for(const extra of [{payload:{}},{mutations:[m]},{artifacts:[]},{atomicGroups:[]},{acknowledged:[]},{ownerId:id()},{batchId:s.batchId}])await denied(()=>prepareCommitRequest(s,{...body,...extra},context),'VALIDATION_FAILED');
 const wrong=structuredClone(body);wrong.mutationIds[0]='not-uuid';await denied(()=>prepareCommitRequest(s,wrong,context),'VALIDATION_FAILED');
});
test('B033-commit route identity and request/current generation remain bound to declaration',async()=>{
 const s=batch([await rename()]),body=commitRequest(s),context=commitContext(s);
 await denied(()=>prepareCommitRequest(s,body,{...context,batchId:id()}),'RESOURCE_NOT_FOUND');
 await denied(()=>prepareCommitRequest(s,{...body,serverGeneration:id()},context),'RECONCILIATION_REQUIRED');
 await denied(()=>prepareCommitRequest(s,body,{...context,serverGeneration:id()}),'RECONCILIATION_REQUIRED');
 await denied(()=>prepareCommitRequest(s,body,{...context,batchId:'../batch'}),'VALIDATION_FAILED');
});
test('B033-commit omitted and external dependencies remain explicit unresolved receipt requirements',async()=>{
 const p=id(),external=id(),a=await rename(p),b=await rename(p,[a.mutationId,external]),c=await rename(p,[b.mutationId]),s=batch([c,b,a]),plan=await prepareCommitRequest(s,commitRequest(s,[b.mutationId]),commitContext(s));
 assert.deepEqual(plan.requestedMutationIds,[b.mutationId]);assert.deepEqual(plan.requiredReceipts,[
  {projectId:p,mutationId:a.mutationId,expectedPayloadHash:a.payloadHash,reason:'outsideRequest'},
  {projectId:p,mutationId:external,expectedPayloadHash:null,reason:'outsideBatch'}
 ]);
 assert.equal(plan.requestedGroups.length,1);assert.equal('resolvedRevision'in plan,false);
 assert.throws(()=>plan.requiredReceipts[0].expectedPayloadHash='changed',TypeError);
});
test('B033-commit scopes receipt requirements per project and freezes caller-independent selection',async()=>{
 const external=id(),a=await rename(id(),[external]),b=await rename(id(),[external]),s=batch([a,b]),body=commitRequest(s),before=canonicalJson(body),plan=await prepareCommitRequest(s,body,commitContext(s));
 assert.equal(canonicalJson(body),before);assert.equal(plan.requiredReceipts.length,2);assert.notEqual(plan.requiredReceipts[0].projectId,plan.requiredReceipts[1].projectId);
 body.mutationIds.length=0;assert.equal(plan.requestedMutationIds.length,2);assert.equal(plan.request.mutationIds.length,2);
 assert.ok(Object.isFrozen(plan.requestedGroups[0].mutationIds));
});
test('B033-commit and ACK capture caller inputs before asynchronous hashing yields',async()=>{
 const m=await rename(),s=batch([m]),body=commitRequest(s),context=commitContext(s);
 const selecting=prepareCommitRequest(s,body,context).then(value=>({value}),error=>({error}));
 body.mutationIds.length=0;body.payload={injected:true};context.batchId=id();context.serverGeneration=id();
 const selected=await selecting;assert.ifError(selected.error);assert.deepEqual(selected.value.requestedMutationIds,[m.mutationId]);assert.equal('payload'in selected.value.request,false);
 const results=[{kind:'acknowledged',receipt:receipt(m)}],options={serverGeneration:s.serverGeneration,requestId:'captured-original'};
 const building=assembleAck(s,results,options).then(value=>({value}),error=>({error}));
 results[0].receipt.payloadHash='f'.repeat(64);options.serverGeneration=id();options.requestId='late-change';
 const built=await building;assert.ifError(built.error);assert.equal(built.value.requestId,'captured-original');assert.equal(built.value.acknowledged[0].payloadHash,m.payloadHash);
});
async function planFixture(){
 const f=await versionFixture(),s=batch([f.m],{artifacts:f.data.artifacts}),options={serverGeneration:s.serverGeneration};
 return {f,s,options,findings:f.data.artifacts.map(a=>uploadFinding(a,s.serverGeneration))};
}
test('B033-plan mixed dispositions cover artifacts without ACKing metadata commit',async()=>{
 const {f,s,options}=await planFixture(),a=f.data.artifacts,findings=[{kind:'rejected',target:'artifact',id:a[2].artifactId,code:'STORAGE_UNAVAILABLE'},presentFinding(a[1]),uploadFinding(a[0],s.serverGeneration),{kind:'rejected',target:'mutation',id:f.m.mutationId,code:'RESOURCE_DELETED'}];
 const plan=await assembleDeclarationPlan(s,findings,options);assertSchema('sync-declaration-plan.json',plan);
 assert.equal(plan.needsUpload.length,1);assert.equal(plan.alreadyPresent[0].state,'verified');assert.deepEqual(plan.rejected.map(r=>r.target),['artifact','mutation']);
 assert.equal('acknowledged'in plan,false);assert.equal('status'in plan,false);
 assert.throws(()=>assertSchema('sync-ack.json',plan),e=>e.code==='VALIDATION_FAILED');
});
test('B033-plan artifact/mutation disposition partition is exact disjoint and scoped',async()=>{
 const {s,findings,options}=await planFixture();
 await denied(()=>assembleDeclarationPlan(s,findings.slice(1),options),'VALIDATION_FAILED');
 await denied(()=>assembleDeclarationPlan(s,[...findings,findings[0]],options),'VALIDATION_FAILED');
 await denied(()=>assembleDeclarationPlan(s,[...findings,{kind:'rejected',target:'artifact',id:id(),code:'RESOURCE_DELETED'}],options),'VALIDATION_FAILED');
 await denied(()=>assembleDeclarationPlan(s,[...findings,{kind:'rejected',target:'mutation',id:id(),code:'RESOURCE_DELETED'}],options),'VALIDATION_FAILED');
 const duplicateUpload=structuredClone(findings);duplicateUpload[1].upload.uploadId=duplicateUpload[0].upload.uploadId;await denied(()=>assembleDeclarationPlan(s,duplicateUpload,options),'VALIDATION_FAILED');
 const r={kind:'rejected',target:'mutation',id:s.mutations[0].mutationId,code:'RESOURCE_DELETED'};await denied(()=>assembleDeclarationPlan(s,[...findings,r,r],options),'VALIDATION_FAILED');
});
test('B033-plan present hash/size/state and upload generation/stage must match',async()=>{
 const {s,options}=await planFixture(),present=s.artifacts.map(a=>presentFinding(a,'ready'));
 await assembleDeclarationPlan(s,present,options);
 for(const field of ['sha256','sizeBytes']){const bad=structuredClone(present);bad[0].artifact[field]=field==='sha256'?'f'.repeat(64):bad[0].artifact.sizeBytes+1;await denied(()=>assembleDeclarationPlan(s,bad,options),'IDEMPOTENCY_MISMATCH');}
 const wrongState=structuredClone(present);wrongState[0].artifact.state='uploading';await denied(()=>assembleDeclarationPlan(s,wrongState,options),'VALIDATION_FAILED');
 await denied(()=>assembleDeclarationPlan(s,present,{serverGeneration:id()}),'RECONCILIATION_REQUIRED');
 for(const state of ['verified','cancelled']){const bad=s.artifacts.map(a=>uploadFinding(a,s.serverGeneration));bad[0].upload.state=state;await denied(()=>assembleDeclarationPlan(s,bad,options),'VALIDATION_FAILED');}
 const generation=s.artifacts.map(a=>uploadFinding(a,s.serverGeneration));generation[0].upload.serverGeneration=id();await denied(()=>assembleDeclarationPlan(s,generation,options),'RECONCILIATION_REQUIRED');
});
test('B033-plan upload chunk metadata is bounded, consistent and does not leak private fields',async()=>{
 const {s,findings,options}=await planFixture(),a=s.artifacts[0],chunk={index:0,offset:0,length:a.sizeBytes,sha256:a.sha256};
 findings[0].upload.receivedChunks=[chunk];findings[0].upload.storageKey='never-public';findings[0].upload.ownerId=id();
 const plan=await assembleDeclarationPlan(s,findings,options);assert.equal('storageKey'in plan.needsUpload[0],false);assert.equal('ownerId'in plan.needsUpload[0],false);
 const variants=[c=>c.push({...c[0]}),c=>c[0].index=1,c=>c[0].offset=1,c=>c[0].length++,c=>c[0].index=-1,c=>c[0].sha256='bad',c=>c[0].storageKey='private'];
 for(const edit of variants){const bad=structuredClone(findings);edit(bad[0].upload.receivedChunks);await denied(()=>assembleDeclarationPlan(s,bad,options),'VALIDATION_FAILED');}
});
test('B033-plan rejections use known IDs/catalog codes; malformed findings are safe validation errors',async()=>{
 const {s,findings,options}=await planFixture();
 const unknown={kind:'rejected',target:'mutation',id:s.mutations[0].mutationId,code:'INVENTED_CODE'};await denied(()=>assembleDeclarationPlan(s,[...findings,unknown],options),'VALIDATION_FAILED');
 for(const malformed of [null,{},'bad',[null],[[]],[{kind:'acknowledged',receipt:{}}]])await denied(()=>assembleDeclarationPlan(s,malformed,options),'VALIDATION_FAILED');
 const meta=batch([await rename()]),ackOptions={serverGeneration:meta.serverGeneration,requestId:'malformed-outcomes'};
 for(const malformed of [null,{},[null],[[]]])await denied(()=>assembleAck(meta,malformed,ackOptions),'VALIDATION_FAILED');
});
test('B033-plan captures findings/context before await and returns frozen detached output',async()=>{
 const {s,findings,options}=await planFixture(),expectedArtifact=s.artifacts[0].artifactId,generation=s.serverGeneration;
 const pending=assembleDeclarationPlan(s,findings,options);findings[0].upload.artifactId=id();options.serverGeneration=id();s.artifacts[0].artifactId=id();
 const plan=await pending;assert.equal(plan.needsUpload[0].artifactId,expectedArtifact);assert.equal(plan.serverGeneration,generation);
 assert.ok(Object.isFrozen(plan.needsUpload[0].receivedChunks));assert.throws(()=>plan.needsUpload[0].uploadId='changed',TypeError);
});
test('B033-plan oversized metadata response rejects without dropping groups or received chunks',async()=>{
 const f=await versionFixture(),mutations=[],artifacts=[];
 for(let i=0;i<100;i++){
  const chunk={...f.data.artifacts.find(a=>a.purpose==='tableChunk'),artifactId:id(),sizeBytes:268435456,sha256:'b'.repeat(64)};
  const root={...f.data.artifacts.find(a=>a.purpose==='tableManifest'),artifactId:id(),sizeBytes:268435456,sha256:'a'.repeat(64),dependencyArtifactIds:[chunk.artifactId]};
  const m=structuredClone(f.next.m);m.mutationId=id();m.entityId=id();m.payload.version.versionId=m.entityId;m.payload.version.tableManifestId=root.artifactId;await rehash(m,[root,chunk]);mutations.push(m);artifacts.push(root,chunk);
 }
 const s=batch(mutations,{artifacts}),findings=artifacts.map(a=>uploadFinding(a,s.serverGeneration,{receivedChunks:Array.from({length:64},(_,index)=>({index,offset:index*4194304,length:4194304,sha256:'c'.repeat(64)}))}));
 await denied(()=>assembleDeclarationPlan(s,findings,{serverGeneration:s.serverGeneration}),'PAYLOAD_TOO_LARGE');
 assert.equal(s.mutations.length,100);assert.equal(findings.length,200);assert.equal(findings[0].upload.receivedChunks.length,64);
});
test('B033-plan metadata-only declaration is valid; root DTO never accepts ACK/receipt fields',async()=>{
 const s=batch([await rename()]),plan=await assembleDeclarationPlan(s,[],{serverGeneration:s.serverGeneration});assert.deepEqual(plan.needsUpload,[]);assert.deepEqual(plan.alreadyPresent,[]);assert.deepEqual(plan.rejected,[]);
 for(const extra of [{acknowledged:[]},{status:'committed'},{receipt:{}},{ownerId:id()},{cursor:'fake'}])assert.throws(()=>assertSchema('sync-declaration-plan.json',{...plan,...extra}),e=>e.code==='VALIDATION_FAILED');
});

const replayFixture=(s,m=s.mutations[0],artifacts=[])=>{
 const committedAt=Date.parse('2026-08-01T00:00:00Z'),ownerId=id();
 const result=receipt(m,artifacts),identity={ownerId,projectId:m.projectId,entityId:m.entityId,mutationId:m.mutationId,canonicalHash:m.payloadHash,serverGeneration:s.serverGeneration,committedAt,result:structuredClone(result)};
 return {observation:{identity,receipt:{...identity,result:structuredClone(result),expiresAt:committedAt+90*86400000}},context:{ownerId,mutationId:m.mutationId,serverGeneration:s.serverGeneration,serverNow:committedAt+86400000}};
};
test('B033-replay lost-ACK equivalent result projects one immutable public receipt, never batch ACK',async()=>{
 const m=await rename(),s=batch([m]),f=replayFixture(s),r=await prepareReceiptReplay(s,f.observation,f.context);
 assert.equal(r.status,'replayPrepared');assert.equal(r.receipt.payloadHash,m.payloadHash);assert.equal('branchResult'in r.receipt,false);assert.equal('storageKey'in r.receipt,false);assert.equal('acknowledged'in r,false);assert.equal('commitAllowed'in r,false);assert.ok(Object.isFrozen(r.receipt.revisions));
 f.observation.identity.result.entityIds.push(id());assert.deepEqual(r.receipt.entityIds,[m.entityId]);
});
test('B033-replay missing receipt or identity never authorizes a new mutation',async()=>{
 const s=batch([await rename()]),f=replayFixture(s);
 for(const [observation,status,reason]of [[{receipt:null,identity:null},'unresolved','noCommitProof'],[{...f.observation,receipt:null},'requiresReconciliation','receiptMissing'],[{...f.observation,identity:null},'requiresReconciliation','identityMissing']]){
  const r=await prepareReceiptReplay(s,observation,f.context);assert.equal(r.status,status);assert.equal(r.reason,reason);assert.equal('receipt'in r,false);assert.equal('commitAllowed'in r,false);
 }
});
test('B033-replay expiry exact boundary and minimum90-day logical retention, no deletion',async()=>{
 const s=batch([await rename()]),f=replayFixture(s),end=f.observation.receipt.expiresAt;
 assert.equal((await prepareReceiptReplay(s,f.observation,{...f.context,serverNow:end-1})).status,'replayPrepared');
 for(const now of [end,end+1]){const r=await prepareReceiptReplay(s,f.observation,{...f.context,serverNow:now});assert.equal(r.reason,'receiptExpired');assert.equal('receipt'in r,false);}
 const changed=structuredClone(f.observation);changed.receipt.expiresAt=end-1;await denied(()=>prepareReceiptReplay(s,changed,f.context),'VALIDATION_FAILED');assert.equal(f.observation.receipt.expiresAt,end);
});
test('B033-replay binds owner/project/mutation/hash/entity/current generation to declaration',async()=>{
 const s=batch([await rename()]),f=replayFixture(s);
 for(const target of ['receipt','identity'])for(const [field,value,code]of [['ownerId',id(),'RESOURCE_NOT_FOUND'],['projectId',id(),'RESOURCE_NOT_FOUND'],['mutationId',id(),'VALIDATION_FAILED'],['canonicalHash','f'.repeat(64),'IDEMPOTENCY_MISMATCH'],['serverGeneration',id(),'RECONCILIATION_REQUIRED']]){const changed=structuredClone(f.observation);changed[target][field]=value;await denied(()=>prepareReceiptReplay(s,changed,f.context),code);}
 const changed=structuredClone(f.observation);changed.identity.entityId=id();await denied(()=>prepareReceiptReplay(s,changed,f.context),'IDEMPOTENCY_MISMATCH');
 await denied(()=>prepareReceiptReplay(s,f.observation,{...f.context,mutationId:id()}),'VALIDATION_FAILED');await denied(()=>prepareReceiptReplay(s,f.observation,{...f.context,serverGeneration:id()}),'RECONCILIATION_REQUIRED');
});
test('B033-replay durable result divergence or malformed result cannot produce replay',async()=>{
 const s=batch([await rename()]),f=replayFixture(s);
 const changed=structuredClone(f.observation);changed.identity.result.revisions[0].revision=2;await denied(()=>prepareReceiptReplay(s,changed,f.context),'RECONCILIATION_REQUIRED');
 for(const target of ['receipt','identity']){const bad=structuredClone(f.observation);bad[target].result.revisions=[null];await denied(()=>prepareReceiptReplay(s,bad,f.context),'VALIDATION_FAILED');}
 const time=structuredClone(f.observation);time.identity.committedAt--;await denied(()=>prepareReceiptReplay(s,time,f.context),'RECONCILIATION_REQUIRED');
});
test('B033-replay preserves stable conflict IDs and version artifact receipt without whole-group ACK',async()=>{
 const v=await versionFixture(),other=await rename(v.projectId),s=batch([v.m,other],{artifacts:v.data.artifacts,groups:[{groupId:id(),mutationIds:[v.m.mutationId,other.mutationId]}]}),f=replayFixture(s,v.m,v.data.artifacts),copy=id();
 for(const item of [f.observation.receipt,f.observation.identity]){item.result.outcome='conflictPreserved';item.result.entityIds=[v.m.entityId,copy];item.result.conflictRefs=[{kind:'branch',entityId:copy,conflictOf:v.m.entityId}];}
 const r=await prepareReceiptReplay(s,f.observation,f.context);assert.deepEqual(r.receipt.artifactIds,v.data.artifacts.map(a=>a.artifactId));assert.equal(r.receipt.conflictRefs[0].entityId,copy);assert.equal('acknowledged'in r,false);assert.equal('atomicGroups'in r,false);
});
test('B033-replay malformed observations/time/context fail safely; in-flight edits cannot rewrite replay',async()=>{
 const s=batch([await rename()]),f=replayFixture(s);
 for(const bad of [null,[],{}, {receipt:null}, {receipt:[],identity:null}])await denied(()=>prepareReceiptReplay(s,bad,f.context),'VALIDATION_FAILED');
 for(const now of [-1,1.5,Number.MAX_SAFE_INTEGER])await denied(()=>prepareReceiptReplay(s,f.observation,{...f.context,serverNow:now}),'VALIDATION_FAILED');
 await denied(()=>prepareReceiptReplay(s,f.observation,null),'VALIDATION_FAILED');
 for(const field of ['committedAt','expiresAt']){const o=structuredClone(f.observation);o.receipt[field]='2026-11-03';await denied(()=>prepareReceiptReplay(s,o,f.context),'VALIDATION_FAILED');}
 const result=prepareReceiptReplay(s,f.observation,f.context);f.context.serverNow=f.observation.receipt.expiresAt;f.context.ownerId=id();f.observation.receipt.result.revisions[0].revision=99;f.observation.identity=null;
 const r=await result;assert.equal(r.status,'replayPrepared');assert.equal(r.receipt.revisions[0].revision,1);
});
