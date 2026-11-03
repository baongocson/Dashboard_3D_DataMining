import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import type {FastifyRequest,FastifyReply} from 'fastify';
import {randomBytes,randomUUID} from 'node:crypto';
import {assertSchema,parseJsonStrict,errorEnvelope,ContractError} from '../../../packages/contracts/src/index.mjs';
import {AuthService} from './auth/service.ts';
import {AuthError,mac,equal,reject} from './auth/policy.ts';
import type {MetadataService} from './metadata/service.ts';
import type {StorageService} from './storage/service.ts';
import type {ByteInput} from './storage/bytes.ts';
import {registerLocalSync,assertLocalSyncAuthority} from './sync/http.ts';
import type {LocalSyncServices} from './sync/http.ts';
const SESSION='__Host-dashboard_session',CSRF='__Host-dashboard_csrf';
import {registerLocalOps} from './ops/http.ts';
import type {LocalOps} from './ops/http.ts';
export async function createApp(auth:AuthService,{tls,metadata,storage,localSync,localOps}:{tls?:{key:Buffer;cert:Buffer};metadata?:MetadataService;storage?:StorageService;localSync?:LocalSyncServices;localOps?:LocalOps}={}) {
  if(metadata&&metadata.auth!==auth)throw Error('Metadata must share this auth/session authority');
  if(storage&&storage.auth!==auth)throw Error('Storage must share this auth/session authority');
  if(localSync)assertLocalSyncAuthority(auth,storage,localSync);
  // No auto-listen. Caller must explicitly own a local-dev listener.
  const app=Fastify({logger:false,bodyLimit:1048576,trustProxy:false,genReqId:()=>randomUUID(),...(tls?{https:tls}:{})});
  await app.register(cookie);
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json',{parseAs:'string'},(_request,body,done)=>{
    try{done(null,parseJsonStrict(String(body)));}catch{done(new AuthError('VALIDATION_FAILED',400),undefined);}
  });
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('X-Request-Id',req.id);
    if(req.headers.origin&&req.headers.origin!==auth.config.origin)reject('CSRF_INVALID',403);
    if(req.headers['sec-fetch-site']==='cross-site')reject('CSRF_INVALID',403);
    if(['POST','PATCH','DELETE','PUT'].includes(req.method)) {
      if(req.headers.origin!==auth.config.origin)reject('CSRF_INVALID',403);
      const nonce=req.cookies[CSRF],t=req.headers['x-csrf-token'];
      if(!nonce||typeof t!=='string'||t.length!==141||t.slice(0,64)!==nonce)reject('CSRF_INVALID',403);
      const stamped=t.slice(64,77),expires=Number(stamped)+600000;
      if(!/^[0-9]{13}$/.test(stamped)||Number(stamped)>auth.clock()||expires<=auth.clock()||!equal(t.slice(77),mac(auth.config.secret,'csrf',nonce,stamped)))reject('CSRF_INVALID',403);
      await auth.limitIp(req.ip,req.url.split('?')[0]);
    }
  });
  app.setErrorHandler(async(err,req,reply)=>{
    const e=err as Error&{code?:string};
    const badMedia=e.code==='FST_ERR_CTP_INVALID_MEDIA_TYPE',badLength=e.code==='FST_ERR_CTP_INVALID_CONTENT_LENGTH'||e.code==='FST_ERR_CTP_EMPTY_JSON_BODY';
    const status=e instanceof AuthError?e.status:e.code==='FST_ERR_CTP_BODY_TOO_LARGE'?413:badLength?400:e instanceof ContractError||badMedia?422:500;
    const code=e instanceof AuthError||e instanceof ContractError?e.code:e.code==='FST_ERR_CTP_BODY_TOO_LARGE'?'PAYLOAD_TOO_LARGE':badMedia||badLength?'VALIDATION_FAILED':'UPSTREAM_UNAVAILABLE';
    if(e.code==='FST_ERR_CTP_BODY_TOO_LARGE'&&!req.raw.complete&&!req.raw.destroyed){
      // Discard, never buffer or parse. Bound the wait for an invalid slow sender.
      await new Promise<void>(resolve=>{
        const done=()=>{clearTimeout(timer);req.raw.off('end',done).off('close',done).off('error',done);resolve();};
        const timer=setTimeout(done,1000);timer.unref();
        req.raw.once('end',done).once('close',done).once('error',done);req.raw.resume();
      });
    }
    const details:Record<string,boolean>={};
    if(e instanceof AuthError){
      const supplied=(e as AuthError&{details?:Record<string,unknown>}).details;
      for(const key of ['requiresReconciliation','requiresNewSnapshot'])if(supplied?.[key]===true)details[key]=true;
      if(status===410&&['CURSOR_EXPIRED','RECONCILIATION_REQUIRED'].includes(code)){details.requiresReconciliation=true;details.requiresNewSnapshot=true;}
    }
    reply.code(status).send(errorEnvelope(code,req.id,details,status>=500,new Date(auth.clock()).toISOString()));
  });
  app.setNotFoundHandler((req,reply)=>reply.code(404).send(errorEnvelope('RESOURCE_NOT_FOUND',req.id,{},false,new Date(auth.clock()).toISOString())));
  function ok(reply:FastifyReply,req:FastifyRequest,schema:string,data:unknown) {
    try{assertSchema(schema+'.json',data);}catch{throw new AuthError('UPSTREAM_UNAVAILABLE',500);}
    return reply.send({data,requestId:req.id,serverNow:new Date(auth.clock()).toISOString()});
  }
  function body<T>(req:FastifyRequest,schema:string):T {
    assertSchema(schema+'.json',req.body);return req.body as T;
  }
  const sessionToken=(req:FastifyRequest)=>req.cookies[SESSION];
  const prefix='/api/v1';
  app.get(prefix+'/auth/csrf',async(req,reply)=>{
    const nonce=randomBytes(32).toString('hex'),now=String(auth.clock());
    reply.setCookie(CSRF,nonce,{path:'/',httpOnly:true,secure:true,sameSite:'lax',maxAge:600});
    return ok(reply,req,'auth-csrf',{csrfToken:nonce+now+mac(auth.config.secret,'csrf',nonce,now),expiresAt:new Date(auth.clock()+600000).toISOString()});
  });
  app.post(prefix+'/auth/register',async(req,reply)=>ok(reply,req,'auth-challenge',await auth.register(body(req,'auth-register'))));
  app.post(prefix+'/auth/otp/resend',async(req,reply)=>{
    const b=body<{challengeId:string;purpose:string}>(req,'auth-resend');return ok(reply,req,'auth-challenge',await auth.resend(b.challengeId,b.purpose));
  });
  app.post(prefix+'/auth/register/verify',async(req,reply)=>ok(reply,req,'auth-verified',await auth.verify(body(req,'auth-verify'),'register')));
  app.post(prefix+'/auth/password/forgot',async(req,reply)=>{
    const b=body<{email:string}>(req,'auth-forgot');return ok(reply,req,'auth-challenge',await auth.forgot(b.email));
  });
  app.post(prefix+'/auth/password/verify',async(req,reply)=>ok(reply,req,'auth-reset-grant',await auth.verify(body(req,'auth-verify'),'reset')));
  app.post(prefix+'/auth/password/reset',async(req,reply)=>ok(reply,req,'auth-reset-result',await auth.resetPassword(body(req,'auth-password-reset'))));
  app.post(prefix+'/auth/login',async(req,reply)=>{
    const result=await auth.login(body(req,'auth-login'));
    reply.setCookie(SESSION,result.rawToken,{path:'/',httpOnly:true,secure:true,sameSite:'lax',maxAge:604800});
    return ok(reply,req,'auth-login-result',result.data);
  });
  app.get(prefix+'/auth/session',async(req,reply)=>ok(reply,req,'auth-session',auth.sessionView(await auth.identity(sessionToken(req)))));
  app.get(prefix+'/me',async(req,reply)=>ok(reply,req,'auth-profile',auth.profile((await auth.identity(sessionToken(req))).user)));
  app.patch(prefix+'/me',async(req,reply)=>{
    const b=body<{displayName:string}>(req,'auth-profile-patch');return ok(reply,req,'auth-profile',await auth.patchProfile(sessionToken(req),b.displayName));
  });
  app.post(prefix+'/auth/logout',async(req,reply)=>{
    body(req,'auth-empty');const result=await auth.logout(sessionToken(req));
    reply.clearCookie(SESSION,{path:'/',secure:true,httpOnly:true,sameSite:'lax'});
    return ok(reply,req,'auth-revoked',result);
  });
  app.post(prefix+'/auth/revoke-deferred',async(req,reply)=>{
    const b=body<{revocationHandle:string}>(req,'auth-deferred');
    return ok(reply,req,'auth-revoked',await auth.revokeDeferred(b.revocationHandle));
  });
  if(metadata){
    const param=(req:FastifyRequest,key:string)=>{const value=(req.params as Record<string,string>)[key];assertSchema('uuid.json',value);return value;};
    app.get(prefix+'/projects',async(req,reply)=>ok(reply,req,'metadata-page',await metadata.list(sessionToken(req),'projects',null,req.query as Record<string,unknown>)));
    app.post(prefix+'/projects',async(req,reply)=>{
      const b=body<{serverGeneration:string;mutation:Record<string,any>}>(req,'metadata-project-create-request');
      if(b.mutation.kind!=='project.create')reject('UNSUPPORTED_OPERATION');
      await metadata.commit(sessionToken(req),b.mutation,[],b.serverGeneration);
      return ok(reply,req,'metadata-project',await metadata.read(sessionToken(req),'project',b.mutation.projectId));
    });
    app.get(prefix+'/projects/:id',async(req,reply)=>{assertSchema('auth-empty.json',req.query);return ok(reply,req,'metadata-project',await metadata.read(sessionToken(req),'project',param(req,'id')));});
    app.get(prefix+'/projects/:id/datasets',async(req,reply)=>ok(reply,req,'metadata-page',await metadata.list(sessionToken(req),'datasets',param(req,'id'),req.query as Record<string,unknown>)));
    app.post(prefix+'/projects/:id/import-intents',async(req,reply)=>{
      const b=body<Record<string,any>>(req,'metadata-intent-request');if(b.projectId!==param(req,'id'))reject('INVALID_SOURCE');
      return ok(reply,req,'metadata-intent-response',await metadata.importIntent(sessionToken(req),b));
    });
    app.get(prefix+'/datasets/:id/versions',async(req,reply)=>ok(reply,req,'metadata-page',await metadata.list(sessionToken(req),'versions',param(req,'id'),req.query as Record<string,unknown>)));
    app.get(prefix+'/datasets/:id/branches',async(req,reply)=>ok(reply,req,'metadata-page',await metadata.list(sessionToken(req),'branches',param(req,'id'),req.query as Record<string,unknown>)));
    app.get(prefix+'/versions/:id',async(req,reply)=>{assertSchema('auth-empty.json',req.query);return ok(reply,req,'metadata-version',await metadata.read(sessionToken(req),'version',param(req,'id')));});
  }
  if(storage){
    app.addContentTypeParser('application/octet-stream',(_req,payload,done)=>done(null,payload));
    const p=(req:FastifyRequest,key:string)=>(req.params as Record<string,string>)[key];
    const emptyQuery=(req:FastifyRequest)=>assertSchema('auth-empty.json',req.query);
    const integer=(value:unknown)=>{if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value)||!Number.isSafeInteger(Number(value)))reject('VALIDATION_FAILED');return Number(value);};
    app.post(prefix+'/artifacts/uploads',async(req,reply)=>{emptyQuery(req);return ok(reply,req,'storage-view',await storage.declare(sessionToken(req),body(req,'storage-request')));});
    app.get(prefix+'/artifacts/uploads/:id',async(req,reply)=>{emptyQuery(req);return ok(reply,req,'storage-view',await storage.status(sessionToken(req),p(req,'id')));});
    app.put(prefix+'/artifacts/uploads/:id/chunks/:index',{bodyLimit:4194304},async(req,reply)=>{
      emptyQuery(req);if(req.headers['content-type']!=='application/octet-stream')reject('VALIDATION_FAILED');
      const hash=req.headers['x-chunk-sha256'];if(typeof hash!=='string')reject('VALIDATION_FAILED');
      try{return ok(reply,req,'storage-chunk',await storage.chunk(sessionToken(req),p(req,'id'),integer(p(req,'index')),integer(req.headers['x-chunk-offset']),integer(req.headers['x-chunk-length']),hash,req.body as ByteInput));}
      catch(e){(req.body as ByteInput)?.resume?.();throw e;}
    });
    app.post(prefix+'/artifacts/uploads/:id/complete',async(req,reply)=>{emptyQuery(req);body(req,'auth-empty');return ok(reply,req,'storage-view',await storage.complete(sessionToken(req),p(req,'id')));});
    app.delete(prefix+'/artifacts/uploads/:id',async(req,reply)=>{emptyQuery(req);body(req,'auth-empty');return ok(reply,req,'storage-cancel',await storage.cancel(sessionToken(req),p(req,'id')));});
    app.get(prefix+'/artifacts/:id/content',async(req,reply)=>{
      emptyQuery(req);const artifactId=p(req,'id'),content=await storage.content(sessionToken(req),artifactId);
      reply.header('Content-Type','application/octet-stream').header('Content-Disposition','attachment; filename="artifact-'+artifactId+'.bin"').header('Content-Length',content.sizeBytes).header('X-Artifact-Sha256',content.sha256);
      return reply.send(content.stream);
    });
  }
  if(localSync)registerLocalSync(app,auth,localSync);
  if(localOps)registerLocalOps(app,auth,localOps);
  await app.ready();return app;
}
