import {LocalStore} from '../../apps/web/src/local/store.ts';
import {SyncCoordinator} from '../../apps/web/src/local/sync.ts';
import {WriterCoordinator} from '../../apps/web/src/local/writer.ts';
import {transaction} from '../../apps/web/src/local/idb.ts';
import {outputB021,commitB021} from '../../tests/fixtures/b021.mjs';
import {assertSchema} from '../../packages/contracts/src/index.mjs';
import {canonicalJson,hashBytes,mutationHash} from '../../packages/data-format/src/index.mjs';
type Value=Record<string,any>;
const healthy={network:'online',server:'reachable',auth:'valid'} as const;
const check=(v:unknown,m:string)=>{if(!v)throw Error(m);};
let csrf='',f:Value|undefined;
const metrics={requests:[] as Array<{method:string;path:string;status:number}>,transportCalls:0,uploadedBytes:0,declarations:[] as Value[]};
async function api(path:string,{method='GET',body,bytes,signal,headers={}}:Value={}){
 if(method!=='GET'&&!csrf)await bootstrap();
 const response=await fetch('/api/v1'+path,{method,credentials:'same-origin',signal,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(method!=='GET'?{'x-csrf-token':csrf}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:bytes!==undefined?{body:bytes}:{})});
 metrics.requests.push({method,path,status:response.status});const envelope=await response.json();
 if(!response.ok){assertSchema('error-envelope.json',envelope);throw Object.assign(new Error(envelope.error.code),{code:envelope.error.code,status:response.status,details:envelope.error.details});}
 assertSchema('success-envelope.json',envelope);return envelope.data;
}
async function bootstrap(){const data=await api('/auth/csrf');assertSchema('auth-csrf.json',data);csrf=data.csrfToken;}
async function login(input:Value){await bootstrap();const data=await api('/auth/login',{method:'POST',body:{email:input.email,password:input.password,deviceId:crypto.randomUUID()}});assertSchema('auth-login-result.json',data);return {ownerId:data.userId,serverGeneration:data.serverGeneration};}
async function coordinators(store:LocalStore,input:Value){
 const writer=new WriterCoordinator(store),lease=await writer.acquire(input.projectId),sync=new SyncCoordinator(store);await sync.initialize(healthy);
 f={...input,store,writer,lease,sync,writerFence:lease.fence,localGeneration:lease.generation,outputs:[]};return summary();
}
async function init(input:Value){
 const signed=await login(input);check(signed.ownerId===input.ownerId&&signed.serverGeneration===input.serverGeneration,'actual authenticated owner/generation');
 const version=await api('/versions/'+input.versionId),branches=await api('/datasets/'+input.datasetId+'/branches'),proof=await api('/sync/receipts/'+input.mutation.mutationId+'?serverGeneration='+input.serverGeneration);
 assertSchema('metadata-version.json',version);assertSchema('sync-receipt-view.json',proof);check(version.contentHash===input.mutation.payloadHash&&proof.receipt.payloadHash===await mutationHash(input.mutation,input.artifacts),'actual baseline hash and receipt');
 const branch=branches.items.find((b:Value)=>b.branchId===input.branchId);check(branch&&branch.headVersionId===input.versionId,'actual baseline branch');
 const store=await LocalStore.open(input.ownerId,{namespace:input.namespace});await store.initialize({projectId:input.projectId,datasetId:input.datasetId,serverGeneration:input.serverGeneration});
 const downloads:Value[]=[];for(const descriptor of input.artifacts){const response=await fetch('/api/v1/artifacts/'+descriptor.artifactId+'/content',{credentials:'same-origin'});check(response.ok,'actual baseline private bytes');const bytes=new Uint8Array(await response.arrayBuffer());check(bytes.byteLength===descriptor.sizeBytes&&await hashBytes(bytes)===descriptor.sha256&&response.headers.get('x-artifact-sha256')===descriptor.sha256,'actual baseline byte hash');downloads.push({descriptor,bytes});}
 const commitId=crypto.randomUUID(),business=Object.fromEntries(Object.keys(input.mutation.payload.initialVersion.version).map(k=>[k,version[k]]));assertSchema('local-version-input.json',business);
 // Fixture hydration of an already committed baseline; never calls this a new local import commit.
 await transaction(store.db,['versions','branches','outbox','state','artifacts','bytes'],'readwrite',async tx=>{
  tx.objectStore('versions').add({...business,id:input.versionId,ownerId:input.ownerId,projectId:input.projectId,mutationId:input.mutation.mutationId,commitId});
  tx.objectStore('branches').add({id:input.branchId,ownerId:input.ownerId,projectId:input.projectId,datasetId:input.datasetId,headVersionId:branch.headVersionId,localHeadRevision:1,forkVersionId:branch.forkVersionId,reason:branch.reason});
  const outbox={id:input.mutation.mutationId,ownerId:input.ownerId,projectId:input.projectId,mutation:input.mutation,artifactDescriptors:input.artifacts,serverGeneration:input.serverGeneration,status:'acknowledged',commitId};assertSchema('local-outbox.json',outbox);tx.objectStore('outbox').add(outbox);
  tx.objectStore('state').add({id:'receipt:'+input.mutation.mutationId,ownerId:input.ownerId,projectId:input.projectId,serverGeneration:input.serverGeneration,receipt:proof.receipt});
  for(const {descriptor,bytes}of downloads){tx.objectStore('artifacts').add({id:descriptor.artifactId,ownerId:input.ownerId,projectId:input.projectId,descriptor,state:'ready',referenced:true});tx.objectStore('bytes').add({id:descriptor.artifactId,ownerId:input.ownerId,projectId:input.projectId,bytes});}
 });return coordinators(store,input);
}
async function resume(input:Value){await bootstrap();const session=await api('/auth/session');check(session.userId===input.ownerId,'resume exact owner');const store=await LocalStore.open(input.ownerId,{namespace:input.namespace});return coordinators(store,input);}
async function addOutput({source,value=1}:Value={}){check(f,'fixture initialized');const current=f!,o=await outputB021(current,{source:source??current.outputs.at(-1)?.version.versionId??current.versionId,value});const result=await current.lease.run(()=>commitB021(current,o));check(result.status==='localCommitted','actual kernel local commit');current.outputs.push(o);return {versionId:o.version.versionId,mutationId:o.snapshot.mutationId,commitId:o.snapshot.commitId,status:result.status,artifacts:o.artifacts.map((a:Value)=>a.descriptor.artifactId)};}
function transport(options:Value={}){
 return async(declaration:Value,{signal}:{signal:AbortSignal})=>{
  metrics.transportCalls++;metrics.declarations.push(structuredClone(declaration));const plan=await api('/sync/batches',{method:'POST',body:declaration,signal});assertSchema('sync-declaration-plan.json',plan);
  for(const upload of plan.needsUpload){if((options.skipArtifactIds??[]).includes(upload.artifactId))continue;const record=await f!.store.inspect('bytes',upload.artifactId),descriptor=declaration.artifacts.find((a:Value)=>a.artifactId===upload.artifactId);check(record&&descriptor,'fixture local immutable bytes');const bytes=record.bytes as Uint8Array;check(bytes.byteLength===descriptor.sizeBytes&&await hashBytes(bytes)===descriptor.sha256,'local hash before real upload');
   if(upload.state!=='verified'){for(let offset=0,index=0;offset<bytes.length;offset+=upload.chunkSizeBytes,index++){const chunk=bytes.slice(offset,Math.min(bytes.length,offset+upload.chunkSizeBytes)),sha256=await hashBytes(chunk);if(upload.receivedChunks.some((c:Value)=>c.index===index&&c.sha256===sha256&&c.length===chunk.length))continue;await api('/artifacts/uploads/'+upload.uploadId+'/chunks/'+index,{method:'PUT',bytes:chunk,signal,headers:{'content-type':'application/octet-stream','x-chunk-offset':String(offset),'x-chunk-length':String(chunk.length),'x-chunk-sha256':sha256}});metrics.uploadedBytes+=chunk.length;}await api('/artifacts/uploads/'+upload.uploadId+'/complete',{method:'POST',body:{},signal});}
  }
  const ack=await api('/sync/batches/'+declaration.batchId+'/commit',{method:'POST',body:{serverGeneration:declaration.serverGeneration,mutationIds:declaration.mutations.map((m:Value)=>m.mutationId)},signal});assertSchema('sync-ack.json',ack);
  if(options.addAfterACK)await addOutput({value:99});
  if(options.ignoreCommittedResponse)throw Object.assign(new Error('Fixture ignored actual committed HTTP response'),{status:504,transportFailure:true});
  if(options.holdAfterACK){(globalThis as any).b033HeldACK={batchId:ack.batchId,mutationIds:ack.acknowledged.map((r:Value)=>r.mutationId)};await new Promise<void>(resolve=>(globalThis as any).b033ReleaseACK=resolve);}
  return ack;
 };
}
async function run(trigger:'user'|'auto'='user',options:Value={}){try{return {ok:true,value:await f!.sync.sync(trigger,transport(options))};}catch(e){const error=e as Value;return {ok:false,code:error.code??error.name,status:error.status};}}
async function summary(){const current=f!;return {ownerId:current.ownerId,projectId:current.projectId,datasetId:current.datasetId,namespace:current.namespace,serverGeneration:current.serverGeneration,account:await current.store.inspect('state','account'),sync:await current.store.inspect('state','sync'),outbox:await current.store.inspect('outbox'),receipts:(await current.store.inspect('state')).filter((r:Value)=>r.id.startsWith('receipt:')),contexts:await current.store.inspect('contexts'),branches:await current.store.inspect('branches'),versions:(await current.store.inspect('versions')).map((r:Value)=>({versionId:r.versionId,branchId:r.branchId,mutationId:r.mutationId})),byteRecords:(await current.store.inspect('bytes')).length,metrics:structuredClone(metrics)};}
async function reopenVersion(versionId:string){return f!.store.openVersion(versionId);}
async function report(signal:any){await f!.sync.report(signal);return summary();}
async function dispose(){if(f){await f.sync.quiesce();await f.writer.dispose();f.store.close();f=undefined;}}
Object.assign(globalThis,{b033:{init,resume,addOutput,run,summary,report,login,api,dispose,reopenVersion,closeSync:()=>f!.sync.close(),newSync:async()=>{f!.sync=new SyncCoordinator(f!.store);await f!.sync.initialize(healthy);},canonicalJson}});

