import {randomUUID} from 'node:crypto';
import {mutation,imported,creation,nextVersion} from './b031.mjs';
import {mutationHash,hashCanonical} from '../../packages/data-format/src/index.mjs';
export const id=()=>randomUUID();
export async function rename(projectId=id(),dependencies=[],name='Tên tổng hợp'){
 return mutation('project.rename',projectId,projectId,{name},{dependencies,baseRevision:1});
}
export function batch(mutations,{artifacts=[],groups=mutations.map(m=>({groupId:id(),mutationIds:[m.mutationId]}))}={}){
 return {schemaVersion:1,batchId:id(),serverGeneration:id(),mutations,artifacts,atomicGroups:groups};
}
export async function versionFixture(){
 const projectId=id(),data=await imported(projectId),m=await creation(projectId,data,{intentId:'A'.repeat(43)}),next=await nextVersion(projectId,data,data.version,m.mutationId);
 return {projectId,data,m,next};
}
export async function rehash(m,artifacts=[]){
 if(m.kind==='dataset.create')m.payload.configHash=await hashCanonical({parseConfig:m.payload.dataset.parseConfig,operationSnapshot:m.payload.initialVersion.version.operationSnapshot});
 m.payloadHash=await mutationHash(m,artifacts);return m;
}
export const commitRequest=(declaration,mutationIds=declaration.mutations.map(m=>m.mutationId))=>({serverGeneration:declaration.serverGeneration,mutationIds});
export function uploadFinding(artifact,generation,{state='uploading',receivedChunks=[]}={}){
 return {kind:'needsUpload',upload:{uploadId:id().replaceAll('-','').padEnd(43,'A'),artifactId:artifact.artifactId,chunkSizeBytes:4194304,expiresAt:'2026-11-04T00:00:00.000Z',serverGeneration:generation,state,receivedChunks}};
}
export const presentFinding=(artifact,state='verified')=>({kind:'alreadyPresent',artifact:{artifactId:artifact.artifactId,sha256:artifact.sha256,sizeBytes:artifact.sizeBytes,state}});
