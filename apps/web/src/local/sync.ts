import {assertSchema,assertVersionCreateMutation,fail} from '../../../../packages/contracts/src/index.mjs';
import {canonicalJson,hashCanonical,mutationHash,collectVersionArtifacts} from '../../../../packages/data-format/src/index.mjs';
import {DEFAULT_LIMITS} from './resource-budget.ts';
import {transaction,request} from './idb.ts';
import {accountLock} from './writer.ts';
import type {LocalStore} from './store.ts';
import type {LocalRecord} from './idb.ts';
type RecordValue=Record<string,any>;
type Connectivity={network:'online'|'offline'|'unknown';server:'reachable'|'unreachable'|'maintenance';auth:'valid'|'expired'|'revoked'|'unknown'};
type Signal='offline'|'transportFailure'|'gateway502'|'gateway504'|'coreUnavailable'|'maintenance'|'authExpired'|'authRevoked'|'healthy'|'reauthenticated'|'mailUnavailable'|'aiUnavailable'|'validationFailure';
type Transport=(declaration:RecordValue,options:{signal:AbortSignal})=>Promise<RecordValue>;
const utf8Size=(value:unknown)=>new TextEncoder().encode(canonicalJson(value)).byteLength;
const unique=(values:string[])=>new Set(values).size===values.length;
const sorted=(values:string[])=>[...values].sort();
export function declarationOf(snapshot:RecordValue) {
 const {schemaVersion,batchId,serverGeneration,mutations,artifacts,atomicGroups}=snapshot;
 return {schemaVersion,batchId,serverGeneration,mutations,artifacts,atomicGroups};
}
export function validateAck(snapshot:RecordValue,ack:RecordValue,ownDescriptors:Map<string,RecordValue[]>) {
 assertSchema('sync-ack.json',ack);
 if(ack.batchId!==snapshot.batchId)fail('VALIDATION_FAILED');
 if(ack.serverGeneration!==snapshot.serverGeneration)fail('RECONCILIATION_REQUIRED');
 const members=new Map<string,RecordValue>(snapshot.mutations.map((m:RecordValue)=>[m.mutationId,m])),seen=new Map<string,string>();
 for(const [kind,items]of [['acknowledged',ack.acknowledged],['pending',ack.pending],['rejected',ack.rejected]] as const)for(const item of items){
   if(!members.has(item.mutationId)||seen.has(item.mutationId))fail('VALIDATION_FAILED');seen.set(item.mutationId,kind);
   if(kind==='acknowledged'){
     const mutation=members.get(item.mutationId)!;
     if(item.payloadHash!==mutation.payloadHash)fail('IDEMPOTENCY_MISMATCH');
     if(!unique(item.revisions.map((r:RecordValue)=>r.entityId)))fail('VALIDATION_FAILED');
     const expectedArtifacts=(ownDescriptors.get(item.mutationId)??[]).map(a=>a.artifactId);
     if(canonicalJson(sorted(expectedArtifacts))!==canonicalJson(sorted(item.artifactIds)))fail('VALIDATION_FAILED');
     if(item.outcome==='committed'&&(!item.entityIds.includes(mutation.entityId)||item.conflictRefs.length))fail('VALIDATION_FAILED');
     if(item.outcome==='conflictPreserved'&&(!item.conflictRefs.length||(!item.entityIds.includes(mutation.entityId)&&!item.conflictRefs.some((r:RecordValue)=>r.conflictOf===mutation.entityId&&item.entityIds.includes(r.entityId)))))fail('VALIDATION_FAILED');
   }
 }
 if(seen.size!==members.size)fail('VALIDATION_FAILED');
 for(const group of snapshot.atomicGroups){const count=group.mutationIds.filter((id:string)=>seen.get(id)==='acknowledged').length;if(count!==0&&count!==group.mutationIds.length)fail('VALIDATION_FAILED');}
 const full=ack.acknowledged.length===members.size;
 const expectedStatus=full?'committed':ack.acknowledged.length===0&&ack.pending.length===0?'rejected':'partial';
 if(ack.status!==expectedStatus)fail('VALIDATION_FAILED');
 return ack;
}
export class SyncCoordinator {
 readonly store:LocalStore;
 readonly channel:BroadcastChannel;
 private validators:Map<string,(value:RecordValue)=>unknown>;
 private closed=false;
 private abort=new AbortController();
 private inFlight=new Set<Promise<unknown>>();
 constructor(store:LocalStore,{validators=new Map([['dataset.version.create',assertVersionCreateMutation]])}:{validators?:Map<string,(value:RecordValue)=>unknown>}={}){
   this.store=store;this.validators=new Map(validators);this.channel=new BroadcastChannel('dashboard:sync:'+store.ownerId);
 }
 close(){this.closed=true;this.abort.abort();this.channel.close();}
 async quiesce(){this.close();await Promise.allSettled([...this.inFlight]);}
 private get(tx:IDBTransaction,store:'state'|'outbox',id:string):Promise<LocalRecord|undefined>{return request(tx.objectStore(store).get(id));}
 private announce(){this.channel.postMessage({type:'SYNC_STATE_CHANGED',ownerId:this.store.ownerId});}
 private async account(tx:IDBTransaction,generation?:number){
   const state=await this.get(tx,'state','account');
   if(!state||state.ownerId!==this.store.ownerId||state.mode!=='open'||(generation!==undefined&&state.localGeneration!==generation))fail('SESSION_REVOKED');
   return state;
 }
 private ready(state:RecordValue){
   if(state.reconciliationRequired)fail('RECONCILIATION_REQUIRED');
   if(state.auth==='expired')fail('SESSION_EXPIRED');if(state.auth==='revoked')fail('SESSION_REVOKED');if(state.auth!=='valid')fail('AUTH_REQUIRED');
   if(state.network!=='online'||state.server!=='reachable')fail('UPSTREAM_UNAVAILABLE');
 }
 async initialize(connectivity:Connectivity){
   if(this.closed)fail('SESSION_REVOKED');
   const result=await transaction(this.store.db,['state','outbox'],'readwrite',async tx=>{
     await this.account(tx);const old=await this.get(tx,'state','sync');
     if(old){
       // Refresh can be the first observer of an outage; persisting an old auto
       // state must not swallow that observation, even with an empty queue.
       const failure=connectivity.network==='offline'||connectivity.server!=='reachable'||['expired','revoked'].includes(connectivity.auth);
       if(!failure)return old;
       const next={...old,syncGate:'awaitingUser',gateRevision:old.gateRevision+1,
         network:connectivity.network==='offline'?'offline':old.network,
         server:connectivity.server!=='reachable'?connectivity.server:old.server,
         auth:['expired','revoked'].includes(connectivity.auth)?connectivity.auth:old.auth};
       assertSchema('local-sync-state.json',next);tx.objectStore('state').put(next);return next;
     }
     const pending=await request(tx.objectStore('outbox').index('status').count(IDBKeyRange.only('pending'))),deleted=await request(tx.objectStore('outbox').index('status').count(IDBKeyRange.only('blockedDeleted')));
     const state={id:'sync',ownerId:this.store.ownerId,...connectivity,syncGate:pending||deleted||connectivity.network==='offline'||connectivity.server!=='reachable'||['expired','revoked'].includes(connectivity.auth)?'awaitingUser':'auto',gateRevision:0,sync:'idle',reconciliationRequired:false,activeBatchId:null};
     assertSchema('local-sync-state.json',state);tx.objectStore('state').add(state);return state;
   });await this.recoverInterrupted();this.announce();return await this.store.inspect('state','sync')??result.value;
 }
 async recoverInterrupted(){
   if(this.closed)fail('SESSION_REVOKED');
   if(!navigator.locks)return {status:'readOnly'};
   return navigator.locks.request('dashboard:sync-lock:'+this.store.ownerId,{ifAvailable:true},async lock=>{
     if(!lock)return {status:'busy'};
     return transaction(this.store.db,['state'],'readwrite',async tx=>{
       const sync=await this.get(tx,'state','sync');if(!sync?.activeBatchId)return {status:'idle'};
       const snapshot=await this.get(tx,'state','snapshot:'+sync.activeBatchId);
       if(snapshot)tx.objectStore('state').put({...snapshot,status:'failed'});
       tx.objectStore('state').put({...sync,sync:'failed',syncGate:'awaitingUser',gateRevision:sync.gateRevision+1,activeBatchId:null});
       return {status:'interrupted',autoResume:false};
     });
   });
 }
 async report(signal:Signal){
   if(this.closed)fail('SESSION_REVOKED');
   const result=await transaction(this.store.db,['state'],'readwrite',async tx=>{
     const old=await this.get(tx,'state','sync');if(!old)fail('VALIDATION_FAILED');const next={...old};
     if(['mailUnavailable','aiUnavailable','validationFailure'].includes(signal))return old;
     if(signal==='healthy'){next.network='online';next.server='reachable';}
     else if(signal==='reauthenticated')next.auth='valid';
     else{
       next.syncGate='awaitingUser';next.gateRevision++;
       if(signal==='offline')next.network='offline';
       if(['transportFailure','gateway502','gateway504','coreUnavailable'].includes(signal))next.server='unreachable';
       if(signal==='maintenance')next.server='maintenance';
       if(signal==='authExpired')next.auth='expired';
       if(signal==='authRevoked')next.auth='revoked';
     }
     assertSchema('local-sync-state.json',next);tx.objectStore('state').put(next);return next;
   });this.announce();return result.value;
 }
 private declaration(records:LocalRecord[],groups:Map<string,LocalRecord[]>,batchId:string,generation:string) {
   const artifacts=new Map<string,RecordValue>();
   for(const o of records)for(const a of o.artifactDescriptors){const old=artifacts.get(a.artifactId);if(old&&canonicalJson(old)!==canonicalJson(a))fail('IDEMPOTENCY_MISMATCH');artifacts.set(a.artifactId,a);}
   return {schemaVersion:1,batchId,serverGeneration:generation,mutations:records.map(o=>o.mutation),artifacts:[...artifacts.values()],atomicGroups:[...groups].map(([groupId,members])=>({groupId,mutationIds:members.map(o=>o.id)}))};
 }
 private async prepare(trigger:'user'|'auto') {
   if(this.closed)fail('SESSION_REVOKED');
   const batchId=crypto.randomUUID(),prepared=(await transaction(this.store.db,['state','outbox'],'readonly',async tx=>{
     const account=await this.account(tx),sync=await this.get(tx,'state','sync');if(!sync)fail('VALIDATION_FAILED');
     if(trigger==='auto'&&sync.syncGate!=='auto')return null;
     this.ready(sync);
     const outbox=tx.objectStore('outbox'),roots=await request(outbox.index('status').getAllKeys(IDBKeyRange.only('pending'),DEFAULT_LIMITS.mutationsPerBatch+1));
     const groups=new Map<string,LocalRecord[]>(),records:LocalRecord[]=[],visiting=new Set<string>();
     const loadGroup=async(groupId:string)=>{
       const members=await request(outbox.index('commitId').getAll(IDBKeyRange.only(groupId),DEFAULT_LIMITS.mutationsPerAtomicGroup+1)) as LocalRecord[];
       if(members.length>DEFAULT_LIMITS.mutationsPerAtomicGroup)fail('RESOURCE_LIMIT_EXCEEDED',{limit:DEFAULT_LIMITS.mutationsPerAtomicGroup});
       if(!members.length||members.some(o=>o.status!=='pending'))fail(members.some(o=>o.status==='blockedDeleted')?'RESOURCE_DELETED':'RECONCILIATION_REQUIRED');
       const ids=new Set(members.map(o=>o.id)),done=new Set<string>(),active=new Set<string>();
       const visit=(id:string)=>{if(done.has(id))return;if(active.has(id))fail('VALIDATION_FAILED');active.add(id);const m=members.find(o=>o.id===id)!;for(const dep of m.mutation.dependencies)if(ids.has(dep))visit(dep);active.delete(id);done.add(id);};
       for(const o of members){
         assertSchema('local-outbox.json',o);
         if(o.ownerId!==this.store.ownerId||o.projectId!==o.mutation.projectId||o.id!==o.mutation.mutationId||o.serverGeneration!==account.serverGeneration)fail('RECONCILIATION_REQUIRED');
         for(const a of o.artifactDescriptors)if(a.projectId!==o.projectId)fail('FORBIDDEN');
         const validator=this.validators.get(o.mutation.kind);if(!validator)fail('UNSUPPORTED_OPERATION');validator(o.mutation);visit(o.id);
       }
       if(utf8Size(this.declaration(members,new Map([[groupId,members]]),batchId,account.serverGeneration))>DEFAULT_LIMITS.metadataBodyMaxBytes)fail('PAYLOAD_TOO_LARGE',{limit:DEFAULT_LIMITS.metadataBodyMaxBytes});
       return members;
     };
     let full=false;
     for(const rootId of roots){
       if(full)break;const root=await this.get(tx,'outbox',String(rootId));if(!root||root.status!=='pending')continue;
       const stack:{groupId:string;expanded:boolean}[]=[{groupId:root.commitId,expanded:false}];
       while(stack.length){
         if((stack.length+visiting.size)*128>DEFAULT_LIMITS.workerMemoryBudgetBytes)fail('RESOURCE_LIMIT_EXCEEDED');
         const frame=stack.at(-1)!;if(groups.has(frame.groupId)){stack.pop();continue;}
         const members=await loadGroup(frame.groupId);
         if(!frame.expanded){
           if(visiting.has(frame.groupId))fail('VALIDATION_FAILED');visiting.add(frame.groupId);frame.expanded=true;
           const dependencies=new Set<string>();
           for(const o of members)for(const depId of o.mutation.dependencies){
             const dep=await this.get(tx,'outbox',depId);
             if(!dep||dep.ownerId!==o.ownerId||dep.projectId!==o.projectId)fail('RECONCILIATION_REQUIRED');
             if(dep.commitId===frame.groupId)continue;
             if(dep.status==='blockedDeleted')fail('RESOURCE_DELETED');
             if(dep.status==='pending'){if(visiting.has(dep.commitId))fail('VALIDATION_FAILED');if(!groups.has(dep.commitId))dependencies.add(dep.commitId);}
             else{
               const receipt=await this.get(tx,'state','receipt:'+depId);
               if(!receipt||receipt.ownerId!==o.ownerId||receipt.projectId!==o.projectId||receipt.serverGeneration!==account.serverGeneration||receipt.receipt.payloadHash!==dep.mutation.payloadHash)fail('RECONCILIATION_REQUIRED');
             }
           }
           for(const groupId of [...dependencies].reverse())stack.push({groupId,expanded:false});
         }else{
           if(records.length+members.length>DEFAULT_LIMITS.mutationsPerBatch){full=true;break;}
           const candidateGroups=new Map(groups);candidateGroups.set(frame.groupId,members);
           const candidate=this.declaration([...records,...members],candidateGroups,batchId,account.serverGeneration);
           if(utf8Size(candidate)>DEFAULT_LIMITS.metadataBodyMaxBytes){if(!records.length)fail('PAYLOAD_TOO_LARGE');full=true;break;}
           groups.set(frame.groupId,members);records.push(...members);visiting.delete(frame.groupId);stack.pop();
         }
       }
     }
     if(!records.length)return null;
     return {account,sync,groups,records,declaration:this.declaration(records,groups,batchId,account.serverGeneration)};
   })).value;
   if(!prepared)return null;
   for(const o of prepared.records){
     if(o.mutation.kind==='dataset.version.create'&&canonicalJson(collectVersionArtifacts(o.mutation,o.artifactDescriptors))!==canonicalJson(o.artifactDescriptors))fail('IDEMPOTENCY_MISMATCH');
     if(await mutationHash(o.mutation,o.artifactDescriptors)!==o.mutation.payloadHash)fail('IDEMPOTENCY_MISMATCH');
   }
   const body={...prepared.declaration,ownerId:this.store.ownerId,localGeneration:prepared.account.localGeneration,gateRevision:prepared.sync.gateRevision,createdAtClient:new Date().toISOString()};
   const snapshot={...body,snapshotHash:await hashCanonical(body)};assertSchema('local-sync-snapshot.json',snapshot);
   await transaction(this.store.db,['state','outbox'],'readwrite',async tx=>{
     const account=await this.account(tx,snapshot.localGeneration);if(account.serverGeneration!==snapshot.serverGeneration)fail('RECONCILIATION_REQUIRED');const sync=await this.get(tx,'state','sync');this.ready(sync!);
     if(sync!.gateRevision!==snapshot.gateRevision)fail('PREVIEW_STALE');
     for(const [groupId,members]of prepared.groups){
       const current=await request(tx.objectStore('outbox').index('commitId').getAll(IDBKeyRange.only(groupId),DEFAULT_LIMITS.mutationsPerAtomicGroup+1)) as LocalRecord[];
       if(canonicalJson(sorted(current.map(o=>o.id)))!==canonicalJson(sorted(members.map(o=>o.id)))||current.some(o=>canonicalJson(members.find(m=>m.id===o.id))!==canonicalJson(o)))fail('PREVIEW_STALE');
     }
     tx.objectStore('state').add({id:'snapshot:'+snapshot.batchId,ownerId:this.store.ownerId,snapshot,descriptors:prepared.records.map(o=>({mutationId:o.id,artifacts:o.artifactDescriptors})),status:'running'});
     tx.objectStore('state').put({...sync,sync:'running',syncGate:'awaitingUser',activeBatchId:snapshot.batchId});
   });return snapshot;
 }
 async applyAck(batchId:string,ack:RecordValue) {
   if(this.closed)fail('SESSION_REVOKED');
   const stored=await this.store.inspect('state','snapshot:'+batchId) as LocalRecord;if(!stored||stored.ownerId!==this.store.ownerId)fail('RESOURCE_NOT_FOUND');
   const snapshot=stored.snapshot,descriptors=new Map<string,RecordValue[]>(stored.descriptors.map((d:RecordValue)=>[d.mutationId,d.artifacts]));
   assertSchema('local-sync-snapshot.json',snapshot);const {snapshotHash,...body}=snapshot;
   if(await hashCanonical(body)!==snapshotHash)fail('IDEMPOTENCY_MISMATCH');
   validateAck(snapshot,ack,descriptors);
   const result=await transaction(this.store.db,['state','outbox'],'readwrite',async tx=>{
     const account=await this.account(tx,snapshot.localGeneration);if(account.serverGeneration!==snapshot.serverGeneration)fail('RECONCILIATION_REQUIRED');const sync=await this.get(tx,'state','sync');if(!sync)fail('VALIDATION_FAILED');
     const original=await this.get(tx,'state','snapshot:'+batchId);if(original?.snapshot.snapshotHash!==snapshot.snapshotHash)fail('IDEMPOTENCY_MISMATCH');
     for(const group of snapshot.atomicGroups){
       const members=await request(tx.objectStore('outbox').index('commitId').getAll(IDBKeyRange.only(group.groupId),DEFAULT_LIMITS.mutationsPerAtomicGroup+1)) as LocalRecord[];
       if(canonicalJson(sorted(members.map(o=>o.id)))!==canonicalJson(sorted(group.mutationIds)))fail('RECONCILIATION_REQUIRED');
     }
     for(const m of snapshot.mutations){const o=await this.get(tx,'outbox',m.mutationId);if(!o||o.ownerId!==this.store.ownerId||canonicalJson(o.mutation)!==canonicalJson(m)||canonicalJson(o.artifactDescriptors)!==canonicalJson(descriptors.get(m.mutationId)))fail('IDEMPOTENCY_MISMATCH');}
     if(sync.activeBatchId!==batchId){
       if(original?.status==='committed'||original?.status==='partial'){
         for(const receipt of ack.acknowledged){
           const known=await this.get(tx,'state','receipt:'+receipt.mutationId);
           if(!known)fail('PREVIEW_STALE');
           if(known.serverGeneration!==ack.serverGeneration||canonicalJson(known.receipt)!==canonicalJson(receipt))fail('IDEMPOTENCY_MISMATCH');
         }
         return {status:'duplicateIgnored',acknowledged:0,syncGate:sync.syncGate};
       }
       fail('PREVIEW_STALE');
     }
     for(const receipt of ack.acknowledged){
       const old=await this.get(tx,'state','receipt:'+receipt.mutationId);
       if(old&&(old.serverGeneration!==ack.serverGeneration||canonicalJson(old.receipt)!==canonicalJson(receipt)))fail('IDEMPOTENCY_MISMATCH');
       const o=await this.get(tx,'outbox',receipt.mutationId);
       tx.objectStore('outbox').put({...o,status:'acknowledged'});
       if(!old)tx.objectStore('state').add({id:'receipt:'+receipt.mutationId,ownerId:this.store.ownerId,projectId:o!.projectId,serverGeneration:ack.serverGeneration,receipt});
     }
     let reconcile=sync.reconciliationRequired;
     for(const rejected of ack.rejected)if(rejected.code==='RESOURCE_DELETED'){const o=await this.get(tx,'outbox',rejected.mutationId);tx.objectStore('outbox').put({...o,status:'blockedDeleted'});}
     for(const item of [...ack.pending,...ack.rejected])if(['CURSOR_EXPIRED','RECONCILIATION_REQUIRED','CLIENT_SCHEMA_UNSUPPORTED'].includes(item.code))reconcile=true;
     const complete=ack.acknowledged.length===snapshot.mutations.length,canAuto=complete&&!reconcile&&sync.gateRevision===snapshot.gateRevision&&sync.auth==='valid'&&sync.network==='online'&&sync.server==='reachable';
     const conflicts=ack.acknowledged.some((r:RecordValue)=>r.outcome==='conflictPreserved');
     const unsynced=await request(tx.objectStore('outbox').index('status').count('pending'))+await request(tx.objectStore('outbox').index('status').count('blockedDeleted'));
     tx.objectStore('state').put({...sync,syncGate:canAuto?'auto':'awaitingUser',gateRevision:complete?sync.gateRevision:sync.gateRevision+1,sync:complete?(conflicts?'conflict':unsynced?'idle':'synced'):'partial',reconciliationRequired:reconcile,activeBatchId:null});
     tx.objectStore('state').put({...original,status:complete?'committed':'partial'});
     tx.objectStore('state').put({id:'sync:cursor',ownerId:this.store.ownerId,serverGeneration:ack.serverGeneration,cursor:ack.cursor});
     return {status:complete?'committed':'partial',acknowledged:ack.acknowledged.length,pending:ack.pending.length,rejected:ack.rejected.length,syncGate:canAuto?'auto':'awaitingUser'};
   });this.announce();return result.value;
 }
 private async failed(batchId:string|undefined,error:any) {
   await transaction(this.store.db,['state'],'readwrite',async tx=>{
     const sync=await this.get(tx,'state','sync');if(!sync)return;
     const next:RecordValue={...sync,syncGate:'awaitingUser',gateRevision:sync.gateRevision+1,sync:'failed',activeBatchId:null};
     if(error?.status===401)next.auth=error.code==='SESSION_REVOKED'?'revoked':'expired';
     if(error?.status===502||error?.status===504||error?.transportFailure)next.server='unreachable';
     if(['RECONCILIATION_REQUIRED','CURSOR_EXPIRED','CLIENT_SCHEMA_UNSUPPORTED'].includes(error?.code))next.reconciliationRequired=true;
     tx.objectStore('state').put(next);
     if(batchId){const snapshot=await this.get(tx,'state','snapshot:'+batchId);if(snapshot)tx.objectStore('state').put({...snapshot,status:'failed'});}
   });this.announce();
 }
 async sync(trigger:'user'|'auto',transport:Transport) {
   if(this.closed)fail('SESSION_REVOKED');
   if(!['user','auto'].includes(trigger))fail('VALIDATION_FAILED');
   if(!navigator.locks)fail('WRITER_FENCE_LOST');
   const running=navigator.locks.request('dashboard:sync-lock:'+this.store.ownerId,{ifAvailable:true},async lock=>{
     if(this.closed)fail('SESSION_REVOKED');
     if(!lock)return {status:'busy'};
     let snapshot:RecordValue|null=null;
     try{
       snapshot=await navigator.locks.request(accountLock(this.store.ownerId),()=>this.prepare(trigger));
       if(!snapshot)return {status:'emptyOrWaiting'}; // Does not clear awaitingUser, even with empty outbox.
       if(this.closed)fail('SESSION_REVOKED');
       const ack=await transport(declarationOf(snapshot),{signal:this.abort.signal});
       if(this.closed)fail('SESSION_REVOKED');
       return await navigator.locks.request(accountLock(this.store.ownerId),()=>this.applyAck(snapshot!.batchId,ack));
     }catch(error){if(!this.closed)await this.failed(snapshot?.batchId,error);throw error;}
   });
   this.inFlight.add(running);try{return await running;}finally{this.inFlight.delete(running);}
 }
}
