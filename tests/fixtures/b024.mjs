import {setupB021,outputB021,commitB021} from './b021.mjs';
import {SyncCoordinator} from '../../apps/web/src/local/sync.ts';
import {WriterCoordinator} from '../../apps/web/src/local/writer.ts';
import {LocalStore} from '../../apps/web/src/local/store.ts';
import {STORES,request,finished} from '../../apps/web/src/local/idb.ts';
import {canonicalJson,mutationHash,collectVersionArtifacts} from '../../packages/data-format/src/index.mjs';
const id=()=>crypto.randomUUID(),healthy={network:'online',server:'reachable',auth:'valid'};
const check=(v,m)=>{if(!v)throw Error(m);};
const expect=async(fn,code)=>{try{await fn();throw Error('Expected '+code);}catch(e){check(e.code===code,'Expected '+code+', actual '+(e.code??e.name));}};
export function fakeAck(declaration,{acknowledge=declaration.mutations.map(m=>m.mutationId),reject=[],conflict=false}={}){
 const chosen=new Set(acknowledge),rejected=new Set(reject);
 return {batchId:declaration.batchId,status:chosen.size===declaration.mutations.length?'committed':chosen.size===0&&rejected.size===declaration.mutations.length?'rejected':'partial',acknowledged:declaration.mutations.filter(m=>chosen.has(m.mutationId)).map((m,i)=>({mutationId:m.mutationId,payloadHash:m.payloadHash,entityIds:[m.entityId],artifactIds:collectVersionArtifacts(m,declaration.artifacts).map(a=>a.artifactId),revisions:[{entityId:m.entityId,revision:1},{entityId:m.payload.expectedHead.branchId,revision:i+1}],outcome:conflict?'conflictPreserved':'committed',conflictRefs:conflict?[{kind:'branch',entityId:id(),conflictOf:m.payload.expectedHead.branchId}]:[]})),pending:declaration.mutations.filter(m=>!chosen.has(m.mutationId)&&!rejected.has(m.mutationId)).map(m=>({mutationId:m.mutationId,code:'ARTIFACT_NOT_READY',retryable:true})),rejected:declaration.mutations.filter(m=>rejected.has(m.mutationId)).map(m=>({mutationId:m.mutationId,code:'RESOURCE_DELETED'})),cursor:null,serverGeneration:declaration.serverGeneration,requestId:'b024-fake-local'};
}
export async function setupB024(count=2){
 const f=await setupB021();f.coordinator=new WriterCoordinator(f.store);f.lease=await f.coordinator.acquire(f.projectId);f.writerFence=f.lease.fence;f.localGeneration=f.lease.generation;f.sync=new SyncCoordinator(f.store);await f.sync.initialize(healthy);f.outputs=[];
 for(let i=0;i<count;i++){const o=await outputB021(f,{source:f.outputs.at(-1)?.version.versionId??null,value:i});await f.lease.run(()=>commitB021(f,o));f.outputs.push(o);}
 return f;
}
export async function disposeB024(f){await f.sync.quiesce();await f.coordinator.dispose();f.store.close();}
async function putOutbox(f,record){const tx=f.store.db.transaction('outbox','readwrite'),done=finished(tx);tx.objectStore('outbox').put(record);await done;}
async function cloneQueueMember(f,original,groupId=original.commitId){
 const o=structuredClone(original);o.id=id();o.mutation.mutationId=o.id;o.mutation.entityId=id();o.mutation.payload.version.versionId=o.mutation.entityId;o.commitId=groupId;o.mutation.payloadHash=await mutationHash(o.mutation,o.artifactDescriptors);await putOutbox(f,o);return o;
}
export async function runB024Checks(){
 const results=[];async function test(id,expected,fn){try{results.push({id,expected,status:'passed',actual:await fn()});}catch(e){results.push({id,expected,status:'failed',actual:{code:e.code??e.name,message:e.message}});}}
 await test('B024-awaiting-empty','Offline closes gate durably with no outbox; healthy/reauth/refresh/empty sync cannot reopen',async()=>{
  const f=await setupB024(0);try{
   await f.sync.report('offline');await f.sync.report('healthy');await f.sync.report('reauthenticated');
   const reopened=new SyncCoordinator(f.store);await reopened.initialize(healthy);let calls=0;const empty=await reopened.sync('user',async d=>{calls++;return fakeAck(d);});
   const state=await f.store.inspect('state','sync');reopened.close();
   check(state.syncGate==='awaitingUser'&&calls===0&&empty.status==='emptyOrWaiting','empty flag retained');
   return {syncGate:state.syncGate,transportCalls:0,persistedAcrossCoordinatorReopen:true};
  }finally{await disposeB024(f);}
 });
 await test('B024-refresh-observes-outage','Reopening an existing auto account offline persists awaitingUser even when its outbox is empty',async()=>{
  const f=await setupB024(0);let reopened;try{
   check((await f.store.inspect('state','sync')).syncGate==='auto','initial clean auto');
   reopened=new SyncCoordinator(f.store);await reopened.initialize({...healthy,network:'offline'});
   const state=await f.store.inspect('state','sync');check(state.syncGate==='awaitingUser'&&state.network==='offline','refresh observation persisted');
   await reopened.report('healthy');let calls=0;await reopened.sync('auto',async d=>{calls++;return fakeAck(d);});
   check(calls===0&&(await f.store.inspect('state','sync')).syncGate==='awaitingUser','healthy does not erase refresh outage');
   return {existingAutoBecameAwaiting:true,emptyPending:0,autoTransportCalls:0};
  }finally{reopened?.close();await disposeB024(f);}
 });
 await test('B024-service-auth','Mail/AI errors do not close healthy core; auth expiry preserves local data/generation and reauth does not clear prior gate',async()=>{
  const f=await setupB024(1);try{
   await f.sync.report('mailUnavailable');await f.sync.report('aiUnavailable');check((await f.store.inspect('state','sync')).syncGate==='auto','separate service no core outage');
   const generation=(await f.store.inspect('state','account')).localGeneration;await f.sync.report('authExpired');let calls=0;await expect(()=>f.sync.sync('user',async d=>{calls++;return fakeAck(d);}),'SESSION_EXPIRED');
   await f.sync.report('reauthenticated');const state=await f.store.inspect('state','sync'),account=await f.store.inspect('state','account');
   check(calls===0&&state.syncGate==='awaitingUser'&&account.localGeneration===generation&&(await f.store.inspect('outbox')).length===1,'auth no clear/no reopen');
   return {mailAI503CoreUnaffected:true,needsReauthPreservesLocal:true,generationUnchanged:true,transportCalls:0,gate:'awaitingUser'};
  }finally{await disposeB024(f);}
 });
 await test('B024-snapshot-new-item','ACK only captured members, new writer commit during transport remains pending; dependency order/hash stable',async()=>{
  const f=await setupB024(2);try{
   let selected,late;const result=await f.sync.sync('user',async d=>{
    selected=structuredClone(d);late=await outputB021(f,{source:f.outputs.at(-1).version.versionId,value:9});await f.lease.run(()=>commitB021(f,late));return fakeAck(d);
   });
   const outbox=await f.store.inspect('outbox'),pending=outbox.filter(o=>o.status==='pending'),acked=outbox.filter(o=>o.status==='acknowledged');
   check(result.status==='committed'&&selected.mutations.length===2&&pending.length===1&&pending[0].id===late.snapshot.mutationId&&acked.length===2,'membership exact');
   check((await f.store.inspect('state','sync')).sync!=='synced','account with newer pending must not claim synced');
   const second=selected.mutations.find(m=>m.mutationId===f.outputs[1].snapshot.mutationId);check(second.payload.expectedHead.fromMutationId===f.outputs[0].snapshot.mutationId,'offline dependency ref stable');
   const hashes=await Promise.all(selected.mutations.map(m=>mutationHash(m,collectVersionArtifacts(m,[...selected.artifacts].reverse()))));check(hashes.every((h,i)=>h===selected.mutations[i].payloadHash),'global order independent typed reconstruction');
   return {captured:2,acknowledged:2,newPending:1,syncGate:result.syncGate,sourceRefsAndPointersNotRebound:true,globalArtifactOrderReconstructed:true};
  }finally{await disposeB024(f);}
 });
 await test('B024-partial-retry','Partial ACK remains awaiting; auto does not retry; user retry keeps remaining mutation IDs/hashes',async()=>{
  const f=await setupB024(2);try{
   let first,second,calls=0;const partial=await f.sync.sync('user',async d=>{calls++;first=d;return fakeAck(d,{acknowledge:[d.mutations[0].mutationId]});});
   await f.sync.sync('auto',async d=>{calls++;return fakeAck(d);});check(calls===1&&partial.status==='partial'&&partial.syncGate==='awaitingUser','no partial auto retry');
   const complete=await f.sync.sync('user',async d=>{calls++;second=d;return fakeAck(d);});
   check(complete.status==='committed'&&second.mutations.length===1&&first.mutations.some(m=>m.mutationId===second.mutations[0].mutationId&&m.payloadHash===second.mutations[0].payloadHash),'stable retry remaining');
   return {firstCaptured:2,firstAck:1,secondCaptured:1,transportCalls:calls,autoRetry:false,remainingMutationIdentityStable:true};
  }finally{await disposeB024(f);}
 });
 await test('B024-lost-ACK','Transport lost response closes gate; healthy alone does not resend, explicit retry reuses immutable mutation identity',async()=>{
  const f=await setupB024(1);try{
   let first,calls=0;try{await f.sync.sync('user',async d=>{calls++;first=d;throw {status:504,transportFailure:true};});}catch{}
   await f.sync.report('healthy');await f.sync.sync('auto',async d=>{calls++;return fakeAck(d);});check(calls===1,'no retry on healthy');
   await f.sync.sync('user',async d=>{calls++;check(d.mutations[0].mutationId===first.mutations[0].mutationId&&d.mutations[0].payloadHash===first.mutations[0].payloadHash,'same ID/hash retry');return fakeAck(d);});
   return {transportCalls:2,automaticRetry:false,mutationIdentityStable:true,serverDeduplicationProof:false};
  }finally{await disposeB024(f);}
 });
 await test('B024-invalid-ACK','Unknown/duplicate/missing/hash/generation ACK rejected without marking pending items complete',async()=>{
  const observations=[];
  for(const variant of ['unknown','duplicate','missing','hash','generation']){
   const f=await setupB024(2);try{
    const expected=variant==='hash'?'IDEMPOTENCY_MISMATCH':variant==='generation'?'RECONCILIATION_REQUIRED':'VALIDATION_FAILED';
    await expect(()=>f.sync.sync('user',async d=>{
     const ack=fakeAck(d);
     if(variant==='unknown')ack.acknowledged[0].mutationId=id();
     if(variant==='duplicate')ack.pending.push({mutationId:ack.acknowledged[0].mutationId,code:'ARTIFACT_NOT_READY',retryable:true});
     if(variant==='missing'){ack.acknowledged.pop();ack.status='partial';}
     if(variant==='hash')ack.acknowledged[0].payloadHash='f'.repeat(64);
     if(variant==='generation')ack.serverGeneration=id();
     return ack;
    }),expected);
    check((await f.store.inspect('outbox')).every(o=>o.status==='pending'),'bad ACK atomic no updates');observations.push({variant,code:expected,pending:2});
   }finally{await disposeB024(f);}
  }
  return {observations};
 });
 await test('B024-atomic-group','No half ACK of a two-mutation synthetic atomic group, all records preserved',async()=>{
  const f=await setupB024(1);try{
   const original=(await f.store.inspect('outbox'))[0];await cloneQueueMember(f,original);
   await expect(()=>f.sync.sync('user',async d=>fakeAck(d,{acknowledge:[d.mutations[0].mutationId]})),'VALIDATION_FAILED');
   check((await f.store.inspect('outbox')).every(o=>o.status==='pending'),'no partial atomic group ACK');
   return {groupSize:2,halfAckRejected:true,pending:2,syntheticQueueOnly:true,serverAtomicityProof:false};
  }finally{await disposeB024(f);}
 });
 await test('B024-delete-conflict-reconcile','Deleted stays local blockedDeleted; conflict ACK does not rebind context; expired receipt response gates reconciliation',async()=>{
  const deleted=await setupB024(1);try{
   await deleted.sync.sync('user',async d=>fakeAck(d,{acknowledge:[],reject:[d.mutations[0].mutationId]}));
   check((await deleted.store.inspect('outbox'))[0].status==='blockedDeleted'&&(await deleted.store.inspect('versions')).length===1,'deleted retains data');
  }finally{await disposeB024(deleted);}
  const conflict=await setupB024(1);try{
   const before=canonicalJson(await conflict.store.inspect('contexts',conflict.projectId));const result=await conflict.sync.sync('user',async d=>fakeAck(d,{conflict:true}));
   check(result.syncGate==='auto'&&canonicalJson(await conflict.store.inspect('contexts',conflict.projectId))===before,'conflict no implicit rebind');
  }finally{await disposeB024(conflict);}
  const expired=await setupB024(1);try{
   await expired.sync.sync('user',async d=>{const ack=fakeAck(d,{acknowledge:[]});ack.pending[0].code='CURSOR_EXPIRED';return ack;});
   let calls=0;await expect(()=>expired.sync.sync('user',async d=>{calls++;return fakeAck(d);}),'RECONCILIATION_REQUIRED');
   check(calls===0&&(await expired.store.inspect('outbox'))[0].status==='pending','expired not treated as new');
  }finally{await disposeB024(expired);}
  return {blockedDeletedRetainsVersion:true,conflictNoPointerRebind:true,expiredRequiresReconcile:true};
 });
 await test('B024-late-generation-gate','New outage during request prevents ACK reopening gate; account close prevents stale ACK; duplicate old ACK cannot open a later closed gate',async()=>{
  const f=await setupB024(1);try{
   let declaration,ack;const result=await f.sync.sync('user',async d=>{declaration=d;ack=fakeAck(d);await f.sync.report('offline');return ack;});
   check(result.syncGate==='awaitingUser','new outage cannot be erased');
   const duplicate=await f.sync.applyAck(declaration.batchId,ack);check(duplicate.status==='duplicateIgnored'&&(await f.store.inspect('state','sync')).syncGate==='awaitingUser','duplicate old gate unchanged');
  }finally{await disposeB024(f);}
  const closed=await setupB024(1);try{
   await expect(()=>closed.sync.sync('user',async d=>{await closed.store.closeAccount(closed.localGeneration);return fakeAck(d);}),'SESSION_REVOKED');
   check((await closed.store.inspect('outbox'))[0].status==='pending','late account ACK no write');
  }finally{await disposeB024(closed);}
  return {newOutagePreserved:true,duplicateOldAckIgnored:true,lateGenerationAckRejected:true};
 });
 await test('B024-inflight-immutable','Rewritten queued content with same hash or appended member of captured atomic group cannot be falsely ACKed',async()=>{
  const changed=await setupB024(1);try{
   await expect(()=>changed.sync.sync('user',async d=>{const o=(await changed.store.inspect('outbox'))[0];o.mutation.payload.version.operationSnapshot.params.changed=true;await putOutbox(changed,o);return fakeAck(d);}),'IDEMPOTENCY_MISMATCH');
   check((await changed.store.inspect('outbox'))[0].status==='pending','same hash rewritten payload stays pending');
  }finally{await disposeB024(changed);}
  const appended=await setupB024(1);try{
   await expect(()=>appended.sync.sync('user',async d=>{await cloneQueueMember(appended,(await appended.store.inspect('outbox'))[0]);return fakeAck(d);}),'RECONCILIATION_REQUIRED');
   check((await appended.store.inspect('outbox')).every(o=>o.status==='pending'),'captured group membership drift no half ACK');
  }finally{await disposeB024(appended);}
  return {sameHashPayloadRewriteRejected:true,atomicGroupAppendRejected:true,pendingDataRetained:true};
 });
 await test('B024-server-generation-change','Account server generation changed during transport rejects an otherwise matching old ACK and retains pending bytes',async()=>{
  const f=await setupB024(1);try{
   await expect(()=>f.sync.sync('user',async d=>{
    const account=await f.store.inspect('state','account'),tx=f.store.db.transaction('state','readwrite'),done=finished(tx);
    tx.objectStore('state').put({...account,serverGeneration:id()});await done;return fakeAck(d);
   }),'RECONCILIATION_REQUIRED');
   check((await f.store.inspect('outbox'))[0].status==='pending'&&(await f.store.inspect('state','sync')).reconciliationRequired,'stale generation no receipt');
   check((await f.store.openVersion(f.outputs[0].version.versionId)).status==='ready','local refs retained');
   return {staleGenerationAckRejected:true,pendingRetained:true,localReopen:'ready'};
  }finally{await disposeB024(f);}
 });
 await test('B024-close-before-account-lock','Closing while preparation waits for account lock prevents transport dispatch',async()=>{
  const f=await setupB024(1);let release;try{
   let entered;const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
   const blocker=navigator.locks.request('dashboard:account:'+f.ownerId,async()=>{entered();await hold;});await started;
   let calls=0;const run=f.sync.sync('user',async d=>{calls++;return fakeAck(d);});
   // The queued callback must recheck disposal even if sync() was called while open.
   f.sync.close();release();await blocker;await expect(()=>run,'SESSION_REVOKED');await f.sync.quiesce();
   check(calls===0&&(await f.store.inspect('outbox'))[0].status==='pending','disposed coordinator no send');
   return {transportCalls:0,pendingRetained:true};
  }finally{release?.();await disposeB024(f);}
 });
 await test('B024-transport-dispose','Disposed coordinator aborts transport signal, waits explicit quiescence, never applies late ACK or clears local data',async()=>{
  const f=await setupB024(1);try{
   let release,signal,started;const latch=new Promise(r=>started=r),gate=new Promise(r=>release=r);
   const running=f.sync.sync('user',async(d,options)=>{signal=options.signal;started();await gate;return fakeAck(d);});await latch;f.sync.close();check(signal.aborted,'transport abort signal');
   release();await expect(()=>running,'SESSION_REVOKED');await f.sync.quiesce();check((await f.store.inspect('outbox'))[0].status==='pending','late ACK not applied');
   return {signalAborted:true,lateAckRejected:true,localDataRetained:true};
  }finally{await disposeB024(f);}
 });
 await test('B024-batch-bounds','101 real local outputs split at100 without losing dependency order; group21 rejected and metadata>1MiB blocked before transport',async()=>{
  const f=await setupB024(101);try{
   const sizes=[];await f.sync.sync('user',async d=>{sizes.push(d.mutations.length);return fakeAck(d);});await f.sync.sync('auto',async d=>{sizes.push(d.mutations.length);return fakeAck(d);});
   check(sizes[0]===100&&sizes[1]===1&&(await f.store.inspect('outbox')).every(o=>o.status==='acknowledged'),'batch100 split');
  }finally{await disposeB024(f);}
  for(const size of [19,20]){
   const allowed=await setupB024(1);try{
    const original=(await allowed.store.inspect('outbox'))[0];for(let i=1;i<size;i++)await cloneQueueMember(allowed,original);
    const result=await allowed.sync.sync('user',async d=>{check(d.atomicGroups.length===1&&d.atomicGroups[0].mutationIds.length===size,'intact group');return fakeAck(d);});check(result.acknowledged===size,'group boundary accepted');
   }finally{await disposeB024(allowed);}
  }
  const group=await setupB024(1);try{
   const original=(await group.store.inspect('outbox'))[0];for(let i=0;i<20;i++)await cloneQueueMember(group,original);
   let calls=0;await expect(()=>group.sync.sync('user',async d=>{calls++;return fakeAck(d);}),'RESOURCE_LIMIT_EXCEEDED');check(calls===0,'group21 not sent');
  }finally{await disposeB024(group);}
  const huge=await setupB024(1);try{
   const record=(await huge.store.inspect('outbox'))[0];record.mutation.payload.version.operationSnapshot.params.text='x'.repeat(1048576);record.mutation.payloadHash=await mutationHash(record.mutation,record.artifactDescriptors);await putOutbox(huge,record);
   let calls=0;await expect(()=>huge.sync.sync('user',async d=>{calls++;return fakeAck(d);}),'PAYLOAD_TOO_LARGE');check(calls===0,'oversize metadata not sent');
  }finally{await disposeB024(huge);}
  return {batchSizes:[100,1],groupSizes19And20Accepted:true,group21TransportCalls:0,oversizeMetadataTransportCalls:0,noBusinessVersionCountCap:true};
 });
 await test('B024-metadata-boundary','Exact canonical declaration byte cap−1/equal accepted and +1 rejected before transport (synthetic queued metadata)',async()=>{
  const observations=[];
  for(const delta of [-1,0,1]){
   const f=await setupB024(1);try{
    const o=(await f.store.inspect('outbox'))[0];o.mutation.payload.version.operationSnapshot.params.text='';
    const declaration={schemaVersion:1,batchId:id(),serverGeneration:f.serverGeneration,mutations:[o.mutation],artifacts:o.artifactDescriptors,atomicGroups:[{groupId:o.commitId,mutationIds:[o.id]}]};
    const base=new TextEncoder().encode(canonicalJson(declaration)).length;
    o.mutation.payload.version.operationSnapshot.params.text='x'.repeat(1048576-base+delta);o.mutation.payloadHash=await mutationHash(o.mutation,o.artifactDescriptors);await putOutbox(f,o);
    let calls=0;const run=()=>f.sync.sync('user',async d=>{calls++;check(new TextEncoder().encode(canonicalJson(d)).length===1048576+delta,'exact metadata size');return fakeAck(d);});
    if(delta===1)await expect(run,'PAYLOAD_TOO_LARGE');else await run();
    check(calls===(delta===1?0:1),'metadata bound no send');
    observations.push({bytes:1048576+delta,transportCalls:calls,status:delta===1?'blocked':'accepted'});
   }finally{await disposeB024(f);}
  }
  return {observations,syntheticQueueOnly:true};
 });
 await test('B024-v1-migration','Additive v1→v2 indexes/journal preserve bytes/version/head/history/outbox hash; old reader fails without deleting data',async()=>{
  const f=await setupB024(1);let upgraded;
  try{
   const namespace='b024-legacy-'+id(),name=namespace+'-'+f.ownerId,open=indexedDB.open(name,1);open.onupgradeneeded=()=>{for(const s of STORES)open.result.createObjectStore(s,{keyPath:'id'});};const legacy=await request(open);
   for(const s of STORES){const records=await f.store.inspect(s),tx=legacy.transaction(s,'readwrite'),done=finished(tx);for(const record of records)if(record.id!=='migration:2')tx.objectStore(s).put(record);await done;}legacy.close();
   const before=canonicalJson((await f.store.inspect('outbox'))[0].mutation);upgraded=await LocalStore.open(f.ownerId,{namespace});
   check(upgraded.db.version===2&&(await upgraded.inspect('state','migration:2')).fromVersion===1,'additive journal');
   check(canonicalJson((await upgraded.inspect('outbox'))[0].mutation)===before&&(await upgraded.inspect('versions')).length===1&&(await upgraded.inspect('history')).length===1&&(await upgraded.inspect('markers')).length===1,'unsynced metadata preserved');
   const tx=upgraded.db.transaction('outbox'),done=finished(tx),pending=await request(tx.objectStore('outbox').index('status').count('pending'));await done;check(pending===1,'index populated');
   let rejected=false;try{await request(indexedDB.open(name,1));}catch(e){rejected=e.name==='VersionError';}check(rejected,'old reader version mismatch');
   check((await upgraded.openVersion(f.outputs[0].version.versionId)).status==='ready','bytes/hash reopen after upgrade');
   return {from:1,to:2,journal:'complete',pending:1,hashAndMetadataPreserved:true,byteReopen:'ready',oldReader:'VersionError',dataDeleted:false};
  }finally{upgraded?.close();await disposeB024(f);}
 });
 return results;
}
