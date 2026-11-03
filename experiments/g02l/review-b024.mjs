import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const reviewId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02l/evidence/b024-reviews/'+reviewId;
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const runs=[];
for(const family of ['b024','b024-crash'])for(const name of (await readdir('experiments/g02l/evidence/'+family)).sort()){
 const dir='experiments/g02l/evidence/'+family+'/'+name;
 const report=await json(dir+'/results.json'),hashes=await json(dir+'/hashes.json');
 for(const [p,h]of Object.entries(hashes))if(sha(await readFile(path.join(dir,p)))!==h)throw Error('Evidence changed '+dir+'/'+p);
 runs.push({dir,family,report});
}
const current=['b024','b024-crash'].map(family=>runs.filter(r=>r.family===family).at(-1));
if(current.some(r=>!r))throw Error('Missing B024 evidence');
for(const r of current){
 if(r.report.counts.failed||r.report.cases.some(c=>c.status!=='passed')||r.report.pageErrors?.length||r.report.externalRequests?.length)throw Error('Current B024 run not passed '+r.dir);
 for(const [p,h]of Object.entries(r.report.sources))if(sha(await readFile(p))!==h)throw Error('Executed source differs '+p);
}
if(current[0].report.counts.passed!==36||current[1].report.counts.passed!==2)throw Error('Case coverage changed; review explicitly');
const generated=await checkGenerated(),checks=[];
for(const [name,args]of [
 ['web-typecheck',['apps/api/node_modules/typescript/bin/tsc','--project','apps/web/tsconfig.json']],
 ['api-typecheck',['apps/api/node_modules/typescript/bin/tsc','--project','apps/api/tsconfig.json']],
 ['contracts-regression',['--test','tests/integration/b020.test.mjs','tests/integration/b021-contract.test.mjs','tests/integration/b023.test.mjs','tests/integration/b024-contract.test.mjs']]
]){
 const result=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true});
 await writeFile(out+'/'+name+'.txt',result.stdout+result.stderr,{flag:'wx'});
 checks.push({command:'node '+args.join(' '),exitCode:result.status,evidence:name+'.txt'});
 if(result.status!==0)throw Error('Check failed '+name);
}
const sourceHashes={};
async function capture(p){const b=await readFile(p),target=path.join(out,'sources',p);sourceHashes[p.replaceAll('\\','/')]=sha(b);await mkdir(path.dirname(target),{recursive:true});await copyFile(p,target);}
async function captureTree(dir){for(const f of await readdir(dir,{withFileTypes:true})){if(['node_modules','.runtime','evidence'].includes(f.name))continue;const p=path.join(dir,f.name);if(f.isDirectory())await captureTree(p);else await capture(p);}}
await captureTree('packages/contracts');await captureTree('packages/data-format');
for(const p of new Set([...current.flatMap(r=>Object.keys(r.report.sources)),'apps/web/src/local/B024.md','experiments/g02l/B024-plan.md','experiments/g02l/review-b024.mjs','tests/integration/b024-contract.test.mjs']))await capture(p);
const limits=[
 'Client-only synthetic transport ACKs; no real server upload, transaction, deduplication, receipt resolution or generation adoption proof. B031/B032/B033 own those checks.',
 'I17 local durable gate/tab/crash boundary checked; full worker/UI/cold-start integration remains B041/B043/B083. I18 client snapshot and partial ACK checked; server atomicity remains B033.',
 'Reopen checks use local version/ref/byte integrity; device/server reopenState schema/merge/UI remain B043/B082. No arbitrary typed kind enabled beyond dataset.version.create.',
 'Migration v1→v2 is additive local-dev preservation, not production release/rollback/compatibility policy B081.',
 '100 batch/20 atomic group/1MiB metadata boundaries tested. Dependency ID/frame memory is an estimate; physical peak RAM, huge project throughput and 100-user scale remain inconclusive.',
 'Actual crash affects owned synthetic browser processes/profiles only. Profiles/evidence retained; no app data, database or evidence cleanup.',
 'No cloud/mail/AI/hosting/product engine/sparse enabled; no git add/commit/push/deploy.'
];
const status={task:'B024',status:'passed',scope:'Local client outbox snapshot, durable sync gate and ACK foundation',reviewId,generated,checks,
 counts:{currentBrowserCases:38,currentNodeChecks:26,historicalFailedObservations:runs.filter(r=>!current.includes(r)).flatMap(r=>r.report.cases).filter(c=>c.status==='failed').length},
 rawEvidence:current.map(r=>r.dir),rawHistory:runs.map(r=>({path:r.dir,counts:r.report.counts})),sourceHashes,
 criteria:{durableGate:'passed; empty/refresh/multitab/health/reauth and service separation',snapshot:'passed; bounded complete groups, dependency order, later items pending, immutable hashes',ack:'passed; exact membership/hash/generation/disjoint/complete/group, duplicate/stale/error rejection',recovery:'passed; v1 migration and owned browser crash',localCommittedVsSynced:'distinct; newer pending prevents account synced state'},
 V01:{localSyncClient:'passed',overall:'inconclusive'},V04:{localProtocolBoundaries:'passed',peakRAMAndScale:'inconclusive',overall:'inconclusive'},serverCommitVerified:false,limits};
await writeFile(out+'/status.json',JSON.stringify(status,null,2)+'\n',{flag:'wx'});
await writeFile(out+'/report.md','# B024 — local client foundation passed\n\n38 current browser cases (36 Chrome/Edge protocol/multitab + 2 real owned-process crash/reopen), 26 Node contract/regression checks and strict web/API TypeScript passed. Node regressions include repeated existing criteria, not 26 additional product features. Current source hashes match executed browser bundles; all B024 historical manifests verified. No external requests in protocol runs.\n\nExisting unlogged B024 draft and raw evidence were audited, not treated as accepted progress. Corrected current account serverGeneration recheck before ACK; coordinator disposal after queued lock wait; account sync state remains idle while a newer pending item exists; refresh observing offline persists awaitingUser over an existing auto state with an empty queue. New browser tests reproduce these lifecycle boundaries. Original sandbox run failed due loopback/browser restrictions and is retained as environment evidence; subsequent loopback-only run passed outside sandbox.\n\nLocal commit remains durable independently of sync. Only exact snapshot ACK members become acknowledged; records/receipts/bytes retained. Conflict receipt does not move context. Deleted and expiry retain local identity and require the owning reconciliation flow. No claim of real server commit or delivery.\n\nRaw runs:\n'+runs.map(r=>'- '+r.dir+': '+JSON.stringify(r.report.counts)).join('\n')+'\n\nLimits:\n'+limits.map(s=>'- '+s).join('\n')+'\n\nDependency next: B031 depends B030 local server foundation (passed with limits). B032 follows B031; B033 follows B032/B030. B040 still waits B035; do not jump G03.\n',{flag:'wx'});
const hashes={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}
await inventory(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,status:status.status,counts:status.counts,generated}));
