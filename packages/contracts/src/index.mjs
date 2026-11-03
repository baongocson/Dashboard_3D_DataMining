import * as validators from './generated/validators.mjs';
import catalog from './error-catalog.json' with {type:'json'};
export const CONTRACT_VERSION=Object.freeze({schemaVersion:1,canonicalHash:'rfc8785-sha256-business-v1',jsonPolicy:'strict-json-v1'});
export const JSON_POLICY=Object.freeze({maxDepth:128,maxNodes:100000});
export const ERROR_CATALOG=Object.freeze(catalog.map(entry=>Object.freeze(entry)));
const errorCodes=new Set(catalog.filter(e=>e.category==='error').map(e=>e.code));
export class ContractError extends Error{
 constructor(code,details={}){super('Yêu cầu bị từ chối: '+code);this.name='ContractError';this.code=code;this.details=details;}
}
/** @returns {never} */
export function fail(code,details){throw new ContractError(code,details);}
export function assertJson(value,policy=JSON_POLICY){
 let nodes=0;const stack=new Set();
 function walk(v,depth,path){if(++nodes>policy.maxNodes||depth>policy.maxDepth)fail('RESOURCE_LIMIT_EXCEEDED',{path,scope:'resource'});
 if(v===null||typeof v==='boolean')return;
 if(typeof v==='number'){if(!Number.isFinite(v)||Number.isInteger(v)&&!Number.isSafeInteger(v))fail('VALIDATION_FAILED',{path,scope:'field'});return;}
 if(typeof v==='string'){if(!v.isWellFormed())fail('VALIDATION_FAILED',{path,scope:'field'});return;}
 if(typeof v!=='object'||stack.has(v))fail('VALIDATION_FAILED',{path,scope:'field'});
 if(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)fail('VALIDATION_FAILED',{path,scope:'field'});
 stack.add(v);const props=Object.getOwnPropertyDescriptors(v);
 for(const key of Reflect.ownKeys(props)){if(typeof key!=='string'||!key.isWellFormed())fail('VALIDATION_FAILED',{path,scope:'field'});const d=props[key];if('get'in d||'set'in d)fail('VALIDATION_FAILED',{path,scope:'field'});if(Array.isArray(v)&&key==='length')continue;if(!d.enumerable)fail('VALIDATION_FAILED',{path,scope:'field'});if(Array.isArray(v)&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=v.length))fail('VALIDATION_FAILED',{path,scope:'field'});}
 if(Array.isArray(v))for(let i=0;i<v.length;i++)walk(v[i],depth+1,path+'/'+i);else for(const [key,d]of Object.entries(props))walk(d.value,depth+1,path+'/'+key.replaceAll('~','~0').replaceAll('/','~1'));
 stack.delete(v);}
 walk(value,0,'');return value;
}
export function parseJsonStrict(text,policy=JSON_POLICY){
 if(typeof text!=='string'||!text.isWellFormed())fail('VALIDATION_FAILED');let i=0;const stack=[];
 while(i<text.length){const ch=text[i];if(ch==='"'){let j=i+1;while(j<text.length){if(text[j]==='\\'){j+=2;continue;}if(text[j]==='"')break;j++;}if(j>=text.length)fail('VALIDATION_FAILED');const token=text.slice(i,j+1);let k=j+1;while(/\s/.test(text[k]??'')&&k<text.length)k++;if(text[k]===':'&&stack.at(-1) instanceof Set){let key;try{key=JSON.parse(token);}catch{fail('VALIDATION_FAILED');}if(stack.at(-1).has(key))fail('VALIDATION_FAILED');stack.at(-1).add(key);}i=j+1;continue;}
 if(ch==='{'||ch==='['){stack.push(ch==='{'?new Set():null);if(stack.length>policy.maxDepth)fail('RESOURCE_LIMIT_EXCEEDED');i++;continue;}
 if(ch==='}'||ch===']'){stack.pop();i++;continue;}
 if(ch==='-'||ch>='0'&&ch<='9'){const m=text.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);if(!m)fail('VALIDATION_FAILED');if(/^-?[0-9]+$/.test(m[0])){const big=BigInt(m[0]);if(big>BigInt(Number.MAX_SAFE_INTEGER)||big<BigInt(Number.MIN_SAFE_INTEGER))fail('VALIDATION_FAILED');}i+=m[0].length;continue;}i++;}
 let value;try{value=JSON.parse(text);}catch{fail('VALIDATION_FAILED');}return assertJson(value,policy);
}
const schemaName=name=>name.replaceAll(/[^A-Za-z0-9_]/g,'_');
export function validateSchema(name,value){
 assertJson(value);const validator=validators[schemaName(name)];if(!validator)fail('CLIENT_SCHEMA_UNSUPPORTED');
 const valid=validator(value);return{valid,errors:valid?[]:validator.errors.map(e=>({path:e.instancePath,keyword:e.keyword,code:'VALIDATION_FAILED'}))};
}
export function assertSchema(name,value){const r=validateSchema(name,value);if(!r.valid)fail('VALIDATION_FAILED',{path:r.errors[0]?.path??'',scope:'field'});return value;}
export function validateOperationConfig(config){assertSchema('operation-config.json',config);const name='operations/'+config.operationId+'.v'+config.configVersion+'.json';const validator=validators[schemaName(name)];if(!validator)fail('CLIENT_SCHEMA_UNSUPPORTED');if(!validator(config.params))fail('UNSUPPORTED_OPERATION',{scope:'resource'});return config;}
export function errorEnvelope(code,requestId,details={},retryable=false,serverNow=new Date().toISOString()){if(!errorCodes.has(code))fail('VALIDATION_FAILED');const envelope={error:{code,message:'Yêu cầu bị từ chối: '+code,details,retryable},requestId,serverNow};assertSchema('error-envelope.json',envelope);return envelope;}
export function assertVersionCreateMutation(value){
 assertSchema('mutation-envelope.json',value);assertSchema('version-create-payload.json',value.payload);
 const {version,expectedHead,branch}=value.payload;
 if(value.kind!=='dataset.version.create'||value.baseRevision!==0||value.entityId!==version.versionId||branch.branchId!==version.branchId||expectedHead.branchId!==version.branchId||value.dependencies.includes(value.mutationId))fail('VALIDATION_FAILED');
 if(expectedHead.kind==='dependency'&&!value.dependencies.includes(expectedHead.fromMutationId))fail('VALIDATION_FAILED',{field:'dependencies'});
 if(expectedHead.kind==='known'&&expectedHead.versionId===null&&expectedHead.revision!==0)fail('VALIDATION_FAILED',{field:'expectedHead'});
 if(branch.reason==='initial'&&branch.forkVersionId!==null)fail('VALIDATION_FAILED');
 if(branch.reason==='initial'&&expectedHead.kind==='known'&&expectedHead.versionId===null&&version.parentVersionId!==null)fail('VALIDATION_FAILED');
 if(branch.reason==='undoContinuation'&&branch.forkVersionId===null)fail('VALIDATION_FAILED');
 return value;
}
export function assertFittedPipeline(value,{supervised=false}={}){assertSchema('fitted-pipeline.json',value);if(supervised&&value.orderedSteps.some(s=>s.fitScope!=='train'))fail('VALIDATION_FAILED',{field:'fitScope',scope:'field'});return value;}
