import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base='https://dashboard.invalid/contracts/v1/';
const names=['metadata-project-create-request','metadata-intent-request','metadata-intent-response','metadata-project','metadata-version','metadata-page','metadata-query','success-envelope','error-envelope','uuid'];
const raw={};for(let i=0;i<names.length;i++){
 const name=names[i];raw[name]=JSON.parse(await readFile(path.join(root,'schemas',name+'.json'),'utf8'));
 function visit(v){if(Array.isArray(v))return v.forEach(visit);if(v&&typeof v==='object'){if(v.$ref?.startsWith(base)){const name=v.$ref.slice(base.length).split('#')[0].replace('.json','');if(!names.includes(name))names.push(name);}Object.values(v).forEach(visit);}}
 visit(raw[name]);
}
function local(v,name){if(Array.isArray(v))return v.map(x=>local(x,name));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['$schema','$id'].includes(k)).map(([k,x])=>{
 if(k==='$ref'&&x.startsWith('#/components/'))return [k,x];
 if(k==='$ref'&&x.startsWith(base)){const [file,fragment]=x.slice(base.length).split('#');return [k,'#/components/schemas/'+file.replace('.json','')+(fragment??'')];}
 if(k==='$ref'&&x.startsWith('#/'))return [k,'#/components/schemas/'+name+x.slice(1)];return [k,local(x,name)];
}));return v;}
const ref=n=>({$ref:'#/components/schemas/'+n}),paths={};
const endpoints=[['get','/projects',null,'metadata-page'],['post','/projects','metadata-project-create-request','metadata-project'],['get','/projects/{id}',null,'metadata-project'],['get','/projects/{id}/datasets',null,'metadata-page'],['post','/projects/{id}/import-intents','metadata-intent-request','metadata-intent-response'],['get','/datasets/{id}/versions',null,'metadata-page'],['get','/datasets/{id}/branches',null,'metadata-page'],['get','/versions/{id}',null,'metadata-version']];
for(const [method,url,input,output]of endpoints){
 const parameters=[];if(url.includes('{id}'))parameters.push({in:'path',name:'id',required:true,schema:ref('uuid')});
 if(output==='metadata-page')for(const name of ['limit','cursor',...(url.includes('/versions')?['branchId']:[])])parameters.push({in:'query',name,required:false,schema:raw['metadata-query'].$ref?raw['metadata-types'].$defs.query.properties[name]:{}});
 if(input)parameters.push({in:'header',name:'Origin',required:true,schema:{type:'string'},description:'Exact configured HTTPS loopback origin; same CSRF bootstrap/cookies as auth.local.v1.'});
 const responses={'200':{description:'Validated metadata DTO; no-store; no private storage key, owner/session, raw source bytes or internal fence.',content:{'application/json':{schema:{allOf:[ref('success-envelope'),{type:'object',properties:{data:ref(output)}}]}}}}};
 for(const status of ['400','401','403','404','409','410','413','422','429','500'])responses[status]={description:'C18 safe error. Missing/other-owner resources use404. Tombstone/generation/expired cursor use410. Unknown fields or invalid DTO are rejected. No Clear-Site-Data.',content:{'application/json':{schema:ref('error-envelope')}}};
 (paths[url]??={})[method]={operationId:'metadata_'+method+'_'+url.replaceAll(/[^a-z0-9]/gi,'_'),tags:['B031-local-metadata'],parameters,security:[{sessionCookie:[],...(input?{csrfCookie:[],csrfHeader:[]}:{})}],...(input?{requestBody:{required:true,content:{'application/json':{schema:ref(input)}}}}:{}),responses};
}
const schemas=Object.fromEntries(names.map(n=>[n,local(raw[n],n)]));
// Query schemas can carry UUID refs; rewrite them too rather than leaving remote refs.
for(const item of Object.values(paths))for(const op of Object.values(item))op.parameters=local(op.parameters,'metadata-query');
const spec={openapi:'3.1.0',info:{title:'B031 local-dev metadata foundation',version:'0.1.0',description:'O03/O04 dataset metadata subset. Optional MetadataService shares B030 local-only auth authority. Project POST invokes the same durable metadata commit service as future B033. Import intents30min do not publish a dataset; renewal preserves logical IDs and queries durable identity first. Cursor pages are bounded live lists, not B080 snapshot manifests. Dataset/version write HTTP endpoints and real artifact storage belong B032/B033; current default artifact authority fails closed. Synthetic fixture operations do not enable product engines. Config hash binds canonical {parseConfig,operationSnapshot} for dataset creation.'},servers:[{url:'/api/v1'}],paths,components:{schemas,securitySchemes:{sessionCookie:{type:'apiKey',in:'cookie',name:'__Host-dashboard_session'},csrfCookie:{type:'apiKey',in:'cookie',name:'__Host-dashboard_csrf'},csrfHeader:{type:'apiKey',in:'header',name:'X-CSRF-Token'}}}};
await writeFile(path.join(root,'openapi/metadata.local.v1.json'),JSON.stringify(spec,null,2)+'\n');console.log(JSON.stringify({endpoints:endpoints.length,schemas:names.length,output:'openapi/metadata.local.v1.json'}));
