// One-time S06/S07 primary schema bootstrap; no overwrite.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../schemas'),base='https://dashboard.invalid/contracts/v1/';
const u={$ref:base+'common.json#/$defs/uuid'},r={$ref:base+'common.json#/$defs/revision'};
const obj=p=>({type:'object',properties:p,required:Object.keys(p),additionalProperties:false}),arr=items=>({type:'array',items,uniqueItems:true});
const local=JSON.parse(await readFile(path.join(dir,'local-snapshot.json'),'utf8'));
const snapshot=obj({...local.properties,config:{$ref:base+'operation-config.json'},configHash:{$ref:base+'common.json#/$defs/sha256'},engineVersion:{type:'string',minLength:1,maxLength:100},confirmationRefs:arr(u)});
const identity={protocolVersion:{const:1},taskId:u,runId:u,stepId:u,generation:r,fence:r,sequence:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER}};
const progress={type:'object',properties:{phase:{type:'string',minLength:1,maxLength:100},completedUnits:r,totalUnits:r},required:['phase'],additionalProperties:false};
const event={oneOf:[
 obj({...identity,type:{const:'STARTED'},data:obj({})}),
 obj({...identity,type:{const:'PROGRESS'},data:progress}),
 obj({...identity,type:{const:'WARNING'},data:obj({code:{type:'string',minLength:1,maxLength:100}})}),
 obj({...identity,type:{const:'RESULT'},data:obj({stagedArtifactRefs:arr(u),summary:obj({rowCount:r,columnCount:r})})}),
 obj({...identity,type:{const:'FAILED'},data:obj({code:{$ref:base+'error-envelope.json#/properties/error/properties/code'}})}),
 obj({...identity,type:{const:'CANCELLED'},data:obj({})})
 ]};
const command={oneOf:[
 obj({protocolVersion:{const:1},type:{const:'START'},snapshot:{$ref:base+'execution-snapshot.json'},inputArtifactRefs:arr(u)}),
 obj({protocolVersion:{const:1},type:{enum:['CANCEL','DISPOSE']},taskId:u,reason:{enum:['user','transfer','logout','revoke','dispose']}})
]};
const transfer=obj({protocolVersion:{const:1},type:{const:'TRANSFER_REQUEST'},requestId:u,ownerId:u,projectId:u,senderId:u});
for(const[file,body]of Object.entries({'execution-snapshot.json':snapshot,'worker-command.json':command,'worker-event.json':event,'writer-transfer-request.json':transfer}))await writeFile(path.join(dir,file),JSON.stringify({$schema:'https://json-schema.org/draft/2020-12/schema',$id:base+file,...body},null,2)+'\n',{flag:'wx'});
