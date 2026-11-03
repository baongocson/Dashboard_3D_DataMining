// Dedicated synthetic protocol fixture, not a product operation executor.
import {assertSchema} from '../../packages/contracts/src/index.mjs';
import {LocalStore} from '../../apps/web/src/local/store.ts';
import {encodeTable,hashBytes,canonicalJson} from '../../packages/data-format/src/index.mjs';
const endpoint=self as unknown as DedicatedWorkerGlobalScope;
const query=new URL(import.meta.url).searchParams,namespace=query.get('namespace')!,mode=query.get('mode')??'finish';
let cancelled=false,store:LocalStore|undefined,snapshot:Record<string,any>,sequence=0;
const emit=(type:string,data:Record<string,unknown>)=>endpoint.postMessage({protocolVersion:1,taskId:snapshot.taskId,runId:snapshot.runId,stepId:snapshot.stepId,generation:snapshot.localGeneration,fence:snapshot.writerFence,sequence:++sequence,type,data});
endpoint.onmessage=e=>{void handle(e.data).catch(()=>{if(snapshot)emit('FAILED',{code:'VALIDATION_FAILED'});});};
async function handle(command:Record<string,any>){
 assertSchema('worker-command.json',command);
 if(command.type!=='START'){cancelled=true;if(store&&snapshot)await store.cancel(snapshot.taskId);if(snapshot)emit('CANCELLED',{});return;}
 snapshot=command.snapshot;store=await LocalStore.open(snapshot.ownerId,{namespace});
 if(mode==='faults'){
  const bad={protocolVersion:1,taskId:crypto.randomUUID(),runId:snapshot.runId,stepId:snapshot.stepId,generation:snapshot.localGeneration,fence:snapshot.writerFence,sequence:100,type:'STARTED',data:{}};endpoint.postMessage(bad);
  endpoint.postMessage({...bad,taskId:snapshot.taskId,generation:snapshot.localGeneration+1});
  endpoint.postMessage({...bad,taskId:snapshot.taskId,type:'RESULT',data:{rows:[['forbidden raw row']]}}); // Invalid event body.
 }
 emit('STARTED',{});emit('PROGRESS',{phase:'fixture',completedUnits:1});
 if(mode==='fail'){emit('FAILED',{code:'VALIDATION_FAILED'});store.close();return;}
 if(mode==='faults')endpoint.postMessage({protocolVersion:1,taskId:snapshot.taskId,runId:snapshot.runId,stepId:snapshot.stepId,generation:snapshot.localGeneration,fence:snapshot.writerFence,sequence,type:'PROGRESS',data:{phase:'duplicate',completedUnits:9,totalUnits:9}});
 if(mode==='hold')await new Promise(()=>{});
 await new Promise(r=>setTimeout(r,mode==='slow'?600:80));if(cancelled)return;
 const column={columnId:snapshot.config.columnIds[0],name:'Synthetic',logicalType:'number',nullable:false,sourceColumns:[]},rows=[{rowId:crypto.randomUUID(),cells:[3]},{rowId:crypto.randomUUID(),cells:[4]}];
 const table=await encodeTable(rows,[column]),manifestId=crypto.randomUUID(),manifestBytes=new TextEncoder().encode(canonicalJson(table.manifest));
 const artifacts=[];
 for(const c of table.chunks)artifacts.push({descriptor:{artifactId:c.artifactId,purpose:'tableChunk',formatVersion:'table-jsonl-v1',mediaType:'application/x-ndjson',sizeBytes:c.bytes.length,sha256:await hashBytes(c.bytes),projectId:snapshot.projectId,dependencyArtifactIds:[]},bytes:c.bytes});
 artifacts.push({descriptor:{artifactId:manifestId,purpose:'tableManifest',formatVersion:'table-jsonl-v1',mediaType:'application/json',sizeBytes:manifestBytes.length,sha256:await hashBytes(manifestBytes),projectId:snapshot.projectId,dependencyArtifactIds:table.chunks.map(c=>c.artifactId)},bytes:manifestBytes});
 if(cancelled)return;await store.stage(snapshot.taskId,artifacts);if(cancelled)return;
 emit('RESULT',{stagedArtifactRefs:artifacts.map(a=>a.descriptor.artifactId),summary:{rowCount:2,columnCount:1}});store.close();
}
