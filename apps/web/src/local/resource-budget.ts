import {assertSchema,fail} from '../../../../packages/contracts/src/index.mjs';
import baseline from '../../../../packages/contracts/limits/local-dev.v1.json' with {type:'json'};
export const DEFAULT_LIMITS=Object.freeze(baseline);
type Plan=Record<string,any>;
type Limits=typeof baseline;
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
export function checkedProduct(...values:number[]):number {
 let result=1n;for(const value of values){if(!Number.isSafeInteger(value)||value<0)fail('VALIDATION_FAILED');result*=BigInt(value);}
 if(result>MAX)fail('RESOURCE_LIMIT_EXCEEDED');return Number(result);
}
export function checkedSum(...values:number[]):number {
 let result=0n;for(const value of values){if(!Number.isSafeInteger(value)||value<0)fail('VALIDATION_FAILED');result+=BigInt(value);}
 if(result>MAX)fail('RESOURCE_LIMIT_EXCEEDED');return Number(result);
}
export function joinRowUpperBound(leftRows:number,rightRows:number,kind:'inner'|'left'):number {
 const product=checkedProduct(leftRows,rightRows);if(!['inner','left'].includes(kind))fail('VALIDATION_FAILED');
 return kind==='left'?Math.max(leftRows,product):product;
}
function limit(actual:number,max:number,code='RESOURCE_LIMIT_EXCEEDED') {if(actual>max)fail(code,{limit:max,scope:'resource'});}
export function estimateResources(plan:Plan,profile:Limits=DEFAULT_LIMITS) {
 assertSchema('limits-profile.json',profile);assertSchema('resource-plan.json',plan);
 let bytes=0,maxDenseCells=0,maxSparseNnz=0;
 const add=(value:number)=>{bytes=checkedSum(bytes,value);limit(bytes,profile.workerMemoryBudgetBytes);};
 limit(plan.featureCount,profile.featureMaxCount);limit(plan.pairwiseComparisons,profile.exactPairwiseMaxPairs);
 for(const rows of plan.outputRows)limit(rows,profile.outputRowMaxCount);
 for(const b of plan.byteBuffers){
   if(b.role==='inputSource')limit(b.sizeBytes,profile.inputSourceMaxBytes,'INPUT_FILE_TOO_LARGE');
   if(b.role==='artifact')limit(b.sizeBytes,profile.artifactMaxBytes,'ARTIFACT_LIMIT_EXCEEDED');
   add(checkedProduct(b.sizeBytes,b.copies));
 }
 for(const m of plan.denseMatrices){
   const cells=checkedProduct(m.rows,m.columns);maxDenseCells=Math.max(cells,maxDenseCells);limit(cells,profile.denseMatrixMaxCells);
   if(m.role==='features'&&m.columns>plan.featureCount)fail('VALIDATION_FAILED');
   add(checkedSum(checkedProduct(cells,8,m.copies),m.workspaceBytes));
 }
 for(const m of plan.sparseMatrices){
   const cells=checkedProduct(m.rows,m.columns);if(m.nnz>cells||m.columns>plan.featureCount)fail('VALIDATION_FAILED');
   limit(m.nnz,profile.sparseMaxNnz);maxSparseNnz=Math.max(maxSparseNnz,m.nnz);
   const mappings=checkedProduct(checkedSum(m.rows,m.columns),128);
   add(checkedSum(checkedProduct(checkedSum(checkedProduct(m.nnz,12),checkedProduct(checkedSum(m.rows,1),4),mappings),m.copies),m.workspaceBytes));
 }
 for(const t of plan.tables){
   // Explicit policy estimates for UTF16 and JS cells/row objects, not measured heap upper bounds.
   const cells=checkedProduct(t.rows,t.columns),objects=checkedProduct(checkedSum(cells,t.rows),64),strings=checkedProduct(t.stringBytesUtf8,2);
   add(checkedProduct(checkedSum(objects,strings),t.copies));
 }
 for(const v of plan.vocabularies){limit(v.entries,profile.featureMaxCount);if(v.entries>plan.featureCount)fail('VALIDATION_FAILED');add(checkedProduct(v.entries,128,v.copies));}
 return Object.freeze({totalBytes:bytes,maxDenseCells,maxSparseNnz,pairwiseComparisons:plan.pairwiseComparisons,outputRowsMax:plan.outputRows.reduce((max:number,n:number)=>Math.max(max,n),0),featureCount:plan.featureCount,profileVersion:profile.profileVersion,assumptionVersion:'policy-overhead-v1',measuredPeakRAM:false});
}
export class BudgetAllocator {
 readonly plannedBytes:number;
 readonly profile:Limits;
 private live=0;
 private peak=0;
 get liveBytes(){return this.live;}
 get peakReservedBytes(){return this.peak;}
 private nextId=0;
 private reservations=new Map<number,number>();
 constructor(estimate:ReturnType<typeof estimateResources>,profile:Limits=DEFAULT_LIMITS){
   assertSchema('limits-profile.json',profile);
   if(!Number.isSafeInteger(estimate.totalBytes)||estimate.totalBytes<0||estimate.profileVersion!==profile.profileVersion)fail('VALIDATION_FAILED');
   limit(estimate.totalBytes,profile.workerMemoryBudgetBytes);
   this.plannedBytes=estimate.totalBytes;this.profile=Object.freeze({...profile});
 }
 private reserve(bytes:number){
   const next=checkedSum(this.liveBytes,bytes);limit(next,Math.min(this.plannedBytes,this.profile.workerMemoryBudgetBytes));
   const id=++this.nextId;this.live=next;this.peak=Math.max(this.peak,next);this.reservations.set(id,bytes);
   return id;
 }
 release(id:number){const size=this.reservations.get(id);if(size===undefined)fail('VALIDATION_FAILED');this.live-=size;this.reservations.delete(id);}
 allocateFloat64(rows:number,columns:number){
   const cells=checkedProduct(rows,columns);limit(cells,this.profile.denseMatrixMaxCells);const bytes=checkedProduct(cells,8),id=this.reserve(bytes);
   try{return {id,buffer:new Float64Array(cells),release:()=>this.release(id)};}catch{this.release(id);fail('RESOURCE_LIMIT_EXCEEDED');}
 }
 allocateBytes(bytes:number){
   const id=this.reserve(bytes);try{return {id,buffer:new Uint8Array(bytes),release:()=>this.release(id)};}catch{this.release(id);fail('RESOURCE_LIMIT_EXCEEDED');}
 }
}
