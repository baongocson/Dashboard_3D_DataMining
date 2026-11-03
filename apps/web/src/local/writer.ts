import {assertSchema,validateSchema,fail} from '../../../../packages/contracts/src/index.mjs';
import {request,finished} from './idb.ts';
import type {LocalStore} from './store.ts';
export const accountLock=(ownerId:string)=>'dashboard:account:'+ownerId;
export const writerLock=(ownerId:string,projectId:string)=>'dashboard:writer:'+ownerId+':'+projectId;
function validMessage(name:string,value:unknown){try{return validateSchema(name,value).valid;}catch{return false;}}
export class ProfileScope {
 readonly namespace:string;
 constructor(namespace='dashboard-profile-v1'){this.namespace=namespace;}
 async claim(ownerId:string,entitlement:{ownerId:string;canOpenLocal:boolean}) {
   assertSchema('uuid.json',ownerId);
   if(entitlement.ownerId!==ownerId||!entitlement.canOpenLocal)fail('FORBIDDEN');
   if(!navigator.locks)return {writable:false,reason:'locksUnavailable'};
   return navigator.locks.request(this.namespace+':scope',async()=>{
     const opening=indexedDB.open(this.namespace,1);opening.onupgradeneeded=()=>opening.result.createObjectStore('state',{keyPath:'id'});
     const db=await request(opening);
     try{
       const tx=db.transaction('state','readwrite',{durability:'strict'}),done=finished(tx),store=tx.objectStore('state'),active=await request(store.get('active'));
       if(active&&active.ownerId!==ownerId){tx.abort();await done.catch(()=>{});fail('FORBIDDEN');}
       if(!active)store.add({id:'active',ownerId});
       await done;return {writable:true,ownerId};
     }finally{db.close();}
   });
 }
}
export class WriterLease {
 accepting=true;
 readonly fence:number;
 readonly generation:number;
 readonly projectId:string;
 readonly coordinator:WriterCoordinator;
 private releaseLock:()=>void;
 private stopped=false;
 private stopping:Promise<void>|undefined;
 private controllers=new Set<{dispose:(reason:'transfer'|'logout'|'dispose')=>Promise<unknown>}>();
 private inFlight=new Set<Promise<unknown>>();
 constructor(coordinator:WriterCoordinator,projectId:string,fence:number,generation:number,release:()=>void){
   this.coordinator=coordinator;this.projectId=projectId;this.fence=fence;this.generation=generation;this.releaseLock=release;
 }
 register(controller:{dispose:(reason:'transfer'|'logout'|'dispose')=>Promise<unknown>}){this.controllers.add(controller);return()=>this.controllers.delete(controller);}
 async run<T>(fn:()=>Promise<T>):Promise<T> {
   if(!this.accepting||this.stopped)fail('WRITER_FENCE_LOST');
   const promise=navigator.locks.request(accountLock(this.coordinator.store.ownerId),async()=>{
     if(!this.accepting||this.stopped)fail('WRITER_FENCE_LOST');return fn();
   });
   this.inFlight.add(promise);try{return await promise;}finally{this.inFlight.delete(promise);}
 }
 stop(reason:'transfer'|'logout'|'dispose'='dispose'):Promise<void> {
   if(this.stopping)return this.stopping;this.accepting=false;
   this.stopping=(async()=>{
     await Promise.all([...this.controllers].map(c=>c.dispose(reason)));
     await Promise.allSettled([...this.inFlight]);
     await this.coordinator.store.invalidateWriter(this.projectId,this.fence);
     this.stopped=true;this.controllers.clear();this.coordinator.leases.delete(this.projectId);this.releaseLock();
   })();return this.stopping;
 }
}
export class WriterCoordinator {
 readonly store:LocalStore;
 readonly tabId=crypto.randomUUID();
 readonly leases=new Map<string,WriterLease>();
 readonly channel:BroadcastChannel;
 readonly errors:string[]=[];
 onTransferRequest:(projectId:string)=>Promise<'accept'|'decline'>=async()=> 'decline';
 private pending=new Set<string>();
 private closed=false;
 constructor(store:LocalStore) {
   this.store=store;this.channel=new BroadcastChannel('dashboard:ownership:'+store.ownerId);
   this.channel.onmessage=e=>{
     const m=e.data;
     if(validMessage('account-closing-event.json',m)&&m.ownerId===this.store.ownerId){
       void this.store.inspect('state','account').then(state=>state?.mode==='closing'&&state.localGeneration===m.generation?Promise.all([...this.leases.values()].map(l=>l.stop('logout'))):undefined).catch(e=>this.errors.push(e.code??'WRITER_FENCE_LOST'));return;
     }
     if(!validMessage('writer-transfer-request.json',m)||m.ownerId!==this.store.ownerId||m.senderId===this.tabId)return;
     const lease=this.leases.get(m.projectId);if(!lease)return;
     void this.onTransferRequest(m.projectId).then(choice=>choice==='accept'?lease.stop('transfer'):undefined).catch(e=>this.errors.push(e.code??'WRITER_FENCE_LOST'));
   };
 }
 async acquire(projectId:string,{wait=false,signal}:{wait?:boolean;signal?:AbortSignal}={}):Promise<WriterLease|null> {
   assertSchema('uuid.json',projectId);
   if(this.closed||!navigator.locks)return null;
   if(this.leases.has(projectId)||this.pending.has(projectId))fail('WRITER_FENCE_LOST');
   this.pending.add(projectId);
   return new Promise((resolve,reject)=>{
     const options:LockOptions=wait?{mode:'exclusive',...(signal?{signal}:{})}:{mode:'exclusive',ifAvailable:true};
     navigator.locks.request(writerLock(this.store.ownerId,projectId),options,async lock=>{
       if(!lock){resolve(null);return;}
       let release:()=>void;const held=new Promise<void>(r=>release=r);
       try{
         if(this.closed){resolve(null);return;}
         const acquired=await navigator.locks.request(accountLock(this.store.ownerId),()=>this.store.advanceWriter(projectId));
         const lease=new WriterLease(this,projectId,acquired.writerFence,acquired.localGeneration,()=>release());
         await this.store.recover(projectId,lease.fence);this.leases.set(projectId,lease);resolve(lease);
         await held;
       }catch(e){reject(e);}
     }).catch(reject).finally(()=>this.pending.delete(projectId));
   });
 }
 requestTransfer(projectId:string,signal?:AbortSignal) {
   const message={protocolVersion:1,type:'TRANSFER_REQUEST',requestId:crypto.randomUUID(),ownerId:this.store.ownerId,projectId,senderId:this.tabId};assertSchema('writer-transfer-request.json',message);
   this.channel.postMessage(message);return this.acquire(projectId,{wait:true,signal});
 }
 async confirmedClose(generation:number,signal?:AbortSignal) {
   const next=await navigator.locks.request(accountLock(this.store.ownerId),()=>this.store.closeAccount(generation));
   // Generation is the correctness fence even if a tab misses a notification.
   this.channel.postMessage({protocolVersion:1,type:'ACCOUNT_CLOSING',ownerId:this.store.ownerId,generation:next.value.localGeneration});
   await Promise.all([...this.leases.values()].map(l=>l.stop('logout')));
   const projects=await this.store.inspect('projects');
   for(const project of projects)await navigator.locks.request(writerLock(this.store.ownerId,project.id),{mode:'exclusive',...(signal?{signal}:{})},async()=>{});
   return {status:'quiesced',localGeneration:next.value.localGeneration,localDataRemoved:false};
 }
 async dispose(){this.closed=true;await Promise.all([...this.leases.values()].map(l=>l.stop()));this.channel.close();}
}
