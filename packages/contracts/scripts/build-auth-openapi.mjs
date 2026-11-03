import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base='https://dashboard.invalid/contracts/v1/';
const names=['common','uuid','json-value','success-envelope','error-envelope','auth-register','auth-login','auth-forgot','auth-resend','auth-verify','auth-password-reset','auth-profile-patch','auth-empty','auth-deferred','auth-csrf','auth-challenge','auth-profile','auth-session','auth-login-result','auth-verified','auth-reset-grant','auth-reset-result','auth-revoked'];
function localRefs(value,name) {
 if(Array.isArray(value))return value.map(v=>localRefs(v,name));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['$schema','$id'].includes(k)).map(([k,v])=>{
   if(k==='$ref'&&v.startsWith(base)){const [file,fragment]=v.slice(base.length).split('#');return[k,'#/components/schemas/'+file.replace('.json','')+(fragment??'')];}
   if(k==='$ref'&&v.startsWith('#/'))return[k,'#/components/schemas/'+name+v.slice(1)];
   return[k,localRefs(v,name)];
 }));return value;
}
const schemas={};for(const name of names)schemas[name]=localRefs(JSON.parse(await readFile(path.join(root,'schemas',name+'.json'),'utf8')),name);
const endpoints=[
 ['get','/auth/csrf',null,'auth-csrf',false,'Public bootstrap; no preexisting session. Nonce cookie HttpOnly/Secure/SameSite=Lax, signed token600s.'],
 ['post','/auth/register','auth-register','auth-challenge',false,'Pending24h, password hash only; no slot until verify; no auto-login.'],
 ['post','/auth/otp/resend','auth-resend','auth-challenge',false,'Cooldown60s; new generation; total5 sends/email/purpose/hour (includes initial); retry only after permitted cooldown.'],
 ['post','/auth/register/verify','auth-verify','auth-verified',false,'Register purpose only, one-use OTP300s/5 wrong, activation counter<100 in same transaction.'],
 ['post','/auth/login','auth-login','auth-login-result',false,'Credential check without preexisting session, opaque cookie; new login atomically revokes previous. Handle returned only on issuance.'],
 ['post','/auth/password/forgot','auth-forgot','auth-challenge',false,'Uniform public shape for known/unknown email, no identity flag. fake-local accepts both; delivery not proven.'],
 ['post','/auth/password/verify','auth-verify','auth-reset-grant',false,'Reset purpose only; grant300s/one-use/passwordGeneration. Unknown identity decoy grant has no authority.'],
 ['post','/auth/password/reset','auth-password-reset','auth-reset-result',false,'Password/grant/epoch atomic; no auto-login or local deletion.'],
 ['get','/auth/session',null,'auth-session',true,'Session token hash/owner/epoch/expiry/currentSession checks. No handle in introspection.'],
 ['get','/me',null,'auth-profile',true,'Self profile only; no owner query parameter.'],
 ['patch','/me','auth-profile-patch','auth-profile',true,'Display name only; conditional user+session fence in transaction.'],
 ['post','/auth/logout','auth-empty','auth-revoked',true,'Server revoke only. Browser dirty/outbox branches belong B022/B043; API never asserts local is clean or clears site data.'],
 ['post','/auth/revoke-deferred','auth-deferred','auth-revoked',false,'Idempotent handle can revoke only its original session; no current cookie required or new-session effect.'],
];
const ref=name=>({$ref:'#/components/schemas/'+name}),paths={};
for(const[method,url,input,output,privateRoute,description]of endpoints) {
 const mutation=method!=='get',security={...(privateRoute?{sessionCookie:[]}:{}),...(mutation?{csrfCookie:[],csrfHeader:[]}:{})};
 const success={allOf:[ref('success-envelope'),{type:'object',properties:{data:ref(output)}}]};
 const responses={'200':{description:'Validated S09 result; serverNow UTC; accepted is not delivered.',headers:{'Cache-Control':{schema:{const:'no-store'}},'X-Request-Id':{schema:{type:'string'}},...(url==='/auth/login'||url==='/auth/csrf'||url==='/auth/logout'?{'Set-Cookie':{schema:{type:'string'},description:'__Host cookie; Secure; HttpOnly; SameSite=Lax; Path=/; never cached.'}}:{})},content:{'application/json':{schema:success}}}};
 for(const status of ['400','401','403','409','413','422','429','500'])responses[status]={description:'Safe C18 error. OTP_INVALID/EXPIRED/ATTEMPTS_EXCEEDED; AUTH_REQUIRED/SESSION_EXPIRED/REVOKED; CSRF_INVALID; ACCOUNT_LIMIT_REACHED; RATE_LIMITED; VALIDATION_FAILED; UPSTREAM_UNAVAILABLE as applicable. No raw fields or account existence.',content:{'application/json':{schema:ref('error-envelope')}}};
 (paths[url]??={})[method]={operationId:method+'_'+url.replaceAll(/[^a-z0-9]/gi,'_'),description,tags:['B030-local-auth'],security:Object.keys(security).length?[security]:[],...(mutation?{parameters:[{in:'header',name:'Origin',required:true,schema:{type:'string'},description:'Exact configured same-origin HTTPS loopback in development; not wildcard.'}],requestBody:{required:true,content:{'application/json':{schema:ref(input)}}}}:{}),responses};
}
const spec={openapi:'3.1.0',info:{title:'Dashboard B030 local-dev auth only',version:'0.1.0',description:'C07/C18, O01/O02, primary S09 JSON Schema. This is not public auth readiness or full API. Fake mail profile rejects production/non-loopback origin. Strict JSON: no duplicate keys, unsafe integers, extra fields or coercion. Unknown error403 preserves local outbox; no Clear-Site-Data.'},servers:[{url:'/api/v1'}],paths,components:{schemas,securitySchemes:{sessionCookie:{type:'apiKey',in:'cookie',name:'__Host-dashboard_session'},csrfCookie:{type:'apiKey',in:'cookie',name:'__Host-dashboard_csrf'},csrfHeader:{type:'apiKey',in:'header',name:'X-CSRF-Token'}}}};
await mkdir(path.join(root,'openapi'),{recursive:true});await writeFile(path.join(root,'openapi/auth.local.v1.json'),JSON.stringify(spec,null,2)+'\n');
console.log(JSON.stringify({endpoints:endpoints.length,schemas:names.length,output:'openapi/auth.local.v1.json'}));
