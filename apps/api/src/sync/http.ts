import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import {assertSchema} from '../../../../packages/contracts/src/index.mjs';
import limits from '../../../../packages/contracts/limits/local-dev.v1.json' with {type:'json'};
import {AuthService} from '../auth/service.ts';
import {AuthError,reject} from '../auth/policy.ts';
import type {StorageService} from '../storage/service.ts';
import type {SyncService} from './service.ts';
import type {ReconciliationService} from './reconciliation.ts';
import type {ManifestService} from './manifest.ts';
import type {ChangefeedService} from './changes.ts';
import type {ConflictService} from './conflicts.ts';
type Value=Record<string,any>;
export type LocalSyncServices={sync:SyncService;reconciliation:ReconciliationService;manifest:ManifestService;changefeed:ChangefeedService;conflicts:ConflictService};
export function assertLocalSyncAuthority(auth:AuthService,storage:StorageService|undefined,services:LocalSyncServices){
 if(!['test','development'].includes(auth.config.profile)||!storage||Object.values(services).length!==5||Object.values(services).some(s=>s.auth!==auth)||services.sync.storage!==storage||services.reconciliation.storage!==storage||services.manifest.storage!==storage)throw Error('Explicit local sync services must share auth and actual storage authority');
}
export function registerLocalSync(app:FastifyInstance,auth:AuthService,services:LocalSyncServices){
 const {sync,reconciliation,manifest,changefeed,conflicts}=services,prefix='/api/v1',token=(req:FastifyRequest)=>req.cookies['__Host-dashboard_session'];
 const param=(req:FastifyRequest,key:string,schema='uuid.json')=>{const value=(req.params as Record<string,string>)[key];if(schema==='opaque'){if(!/^[A-Za-z0-9_-]{43}$/.test(value))reject('VALIDATION_FAILED');}else assertSchema(schema,value);return value;};
 const body=(req:FastifyRequest,name:string):Value=>{assertSchema(name+'.json',req.body);return req.body as Value;};
 const query=(req:FastifyRequest,name:string):Value=>{const value={...(req.query as Value)};for(const key of ['pageSize','limit'])if(value[key]!==undefined){if(typeof value[key]!=='string'||!/^[1-9][0-9]*$/.test(value[key])||!Number.isSafeInteger(Number(value[key])))reject('VALIDATION_FAILED');value[key]=Number(value[key]);}assertSchema(name+'.json',value);return value;};
 const empty=(req:FastifyRequest)=>assertSchema('auth-empty.json',req.query);
 const send=(req:FastifyRequest,reply:FastifyReply,name:string,data:unknown)=>{try{assertSchema(name+'.json',data);}catch{throw new AuthError('UPSTREAM_UNAVAILABLE',500);}const envelope={data,requestId:req.id,serverNow:new Date(auth.clock()).toISOString()};if(Buffer.byteLength(JSON.stringify(envelope))>limits.metadataBodyMaxBytes)reject('PAYLOAD_TOO_LARGE',413);return reply.send(envelope);};
 app.post(prefix+'/sync/batches',async(req,reply)=>{empty(req);return send(req,reply,'sync-declaration-plan',await sync.declare(token(req),body(req,'sync-declaration')));});
 app.get(prefix+'/sync/batches/:id',async(req,reply)=>{empty(req);return send(req,reply,'sync-batch-view',await sync.read(token(req),param(req,'id')));});
 app.post(prefix+'/sync/batches/:id/commit',async(req,reply)=>{empty(req);return send(req,reply,'sync-ack',await sync.commit(token(req),param(req,'id'),body(req,'sync-commit-request'),{requestId:req.id}));});
 app.get(prefix+'/sync/receipts/:mutationId',async(req,reply)=>{const q=query(req,'sync-receipt-query');return send(req,reply,'sync-receipt-view',await sync.receipt(token(req),param(req,'mutationId'),q.serverGeneration));});
 app.post(prefix+'/sync/reconciliations',async(req,reply)=>{empty(req);return send(req,reply,'sync-reconciliation-page',await reconciliation.create(token(req),body(req,'sync-reconciliation-request')));});
 app.get(prefix+'/sync/reconciliations/:id',async(req,reply)=>send(req,reply,'sync-reconciliation-page',await reconciliation.read(token(req),param(req,'id','opaque'),query(req,'sync-reconciliation-query'))));
 app.get(prefix+'/projects/:id/conflicts',async(req,reply)=>send(req,reply,'sync-conflicts-page',await conflicts.list(token(req),param(req,'id'),query(req,'sync-conflicts-query'))));
 app.get(prefix+'/projects/:id/manifest',async(req,reply)=>{const id=param(req,'id'),q=query(req,'project-manifest-query'),page=q.manifestId?await manifest.read(token(req),q.manifestId,q.cursor?{cursor:q.cursor}:{}):await manifest.create(token(req),id,{serverGeneration:q.serverGeneration,pageSize:q.pageSize??20});if(page.projectId!==id)reject('RESOURCE_NOT_FOUND',404);return send(req,reply,'project-manifest-page',page);});
 app.get(prefix+'/projects/:id/changes',async(req,reply)=>{const id=param(req,'id'),q=query(req,'project-changes-query'),page=q.cursor?await changefeed.read(token(req),id,{cursor:q.cursor}):await changefeed.open(token(req),q.manifestId,{serverGeneration:q.serverGeneration,pageSize:q.pageSize??20});if(page.projectId!==id)reject('RESOURCE_NOT_FOUND',404);return send(req,reply,'project-change-page',page);});
}
