// Browser-only local/dev harness. Never connects to a user account or remote API.
import canonicalize from '/canonicalize.mjs';
import {runX01,scaleFixture,sha,check} from '/shared.mjs';
const request=q=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('g01-synthetic',1);q.onupgradeneeded=()=>{for(const s of ['state','versions','history','outbox','staging'])q.result.createObjectStore(s);};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
async function tx(stores,fn) {return new Promise((resolve,reject)=>{const t=db.transaction(stores,'readwrite');let value; t.oncomplete=()=>resolve(value);t.onabort=()=>reject(t.error??new Error('injected transaction abort'));t.onerror=()=>{};try{value=fn(t);}catch(e){t.abort();reject(e);}});}
async function read(store,key){return request(db.transaction(store).objectStore(store).get(key));}
async function put(store,key,value){return tx([store],t=>t.objectStore(store).put(value,key));}
let release;
let fence;
async function acquire() {
  let announce;const acquired=new Promise(r=>announce=r);
  navigator.locks.request('g01-owner/project-writer',{ifAvailable:true},async lock=>{
    if(!lock){announce(false);return;}
    fence=(await read('state','fence')??0)+1;await put('state','fence',fence);announce(true);
    await new Promise(r=>release=r);
  });
  return acquired;
}
async function commit(id,{expectedFence=fence,expectedEpoch=0,abort=false}={}) {
  return navigator.locks.request('g01-owner/account-gate',async()=>{
    check(await read('state','fence')===expectedFence,'WRITER_FENCE_LOST');
    check((await read('state','epoch')??0)===expectedEpoch,'GENERATION_MISMATCH');
    await tx(['state','versions','history','outbox'],t=>{
      t.objectStore('versions').put({id,complete:true},id);
      t.objectStore('history').put({id,status:'succeeded'},id);
      t.objectStore('outbox').put({id,synced:false},id);
      t.objectStore('state').put(id,'head');
      if(abort)t.abort();
    });
    return id;
  });
}
globalThis.probe={
  ready:true,runX01:()=>runX01(canonicalize),scaleFixture,read,put,acquire,commit,
  release:()=>{release?.();release=undefined;}, getFence:()=>fence,
  logout:()=>navigator.locks.request('g01-owner/account-gate',async()=>{await put('state','epoch',(await read('state','epoch')??0)+1);}),
  resetEpoch:()=>put('state','epoch',0),
  switchOwner:async()=>{check((await request(db.transaction('outbox').objectStore('outbox').getAll())).length===0,'ACCOUNT_SWITCH_BLOCKED_DIRTY');},
  recover:async()=>{const all=await request(db.transaction('staging').objectStore('staging').getAll());const interrupted=all.filter(x=>x?.id&&!x.complete).map(x=>x.id);await tx(['staging'],t=>{for(const id of interrupted)t.objectStore('staging').delete(id);});return {interrupted,resumed:false,head:await read('state','head')};},
  stage:async id=>{await put('staging',id,{id,complete:false});},
  list:async store=>request(db.transaction(store).objectStore(store).getAll()),
  storage:async size=>{
    const bytes=new Uint8Array(size).fill(37);const hash=await sha(bytes);
    let start=performance.now();await put('staging','blob',new Blob([bytes]));let idbWriteMs=performance.now()-start;
    const blob=await read('staging','blob');check(await sha(new Uint8Array(await blob.arrayBuffer()))===hash,'IDB blob hash');
    const root=await navigator.storage.getDirectory();const file=await root.getFileHandle('g01-staged.bin',{create:true});
    start=performance.now();const writable=await file.createWritable();await writable.write(bytes);await writable.close();const opfsWriteMs=performance.now()-start;
    check(await sha(new Uint8Array(await(await file.getFile()).arrayBuffer()))===hash,'OPFS hash');
    // Orphan exists in file store but never published as a complete version.
    return {size,hash,idbWriteMs,opfsWriteMs,opfsClosedAndVerified:true,estimate:await navigator.storage.estimate(),persisted:await navigator.storage.persisted()};
  },
  quotaFailure:async()=>{try{throw new DOMException('synthetic quota fault','QuotaExceededError');}catch(e){return {name:e.name,head:await read('state','head'),faultInjected:true,actualQuotaExhausted:false};}},
  opfsOrphan:async()=>{const root=await navigator.storage.getDirectory();return {exists:!!await root.getFileHandle('g01-staged.bin'),published:!!await read('versions','opfs-orphan')};},
  setGate:()=>put('state','syncGate','awaitingUser'),
};
document.querySelector('pre').textContent='G01 synthetic probe ready. No application/user data.';
