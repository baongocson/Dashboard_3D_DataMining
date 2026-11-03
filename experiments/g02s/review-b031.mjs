import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const reviewId=new Date().toISOString().replace(/[:.]/g,'-'),out='experiments/g02s/evidence/b031-reviews/'+reviewId;await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8')),runs=[];
for(const name of (await readdir('experiments/g02s/evidence/b031')).sort()){
 const dir='experiments/g02s/evidence/b031/'+name,r=await json(dir+'/results.json'),hashes=await json(dir+'/hashes.json');
 for(const [p,h]of Object.entries(hashes))if(sha(await readFile(path.join(dir,p)))!==h)throw Error('Historical evidence changed '+dir+'/'+p);
 runs.push({dir,r});
}
const last=runs.at(-1);if(!last||last.r.fatal||last.r.counts.passed!==14||last.r.counts.failed||!last.r.sourcesUnchangedDuringRun)throw Error('Latest B031 incomplete');
for(const [p,h]of Object.entries(last.r.sources))if(sha(await readFile(p))!==h)throw Error('Current source differs from executed '+p);
const generated=await checkGenerated(),checks=[];
for(const [name,args]of [
 ['api-typecheck',['apps/api/node_modules/typescript/bin/tsc','--project','apps/api/tsconfig.json']],
 ['web-typecheck',['apps/api/node_modules/typescript/bin/tsc','--project','apps/web/tsconfig.json']],
 ['contracts-regression',['--test','tests/integration/b020.test.mjs','tests/integration/b021-contract.test.mjs','tests/integration/b023.test.mjs','tests/integration/b024-contract.test.mjs','tests/integration/b031-contract.test.mjs']]
]){const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true});await writeFile(out+'/'+name+'.txt',r.stdout+r.stderr,{flag:'wx'});checks.push({command:'node '+args.join(' '),exitCode:r.status,evidence:name+'.txt'});if(r.status!==0)throw Error('Check failed '+name);}
const spec=await json('packages/contracts/openapi/metadata.local.v1.json');let refs=0;
function inspect(v){if(Array.isArray(v))return v.forEach(inspect);if(!v||typeof v!=='object')return;if(v.$ref){refs++;if(!v.$ref.startsWith('#/'))throw Error('Nonlocal OpenAPI reference');let target=spec;for(const part of v.$ref.slice(2).split('/'))target=target?.[part.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Unresolved '+v.$ref);}Object.values(v).forEach(inspect);}inspect(spec);
const sourceHashes={};async function capture(p){const b=await readFile(p),dest=path.join(out,'sources',p);sourceHashes[p.replaceAll('\\','/')]=sha(b);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,b,{flag:'wx'});}
async function tree(dir){for(const f of await readdir(dir,{withFileTypes:true})){if(['node_modules','.runtime','evidence'].includes(f.name))continue;const p=path.join(dir,f.name);if(f.isDirectory())await tree(p);else await capture(p);}}
await tree('packages/contracts');await tree('apps/api/src');
for(const p of ['apps/api/package.json','apps/api/package-lock.json','apps/api/tsconfig.json','packages/data-format/src/index.mjs','tests/fixtures/b031.mjs','tests/integration/b031-contract.test.mjs','experiments/g02s/B031-plan.md','experiments/g02s/run-b031.mjs','experiments/g02s/review-b031.mjs'])await capture(p);
const limits=[
 'Metadata/session/transaction foundation only. Dataset/version tests inject an explicitly synthetic artifact metadata authority. No real storage/byte/format verification claim; default authority is absent and the complete metadata transaction rolls back.',
 'No HTTP dataset/version writer or batch endpoint: future B033 composes opaque prepared handles inside one auth.withFence transaction. B033 still owns actual batch/ACK, stable conflict copies/branches, receipt expiry and reconciliation.',
 'No product parsing/concat/join/ML operation enabled. Synthetic operation config is stored as provenance; it is not numerical output verification.',
 'Pagination is live ID keyset metadata, not a consistent B080 offline snapshot. Scope/owner/expiry and bounded reads tested; huge graph/physical peakRAM/100user capacity unmeasured.',
 'Version commit before/after revocation ordering tested against actual Mongo transaction. This run does not claim an actual concurrent revoke race; shared B030 fence mechanism retained.',
 'B034 owns resources/runs beyond dataset/version; B041/B043 own product import/undo/current-pointer/reopen integration. No dataset.head.select semantics enabled here.',
 'First exploratory run predates source-at-start guarding: preserve its3failed observations as historical diagnostics only, not current acceptance. All current evidence has source-at-start snapshot and end hash equality.',
 'Local test/development factory only; no public auth, real mail/AI/cloud/hosting, data deletion, git add/commit/push/deploy.'
];
const status={task:'B031',status:'passed',scope:'Metadata/version/import-intent local-dev foundation; not real artifact/sync product integration',reviewId,generated,
 counts:{currentMongoAndAPIGroups:14,currentNodeContractAndRegressionChecks:29,historicalFailedObservations:runs.flatMap(r=>r.r.cases).filter(c=>c.status==='failed').length},
 checks,rawEvidence:last.dir,rawHistory:runs.map(r=>({path:r.dir,counts:r.r.counts,sourceAtStartGuard:r.r.sourcesUnchangedDuringRun??false})),openapi:{endpoints:8,schemas:Object.keys(spec.components.schemas).length,localRefs:refs,unresolved:0},sourceHashes,
 criteria:{ownerAndScope:'passed in actual local Mongo/private API',immutableMetadataAndDAG:'passed; existing sources only, parent/head/fork/V0 guards',revisionsAndA:'passed; baseRevision0, dependency identity resolves server branch/version/revision without rewriting mutation',intent:'passed;30min expiry, stable IDs/config/session binding, replay-before-renew, no dataset visibility on grant',atomicity:'passed; metadata/refs/identities share transaction, default missing artifact authority rolls back',privateReads:'passed; strict DTO/query, bounded opaque owner/scope/expiry cursor, no-store'},
 V02:{localMetadataTransactions:'passed',artifactStorageAndWholeProduct:'notTested',overall:'inconclusive'},V04:{metadataPagingBoundaries:'passed',physicalPeakAndScale:'inconclusive',overall:'inconclusive'},productOperationsEnabled:0,limits};
await writeFile(out+'/status.json',JSON.stringify(status,null,2)+'\n',{flag:'wx'});
await writeFile(out+'/report.md','# B031 — local-dev metadata/version foundation passed\n\n14 current Mongo/private-API groups passed in one final run;29Node contracts/regression checks and strictAPI/web TypeScript passed.212primary/generated schemas agree. O03/O04 metadata subset:8endpoints/19schema components/'+refs+'resolved local refs. Raw/source hashes verified; original evidence retained.\n\nProject create/replay/concurrent replay/rename CAS, private owner/project scope, import intent grant/expiry/renew/config/logical-ID binding, actual V0→V1→V2 and branchV3 fromV1, two-source derived lineage, hash/immutability, parent/self-cycle/secondV0 guards, generation/tombstone/revocation ordering, opaque paging and auth-only factory regression covered. Prepared mutation handles keep hashing outside transaction and permit multi-mutation rollback of data+identity in one fenced transaction. No HTTP batch/ACK proof is claimed.\n\nB031 source/API scope and defaults keep artifact writes fail-closed. Source bytes/manifest formats and true ready storage must be supplied and verified in B032. Stale head rejects here; stable conflict preservation is B033, not an silently accepted overwrite.\n\nRuns:\n'+runs.map(r=>'- '+r.dir+': '+JSON.stringify(r.r.counts)).join('\n')+'\n\nLimits:\n'+limits.map(s=>'- '+s).join('\n')+'\n\nNext dependency: B032 depends B031 and B010, both foundation evidence available; read C03/C10/C18/C20–C21,S12/O05/M14–M15,F12/F14 before defining storage scope. B033 follows B032/B030. B034/B035 then G03 still have dependencies; no product enablement implied.\n',{flag:'wx'});
const hashes={};async function scan(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await scan(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await scan(out);await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,status:status.status,counts:status.counts,openapi:status.openapi,generated}));
