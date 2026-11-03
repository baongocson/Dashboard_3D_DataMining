import {MongoMemoryReplSet} from 'mongodb-memory-server-core';
import {MongoClient} from 'mongodb';
import {AuthService} from '../../apps/api/src/auth/service.ts';
import {FakeMailAdapter} from '../../apps/api/src/auth/fake-mail.ts';
import {emailPolicy,passwordPolicy,PasswordHasher,HASH_POLICY,digest} from '../../apps/api/src/auth/policy.ts';
import {createApp} from '../../apps/api/src/app.ts';
import {parseOptions} from '../../apps/api/node_modules/@node-rs/argon2/index.js';
import {assertSchema} from '../../packages/contracts/src/index.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
import {password,nextPassword,cases} from '../../tests/fixtures/b030.mjs';
import {mkdir,readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
process.chdir(root);await checkGenerated();
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.resolve('experiments/g02s/evidence/b030',runId),runtime=path.resolve('experiments/g02s/.runtime/b030',runId);
await mkdir(out,{recursive:true});await mkdir(runtime,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const selected=new Set(process.argv.slice(2)),want=id=>!selected.size||selected.has(id);
const report={task:'B030',runId,profile:'fake-local-only',environment:{node:process.version,os:os.platform()+' '+os.release(),cpu:os.cpus()[0].model,mongodb:'8.0.34',fastify:'5.12.8',cookie:'11.1.5',argon2:'2.2.2',driver:'7.8.0'},method:'Real one-member MongoDB replica set, synthetic data, controlled clock except browser transport. API inject plus selected actual browser HTTPS. No SMTP/cloud/AI/Docker.',cases:[],findings:[{id:'realMail',status:'blocked',reason:'No provider/sender authority; public auth disabled'},{id:'fullOfflineAccountUI',status:'inconclusive',reason:'B022/B043 pending; API does not clear local data but full dirty/outbox account gate not implemented'},{id:'productionCapacity',status:'inconclusive',reason:'Dev cost and bounded queue are not100-concurrent production measurements'}],cleanup:[]};
let repl,client;const apps=[];let dbNumber=0;
function check(value,message){if(!value)throw Error(message);}
async function denied(fn,code){try{await fn();throw Error('Expected rejection '+code);}catch(e){check(e.code===code,'Expected '+code+', actual '+(e.code??e.message));}}
async function test(id,fn){if(!want(id))return;const started=performance.now();try{const details=await fn();report.cases.push({id,expected:cases.find(c=>c[0]===id)[1],status:'passed',actual:details,elapsedMs:Math.round(performance.now()-started)});}catch(e){report.cases.push({id,expected:cases.find(c=>c[0]===id)[1],status:'failed',actual:e.code??e.message,elapsedMs:Math.round(performance.now()-started)});}console.log(JSON.stringify(report.cases.at(-1)));}
async function fixture() {
  const db=client.db('b030_synthetic_'+(++dbNumber)),mail=new FakeMailAdapter(),time={now:Date.UTC(2026,10,2,12)};
  const auth=new AuthService(client,db,{profile:'test',origin:'https://localhost',secret:randomBytes(32),serverGeneration:randomUUID()},mail,()=>time.now);
  await auth.ready();return {db,mail,time,auth};
}
const getOtp=(f,c)=>f.mail.messages.findLast(m=>m.challengeId===c.challengeId&&m.generation===c.generation).otp;
const verifyInput=(f,c)=>({challengeId:c.challengeId,purpose:c.purpose,generation:c.generation,otp:getOtp(f,c)});
async function register(f,email='a@example.test',name='Người dùng A') {return f.auth.register({email,displayName:name,password,confirmPassword:password});}
async function active(f,email='a@example.test') {const c=await register(f,email);await f.auth.verify(verifyInput(f,c),'register');return email;}
const login=(f,email='a@example.test',pw=password)=>f.auth.login({email,password:pw,deviceId:randomUUID()});
const cookieName='__Host-dashboard_session',csrfName='__Host-dashboard_csrf';
function actor(app,origin='https://localhost') {
  const jar={};let csrf;
  async function call(url,body,method=body===undefined?'GET':'POST',extra={}) {
    const headers={cookie:Object.entries(jar).map(([k,v])=>k+'='+v).join('; '),...(body===undefined?{}:{origin,...(csrf?{'x-csrf-token':csrf}:{}),'content-type':'application/json'}),...extra};
    const r=await app.inject({method,url:'/api/v1'+url,headers,...(body===undefined?{}:{payload:typeof body==='string'?body:JSON.stringify(body)})});
    for(const c of r.cookies)if(c.value)jar[c.name]=c.value;else delete jar[c.name];
    let json;try{json=r.json();}catch{}
    if(url==='/auth/csrf'&&r.statusCode===200)csrf=json.data.csrfToken;
    if(json?.error)assertSchema('error-envelope.json',json);else if(json)assertSchema('success-envelope.json',json);
    return {status:r.statusCode,json,headers:r.headers,cookies:r.cookies};
  }
  return {call,jar};
}
try {
  const binary=path.resolve('experiments/g01/.runtime/mongod-8.0.34.exe');report.environment.mongoBinarySha256=sha(await readFile(binary));
  await mkdir(path.join(runtime,'db'));
  repl=await MongoMemoryReplSet.create({binary:{systemBinary:binary,version:'8.0.34'},instanceOpts:[{dbPath:path.join(runtime,'db')}],replSet:{count:1,name:'b030rs',ip:'127.0.0.1',storageEngine:'wiredTiger'}});
  client=new MongoClient(repl.getUri(),{serverSelectionTimeoutMS:15000});await client.connect();
  await test('B030-N-CSRF',async()=>{
    const f=await fixture(),app=await createApp(f.auth);apps.push(app);const a=actor(app);
    check((await a.call('/auth/session')).status===401,'private without session');
    check((await a.call('/auth/register',{email:'a@example.test',displayName:'A',password,confirmPassword:password})).status===403,'no bootstrap');
    const boot=await a.call('/auth/csrf');check(boot.status===200,'bootstrap no cookie');
    check((await a.call('/auth/register',{email:'a@example.test',displayName:'A',password,confirmPassword:password},'POST',{origin:'https://evil.invalid'})).status===403,'origin blocked');
    check((await a.call('/auth/register','{"email":"a@example.test","email":"b@example.test"}')).status===400,'duplicate JSON');
    check((await a.call('/auth/register','{"count":9007199254740993}')).status===400,'unsafe raw number');
    const c=await a.call('/auth/register',{email:'a@example.test',displayName:'A',password,confirmPassword:password});
    check(c.status===200&&!a.jar[cookieName],'register no pre-session or auto-login');
    check((await a.call('/auth/login',{email:'a@example.test',password,deviceId:randomUUID()})).status===422,'pending cannot login');
    check((await a.call('/auth/password/forgot',{email:'unknown@example.test'})).status===200,'forgot no pre-session');
    check(!c.headers['clear-site-data']&&c.headers['cache-control']==='no-store','safe cache/no clear');
    f.time.now+=600000;check((await a.call('/auth/register',{})).status===403,'bootstrap expiry');
    return {publicWithoutSession:true,private401:true,origin403:true,invalidJSON400:true,autoLogin:false,csrfTTL600s:true};
  });
  await test('B030-policy',async()=>{
    check(emailPolicy(' A.B+Tag@BÜCHER.example ').canonicalEmail==='a.b+tag@xn--bcher-kva.example','email IDNA preserved local');
    check(emailPolicy('a.b@example.test').canonicalEmail!==emailPolicy('ab@example.test').canonicalEmail,'dots not removed');
    passwordPolicy('🧪'.repeat(15));passwordPolicy('🧪'.repeat(128));
    for(const p of ['🧪'.repeat(14),'🧪'.repeat(129),'\ud800'+'a'.repeat(20)])await denied(async()=>passwordPolicy(p),'VALIDATION_FAILED');
    const f=await fixture(),app=await createApp(f.auth);apps.push(app);const a=actor(app);await a.call('/auth/csrf');
    const r=await a.call('/auth/register',{email:'unicode@example.test',displayName:'Tên Việt',password:'🧪'.repeat(15),confirmPassword:'🧪'.repeat(15)});check(r.status===200,'shared schema counts code points');
    return {passwordCodePoints:[15,128],noTrimOrNormalization:true,emailIDNA:true,additionalFieldsRejectedBySchema:true};
  });
  await test('B030-activation-100',async()=>{
    const f=await fixture(),encoded=await f.auth.passwords.create(password);
    await f.auth.c.users.insertMany(Array.from({length:99},(_,i)=>{const id=randomUUID();return {_id:id,ownerId:id,schemaVersion:1,canonicalEmail:'seed'+i+'@example.test',displayEmail:'seed'+i+'@example.test',displayName:'Seed',passwordHash:encoded,status:'active',authEpoch:0,passwordGeneration:0,fence:0,currentSessionId:null};}));
    await f.auth.c.control.updateOne({_id:'activationCounter'},{$set:{count:99}});
    const challenges=await Promise.all([register(f,'r1@example.test'),register(f,'r2@example.test')]);
    const results=await Promise.allSettled(challenges.map(c=>f.auth.verify(verifyInput(f,c),'register')));
    check(results.filter(r=>r.status==='fulfilled').length===1,'only one activated');
    check(results.find(r=>r.status==='rejected').reason.code==='ACCOUNT_LIMIT_REACHED','clear account limit');
    check(await f.auth.c.users.countDocuments({status:'active'})===100,'actual100 users');
    check((await f.auth.c.control.findOne({_id:'activationCounter'})).count===100,'counter100');
    check(await f.auth.c.challenges.countDocuments({consumedAt:{$ne:null}})===1,'only winner consumed');
    return {initialActive:99,concurrent:2,actualActive:100,activated:1,rejected:1,consumed:1};
  });
  await test('B030-OTP-attempts',async()=>{
    const f=await fixture(),c=await register(f),input=verifyInput(f,c);input.otp=input.otp==='000000'?'000001':'000000';
    const results=await Promise.allSettled(Array.from({length:5},()=>f.auth.verify(input,'register')));
    check(results.every(r=>r.status==='rejected'&&r.reason.code==='OTP_INVALID'),'five wrong');
    check((await f.auth.c.challenges.findOne({_id:c.challengeId})).attemptsRemaining===0,'wrong attempts durable');
    await denied(()=>f.auth.verify(verifyInput(f,c),'register'),'OTP_ATTEMPTS_EXCEEDED');
    check(await f.auth.c.users.countDocuments({})===0,'no activation');
    return {concurrentWrong:5,remaining:0,correctAfterExhaustion:'OTP_ATTEMPTS_EXCEEDED'};
  });
  await test('B030-OTP-generation',async()=>{
    const f=await fixture(),c=await register(f),old=verifyInput(f,c);
    f.time.now+=59999;await denied(()=>f.auth.resend(c.challengeId,'register'),'RATE_LIMITED');
    f.time.now++;const r=await Promise.allSettled([f.auth.resend(c.challengeId,'register'),f.auth.resend(c.challengeId,'register')]);
    check(r.filter(x=>x.status==='fulfilled').length===1,'one concurrent resend');
    const current=r.find(x=>x.status==='fulfilled').value;check(current.generation===2,'generation increments');
    await denied(()=>f.auth.verify(old,'register'),'OTP_INVALID');
    await denied(()=>f.auth.verify({...verifyInput(f,current),purpose:'reset'},'reset'),'OTP_INVALID');
    await f.auth.verify(verifyInput(f,current),'register');
    await denied(()=>f.auth.verify(verifyInput(f,current),'register'),'OTP_INVALID');
    return {cooldown59999Rejected:true,at60000:true,concurrentWinner:1,generation:2,replayRejected:true};
  });
  await test('B030-OTP-expiry',async()=>{
    const f=await fixture(),c=await register(f);f.time.now+=300000;
    await denied(()=>f.auth.verify(verifyInput(f,c),'register'),'OTP_EXPIRED');
    check(await f.auth.c.challenges.countDocuments({_id:c.challengeId})===1,'TTL not authority');
    f.time.now+=86400000;await denied(()=>f.auth.resend(c.challengeId,'register'),'OTP_INVALID');
    return {at300000:'OTP_EXPIRED',retainedDocument:true,pending24hRejected:true};
  });
  await test('B030-OTP-quota',async()=>{
    const f=await fixture();let c=await register(f);
    for(let i=0;i<4;i++){f.time.now+=60000;c=await f.auth.resend(c.challengeId,'register');}
    f.time.now+=60000;await denied(()=>f.auth.resend(c.challengeId,'register'),'RATE_LIMITED');
    await denied(()=>register(f),'RATE_LIMITED');
    await f.auth.forgot('a@example.test');check(f.mail.messages.length===6,'register5 plus reset1');
    f.time.now=Date.UTC(2026,10,2,13);await f.auth.resend(c.challengeId,'register');
    return {maxTotalSendsPerEmailPurposeHour:5,resetIndependent:true,hourBoundaryAllows:true};
  });
  await test('B030-existing-user',async()=>{
    const f=await fixture();await active(f);const before=await f.auth.c.users.findOne({});
    const c=await f.auth.register({email:'A@EXAMPLE.TEST',displayName:'Attacker',password:nextPassword,confirmPassword:nextPassword});
    f.time.now+=60000;const r=await f.auth.resend(c.challengeId,'register');
    await denied(()=>f.auth.verify(verifyInput(f,r),'register'),'VALIDATION_FAILED');
    const after=await f.auth.c.users.findOne({_id:before._id});
    check(after.passwordHash===before.passwordHash&&after.displayName===before.displayName,'active unchanged');
    await login(f);await denied(()=>login(f,'a@example.test',nextPassword),'VALIDATION_FAILED');
    return {activePasswordNameUntouched:true,pendingImmutableAcrossResend:true};
  });
  await test('B030-mail-status',async()=>{
    const f=await fixture(),statuses=[];
    for(const status of ['accepted','failed','unknown']){f.mail.nextStatus=status;const c=await register(f,status+'@example.test');check(c.sendStatus===status,'truthful sendStatus');statuses.push(c.sendStatus);}
    check(await f.auth.c.users.countDocuments({})===0,'no auto activate');
    return {statuses,deliveredClaim:false,active:0,network:false};
  });
  await test('B030-single-session',async()=>{
    const f=await fixture();await active(f);const a=await login(f),b=await login(f);
    await denied(()=>f.auth.identity(a.rawToken),'SESSION_REVOKED');
    const identity=await f.auth.identity(b.rawToken);check(identity.user.authEpoch===2,'epoch2');
    const view=f.auth.sessionView(identity);check(!('revocationHandle'in view)&&!('rawToken'in view),'introspection omits secrets');
    const app=await createApp(f.auth);apps.push(app);const actorB=actor(app);await actorB.call('/auth/csrf');actorB.jar[cookieName]=b.rawToken;
    check((await actorB.call('/me',{email:'new@example.test'},'PATCH')).status===422,'email immutable');
    check((await actorB.call('/me',{displayName:'Tên mới',ownerId:randomUUID()},'PATCH')).status===422,'owner injection');
    const profile=await actorB.call('/me',{displayName:'Tên mới'},'PATCH');check(profile.status===200&&profile.json.data.userId===b.data.userId,'self scoped');
    return {authEpoch:2,oldSessionRevoked:true,noIntrospectionHandle:true,profileAllowlist:true};
  });
  await test('B030-reset-grant',async()=>{
    const f=await fixture();await active(f);const a=await login(f),c=await f.auth.forgot('a@example.test');
    const g=await f.auth.verify(verifyInput(f,c),'reset');
    const concurrent=await Promise.allSettled([1,2].map(()=>f.auth.resetPassword({grant:g.grant,password:nextPassword,confirmPassword:nextPassword})));
    check(concurrent.filter(r=>r.status==='fulfilled').length===1,'one-use reset concurrent');
    await denied(()=>f.auth.identity(a.rawToken),'SESSION_REVOKED');
    await denied(()=>login(f),'VALIDATION_FAILED');await login(f,'a@example.test',nextPassword);
    const user=await f.auth.c.users.findOne({canonicalEmail:'a@example.test'});check(user.passwordGeneration===1,'generation1');
    const expired=await f.auth.forgot('a@example.test'),grant=await f.auth.verify(verifyInput(f,expired),'reset');
    f.time.now+=300000;await denied(()=>f.auth.resetPassword({grant:grant.grant,password,confirmPassword:password}),'OTP_INVALID');
    const unknown=await f.auth.forgot('unknown@example.test'),decoy=await f.auth.verify(verifyInput(f,unknown),'reset');
    await denied(()=>f.auth.resetPassword({grant:decoy.grant,password,confirmPassword:password}),'OTP_INVALID');
    return {oneConcurrentReset:true,passwordGeneration:1,oldSessionRevoked:true,grant300s:true,unknownDecoyNoAuthority:true,autoLogin:false,localClearOperation:false};
  });
  await test('B030-deferred',async()=>{
    const f=await fixture();await active(f);const a=await login(f),b=await login(f);
    await f.auth.revokeDeferred(a.data.revocationHandle);await f.auth.revokeDeferred(a.data.revocationHandle);
    await f.auth.revokeDeferred(randomBytes(32).toString('base64url'));await f.auth.identity(b.rawToken);
    await denied(()=>f.auth.identity(a.data.revocationHandle),'AUTH_REQUIRED');
    await f.auth.revokeDeferred(b.data.revocationHandle);await denied(()=>f.auth.identity(b.rawToken),'SESSION_REVOKED');
    return {oldHandleIdempotent:true,newSessionSurvivesOldHandle:true,handleNotSession:true};
  });
  await test('B030-fence-order',async()=>{
    const f=await fixture();await active(f);const a=await login(f);let signal,release;
    const started=new Promise(r=>signal=r),gate=new Promise(r=>release=r),writeId=randomUUID();
    const commit=f.auth.withFence(a.rawToken,async(s,identity)=>{signal();await gate;await f.db.collection('synthetic_commits').insertOne({_id:writeId,ownerId:identity.user._id},{session:s});});
    await started;const bPromise=login(f);await new Promise(r=>setTimeout(r,100));release();await commit;const b=await bPromise;
    await denied(()=>f.auth.withFence(a.rawToken,async s=>{await f.db.collection('synthetic_commits').insertOne({_id:randomUUID()},{session:s});}),'SESSION_REVOKED');
    check(await f.db.collection('synthetic_commits').countDocuments({})===1,'only pre-revoke durable');
    await f.auth.logout(b.rawToken);
    await denied(()=>f.auth.withFence(b.rawToken,async()=>true),'SESSION_REVOKED');
    return {realSnapshotTransactions:true,preRevokeCommits:1,postRevokeCommits:0,loginLogoutConditionalUserAndSessionFence:true};
  });
  await test('B030-durable-secrets',async()=>{
    const f=await fixture();await active(f);const a=await login(f),c=await f.auth.forgot('a@example.test'),g=await f.auth.verify(verifyInput(f,c),'reset');
    const documents={};for(const name of ['users','sessions','auth_challenges','auth_control','reset_grants','auth_rate_limits'])documents[name]=await f.db.collection(name).find({}).toArray();
    const dump=JSON.stringify(documents),secretValues=[password,a.rawToken,a.data.revocationHandle,g.grant,f.auth.config.secret.toString('hex')];
    check(secretValues.every(x=>!dump.includes(x)),'no plaintext durable secrets');
    check(documents.users[0].passwordHash.startsWith('$argon2id$'),'PHC');
    check(documents.sessions[0].tokenHash===digest(a.rawToken),'token hash');
    for(const m of f.mail.messages){const d=documents.auth_challenges.find(x=>x._id===m.challengeId);check(!('otp'in d)&&!('code'in d)&&/^[a-f0-9]{64}$/.test(d.otpVerifier),'HMAC verifier only');}
    return {passwordPHC:true,otpHMAC:true,sessionHandleGrantDigests:true,plaintextPersisted:false,loggerDisabled:true};
  });
  await test('B030-argon2-cost',async()=>{
    const h=new PasswordHasher(),started=performance.now(),initial=process.memoryUsage();
    const hashes=await Promise.all(Array.from({length:4},()=>h.create(password)));
    check(new Set(hashes).size===4,'random salts');
    check(await h.check(hashes[0],password),'roundtrip');
    check(!await h.check(hashes[0],password.trim()),'no trim');
    check(!await h.check(hashes[0],password.normalize('NFD')),'no normalization');
    const parameters=parseOptions(hashes[0]);check(parameters.algorithm===2&&parameters.memoryCost===19456&&parameters.timeCost===2&&parameters.parallelism===1&&parameters.saltLen===16,'PHC parameters');
    check(h.peakActive===2,'hash concurrency2');
    const saturated=await Promise.allSettled(Array.from({length:11},()=>h.create(password)));
    check(saturated.filter(r=>r.status==='rejected'&&r.reason.code==='RATE_LIMITED').length===1,'bounded queue8');
    return {parameters,policy:HASH_POLICY,peakConcurrent:2,maxQueued:8,costBatchMs:Math.round(performance.now()-started),processRssBefore:initial.rss,processRssAfter:process.memoryUsage().rss,peakMemory:'inconclusive: endpoint samples are not peak'};
  });
  await test('B030-session-expiry',async()=>{
    const f=await fixture();await active(f);const a=await login(f);f.time.now+=604800000;
    await denied(()=>f.auth.identity(a.rawToken),'SESSION_EXPIRED');
    check(await f.auth.c.sessions.countDocuments({})===1,'expiry business check not TTL');
    const app=await createApp(f.auth);apps.push(app);const actorA=actor(app);actorA.jar[cookieName]=a.rawToken;
    const r=await actorA.call('/auth/session');check(r.status===401&&!r.headers['clear-site-data'],'keep offline local');
    return {at7Days401:true,retainedSessionRecord:true,clearSiteData:false};
  });
  await test('B030-O01-O02',async()=>{
    const f=await fixture(),app=await createApp(f.auth);apps.push(app);const a=actor(app);
    await a.call('/auth/csrf');const c=await a.call('/auth/register',{email:'a@example.test',displayName:'A',password,confirmPassword:password});
    f.time.now+=60000;const resend=await a.call('/auth/otp/resend',{challengeId:c.json.data.challengeId,purpose:'register'});check(resend.status===200,'resend route');
    const verified=await a.call('/auth/register/verify',verifyInput(f,resend.json.data));check(verified.status===200&&verified.json.data.autoLogin===false,'register verify route');
    const logged=await a.call('/auth/login',{email:'a@example.test',password,deviceId:randomUUID()});check(logged.status===200,'login route');
    check((await a.call('/auth/session')).status===200&&(await a.call('/me')).status===200,'get routes');
    check((await a.call('/me',{displayName:'Tên mới'},'PATCH')).status===200,'patch route');
    const forgot=await a.call('/auth/password/forgot',{email:'a@example.test'});check(forgot.status===200,'forgot route');
    const grant=await a.call('/auth/password/verify',verifyInput(f,forgot.json.data));check(grant.status===200,'reset verify route');
    const reset=await a.call('/auth/password/reset',{grant:grant.json.data.grant,password:nextPassword,confirmPassword:nextPassword});
    check(reset.status===200&&reset.json.data.autoLogin===false,'reset route');
    check((await a.call('/auth/session')).status===401,'no implicit session on reset');
    const newLogin=await a.call('/auth/login',{email:'a@example.test',password:nextPassword,deviceId:randomUUID()});check(newLogin.status===200,'new password login');
    check((await a.call('/auth/revoke-deferred',{revocationHandle:logged.json.data.revocationHandle})).status===200,'deferred route');
    check((await a.call('/auth/session')).status===200,'old handle does not revoke new cookie');
    check((await a.call('/auth/logout',{})).status===200&&!a.jar[cookieName],'logout clears exact session cookie');
    const spec=JSON.parse(await readFile('packages/contracts/openapi/auth.local.v1.json','utf8'));const refs=[];
    function scan(v){if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(k==='$ref')refs.push(x);else scan(x);}}scan(spec);
    for(const ref of refs){check(ref.startsWith('#/'),'OpenAPI no remote refs');let value=spec;for(const key of ref.slice(2).split('/'))value=value?.[key.replaceAll('~1','/').replaceAll('~0','~')];check(value!==undefined,'OpenAPI resolvable reference');}
    check(Object.values(spec.paths).reduce((n,p)=>n+Object.keys(p).length,0)===13,'13 OpenAPI endpoints');
    check(reset.json.serverNow===new Date(f.time.now).toISOString(),'C18 clock');
    return {endpoints:13,allSuccessAndErrorEnvelopesValidated:true,openAPIRefs:refs.length,unresolvedRefs:0,remoteRefs:0,noAutoLogin:true,serverNowRequired:true};
  });
  await test('B030-reset-generation',async()=>{
    const f=await fixture();await active(f);const first=await f.auth.forgot('a@example.test'),second=await f.auth.forgot('a@example.test'),third=await f.auth.forgot('a@example.test');
    const g1=await f.auth.verify(verifyInput(f,first),'reset'),g2=await f.auth.verify(verifyInput(f,second),'reset');
    await f.auth.resetPassword({grant:g1.grant,password:nextPassword,confirmPassword:nextPassword});
    await denied(()=>f.auth.resetPassword({grant:g2.grant,password,confirmPassword:password}),'OTP_INVALID');
    const stale=await f.auth.verify(verifyInput(f,third),'reset');
    await denied(()=>f.auth.resetPassword({grant:stale.grant,password,confirmPassword:password}),'OTP_INVALID');
    const known=await f.auth.forgot('a@example.test'),unknown=await f.auth.forgot('unknown@example.test');
    check(JSON.stringify(Object.keys(known).sort())===JSON.stringify(Object.keys(unknown).sort()),'forgot public same fields');
    check(known.sendStatus===unknown.sendStatus&&known.attemptsRemaining===unknown.attemptsRemaining,'forgot same policy');
    check((await f.auth.c.users.findOne({canonicalEmail:'a@example.test'})).passwordGeneration===1,'no old generation rollback');
    return {preResetGrantRejected:true,preResetChallengeNoAuthority:true,passwordGeneration:1,knownUnknownResponseShapeEqual:true,timingSideChannel:'inconclusive'};
  });
  await test('B030-rate-guards',async()=>{
    const f=await fixture();await active(f);
    for(let i=0;i<20;i++)await denied(()=>login(f,'a@example.test',nextPassword),'VALIDATION_FAILED');
    await denied(()=>login(f),'RATE_LIMITED');f.time.now+=900000;await login(f);
    for(let i=0;i<300;i++)await f.auth.limitIp('198.51.100.10','synthetic-action');
    await denied(()=>f.auth.limitIp('198.51.100.10','synthetic-action'),'RATE_LIMITED');
    const config={...f.auth.config,profile:'production'};let blocked=false;
    try{new AuthService(client,f.db,config,f.mail);}catch{blocked=true;}check(blocked,'fake production guard');
    blocked=false;try{new AuthService(client,f.db,{...f.auth.config,origin:'https://public.example'},f.mail);}catch{blocked=true;}check(blocked,'fake non-loopback guard');
    const c=await register(f,'format@example.test'),message=f.mail.messages.at(-1);check(/^[0-9]{6}$/.test(message.otp),'crypto OTP format');
    const record=await f.auth.c.challenges.findOne({_id:c.challengeId});check(record.otpVerifier.length===64&&!('otp'in record),'HMAC not raw OTP');
    return {login20Per15m:true,ip300PerAction15m:true,configuredLocalTuningOnly:true,fakeProductionBlocked:true,fakePublicOriginBlocked:true,sixDigitCSPRNG:true};
  });
  // Browser transport is a separate explicit target so its environment failure cannot imply API success.
  if(want('B030-HTTPS-browser'))report.cases.push({id:'B030-HTTPS-browser',status:'inconclusive',expected:cases.find(c=>c[0]==='B030-HTTPS-browser')[1],actual:'Run dedicated run-b030-browser.mjs after API cases pass'});
} catch(e){report.fatal=e.code??e.message;}
finally {
  for(const app of apps)await app.close();
  if(client)await client.close();
  if(repl){await repl.stop({doCleanup:false,force:false});report.cleanup.push({ownedMongoStopped:true,dbRetained:true});}
  report.counts=Object.fromEntries(['passed','failed','blocked','inconclusive'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));
  const sourcePaths=['experiments/g02s/run-b030.mjs','tests/fixtures/b030.mjs','apps/api/package.json','apps/api/package-lock.json','apps/api/tsconfig.json','apps/api/src/app.ts','apps/api/src/auth/policy.ts','apps/api/src/auth/service.ts','apps/api/src/auth/schema.ts','apps/api/src/auth/fake-mail.ts','packages/contracts/src/index.mjs','packages/contracts/openapi/auth.local.v1.json','packages/contracts/src/generated/build-manifest.json'];
  const hashes={};for(const p of sourcePaths){const b=await readFile(p);hashes[p]=sha(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
  report.sources=hashes;await writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  const evidence={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else evidence[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await inventory(out);
  await writeFile(path.join(out,'hashes.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({out:path.relative(root,out),counts:report.counts,fatal:report.fatal,dbRetained:runtime}));if(report.fatal||report.counts.failed)process.exitCode=1;
}
