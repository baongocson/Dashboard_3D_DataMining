import {randomUUID} from 'node:crypto';
import {hashBytes,hashCanonical,canonicalJson,mutationHash,encodeTable} from '../../packages/data-format/src/index.mjs';
export const id=()=>randomUUID();
export const password='B031 tổng hợp password 42!';
export async function mutation(kind,projectId,entityId,payload,{artifacts=[],baseRevision=0,dependencies=[]}={}){
 const m={schemaVersion:1,mutationId:id(),kind,projectId,entityId,baseRevision,dependencies,payload,payloadHash:'0'.repeat(64)};
 m.payloadHash=await mutationHash(m,artifacts);return m;
}
export async function imported(projectId){
 const datasetId=id(),versionId=id(),branchId=id(),columnId=id();
 const table=await encodeTable([{rowId:id(),cells:[1]},{rowId:id(),cells:[2]}],[{columnId,name:'Số tổng hợp',logicalType:'number',nullable:false,sourceColumns:[]}]);
 const buffers=table.chunks.map(c=>({artifactId:c.artifactId,purpose:'tableChunk',bytes:c.bytes}));
 const manifestId=id(),sourceId=id(),sourceBytes=new TextEncoder().encode('số\n1\n2\n');
 buffers.unshift({artifactId:manifestId,purpose:'tableManifest',bytes:new TextEncoder().encode(canonicalJson(table.manifest)),dependencies:table.chunks.map(c=>c.artifactId)});
 buffers.unshift({artifactId:sourceId,purpose:'source',bytes:sourceBytes});
 const artifacts=[];for(const b of buffers)artifacts.push({artifactId:b.artifactId,purpose:b.purpose,projectId,formatVersion:b.purpose==='source'?'csv-v1':'table-jsonl-v1',mediaType:b.purpose==='source'?'text/csv':'application/json',sizeBytes:b.bytes.length,sha256:await hashBytes(b.bytes),dependencyArtifactIds:b.dependencies??[]});
 const operationSnapshot={operationId:'PREP.MISS_MEAN',configVersion:1,columnIds:[columnId],params:{fixtureOnly:true}};
 const dataset={datasetId,name:'Dữ liệu trùng tên',kind:'imported',sourceArtifactId:sourceId,parseConfig:{delimiter:',',encoding:'utf-8'},v0VersionId:versionId,defaultBranchId:branchId};
 const version={schemaVersion:1,versionId,datasetId,branchId,parentVersionId:null,sourceVersions:[],tableManifestId:manifestId,rowCount:2,columnCount:1,operationSnapshot};
 const initialVersion={version,expectedHead:{kind:'known',branchId,versionId:null,revision:0},branch:{branchId,forkVersionId:null,reason:'initial'}};
 const configHash=await hashCanonical({parseConfig:dataset.parseConfig,operationSnapshot});
 const intent={logicalImportId:id(),datasetId,versionId,mutationId:id(),projectId,kind:'import',configHash,file:{name:'synthetic.csv',size:sourceBytes.length,format:'csv'}};
 return {dataset,version,initialVersion,intent,artifacts,buffers,configHash};
}
export async function creation(projectId,f,intent){
 const m=await mutation('dataset.create',projectId,f.dataset.datasetId,{dataset:f.dataset,initialVersion:f.initialVersion,intentId:intent.intentId,logicalImportId:f.intent.logicalImportId,configHash:f.configHash},{artifacts:f.artifacts});
 m.mutationId=f.intent.mutationId;return m; // mutationId is transport identity, excluded from business hash by C02.
}
export async function nextVersion(projectId,f,prior,priorMutation,{fork=false}={}){
 const version={...structuredClone(f.version),versionId:id(),parentVersionId:prior.versionId,sourceVersions:[{datasetId:prior.datasetId,versionId:prior.versionId,role:'primary',sourceOrder:0}],branchId:fork?id():prior.branchId};
 const branch={branchId:version.branchId,forkVersionId:fork?prior.versionId:null,reason:fork?'undoContinuation':'initial'};
 const expectedHead=fork?{kind:'known',branchId:version.branchId,versionId:null,revision:0}:{kind:'dependency',branchId:version.branchId,fromMutationId:priorMutation};
 const artifacts=f.artifacts.filter(a=>a.purpose!=='source'),m=await mutation('dataset.version.create',projectId,version.versionId,{version,expectedHead,branch},{artifacts,dependencies:[priorMutation]});
 return {version,m,artifacts};
}
