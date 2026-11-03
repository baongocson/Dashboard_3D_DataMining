import {assertSchema,validateSchema,fail,ERROR_CATALOG} from '../../../../packages/contracts/src/index.mjs';
import {hashCanonical} from '../../../../packages/data-format/src/index.mjs';
import type {WriterLease} from './writer.ts';
function validEvent(value:unknown){try{return validateSchema('worker-event.json',value).valid;}catch{return false;}}
function immutable<T>(value:T):T {if(value&&typeof value==='object'){for(const child of Object.values(value))immutable(child);Object.freeze(value);}return value;}
export class TaskWorker {
 readonly lease:WriterLease;
 readonly worker:Worker;
 readonly snapshot:Record<string,any>;
 status:'ready'|'running'|'committing'|'succeeded'|'failed'|'cancelled'='ready';
 lastSequence=0;
 discarded=0;
 progress:{phase:string;completedUnits?:number;totalUnits?:number}|undefined;
 readonly terminal:Promise<unknown>;
 private resolveTerminal!:(value:unknown)=>void;
 private settled=false;
 private queue:Promise<void>=Promise.resolve();
 private unregister:()=>void;
 constructor(lease:WriterLease,worker:Worker,snapshot:Record<string,any>){
   assertSchema('execution-snapshot.json',snapshot);
   if(snapshot.ownerId!==lease.coordinator.store.ownerId||snapshot.projectId!==lease.projectId||snapshot.writerFence!==lease.fence||snapshot.localGeneration!==lease.generation)fail('WRITER_FENCE_LOST');
   this.lease=lease;this.worker=worker;this.snapshot=immutable(structuredClone(snapshot));
   this.terminal=new Promise(resolve=>this.resolveTerminal=resolve);
   this.unregister=lease.register(this);
   worker.onmessage=e=>{this.queue=this.queue.then(()=>this.receive(e.data)).catch(e=>this.fail(e.code??'VALIDATION_FAILED'));};
   worker.onerror=e=>{e.preventDefault();if(this.status!=='committing')void this.fail('UPSTREAM_UNAVAILABLE');};
 }
 private finish(status:'succeeded'|'failed'|'cancelled',result:unknown) {
   if(this.settled)return;this.settled=true;this.status=status;this.worker.terminate();this.unregister();this.resolveTerminal({status,result});
 }
 private async fail(code:string) {
   if(!ERROR_CATALOG.some(e=>e.category==='error'&&e.code===code))code='VALIDATION_FAILED';
   await this.lease.coordinator.store.failTask(this.snapshot.taskId,code).catch(()=>{});
   this.finish('failed',{code});
 }
 async start(inputArtifactRefs:string[]) {
   if(this.status!=='ready')fail('PREVIEW_STALE');
   if(await hashCanonical(this.snapshot.config)!==this.snapshot.configHash)fail('PREVIEW_STALE');
   const command={protocolVersion:1,type:'START',snapshot:this.snapshot,inputArtifactRefs:structuredClone(inputArtifactRefs)};assertSchema('worker-command.json',command);
   for(const id of command.inputArtifactRefs){
     const artifact=await this.lease.coordinator.store.inspect('artifacts',id);
     if(!artifact||artifact.ownerId!==this.snapshot.ownerId||artifact.projectId!==this.snapshot.projectId||(artifact.state!=='ready'&&artifact.taskId!==this.snapshot.taskId))fail('ARTIFACT_NOT_READY');
   }
   await this.lease.run(()=>this.lease.coordinator.store.start(this.snapshot));
   if(this.settled)fail('PREVIEW_STALE');
   if(!this.lease.accepting)fail('WRITER_FENCE_LOST');
   this.status='running';this.worker.postMessage(command);
 }
 private async receive(event:Record<string,any>) {
   const s=this.snapshot;
   if(this.settled||this.status!=='running'||!validEvent(event)||event.taskId!==s.taskId||event.runId!==s.runId||event.stepId!==s.stepId||event.generation!==s.localGeneration||event.fence!==s.writerFence||event.sequence<=this.lastSequence||!this.lease.accepting){this.discarded++;return;}
   if(event.type==='PROGRESS'&&event.data.totalUnits!==undefined&&(event.data.completedUnits===undefined||event.data.completedUnits>event.data.totalUnits)){this.discarded++;return;}
   this.lastSequence=event.sequence;
   if(event.type==='PROGRESS'){this.progress=event.data;return;}
   if(event.type==='FAILED'){await this.fail(event.data.code);return;}
   if(event.type==='CANCELLED'){await this.lease.coordinator.store.cancel(s.taskId);this.finish('cancelled',{});return;}
   if(event.type!=='RESULT')return;
   this.status='committing';
   const store=this.lease.coordinator.store,artifacts=[];
   for(const id of event.data.stagedArtifactRefs){const a=await store.inspect('artifacts',id);if(!a||a.ownerId!==s.ownerId||a.projectId!==s.projectId||a.taskId!==s.taskId)fail('ARTIFACT_NOT_READY');artifacts.push(a);}
   const manifests=artifacts.filter(a=>a.descriptor.purpose==='tableManifest'),lineages=artifacts.filter(a=>a.descriptor.purpose==='rowLineage');
   if(manifests.length!==1||lineages.length>1)fail('INVALID_SOURCE');
   const version={schemaVersion:1,versionId:s.outputVersionId,datasetId:s.datasetId,branchId:s.branchId,parentVersionId:s.sourceVersionId,sourceVersions:s.sourceRefs,tableManifestId:manifests[0].id,rowCount:event.data.summary.rowCount,columnCount:event.data.summary.columnCount,operationSnapshot:s.config,...(lineages.length?{rowLineageArtifactId:lineages[0].id}:{})};
   const committed=await this.lease.run(()=>store.commit(s.taskId,version));
   this.finish(committed.status==='localCommitted'?'succeeded':'cancelled',committed);
 }
 async dispose(reason:'user'|'transfer'|'logout'|'revoke'|'dispose'='dispose') {
   if(this.settled)return;
   if(this.status==='ready'&&!await this.lease.coordinator.store.inspect('tasks',this.snapshot.taskId)){this.finish('cancelled',{});return;}
   const command={protocolVersion:1,type:reason==='dispose'?'DISPOSE':'CANCEL',taskId:this.snapshot.taskId,reason};assertSchema('worker-command.json',command);this.worker.postMessage(command);
   const result=await this.lease.coordinator.store.cancel(this.snapshot.taskId);
   this.worker.terminate();
   if(result.status!=='tooLate')this.finish('cancelled',result);
   return result;
 }
 get progressPercent(){return this.progress?.totalUnits?100*(this.progress.completedUnits??0)/this.progress.totalUnits:undefined;}
}
