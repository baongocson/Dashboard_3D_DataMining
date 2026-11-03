export type LocalRecord={id:string;[key:string]:any};
export const STORES=['state','projects','datasets','versions','branches','artifacts','bytes','staging','tasks','steps','history','markers','outbox','contexts'] as const;
export const LOCAL_DATABASE_VERSION=2;
export type Store=typeof STORES[number];
export function request<T>(r:IDBRequest<T>):Promise<T> {
 return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
export function finished(tx:IDBTransaction):Promise<void> {
 return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new DOMException('Transaction aborted','AbortError'));tx.onerror=()=>{};});
}
export async function openDatabase(ownerId:string,namespace='dashboard-local-v1',factory:IDBFactory=indexedDB) {
 const r=factory.open(namespace+'-'+ownerId,LOCAL_DATABASE_VERSION);
 r.onupgradeneeded=e=>{
   for(const name of STORES)if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'});
   const outbox=r.transaction!.objectStore('outbox');
   if(!outbox.indexNames.contains('status'))outbox.createIndex('status','status');
   if(!outbox.indexNames.contains('commitId'))outbox.createIndex('commitId','commitId');
   r.transaction!.objectStore('state').put({id:'migration:2',fromVersion:e.oldVersion,toVersion:2,status:'complete'});
 };
 const db=await request(r);db.onversionchange=()=>db.close();return db;
}
export async function transaction<T>(db:IDBDatabase,stores:Store[],mode:IDBTransactionMode,fn:(tx:IDBTransaction)=>Promise<T>):Promise<{value:T;durability:IDBTransactionDurability}> {
 const tx=db.transaction(stores,mode,mode==='readwrite'?{durability:'strict'}:undefined),done=finished(tx);
 try{const value=await fn(tx);await done;return {value,durability:tx.durability};}
 catch(error){const nativeFailure=tx.error;try{tx.abort();}catch{}await done.catch(()=>{});throw nativeFailure??tx.error??error;}
}
