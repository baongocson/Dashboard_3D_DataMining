import {writeFile,readFile} from 'node:fs/promises';
const base='https://dashboard.invalid/contracts/v1/',obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),int={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},flag={type:'boolean'},text={type:'string',minLength:1,maxLength:128};
const limits=JSON.parse(await readFile('packages/contracts/limits/local-dev.v1.json'));
const schemas={
 'ops-live':obj({live:{const:true}}),
 'ops-ready':obj({ready:{const:true},scope:{const:'localDependencyProbe'},storageProbe:{const:'directoryAccessOnly'},persistentWriteVerified:{const:false}}),
 'ops-capabilities':obj({profile:{const:'local-dev'},registryVersion:int,limits:obj(Object.fromEntries(Object.entries(limits).filter(([k])=>!k.startsWith('perAccount')).map(([k,v])=>[k,{const:v}]))),publicAuthEnabled:{const:false},productAdaptersEnabled:{const:false}}),
 'ops-operations':obj({registryVersion:int,items:{type:'array',maxItems:100,items:obj({operationId:text,configVersion:int,outputKind:text,availability:{enum:['available','unavailable']},reason:text})},nextOffset:{anyOf:[int,{type:'null'}]}}),
 'ops-compatibility':obj({serverGeneration:{$ref:base+'uuid.json'},contractVersions:{const:[1]},localSchemaVersion:{const:1},limitsProfileVersion:{const:limits.profileVersion},maintenance:flag,releaseWindowVerified:{const:false},requiresReconciliation:flag})
};
for(const[name,schema]of Object.entries(schemas))await writeFile('packages/contracts/schemas/'+name+'.json',JSON.stringify({$schema:'https://json-schema.org/draft/2020-12/schema',$id:base+name+'.json',...schema},null,2)+'\n',{flag:'wx'});
