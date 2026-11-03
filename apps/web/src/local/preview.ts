import {assertSchema,fail} from '../../../../packages/contracts/src/index.mjs';
import {hashCanonical,canonicalJson} from '../../../../packages/data-format/src/index.mjs';
import {getOperation,registry} from '../../../../packages/operation-registry/src/index.mjs';
import {estimateResources,BudgetAllocator,DEFAULT_LIMITS} from './resource-budget.ts';
type Request=Record<string,any>;
type EstimateOutput={plan:Record<string,any>;effects:Record<string,number>;warnings:string[];errors:string[]};
type Adapter={operationId:string;configVersion:number;estimatorVersion:string;available:boolean;validateConfig:(config:Request)=>void;estimate:(request:Request)=>Promise<EstimateOutput>|EstimateOutput};
function immutable<T>(value:T):T {if(value&&typeof value==='object'){for(const child of Object.values(value))immutable(child);Object.freeze(value);}return value;}
export class PreviewCoordinator {
 private adapters:Map<string,Adapter>;
 private previews=new Map<string,{result:Record<string,any>;plan:Record<string,any>}>();
 readonly profile:typeof DEFAULT_LIMITS;
 readonly registryVersion:number;
 readonly clock:()=>number;
 constructor({adapters=new Map<string,Adapter>(),profile=DEFAULT_LIMITS,registryVersion=registry.registryVersion,clock=Date.now}:{adapters?:Map<string,Adapter>;profile?:typeof DEFAULT_LIMITS;registryVersion?:number;clock?:()=>number}={}){
   assertSchema('limits-profile.json',profile);
   this.adapters=new Map([...adapters].map(([id,a])=>[id,Object.freeze({...a})]));this.profile=immutable(structuredClone(profile));this.registryVersion=registryVersion;this.clock=clock;
 }
 private adapter(request:Request) {
   assertSchema('preview-request.json',request);
   const entry=this.adapters.get(request.config.operationId);
   // Explicit adapter injection is for trusted owning modules/tests, never from form/JSON/AI.
   if(!entry||!entry.available||entry.operationId!==request.config.operationId||entry.configVersion!==request.config.configVersion)fail('UNSUPPORTED_OPERATION');
   entry.validateConfig(request.config);
   if(request.rowsExamined>request.sourceRowCount)fail('VALIDATION_FAILED');
   if(request.scope==='full'&&(request.sampleMethod!=='none'||request.sampleSeed!==null||request.rowsExamined!==request.sourceRowCount))fail('VALIDATION_FAILED');
   if(request.scope==='sample'&&(request.sampleMethod==='none'||(request.sampleMethod==='seededUniform'&&request.sampleSeed===null)||(request.sampleMethod==='head'&&request.sampleSeed!==null)))fail('VALIDATION_FAILED');
   return entry;
 }
 private async evaluate(input:Request) {
   const request=immutable(structuredClone(input)),adapter=this.adapter(request);
   const profileHash=await hashCanonical(this.profile),configHash=await hashCanonical(request.config);
   const proposed=await adapter.estimate(request),plan=immutable(structuredClone(proposed.plan)),estimate=estimateResources(plan,this.profile),planHash=await hashCanonical(plan);
   const proposalHash=await hashCanonical({planHash,estimate,effects:proposed.effects,warnings:proposed.warnings,errors:proposed.errors});
   const fingerprint=await hashCanonical({request,profileHash,registryVersion:this.registryVersion,estimatorVersion:adapter.estimatorVersion,proposalHash});
   return {request,adapter,profileHash,configHash,fingerprint,plan,planHash,estimate,proposed};
 }
 async preview(input:Request) {
   const p=await this.evaluate(input),r=p.request;
   const effects=p.proposed.effects;
   if(effects.outputRowUpperBound!==p.estimate.outputRowsMax||effects.outputFeatureUpperBound!==p.estimate.featureCount)fail('VALIDATION_FAILED');
   if(r.scope==='full'&&('sampleAffectedRows'in effects||effects.affectedRows>r.rowsExamined))fail('VALIDATION_FAILED');
   if(r.scope==='sample'&&('affectedRows'in effects||effects.sampleAffectedRows>r.rowsExamined))fail('VALIDATION_FAILED');
   const result={schemaVersion:1,previewId:crypto.randomUUID(),sourceRefs:r.sourceRefs,configHash:p.configHash,fingerprint:p.fingerprint,planHash:p.planHash,profileHash:p.profileHash,estimatorVersion:p.adapter.estimatorVersion,scope:r.scope,sampleMethod:r.sampleMethod,sampleSeed:r.sampleSeed,rowsExamined:r.rowsExamined,effects,warnings:p.proposed.warnings,errors:p.proposed.errors,estimate:p.estimate,createdAt:new Date(this.clock()).toISOString()};
   assertSchema('preview-result.json',result);this.previews.set(result.previewId,{result:immutable(structuredClone(result)),plan:p.plan});
   return result;
 }
 async runApproved<T>(previewId:string,readLive:()=>Promise<Request>|Request,execute:(allocation:BudgetAllocator,plan:Readonly<Record<string,any>>)=>Promise<T>|T) {
   const old=this.previews.get(previewId);if(!old)fail('PREVIEW_STALE');
   const current=await this.evaluate(await readLive());
   if(old.result.fingerprint!==current.fingerprint||old.result.planHash!==current.planHash)fail('PREVIEW_STALE');
   if(old.result.errors.length||current.proposed.errors.length)fail('VALIDATION_FAILED');
   if(canonicalJson(await readLive())!==canonicalJson(current.request))fail('PREVIEW_STALE');
   const budget=new BudgetAllocator(current.estimate,this.profile);
   return execute(budget,current.plan);
 }
 productAvailability(operationId:string){
   const operation=getOperation(operationId);return {operationId,status:operation?.capability.status??'unavailable',previewReady:!!this.adapters.get(operationId)?.available};
 }
}
