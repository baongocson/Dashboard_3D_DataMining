import {assertSchema} from '../../../../packages/contracts/src/index.mjs';
import type {FastifyInstance} from 'fastify';
import {access,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {AuthService} from '../auth/service.ts';
import {reject} from '../auth/policy.ts';
import {registry} from '../../../../packages/operation-registry/src/index.mjs';
import limits from '../../../../packages/contracts/limits/local-dev.v1.json' with {type:'json'};
export type LocalOps={auth:AuthService;privateRoot:string};
export function registerLocalOps(app:FastifyInstance,auth:AuthService,ops:LocalOps){
 if(ops.auth!==auth)throw Error('Ops must share auth authority');
 const send=(req:any,reply:any,data:unknown)=>{const names:Record<string,string>={'/api/v1/health/live':'ops-live','/api/v1/health/ready':'ops-ready','/api/v1/capabilities':'ops-capabilities','/api/v1/operations':'ops-operations','/api/v1/compatibility':'ops-compatibility'};assertSchema(names[req.url.split('?')[0]]+'.json',data);return reply.send({data,requestId:req.id,serverNow:new Date(auth.clock()).toISOString()});};
 const empty=(req:any)=>{if(Object.keys(req.query??{}).length)reject('VALIDATION_FAILED');};
 app.get('/api/v1/health/live',async(req,reply)=>{empty(req);return send(req,reply,{live:true});});
 app.get('/api/v1/health/ready',async(req,reply)=>{
  empty(req);try{await auth.db.command({ping:1},{timeoutMS:1000});const control=await auth.c.control.findOne({_id:'server'});if(control?.serverGeneration!==auth.config.serverGeneration||control?.maintenance===true)reject('UPSTREAM_UNAVAILABLE',503);await access(ops.privateRoot,constants.R_OK|constants.W_OK);if(!(await stat(ops.privateRoot)).isDirectory())reject('UPSTREAM_UNAVAILABLE',503);}catch{reject('UPSTREAM_UNAVAILABLE',503);}
  return send(req,reply,{ready:true,scope:'localDependencyProbe',storageProbe:'directoryAccessOnly',persistentWriteVerified:false});
 });
 app.get('/api/v1/capabilities',async(req,reply)=>{empty(req);const publicLimits=Object.fromEntries(Object.entries(limits).filter(([k])=>!k.startsWith('perAccount')));return send(req,reply,{profile:'local-dev',registryVersion:registry.registryVersion,limits:publicLimits,publicAuthEnabled:false,productAdaptersEnabled:false});});
 app.get('/api/v1/operations',async(req,reply)=>{
  const q=req.query as Record<string,string>;if(Object.keys(q).some(k=>!['offset','limit','registryVersion'].includes(k)))reject('VALIDATION_FAILED');
  const number=(v:string|undefined,d:number)=>{if(v===undefined)return d;if(!/^(0|[1-9][0-9]{0,8})$/.test(v))reject('VALIDATION_FAILED');return Number(v);};
  const offset=number(q.offset,0),limit=number(q.limit,20),version=number(q.registryVersion,registry.registryVersion);if(limit<1||limit>100||offset>registry.operations.length)reject('VALIDATION_FAILED');if(version!==registry.registryVersion)reject('RECONCILIATION_REQUIRED',410);
  const items=registry.operations.slice(offset,offset+limit).map((o:any)=>({operationId:o.id,configVersion:o.configVersion,outputKind:o.outputKind,availability:o.capability.status,reason:o.capability.reason}));return send(req,reply,{registryVersion:registry.registryVersion,items,nextOffset:offset+limit<registry.operations.length?offset+limit:null});
 });
 app.get('/api/v1/compatibility',async(req,reply)=>{empty(req);const token=(req as any).cookies?.['__Host-dashboard_session'];await auth.identity(token);const control=await auth.c.control.findOne({_id:'server'});if(!control)reject('UPSTREAM_UNAVAILABLE',503);return send(req,reply,{serverGeneration:control.serverGeneration,contractVersions:[1],localSchemaVersion:1,limitsProfileVersion:limits.profileVersion,maintenance:control.maintenance===true,releaseWindowVerified:false,requiresReconciliation:control.serverGeneration!==auth.config.serverGeneration});});
}


