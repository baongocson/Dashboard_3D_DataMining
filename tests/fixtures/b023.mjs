import {estimateResources,DEFAULT_LIMITS,checkedProduct,checkedSum,joinRowUpperBound,BudgetAllocator} from '../../apps/web/src/local/resource-budget.ts';
import {PreviewCoordinator} from '../../apps/web/src/local/preview.ts';
import {assertSchema} from '../../packages/contracts/src/index.mjs';
import {registry} from '../../packages/operation-registry/src/index.mjs';
const check=(v,m)=>{if(!v)throw Error(m);};
const expect=async(fn,code)=>{try{await fn();throw Error('Expected '+code);}catch(e){check(e.code===code,'Expected '+code+', got '+(e.code??e.name));}};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const emptyPlan=()=>({estimateVersion:1,byteBuffers:[],denseMatrices:[],sparseMatrices:[],tables:[],vocabularies:[],outputRows:[],pairwiseComparisons:0,featureCount:0});
const request=()=>({schemaVersion:1,ownerId:id(1),projectId:id(2),sourceRefs:[{datasetId:id(3),versionId:id(4),role:'primary',sourceOrder:0}],sourceArtifacts:[{artifactId:id(5),sha256:'a'.repeat(64)}],sourceRowCount:2,config:{operationId:'PREP.MISS_MEAN',configVersion:1,columnIds:[id(10)],params:{alpha:1}},contextRevision:0,localGeneration:1,scope:'full',sampleMethod:'none',sampleSeed:null,rowsExamined:2});
function trustedFixture({version='synthetic-estimator-v1',propose}={}){
 const estimate=req=>{
   const plan=emptyPlan();plan.featureCount=2;plan.outputRows=[2];plan.denseMatrices=[{role:'features',rows:2,columns:2,copies:1,workspaceBytes:0}];
   return propose?propose(req,plan):{plan,effects:{outputRowUpperBound:2,outputFeatureUpperBound:2,...(req.scope==='full'?{affectedRows:1}:{sampleAffectedRows:3})},warnings:req.scope==='sample'?['SAMPLE_COUNTS_ONLY']:[],errors:[]};
 };
 return new Map([['PREP.MISS_MEAN',{operationId:'PREP.MISS_MEAN',configVersion:1,estimatorVersion:version,available:true,validateConfig:config=>assertSchema('operation-config.json',config),estimate}]]);
}
const coordinator=options=>new PreviewCoordinator({adapters:trustedFixture(),clock:()=>Date.UTC(2026,10,2),...options});
export async function runB023Checks(){
 const results=[];async function test(id,expected,fn){try{results.push({id,expected,status:'passed',actual:await fn()});}catch(e){results.push({id,expected,status:'failed',actual:{code:e.code??e.name,message:e.message}});}}
 await test('B023-profile-P','C20 baseline numbers versioned, input max remains P20000000, no product operations enabled',async()=>{
   assertSchema('limits-profile.json',DEFAULT_LIMITS);
   await expect(async()=>assertSchema('limits-profile.json',{...DEFAULT_LIMITS,inputSourceMaxBytes:20000001}),'VALIDATION_FAILED');
   check(DEFAULT_LIMITS.workerMemoryBudgetBytes===536870912&&DEFAULT_LIMITS.denseMatrixMaxCells===10000000&&DEFAULT_LIMITS.sparseMaxNnz===10000000&&DEFAULT_LIMITS.featureMaxCount===20000,'C20 profile');
   check(registry.operations.every(o=>o.capability.status==='unavailable'),'registry not enabled');
   return {profileVersion:DEFAULT_LIMITS.profileVersion,inputSourceMaxBytes:20000000,workerBudget:536870912,productOperationsEnabled:0};
 });
 await test('B023-byte-boundaries','Source20MB versus artifact256MiB, boundary−1/equal/+1 and cumulative worker budget checked without allocation',async()=>{
   for(const role of ['inputSource','artifact']){
    const cap=role==='inputSource'?20000000:268435456;
    for(const n of [cap-1,cap]){const p=emptyPlan();p.byteBuffers=[{role,sizeBytes:n,copies:1}];check(estimateResources(p).totalBytes===n,'boundary accepted');}
    const p=emptyPlan();p.byteBuffers=[{role,sizeBytes:cap+1,copies:1}];await expect(async()=>estimateResources(p),role==='inputSource'?'INPUT_FILE_TOO_LARGE':'ARTIFACT_LIMIT_EXCEEDED');
   }
   const artifact=emptyPlan();artifact.byteBuffers=[{role:'artifact',sizeBytes:20000001,copies:1}];estimateResources(artifact);
   for(const n of [536870911,536870912]){const p=emptyPlan();p.byteBuffers=[{role:'workspace',sizeBytes:n,copies:1}];estimateResources(p);}
   const tooBig=emptyPlan();tooBig.byteBuffers=[{role:'workspace',sizeBytes:536870913,copies:1}];await expect(async()=>estimateResources(tooBig),'RESOURCE_LIMIT_EXCEEDED');
   return {sourceBoundary:20000000,artifactBoundary:268435456,artifactOver20MAllowed:true,budgetBoundary:536870912,actualLargeAllocations:0};
 });
 await test('B023-shape-boundaries','Dense/nnz/features/output/pairs cap boundaries are separate and never imply input50k limit',async()=>{
   for(const cells of [9999999,10000000]){const p=emptyPlan();p.denseMatrices=[{role:'workspace',rows:cells,columns:1,copies:1,workspaceBytes:0}];estimateResources(p);}
   const d=emptyPlan();d.denseMatrices=[{role:'workspace',rows:10000001,columns:1,copies:1,workspaceBytes:0}];await expect(async()=>estimateResources(d),'RESOURCE_LIMIT_EXCEEDED');
   for(const nnz of [9999999,10000000,10000001]){const p=emptyPlan();p.featureCount=1000;p.sparseMatrices=[{rows:10001,columns:1000,nnz,copies:1,workspaceBytes:0}];if(nnz>10000000)await expect(async()=>estimateResources(p),'RESOURCE_LIMIT_EXCEEDED');else estimateResources(p);}
   for(const [field,cap]of [['featureCount',20000],['pairwiseComparisons',2000000]])for(const n of [cap-1,cap,cap+1]){const p=emptyPlan();p[field]=n;if(n>cap)await expect(async()=>estimateResources(p),'RESOURCE_LIMIT_EXCEEDED');else estimateResources(p);}
   for(const rows of [999999,1000000,1000001]){const p=emptyPlan();p.outputRows=[rows];if(rows>1000000)await expect(async()=>estimateResources(p),'RESOURCE_LIMIT_EXCEEDED');else estimateResources(p);}
   const input=emptyPlan();input.tables=[{rows:60000,columns:1,stringBytesUtf8:0,copies:1}];estimateResources(input);
   return {denseCells:10000000,nnz:10000000,features:20000,outputRows:1000000,pairs:2000000,input60000Allowed:true,densification:false};
 });
 await test('B023-copy-memory','UTF16/object/row/matrix copies/workspace/vocabulary/CSR buffers all contribute to policy estimate',async()=>{
   const p=emptyPlan();p.featureCount=4;p.outputRows=[2];p.byteBuffers=[{role:'workspace',sizeBytes:20,copies:2}];p.tables=[{rows:10,columns:2,stringBytesUtf8:100,copies:2}];p.denseMatrices=[{role:'features',rows:2,columns:2,copies:2,workspaceBytes:16}];p.sparseMatrices=[{rows:2,columns:4,nnz:4,copies:2,workspaceBytes:4}];p.vocabularies=[{entries:4,copies:1}];
   const result=estimateResources(p);check(result.totalBytes===6532,'independent memory oracle');
   check(result.measuredPeakRAM===false,'not peak RAM');
   return {expectedPolicyBytes:6532,actualPolicyBytes:result.totalBytes,components:{bytes:40,tables:4240,dense:80,csrIncludingMappings:1660,vocabulary:512},measuredPeakRAM:false};
 });
 await test('B023-safe-arithmetic-join','Overflow and large many-to-many output rejected before allocation, no silent dedup/sample',async()=>{
   await expect(async()=>checkedProduct(Number.MAX_SAFE_INTEGER,2),'RESOURCE_LIMIT_EXCEEDED');
   await expect(async()=>checkedSum(Number.MAX_SAFE_INTEGER,1),'RESOURCE_LIMIT_EXCEEDED');
   for(const n of [-1,NaN,Number.MAX_SAFE_INTEGER+1])await expect(async()=>checkedProduct(n,1),'VALIDATION_FAILED');
   check(joinRowUpperBound(10,0,'left')===10&&joinRowUpperBound(10,0,'inner')===0,'left unmatched');
   const p=emptyPlan();p.outputRows=[joinRowUpperBound(50000,50000,'inner')];await expect(async()=>estimateResources(p),'RESOURCE_LIMIT_EXCEEDED');
   return {bigIntCheckedMath:true,leftUnmatched:10,joinUpperBound:2500000000,largeAllocations:0,autoDedupOrSampling:false};
 });
 await test('B023-allocator','Logical reservations guard actual tiny typed array allocations and release without pretending measured peak RAM',async()=>{
   const profile={...DEFAULT_LIMITS,profileVersion:'test-small',workerMemoryBudgetBytes:128},p=emptyPlan();p.byteBuffers=[{role:'workspace',sizeBytes:128,copies:1}];
   const budget=new BudgetAllocator(estimateResources(p,profile),profile),a=budget.allocateFloat64(2,4),b=budget.allocateBytes(64);
   check(a.buffer.byteLength===64&&b.buffer.byteLength===64&&budget.liveBytes===128,'actual tiny allocations');
   await expect(async()=>budget.allocateBytes(1),'RESOURCE_LIMIT_EXCEEDED');await expect(async()=>budget.allocateFloat64(10000001,1),'RESOURCE_LIMIT_EXCEEDED');
   a.release();b.release();await expect(async()=>a.release(),'VALIDATION_FAILED');check(budget.liveBytes===0&&budget.peakReservedBytes===128,'reservation release');
   return {allocatedBytes:128,peakReservedBytes:128,afterRelease:0,overBudgetNotAllocated:true,actualProcessPeakRAM:'inconclusive'};
 });
 await test('B023-preview-permit','Default unavailable registry rejects; trusted synthetic estimator obtains scoped preview and checked allocator permit',async()=>{
   const req=request();await expect(()=>new PreviewCoordinator().preview(req),'UNSUPPORTED_OPERATION');
   const c=coordinator(),preview=await c.preview(req);let executed=0;
   const answer=await c.runApproved(preview.previewId,()=>req,budget=>{executed++;const a=budget.allocateFloat64(2,2);a.release();return 'synthetic-only';});
   check(executed===1&&answer==='synthetic-only'&&preview.estimate.totalBytes===32,'approved path');
   return {fingerprint:preview.fingerprint,configHash:preview.configHash,estimateBytes:32,executedSyntheticCallbacks:1,productOperationsEnabled:0};
 });
 await test('B023-stale-binding','Config/source hash/ref/context/generation/owner changes invalidate preview before callback, implementation/profile versions bind fingerprint',async()=>{
   const req=request(),c=coordinator(),preview=await c.preview(req);let executed=0;
   const edits=[
    r=>r.config.params.alpha++,r=>r.sourceArtifacts[0].sha256='b'.repeat(64),r=>r.sourceRefs[0].versionId=id(99),
    r=>r.contextRevision++,r=>r.localGeneration++,r=>r.ownerId=id(98),r=>r.projectId=id(97)
   ];
   for(const edit of edits){const changed=structuredClone(req);edit(changed);await expect(()=>c.runApproved(preview.previewId,()=>changed,()=>executed++),'PREVIEW_STALE');}
   const otherLimits=await coordinator({profile:{...DEFAULT_LIMITS,profileVersion:'test-other',workerMemoryBudgetBytes:256}}).preview(req);
   const otherAdapter=await coordinator({adapters:trustedFixture({version:'synthetic-v2'})}).preview(req);
   const otherRegistry=await coordinator({registryVersion:2}).preview(req);
   check(new Set([preview.fingerprint,otherLimits.fingerprint,otherAdapter.fingerprint,otherRegistry.fingerprint]).size===4&&executed===0,'version binding/no stale execute');
   return {staleVariants:7,executedCallbacks:0,profileEstimatorRegistryBound:true};
 });
 await test('B023-sample-scope','Sample affected rows explicitly sample, cannot masquerade as full; full preview must examine full source',async()=>{
   const req={...request(),scope:'sample',sampleMethod:'seededUniform',sampleSeed:7,sourceRowCount:100,rowsExamined:5},c=coordinator(),preview=await c.preview(req);
   check(preview.effects.sampleAffectedRows===3&&!('affectedRows'in preview.effects)&&preview.rowsExamined===5,'sample counts labeled');
   await expect(()=>c.preview({...request(),rowsExamined:1}),'VALIDATION_FAILED');
   await expect(()=>c.preview({...req,sampleSeed:null}),'VALIDATION_FAILED');
   const bad=coordinator({adapters:trustedFixture({propose:(r,plan)=>({plan,effects:{outputRowUpperBound:2,outputFeatureUpperBound:2,affectedRows:3},warnings:[],errors:[]})})});
   await expect(()=>bad.preview(req),'VALIDATION_FAILED');
   return {scope:'sample',method:'seededUniform',seed:7,rowsExamined:5,sampleAffectedRows:3,fullAffectedRowsClaimed:false};
 });
 await test('B023-recheck-before-allocation','Changed plan/effects/errors or live context during approval blocks before allocation callback',async()=>{
   const req=request();let variant='normal',executed=0;
   const c=coordinator({adapters:trustedFixture({propose:(r,plan)=>{if(variant==='huge')plan.byteBuffers=[{role:'workspace',sizeBytes:536870913,copies:1}];return {plan,effects:{outputRowUpperBound:2,outputFeatureUpperBound:2,affectedRows:variant==='effect'?2:1},warnings:[],errors:variant==='error'?['VALIDATION_FAILED']:[]};}})});
   const preview=await c.preview(req);
   variant='effect';await expect(()=>c.runApproved(preview.previewId,()=>req,()=>executed++),'PREVIEW_STALE');
   variant='error';await expect(()=>c.runApproved(preview.previewId,()=>req,()=>executed++),'PREVIEW_STALE');
   const invalid=await c.preview(req);await expect(()=>c.runApproved(invalid.previewId,()=>req,()=>executed++),'VALIDATION_FAILED');
   variant='huge';await expect(()=>c.runApproved(preview.previewId,()=>req,()=>executed++),'RESOURCE_LIMIT_EXCEEDED');
   variant='normal';let calls=0;await expect(()=>c.runApproved(preview.previewId,()=>({...req,contextRevision:++calls>1?1:0}),()=>executed++),'PREVIEW_STALE');
   check(executed===0,'no callback before rechecks');
   return {executedCallbacks:0,recomputedPlan:true,proposalEffectsErrorsBound:true,lastMomentContextRechecked:true,autoTruncate:false};
 });
 return results;
}
