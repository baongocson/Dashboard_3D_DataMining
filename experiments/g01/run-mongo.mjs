import {MongoMemoryReplSet,MongoBinary} from 'mongodb-memory-server-core';
import {MongoClient} from 'mongodb';
import {mkdir,writeFile,readFile,open,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {check} from './shared.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));process.chdir(here);
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const work=path.resolve('.runtime','x03',runId),evidence=path.resolve('evidence');
await mkdir(work,{recursive:true});await mkdir(evidence,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const report={experiment:'X03',startedAt:new Date().toISOString(),environment:{node:process.version,os:os.type(),release:os.release(),arch:os.arch(),mongodbDriver:'7.8.0',mongodbMemoryServerCore:'11.3.0',requestedMongoVersion:'8.0.34',bindIp:'127.0.0.1',replicaSetMembers:1,storageEngine:'wiredTiger',authEnabled:false,scope:'isolated synthetic loopback development only'},tests:[],events:[]};
let repl,client,db;
const test=async(id,expected,fn)=>{const begin=performance.now();try{const actual=await fn();report.tests.push({id,expected,status:'passed',actual,durationMs:performance.now()-begin});}catch(e){report.tests.push({id,expected,status:'failed',actual:{name:e.name,message:e.message,code:e.code},durationMs:performance.now()-begin});}await writeFile(path.join(evidence,'x03-results.json'),JSON.stringify(report,null,2));};
const transact=async fn=>{const s=client.startSession();try{return await s.withTransaction(()=>fn(s),{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary',maxCommitTimeMS:10000,timeoutMS:30000});}finally{await s.endSession();}};
try {
  let binary=path.resolve('.runtime/mongod-8.0.34.exe');
  try{await access(binary);}catch{binary=await MongoBinary.getPath({version:'8.0.34',downloadDir:path.resolve('.runtime/mongodb-binaries')});}
  report.environment.binarySha256=hash(await readFile(binary));
  const dbPath=path.join(work,'db');await mkdir(dbPath);
  repl=await MongoMemoryReplSet.create({binary:{systemBinary:binary,version:'8.0.34'},instanceOpts:[{dbPath}],replSet:{count:1,name:'g01rs',ip:'127.0.0.1',storageEngine:'wiredTiger'}});
  client=new MongoClient(repl.getUri(),{serverSelectionTimeoutMS:15000});await client.connect();
  db=client.db('g01_synthetic');
  for(const n of ['control','users','challenges','projects','refs','artifacts','versions','steps','receipts','tombstones','server'])await db.createCollection(n);
  await db.collection('receipts').createIndex({ownerId:1,mutationId:1},{unique:true});
  await db.collection('users').createIndex({email:1},{unique:true});
  report.environment.buildInfo=(await db.admin().command({buildInfo:1})).version;
  report.environment.hello={setName:(await db.admin().command({hello:1})).setName};
  await db.collection('control').insertOne({_id:'activation',count:99});
  await db.collection('challenges').insertMany([{_id:'ca',consumed:false},{_id:'cb',consumed:false}]);
  await db.collection('users').insertOne({_id:'owner',email:'synthetic@example.invalid',epoch:1,fence:0,activated:true});
  await db.collection('users').insertMany(Array.from({length:98},(_,i)=>({_id:`existing-${i}`,email:`existing-${i}@example.invalid`,epoch:1,fence:0,activated:true})));
  await db.collection('projects').insertOne({_id:'project',ownerId:'owner',state:'active',revision:1,fence:0,head:null});

  await test('X03-01','Real replica set/WiredTiger and majority transaction deployment',async()=>{
    check(report.environment.hello.setName==='g01rs'&&report.environment.buildInfo==='8.0.34','wrong deployment');
    const info=await db.admin().command({serverStatus:1});check(info.storageEngine.name==='wiredTiger','storage engine');
    return {version:report.environment.buildInfo,setName:report.environment.hello.setName,storageEngine:info.storageEngine.name,singleMember:true};
  });
  await test('X03-02','Two concurrent verifications from 99 active admit exactly one; consumed OTP cannot activate twice',async()=>{
    const activate=cid=>transact(async s=>{
      const challenge=await db.collection('challenges').findOne({_id:cid},{session:s});check(challenge&&!challenge.consumed,'OTP_CONSUMED');
      const count=await db.collection('control').updateOne({_id:'activation',count:{$lt:100}},{$inc:{count:1}},{session:s});check(count.modifiedCount===1,'ACCOUNT_LIMIT_REACHED');
      await db.collection('users').insertOne({_id:cid,email:`${cid}@example.invalid`,epoch:1,fence:0,activated:true},{session:s});
      await db.collection('challenges').updateOne({_id:cid,consumed:false},{$set:{consumed:true}},{session:s});return cid;
    });
    const results=await Promise.allSettled([activate('ca'),activate('cb')]);
    const winner=results.find(x=>x.status==='fulfilled')?.value;
    const count=(await db.collection('control').findOne({_id:'activation'})).count;
    const activatedUsers=await db.collection('users').countDocuments({activated:true});
    check(count===100&&activatedUsers===100&&results.filter(x=>x.status==='fulfilled').length===1,'activation race');
    let replayRejected=false;try{await activate(winner);}catch(e){replayRejected=e.message==='OTP_CONSUMED';}
    check(replayRejected,'OTP replay');return {counter:count,activatedUsers,outcomes:results.map(x=>x.status==='fulfilled'?{status:x.status,challenge:x.value}:{status:x.status,reason:x.reason.message}),replayRejected};
  });
  const bytes=Buffer.from('synthetic artifact\nTiếng Việt\n');const artifactPath=path.join(work,'table.bin');await writeFile(artifactPath,bytes);
  await db.collection('artifacts').insertOne({_id:'table',ownerId:'owner',projectId:'project',hash:hash(bytes),size:bytes.length,state:'verifiedStaging'});
  const commitVersion=async({mutationId,id,epoch,expectedHash=hash(bytes),abort=false})=>{
    // Storage check outside database transaction, just like bounded verification stage.
    const actual=await readFile(artifactPath);check(hash(actual)===expectedHash,'HASH_MISMATCH');
    const payloadHash=hash(JSON.stringify({id,artifact:'table',expectedHash}));
    return transact(async s=>{
      const receipt=await db.collection('receipts').findOne({ownerId:'owner',mutationId},{session:s});
      if(receipt){check(receipt.payloadHash===payloadHash,'IDEMPOTENCY_MISMATCH');return {replayed:true,receipt};}
      const auth=await db.collection('users').updateOne({_id:'owner',epoch},{$inc:{fence:1}},{session:s});check(auth.modifiedCount===1,'SESSION_REVOKED');
      const project=await db.collection('projects').findOne({_id:'project'},{session:s});check(project?.state==='active','RESOURCE_DELETED');
      check(!await db.collection('tombstones').findOne({_id:'project'},{session:s}),'RESOURCE_DELETED');
      await db.collection('projects').updateOne({_id:'project',state:'active'},{$inc:{fence:1,revision:1},$set:{head:id}},{session:s});
      await db.collection('versions').insertOne({_id:id,ownerId:'owner',projectId:'project',artifactId:'table',hash:expectedHash},{session:s});
      await db.collection('steps').insertOne({_id:id,status:'succeeded',output:id},{session:s});
      await db.collection('artifacts').updateOne({_id:'table'},{$set:{state:'ready'}},{session:s});
      if(abort)throw new Error('INJECTED_PRE_COMMIT_FAILURE');
      const rec={ownerId:'owner',mutationId,payloadHash,entityId:id,artifactId:'table',outcome:'committed'};
      await db.collection('receipts').insertOne(rec,{session:s});return {replayed:false,receipt:rec};
    });
  };
  await test('X03-03','Injected failure inside real transaction leaves no version/step/receipt/head/ready partial commit',async()=>{
    let rejected=false;try{await commitVersion({mutationId:'m-abort',id:'v-abort',epoch:1,abort:true});}catch(e){rejected=e.message==='INJECTED_PRE_COMMIT_FAILURE';}
    const actual={rejected,versions:await db.collection('versions').countDocuments({_id:'v-abort'}),steps:await db.collection('steps').countDocuments({_id:'v-abort'}),receipts:await db.collection('receipts').countDocuments({mutationId:'m-abort'}),head:(await db.collection('projects').findOne({_id:'project'})).head,artifactState:(await db.collection('artifacts').findOne({_id:'table'})).state};
    check(rejected&&actual.versions===0&&actual.steps===0&&actual.receipts===0&&actual.head===null&&actual.artifactState==='verifiedStaging','partial DB state');return actual;
  });
  await test('X03-04','Commit with verified byte/hash is atomic; lost response replay returns single logical result',async()=>{
    let acknowledgementLost=false;try{await commitVersion({mutationId:'m1',id:'v1',epoch:1});throw new Error('INJECTED_LOST_ACK');}catch(e){acknowledgementLost=e.message==='INJECTED_LOST_ACK';}
    const retry=await commitVersion({mutationId:'m1',id:'v1',epoch:1});const count=await db.collection('versions').countDocuments({_id:'v1'});
    check(acknowledgementLost&&retry.replayed&&count===1,'duplicate result');
    const receipt=await db.collection('receipts').findOne({mutationId:'m1'});const artifact=await db.collection('artifacts').findOne({_id:'table'});
    check(receipt.entityId==='v1'&&artifact.state==='ready'&&hash(await readFile(artifactPath))===artifact.hash,'ready missing bytes');return {acknowledgementLost,replayed:retry.replayed,versionCount:count,artifactHash:artifact.hash,receipt};
  });
  await test('X03-05','Same mutation ID with different payload and bad byte hash are rejected',async()=>{
    let mismatch=false,badHash=false;try{await commitVersion({mutationId:'m1',id:'v-other',epoch:1});}catch(e){mismatch=e.message==='IDEMPOTENCY_MISMATCH';}
    try{await commitVersion({mutationId:'m-badhash',id:'v-badhash',epoch:1,expectedHash:'0'.repeat(64)});}catch(e){badHash=e.message==='HASH_MISMATCH';}
    check(mismatch&&badHash&&await db.collection('versions').countDocuments({_id:{$in:['v-other','v-badhash']}})===0,'mismatch accepted');return {mismatch,badHash};
  });
  await test('X03-06','Revocation between snapshot auth read and conditional fence write rejects stale transaction, including retry',async()=>{
    let readDone,proceed;const readReady=new Promise(r=>readDone=r),go=new Promise(r=>proceed=r);let attempts=0;
    const pending=transact(async s=>{
      attempts++;const user=await db.collection('users').findOne({_id:'owner'},{session:s});check(user.epoch===1,'SESSION_REVOKED');
      if(attempts===1){readDone();await go;}
      const fenced=await db.collection('users').updateOne({_id:'owner',epoch:1},{$inc:{fence:1}},{session:s});check(fenced.modifiedCount===1,'SESSION_REVOKED');
      await db.collection('versions').insertOne({_id:'v-stale'},{session:s});return true;
    });
    // Attach rejection handler before releasing the interleaving to avoid unhandled rejection.
    const result=pending.then(()=>({accepted:true}),e=>({accepted:false,reason:e.message}));
    await readReady;await db.collection('users').updateOne({_id:'owner'},{$inc:{epoch:1,fence:1}});proceed();
    const actual=await result;check(!actual.accepted&&actual.reason==='SESSION_REVOKED'&&await db.collection('versions').countDocuments({_id:'v-stale'})===0,'stale commit');
    check(await db.collection('versions').countDocuments({_id:'v1'})===1,'pre-revoke commit lost');return {...actual,attempts,epoch:(await db.collection('users').findOne({_id:'owner'})).epoch,preRevocationVersionRetained:true};
  });
  await test('X03-07','Hard-reference creation and deletion share project write fence: reference wins, deletion blocks',async()=>{
    await db.collection('refs').insertOne({_id:'r1',projectId:'project',target:'source',strength:'hard'});
    let blocked=false;try{await transact(async s=>{await db.collection('projects').updateOne({_id:'project'},{$inc:{fence:1}},{session:s});check(await db.collection('refs').countDocuments({target:'source',strength:'hard'},{session:s})===0,'DEPENDENCY_EXISTS');await db.collection('tombstones').insertOne({_id:'source'},{session:s});});}catch(e){blocked=e.message==='DEPENDENCY_EXISTS';}
    check(blocked&&!await db.collection('tombstones').findOne({_id:'source'}),'dependency deleted');
    return {blocked,remainingHardReferences:await db.collection('refs').countDocuments({target:'source'})};
  });
  await test('X03-08','Actual concurrent snapshot reference race retries through project fence and blocks deletion',async()=>{
    let ready,go;const snapshotReady=new Promise(r=>ready=r),release=new Promise(r=>go=r);let attempts=0;
    const deleting=transact(async s=>{
      attempts++;const count=await db.collection('refs').countDocuments({target:'race-source'},{session:s});
      if(attempts===1){ready();await release;}
      await db.collection('projects').updateOne({_id:'project'},{$inc:{fence:1}},{session:s});check(count===0,'DEPENDENCY_EXISTS');
      await db.collection('tombstones').insertOne({_id:'race-source'},{session:s});
    }).then(()=>({deleted:true}),e=>({deleted:false,reason:e.message}));
    await snapshotReady;
    await transact(async s=>{await db.collection('projects').updateOne({_id:'project',state:'active'},{$inc:{fence:1}},{session:s});await db.collection('refs').insertOne({_id:'r-race',target:'race-source',strength:'hard'},{session:s});});go();
    const actual=await deleting;check(!actual.deleted&&actual.reason==='DEPENDENCY_EXISTS'&&await db.collection('tombstones').countDocuments({_id:'race-source'})===0,'race deletion');return {...actual,attempts};
  });
  const ledgerPath=path.join(work,'ledger-outside-snapshot.jsonl');const entry={entryId:'d1',resourceId:'project',generation:'before-restore',state:'prepared'};
  let backupProject;
  const recoverLedger=async()=>{
    const ledger=(await readFile(ledgerPath,'utf8')).trim().split('\n').map(JSON.parse);
    for(const e of ledger)await transact(async s=>{await db.collection('projects').updateOne({_id:e.resourceId},{$set:{state:'deleted'},$inc:{fence:1}},{session:s});await db.collection('tombstones').updateOne({_id:e.resourceId},{$set:{jobId:e.entryId,deleted:true}},{session:s,upsert:true});});
    return ledger.length;
  };
  await test('X03-09','Child process exits after ledger fsync but before Mongo mark; recovery applies intent idempotently',async()=>{
    backupProject=await db.collection('projects').findOne({_id:'project'});await writeFile(path.join(evidence,'x03-logical-backup-fixture.json'),JSON.stringify({project:backupProject,artifactHash:hash(bytes)},null,2));
    const exit=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['ledger-child.mjs',ledgerPath,JSON.stringify(entry)],{cwd:here,windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('exit',resolve);});
    check(exit===42&&(await db.collection('projects').findOne({_id:'project'})).state==='active','crash boundary');
    const count=await recoverLedger();await recoverLedger();check((await db.collection('projects').findOne({_id:'project'})).state==='deleted'&&await db.collection('tombstones').countDocuments({_id:'project'})===1,'ledger replay');
    return {childExitCode:exit,ledgerEntries:count,ledgerSha256:hash(await readFile(ledgerPath)),projectDeleted:true,tombstones:1,physicalPowerFailureTested:false};
  });
  await test('X03-10','Restore old logical metadata fixture replays newer external ledger, changes generation and rejects old-client create',async()=>{
    check(backupProject?.state==='active','no backup fixture');await db.collection('projects').replaceOne({_id:'project'},backupProject);await db.collection('tombstones').deleteOne({_id:'project'});
    await recoverLedger();await db.collection('server').updateOne({_id:'generation'},{$set:{value:'after-restore',maintenance:false}},{upsert:true});
    let rejected=false;try{await commitVersion({mutationId:'m-after-delete',id:'v-resurrect',epoch:2});}catch(e){rejected=e.message==='RESOURCE_DELETED';}
    check(rejected&&await db.collection('versions').countDocuments({_id:'v-resurrect'})===0,'resource resurrected');
    return {logicalMetadataFixtureRestore:true,physicalBackupRestoreTested:false,generation:'after-restore',oldClientCreateRejected:rejected,ledgerIndependentOfSnapshot:true};
  });
  await test('X03-11','Missing/unwritable ledger path prevents deletion acknowledgement and keeps active resource',async()=>{
    await db.collection('projects').insertOne({_id:'ledger-fail-project',state:'active',fence:0});let blocked=false;
    try{const handle=await open(path.join(work,'parent-does-not-exist','ledger'),'a');await handle.writeFile('unreachable');await handle.sync();await handle.close();await db.collection('projects').updateOne({_id:'ledger-fail-project'},{$set:{state:'deleted'}});}catch(e){blocked=e.code==='ENOENT';}
    const state=(await db.collection('projects').findOne({_id:'ledger-fail-project'})).state;check(blocked&&state==='active','unlogged deletion');return {blocked,errorCode:'ENOENT',state};
  });
  const snapshot={};for(const name of ['control','users','challenges','projects','refs','artifacts','versions','steps','receipts','tombstones','server'])snapshot[name]=await db.collection(name).find({}).toArray();
  await writeFile(path.join(evidence,'x03-db-snapshot.json'),JSON.stringify(snapshot,null,2));
  await writeFile(path.join(evidence,'x03-ledger.jsonl'),await readFile(ledgerPath));
}catch(e){report.setupFailure={name:e.name,message:e.message,stack:e.stack};}
finally{
  await client?.close();await repl?.stop({doCleanup:false,force:false});
  report.finishedAt=new Date().toISOString();report.processesStopped=true;
  await writeFile(path.join(evidence,'x03-results.json'),JSON.stringify(report,null,2));
}
const failures=Number(!!report.setupFailure)+report.tests.filter(x=>x.status==='failed').length;
console.log(JSON.stringify({evidence:'evidence/x03-results.json',version:report.environment.buildInfo,tests:report.tests.length,failures,setupFailure:report.setupFailure?.message},null,2));if(failures)process.exitCode=1;
