// One-time transition of unused S08 drafts after owner accepted ADR-B021-01 A.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../schemas'),base='https://dashboard.invalid/contracts/v1/';
const u={$ref:base+'common.json#/$defs/uuid'},r={$ref:base+'common.json#/$defs/revision'},nullable={anyOf:[u,{type:'null'}]};
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const head={oneOf:[
 obj({kind:{const:'known'},branchId:u,versionId:nullable,revision:r}),
 obj({kind:{const:'dependency'},branchId:u,fromMutationId:u})
]};
const branch=obj({branchId:u,forkVersionId:nullable,reason:{enum:['initial','undoContinuation']}});
const payload=obj({version:{$ref:base+'local-version-input.json'},expectedHead:{$ref:base+'expected-head.json'},branch});
for(const[file,body]of Object.entries({'expected-head.json':head,'version-create-payload.json':payload}))await writeFile(path.join(dir,file),JSON.stringify({$schema:'https://json-schema.org/draft/2020-12/schema',$id:base+file,...body},null,2)+'\n',{flag:'wx'});
const snapshotPath=path.join(dir,'local-snapshot.json'),snapshot=JSON.parse(await readFile(snapshotPath,'utf8'));
if(!snapshot.properties.expectedHeadVersionId)throw Error('S08 transition already applied; do not rerun');
for(const key of ['expectedHeadVersionId','expectedHeadRevision']){delete snapshot.properties[key];snapshot.required=snapshot.required.filter(k=>k!==key);}
const add={expectedLocalHeadVersionId:nullable,expectedLocalHeadRevision:r,expectedHead:{$ref:base+'expected-head.json'}};
Object.assign(snapshot.properties,add);snapshot.required.push(...Object.keys(add));
await writeFile(snapshotPath,JSON.stringify(snapshot,null,2)+'\n');
console.log('Applied accepted A to S08 drafts and two new S11 guard/payload schemas');
