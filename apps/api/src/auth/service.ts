import {randomInt,randomUUID} from 'node:crypto';
import type {Db,MongoClient,ClientSession} from 'mongodb';
import {collections,prepareAuth} from './schema.ts';
import type {RecordDoc} from './schema.ts';
import {AuthError,reject,digest,equal,mac,token,emailPolicy,namePolicy,passwordPolicy,PasswordHasher} from './policy.ts';
import type {FakeMailAdapter} from './fake-mail.ts';
type TxResult<T>={value:T;error?:never}|{error:AuthError;value?:never};
export type AuthIdentity={user:RecordDoc;session:RecordDoc};
export type AuthConfig={profile:'development'|'test';origin:string;secret:Buffer;serverGeneration:string};
export class AuthService {
  readonly c;
  readonly client:MongoClient;
  readonly db:Db;
  readonly config:AuthConfig;
  readonly mail:FakeMailAdapter;
  readonly clock:()=>number;
  readonly passwords=new PasswordHasher();
  private dummyHash='';
  private serverGeneration='';
  constructor(client:MongoClient,db:Db,config:AuthConfig,mail:FakeMailAdapter,clock:()=>number=Date.now) {
    this.client=client;this.db=db;this.config=config;this.mail=mail;this.clock=clock;
    if(!['development','test'].includes(config.profile)||mail.kind!=='fake-local'||config.secret.length<32)throw Error('B030 local profile required');
    const url=new URL(config.origin);
    if(url.protocol!=='https:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('Fake auth only supports loopback HTTPS origin');
    this.c=collections(db);
  }
  async ready(){this.serverGeneration=await prepareAuth(this.db,this.config.serverGeneration);this.dummyHash=await this.passwords.create(token());}
  private async transaction<T>(fn:(s:ClientSession)=>Promise<T>):Promise<T> {
    const s=this.client.startSession();try{return await s.withTransaction(()=>fn(s),{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}}) as T;}finally{await s.endSession();}
  }
  private async limit(s:ClientSession,key:string,max:number,windowMs:number,now:number) {
    const window=Math.floor(now/windowMs),id=digest(key+':'+window);
    const entry=await this.c.limits.findOne({_id:id},{session:s});
    if(entry&&entry.count>=max)return false;
    await this.c.limits.updateOne({_id:id},{$inc:{count:1},$setOnInsert:{cleanupAt:new Date((window+1)*windowMs+86400000)}},{upsert:true,session:s});
    return true;
  }
  async limitIp(ip:string,action:string) {
    // Local-dev tuning, not a production/NAT capacity claim. Atomic across requests.
    const ok=await this.transaction(s=>this.limit(s,'ip:'+ip+':'+action,300,900000,this.clock()));
    if(!ok)reject('RATE_LIMITED',429);
  }
  private challengeView(c:RecordDoc) {
    return {challengeId:c._id,purpose:c.purpose,generation:c.generation,serverNow:new Date(this.clock()).toISOString(),expiresAt:c.expiresAt.toISOString(),resendAvailableAt:c.resendAvailableAt.toISOString(),attemptsRemaining:c.attemptsRemaining,sendStatus:c.sendStatus};
  }
  private otpVerifier(c:RecordDoc,otp:string) {return mac(this.config.secret,'otp',c._id,c.purpose,c.canonicalEmail,c.generation,otp);}
  private async send(c:RecordDoc,otp:string) {
    let status:'accepted'|'failed'|'unknown'='unknown';
    try{status=await this.mail.send({email:c.canonicalEmail,challengeId:c._id,purpose:c.purpose,generation:c.generation,otp});}catch{status='failed';}
    await this.c.challenges.updateOne({_id:c._id,generation:c.generation,consumedAt:null},{$set:{sendStatus:status}});
    return this.challengeView({...c,sendStatus:status});
  }
  async register(input:{email:string;displayName:string;password:string;confirmPassword:string}) {
    const e=emailPolicy(input.email);namePolicy(input.displayName);passwordPolicy(input.password,input.confirmPassword);
    const encoded=await this.passwords.create(input.password);
    return this.createChallenge('register',e,{pendingPasswordHash:encoded,pendingDisplayName:input.displayName});
  }
  async forgot(email:string) {
    const e=emailPolicy(email),user=await this.c.users.findOne({canonicalEmail:e.canonicalEmail,status:'active'});
    // Both identities get an indistinguishable challenge. Unknown identities never get account authority.
    return this.createChallenge('reset',e,user?{userId:user._id,passwordGeneration:user.passwordGeneration}:{});
  }
  private async createChallenge(purpose:'register'|'reset',e:ReturnType<typeof emailPolicy>,extra:Record<string,unknown>) {
    const now=this.clock(),otp=String(randomInt(1000000)).padStart(6,'0');
    const c:RecordDoc={_id:token(),schemaVersion:1,...e,purpose,generation:1,expiresAt:new Date(now+300000),resendAvailableAt:new Date(now+60000),cleanupAt:new Date(now+86400000),attemptsRemaining:5,consumedAt:null,sendStatus:'unknown',...extra};
    c.otpVerifier=this.otpVerifier(c,otp);
    const ok=await this.transaction(async s=>{
      if(!await this.limit(s,'email:'+purpose+':'+e.canonicalEmail,5,3600000,now))return false;
      await this.c.challenges.insertOne(c,{session:s});return true;
    });
    if(!ok)reject('RATE_LIMITED',429);
    return this.send(c,otp);
  }
  async resend(id:string,purpose:string) {
    const now=this.clock(),otp=String(randomInt(1000000)).padStart(6,'0');
    const result=await this.transaction<TxResult<RecordDoc>>(async s=>{
      const c=await this.c.challenges.findOne({_id:id,purpose},{session:s});
      if(!c||c.consumedAt||c.cleanupAt.getTime()<=now)return {error:new AuthError('OTP_INVALID')};
      if(c.resendAvailableAt.getTime()>now)return {error:new AuthError('RATE_LIMITED',429)};
      if(!await this.limit(s,'email:'+purpose+':'+c.canonicalEmail,5,3600000,now))return {error:new AuthError('RATE_LIMITED',429)};
      const next:RecordDoc={...c,generation:c.generation+1,expiresAt:new Date(now+300000),resendAvailableAt:new Date(now+60000),attemptsRemaining:5,sendStatus:'unknown'};
      next.otpVerifier=this.otpVerifier(next,otp);
      await this.c.challenges.replaceOne({_id:id},next,{session:s});
      return {value:next};
    });
    if(result.error)throw result.error;return this.send(result.value,otp);
  }
  async verify(input:{challengeId:string;purpose:string;generation:number;otp:string},routePurpose:'register'|'reset') {
    const now=this.clock(),grant=token(),grantId=token();
    const result=await this.transaction<TxResult<Record<string,unknown>>>(async s=>{
      const c=await this.c.challenges.findOne({_id:input.challengeId},{session:s});
      if(!c||c.purpose!==routePurpose||input.purpose!==routePurpose||c.generation!==input.generation||c.consumedAt)return {error:new AuthError('OTP_INVALID')};
      if(c.expiresAt.getTime()<=now)return {error:new AuthError('OTP_EXPIRED')};
      if(c.attemptsRemaining<=0)return {error:new AuthError('OTP_ATTEMPTS_EXCEEDED')};
      if(!equal(c.otpVerifier,this.otpVerifier(c,input.otp))) {
        await this.c.challenges.updateOne({_id:c._id},{$inc:{attemptsRemaining:-1}},{session:s});
        return {error:new AuthError('OTP_INVALID')}; // Commit the failed-attempt write before throwing.
      }
      if(routePurpose==='register') {
        if(await this.c.users.findOne({canonicalEmail:c.canonicalEmail},{session:s}))return {error:new AuthError('VALIDATION_FAILED')};
        const slot=await this.c.control.updateOne({_id:'activationCounter',count:{$lt:100}},{$inc:{count:1,revision:1}},{session:s});
        if(slot.modifiedCount!==1)return {error:new AuthError('ACCOUNT_LIMIT_REACHED',409)};
        const id=randomUUID();
        await this.c.users.insertOne({_id:id,ownerId:id,schemaVersion:1,canonicalEmail:c.canonicalEmail,displayEmail:c.displayEmail,displayName:c.pendingDisplayName,passwordHash:c.pendingPasswordHash,status:'active',authEpoch:0,passwordGeneration:0,fence:0,currentSessionId:null,activatedAt:new Date(now),createdAtServer:new Date(now)},{session:s});
        await this.c.challenges.updateOne({_id:c._id},{$set:{consumedAt:new Date(now)},$unset:{pendingPasswordHash:'',pendingDisplayName:''}},{session:s});
        return {value:{activated:true,autoLogin:false}};
      }
      // A reset challenge created before another reset cannot authorize a newer password generation.
      const user=c.userId?await this.c.users.findOne({_id:c.userId,status:'active',passwordGeneration:c.passwordGeneration},{session:s}):null;
      await this.c.challenges.updateOne({_id:c._id},{$set:{consumedAt:new Date(now)}},{session:s});
      if(user)await this.c.grants.insertOne({_id:grantId,schemaVersion:1,verifier:digest(grant),userId:user._id,passwordGeneration:user.passwordGeneration,expiresAt:new Date(now+300000),consumedAt:null},{session:s});
      // Decoy grant for unknown identity has the same public shape and no DB authority.
      return {value:{grant,expiresAt:new Date(now+300000).toISOString(),autoLogin:false}};
    });
    if(result.error)throw result.error;return result.value;
  }
  async login(input:{email:string;password:string;deviceId:string}) {
    const {canonicalEmail}=emailPolicy(input.email);passwordPolicy(input.password);const now=this.clock();
    const allowed=await this.transaction(s=>this.limit(s,'login:'+canonicalEmail,20,900000,now));
    if(!allowed)reject('RATE_LIMITED',429);
    const user=await this.c.users.findOne({canonicalEmail,status:'active'});
    const valid=await this.passwords.check(user?.passwordHash??this.dummyHash,input.password);
    if(!valid||!user)reject('VALIDATION_FAILED');
    const rawToken=token(),handle=token(),sessionId=token();
    const session:RecordDoc={_id:sessionId,schemaVersion:1,userId:user._id,tokenHash:digest(rawToken),deviceId:input.deviceId,authEpoch:user.authEpoch+1,issuedAt:new Date(now),expiresAt:new Date(now+604800000),revokedAt:null,revocationHandleVerifier:digest(handle),state:'active',fence:0};
    const result=await this.transaction<TxResult<AuthIdentity>>(async s=>{
      // Recheck the exact hash/generation after the expensive password check.
      const u=await this.c.users.findOne({_id:user._id,status:'active',passwordGeneration:user.passwordGeneration,passwordHash:user.passwordHash},{session:s});
      if(!u)return {error:new AuthError('VALIDATION_FAILED')};
      session.authEpoch=u.authEpoch+1;
      await this.c.users.updateOne({_id:u._id,authEpoch:u.authEpoch},{$inc:{authEpoch:1,fence:1},$set:{currentSessionId:sessionId}},{session:s});
      await this.c.sessions.updateMany({userId:u._id,revokedAt:null},{$set:{revokedAt:new Date(now),state:'revoked'},$inc:{fence:1}},{session:s});
      await this.c.sessions.insertOne(session,{session:s});
      return {value:{user:{...u,authEpoch:session.authEpoch,currentSessionId:sessionId},session}};
    });
    if(result.error)throw result.error;
    return {rawToken,data:{...this.sessionView(result.value),revocationHandle:handle}};
  }
  async identity(rawToken:string|undefined,s?:ClientSession):Promise<AuthIdentity> {
    if(!rawToken)reject('AUTH_REQUIRED',401);
    const session=await this.c.sessions.findOne({tokenHash:digest(rawToken)},s?{session:s}:{});
    if(!session)reject('AUTH_REQUIRED',401);
    if(session.expiresAt.getTime()<=this.clock())reject('SESSION_EXPIRED',401);
    const user=await this.c.users.findOne({_id:session.userId},s?{session:s}:{});
    if(!user||user.status!=='active'||session.revokedAt||user.authEpoch!==session.authEpoch||user.currentSessionId!==session._id)reject('SESSION_REVOKED',401);
    return {user,session};
  }
  sessionView({user,session}:AuthIdentity) {
    return {userId:user._id,sessionId:session._id,authEpoch:session.authEpoch,expiresAt:session.expiresAt.toISOString(),serverGeneration:this.serverGeneration,offlineEntitlement:{ownerId:user._id,issuedAt:session.issuedAt.toISOString(),profileBound:true,onlineExpiryRevokesLocal:false}};
  }
  profile(user:RecordDoc){return {userId:user._id,email:user.displayEmail,displayName:user.displayName};}
  async withFence<T>(rawToken:string|undefined,write:(s:ClientSession,identity:AuthIdentity)=>Promise<T>):Promise<T> {
    return this.transaction(async s=>{
      const identity=await this.identity(rawToken,s),{user,session}=identity;
      const u=await this.c.users.updateOne({_id:user._id,status:'active',authEpoch:session.authEpoch,currentSessionId:session._id},{$inc:{fence:1}},{session:s});
      const q=await this.c.sessions.updateOne({_id:session._id,authEpoch:session.authEpoch,revokedAt:null,expiresAt:{$gt:new Date(this.clock())}},{$inc:{fence:1}},{session:s});
      if(u.modifiedCount!==1||q.modifiedCount!==1)reject('SESSION_REVOKED',401);
      return write(s,identity);
    });
  }
  async patchProfile(rawToken:string|undefined,displayName:string) {
    namePolicy(displayName);
    return this.withFence(rawToken,async(s,{user})=>{await this.c.users.updateOne({_id:user._id},{$set:{displayName}},{session:s});return this.profile({...user,displayName});});
  }
  async logout(rawToken:string|undefined) {
    return this.withFence(rawToken,async(s,{user,session})=>{
      await this.c.users.updateOne({_id:user._id,authEpoch:session.authEpoch},{$inc:{authEpoch:1,fence:1},$set:{currentSessionId:null}},{session:s});
      await this.c.sessions.updateOne({_id:session._id},{$set:{revokedAt:new Date(this.clock()),state:'revoked'},$inc:{fence:1}},{session:s});
      return {revoked:true};
    });
  }
  async revokeDeferred(handle:string) {
    await this.transaction(async s=>{
      const old=await this.c.sessions.findOne({revocationHandleVerifier:digest(handle)},{session:s});
      if(!old||old.revokedAt)return;
      // Old handle may only touch this old session; conditional user write never revokes a newer login.
      await this.c.users.updateOne({_id:old.userId,currentSessionId:old._id,authEpoch:old.authEpoch},{$inc:{authEpoch:1,fence:1},$set:{currentSessionId:null}},{session:s});
      await this.c.sessions.updateOne({_id:old._id},{$set:{revokedAt:new Date(this.clock()),state:'revoked'},$inc:{fence:1}},{session:s});
    });
    return {revoked:true};
  }
  async resetPassword(input:{grant:string;password:string;confirmPassword:string}) {
    passwordPolicy(input.password,input.confirmPassword);
    const encoded=await this.passwords.create(input.password),now=this.clock();
    const result=await this.transaction<TxResult<true>>(async s=>{
      const g=await this.c.grants.findOne({verifier:digest(input.grant)},{session:s});
      if(!g||g.consumedAt||g.expiresAt.getTime()<=now)return {error:new AuthError('OTP_INVALID')};
      const u=await this.c.users.updateOne({_id:g.userId,status:'active',passwordGeneration:g.passwordGeneration},{$set:{passwordHash:encoded,currentSessionId:null},$inc:{passwordGeneration:1,authEpoch:1,fence:1}},{session:s});
      if(u.modifiedCount!==1)return {error:new AuthError('OTP_INVALID')};
      await this.c.grants.updateOne({_id:g._id},{$set:{consumedAt:new Date(now)}},{session:s});
      await this.c.sessions.updateMany({userId:g.userId,revokedAt:null},{$set:{revokedAt:new Date(now),state:'revoked'},$inc:{fence:1}},{session:s});
      return {value:true};
    });
    if(result.error)throw result.error;
    return {passwordChanged:true,autoLogin:false};
  }
}
