import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {AuthService} from '../../apps/api/src/auth/service.ts';
import {FakeMailAdapter} from '../../apps/api/src/auth/fake-mail.ts';
import {MetadataService} from '../../apps/api/src/metadata/service.ts';
import {StorageService} from '../../apps/api/src/storage/service.ts';
import {SyncService} from '../../apps/api/src/sync/service.ts';
import {ReconciliationService} from '../../apps/api/src/sync/reconciliation.ts';
import {ManifestService} from '../../apps/api/src/sync/manifest.ts';
import {ChangefeedService} from '../../apps/api/src/sync/changes.ts';
import {id,password,mutation,imported,creation,nextVersion} from './b031.mjs';
import {upload,sha} from './b032.mjs';
export async function account(f,email='a@example.test'){
 const c=await f.auth.register({email,displayName:'B033 tổng hợp',password,confirmPassword:password}),mail=f.mail.messages.findLast(m=>m.challengeId===c.challengeId);
 await f.auth.verify({challengeId:c.challengeId,purpose:'register',generation:c.generation,otp:mail.otp},'register');
 const login=await f.auth.login({email,password,deviceId:id()}),projectId=id();
 await f.metadata.commit(login.rawToken,await mutation('project.create',projectId,projectId,{name:'B033 synthetic'}),[],f.generation);
 return {token:login.rawToken,ownerId:login.data.userId,projectId};
}
export async function fixture(client,runtime,n){
 const dbName='b033_'+n,db=client.db(dbName),generation=id(),time={now:Date.UTC(2026,10,3)},config={profile:'test',origin:'https://localhost',secret:randomBytes(32),serverGeneration:generation},mail=new FakeMailAdapter(),auth=new AuthService(client,db,config,mail,()=>time.now);await auth.ready();
 const byteRoot=path.join(runtime,'private-'+n),storage=new StorageService(auth,byteRoot);await storage.ready();
 const metadata=new MetadataService(auth,{artifacts:storage.authority});await metadata.ready();const sync=new SyncService(auth,storage);await sync.ready();
 const reconciliation=new ReconciliationService(auth,storage);await reconciliation.ready();const manifest=new ManifestService(auth,storage);await manifest.ready();const changefeed=new ChangefeedService(auth);await changefeed.ready();const f={db,dbName,generation,time,config,mail,auth,storage,metadata,sync,reconciliation,manifest,changefeed,byteRoot};return {...f,...await account(f)};
}
export async function dataset(f,{uploaded=false}={}){
 const d=await imported(f.projectId),grant=await f.metadata.importIntent(f.token,d.intent),m=await creation(f.projectId,d,grant);
 if(uploaded)for(const b of d.buffers)await upload(f.storage,f.token,f.generation,d.artifacts.find(a=>a.artifactId===b.artifactId),b.bytes);
 return {...d,grant,m};
}

import {canonicalJson,mutationHash} from '../../packages/data-format/src/index.mjs';

export async function lineageChain(f,{invalidSourceRow=false}={}){
 const d=await dataset(f,{uploaded:true}),next=await nextVersion(f.projectId,d,d.version,d.m.mutationId),rows=d.buffers.filter(b=>b.purpose==='tableChunk').flatMap(b=>new TextDecoder().decode(b.bytes).trimEnd().split('\n').map(JSON.parse));
 const bytes=Buffer.from(rows.map(row=>canonicalJson({rowId:row.rowId,sources:[{datasetId:d.dataset.datasetId,versionId:d.version.versionId,rowId:invalidSourceRow?id():row.rowId,role:'primary',sourceOrder:0}]})).join('\n')+'\n'),lineage={artifactId:id(),purpose:'rowLineage',formatVersion:'json-v1',mediaType:'application/json',projectId:f.projectId,sizeBytes:bytes.length,sha256:sha(bytes),dependencyArtifactIds:[]};
 next.m.payload.version.rowLineageArtifactId=lineage.artifactId;next.artifacts.push(lineage);next.m.payloadHash=await mutationHash(next.m,next.artifacts);await upload(f.storage,f.token,f.generation,lineage,bytes);return {d,next,lineage,rows,artifacts:[...d.artifacts,lineage]};
}

import {batch} from './b033-contract.mjs';

export async function conflictFixture(f,{known=false}={}){
 const d=await dataset(f,{uploaded:true}),declare=async(mutations,artifacts)=>{const s={...batch(mutations,{artifacts}),serverGeneration:f.generation};await f.sync.declare(f.token,s);const ack=await f.sync.commit(f.token,s.batchId,{serverGeneration:f.generation,mutationIds:mutations.map(m=>m.mutationId)},{requestId:'conflict-fixture'});if(ack.status!=='committed')throw Error('Conflict fixture baseline not committed');return {batch:s,ack};};
 await declare([d.m],d.artifacts);const local=await nextVersion(f.projectId,d,d.version,d.m.mutationId),server=await nextVersion(f.projectId,d,d.version,d.m.mutationId);await declare([server.m],server.artifacts);
 if(known){local.m.payload.expectedHead={kind:'known',branchId:d.version.branchId,versionId:d.version.versionId,revision:1};local.m.payloadHash=await mutationHash(local.m,local.artifacts);}
 return {d,local,server};
}

export function reconciliationRequest(f,pending=[],{knownEntities=[],knownArtifacts=[],pageSize=100,groupId}={}){
 return {serverGeneration:f.generation,projectIds:[f.projectId],knownEntities,knownArtifacts,pageSize,pending:pending.map(({m,artifacts=[]})=>({projectId:m.projectId,mutationId:m.mutationId,entityId:m.entityId,groupId:groupId??id(),kind:m.kind,baseRevision:m.baseRevision,payloadHash:m.payloadHash,artifactIds:artifacts.map(a=>a.artifactId),targetIds:[...new Set([m.payload.dataset?.datasetId,m.payload.version?.datasetId,m.payload.version?.branchId,...(m.payload.version?.sourceVersions??[]).flatMap(r=>[r.datasetId,r.versionId])].filter(Boolean))]}))};
}
export async function allReconciliationRows(f,page){const rows=[...page.rows];let last=page;while(last.nextCursor){last=await f.reconciliation.read(f.token,page.reconciliationId,{cursor:last.nextCursor});if(last.snapshotHash!==page.snapshotHash||last.offset!==rows.length)throw Error('Mixed reconciliation page');rows.push(...last.rows);}if(rows.length!==page.totalCount||!last.complete)throw Error('Incomplete reconciliation rows');return rows;}

export async function allManifestRows(f,page){const rows=[...page.rows];let next=page;while(next.nextCursor){next=await f.manifest.read(f.token,page.manifestId,{cursor:next.nextCursor});if(next.offset!==rows.length||next.snapshotHash!==page.snapshotHash||next.sequence!==page.sequence)throw Error('Mixed project manifest pages');rows.push(...next.rows);}if(!next.complete||rows.length!==page.totalCount)throw Error('Incomplete project manifest');return rows;}
