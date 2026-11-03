import {runB020Checks,id} from '../../tests/fixtures/b020.mjs';
import {hashCanonical} from '../../packages/data-format/src/index.mjs';
import {validateSchema} from '../../packages/contracts/src/index.mjs';
self.onmessage=async()=>{
try{const tests=await runB020Checks();const value={name:'r2',value:null,status:'undefined',reason:'constant test target',evaluationSet:'test',params:{},sourceRefs:[{datasetId:id(10),versionId:id(20)}]};
let crossApi={status:'blocked',reason:'Network intentionally disabled; pure package checks still executed offline'};
if(navigator.onLine){const expectedHash=await hashCanonical(value);const response=await fetch('/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:'metric-record.json',value})});const result=await response.json();crossApi={status:response.ok&&result.valid===validateSchema('metric-record.json',value).valid&&result.sha256===expectedHash?'passed':'failed',browserHash:expectedHash,apiHash:result.sha256,apiValidation:result.valid};}
self.postMessage({tests,crossApi,executionLocation:'DedicatedWorkerGlobalScope',online:navigator.onLine});}catch(e){self.postMessage({failure:{message:e.message,stack:e.stack}});}
};
