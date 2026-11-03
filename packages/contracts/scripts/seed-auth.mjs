// One-time B030 bootstrap. Primary schemas are the emitted JSON; never overwrite.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../schemas');
const base='https://dashboard.invalid/contracts/v1/';
const s=(min=1,max=256)=>({type:'string',minLength:min,maxLength:max});
const integer={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER};
const utc={$ref:base+'common.json#/$defs/utc'},uuid={$ref:base+'uuid.json'};
const opaque={type:'string',pattern:'^[A-Za-z0-9_-]{16,256}$'};
const purpose={enum:['register','reset']},password=s(15,128),email=s(3,254),displayName=s(1,100);
const obj=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const docs={
 'auth-register':obj({email,displayName,password,confirmPassword:password}),
 'auth-login':obj({email,password,deviceId:uuid}),
 'auth-forgot':obj({email}),
 'auth-resend':obj({challengeId:opaque,purpose}),
 'auth-verify':obj({challengeId:opaque,purpose,generation:{...integer,minimum:1},otp:{type:'string',pattern:'^[0-9]{6}$'}}),
 'auth-password-reset':obj({grant:opaque,password,confirmPassword:password}),
 'auth-profile-patch':obj({displayName}),
 'auth-empty':obj({}),
 'auth-deferred':obj({revocationHandle:opaque}),
 'auth-csrf':obj({csrfToken:opaque,expiresAt:utc}),
 'auth-challenge':obj({challengeId:opaque,purpose,generation:{...integer,minimum:1},serverNow:utc,expiresAt:utc,resendAvailableAt:utc,attemptsRemaining:{type:'integer',minimum:0,maximum:5},sendStatus:{enum:['accepted','failed','unknown']}}),
 'auth-profile':obj({userId:uuid,email,displayName}),
 'auth-session':obj({userId:uuid,sessionId:opaque,authEpoch:integer,expiresAt:utc,serverGeneration:uuid,offlineEntitlement:obj({ownerId:uuid,issuedAt:utc,profileBound:{const:true},onlineExpiryRevokesLocal:{const:false}})}),
 'auth-login-result':{allOf:[{$ref:base+'auth-session.json'}]},
 'auth-verified':obj({activated:{type:'boolean'},autoLogin:{const:false}}),
 'auth-reset-grant':obj({grant:opaque,expiresAt:utc,autoLogin:{const:false}}),
 'auth-reset-result':obj({passwordChanged:{const:true},autoLogin:{const:false}}),
 'auth-revoked':obj({revoked:{const:true}}),
};
// Login adds the deferred handle only at issuance; session introspection omits it.
docs['auth-login-result']=obj({...docs['auth-session'].properties,revocationHandle:opaque});
await mkdir(root,{recursive:true});
for(const[name,body]of Object.entries(docs))await writeFile(path.join(root,name+'.json'),JSON.stringify({$schema:'https://json-schema.org/draft/2020-12/schema',$id:base+name+'.json',...body},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({created:Object.keys(docs).length,scope:'S09'}));
