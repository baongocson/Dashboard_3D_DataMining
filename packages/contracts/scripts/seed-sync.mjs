// One-time S08/S11 local snapshot/ACK bootstrap; primary schemas not overwritten.
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../schemas'),base='https://dashboard.invalid/contracts/v1/';
const u={$ref:base+'common.json#/$defs/uuid'},r={$ref:base+'common.json#/$defs/revision'},h={$ref:base+'common.json#/$defs/sha256'},utc={$ref:base+'common.json#/$defs/utc'},code={$ref:base+'error-envelope.json#/properties/error/properties/code'};
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),arr=items=>({type:'array',items}),ids={...arr(u),uniqueItems:true},ref=name=>({$ref:base+name+'.json'});
const group=obj({groupId:u,mutationIds:{...ids,minItems:1,maxItems:20}});
const declaration=obj({schemaVersion:{const:1},batchId:u,serverGeneration:u,mutations:{...arr(ref('mutation-envelope')),maxItems:100,minItems:1},artifacts:arr(ref('artifact-descriptor')),atomicGroups:arr(group)});
const snapshot=obj({...declaration.properties,ownerId:u,localGeneration:r,gateRevision:r,snapshotHash:h,createdAtClient:utc});
const conflict=obj({kind:{enum:['branch','copy']},entityId:u,conflictOf:u});
const receipt=obj({mutationId:u,payloadHash:h,entityIds:ids,artifactIds:ids,revisions:arr(obj({entityId:u,revision:r})),outcome:{enum:['committed','conflictPreserved']},conflictRefs:arr(conflict)});
const ack=obj({batchId:u,status:{enum:['committed','partial','rejected']},acknowledged:arr(receipt),pending:arr(obj({mutationId:u,code,retryable:{type:'boolean'}})),rejected:arr(obj({mutationId:u,code})),cursor:{anyOf:[{type:'string',minLength:1,maxLength:4096},{type:'null'}]},serverGeneration:u,requestId:{type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'}});
const state=obj({id:{const:'sync'},ownerId:u,network:{enum:['online','offline','unknown']},server:{enum:['reachable','unreachable','maintenance']},auth:{enum:['valid','expired','revoked','unknown']},syncGate:{enum:['auto','awaitingUser']},gateRevision:r,sync:{enum:['idle','running','partial','failed','synced','conflict']},reconciliationRequired:{type:'boolean'},activeBatchId:{anyOf:[u,{type:'null'}]}});
for(const[file,body]of Object.entries({'sync-declaration.json':declaration,'local-sync-snapshot.json':snapshot,'sync-ack.json':ack,'local-sync-state.json':state}))await writeFile(path.join(dir,file),JSON.stringify({$schema:'https://json-schema.org/draft/2020-12/schema',$id:base+file,...body},null,2)+'\n',{flag:'wx'});
