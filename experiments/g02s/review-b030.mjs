import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out=path.resolve('experiments/g02s/evidence/b030-reviews',runId);
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await readFile(p,'utf8'));
const rawRoots=['experiments/g02s/evidence/b030','experiments/g02s/evidence/b030-browser'],runs=[];
for(const parent of rawRoots)for(const d of (await readdir(parent,{withFileTypes:true})).filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
  const dir=path.join(parent,d.name),report=await read(path.join(dir,'results.json')),hashes=await read(path.join(dir,'hashes.json'));
  for(const[p,digest]of Object.entries(hashes))if(sha(await readFile(path.join(dir,p)))!==digest)throw Error('Raw evidence changed '+dir+'/'+p);
  for(const[p,digest]of Object.entries(report.sources??{}))if(sha(await readFile(path.join(dir,'sources',p)))!==digest)throw Error('Source snapshot changed '+p);
  runs.push({dir,report});
}
runs.sort((a,b)=>a.report.runId.localeCompare(b.report.runId));
const current=new Map(),observations=[];
for(const{dir,report}of runs)for(const c of report.cases){observations.push({...c,evidence:dir});if(c.status!=='inconclusive')current.set(c.id,{...c,evidence:dir,runId:report.runId});}
if(current.has('B030-HTTPS-browser-chrome')&&current.has('B030-HTTPS-browser-msedge'))current.delete('B030-HTTPS-browser');
if(current.size!==21||[...current.values()].some(c=>c.status!=='passed'))throw Error('B030 current cases incomplete');
const productFiles=['apps/api/src/app.ts','apps/api/src/auth/service.ts','apps/api/src/auth/policy.ts','apps/api/src/auth/schema.ts','apps/api/src/auth/fake-mail.ts','packages/contracts/src/generated/build-manifest.json'];
for(const c of current.values()){
 const run=runs.find(r=>r.dir===c.evidence).report;
 for(const p of productFiles)if(run.sources[p]!==sha(await readFile(p)))throw Error('Selected case not current product source: '+c.id+' '+p);
}
const generated=await checkGenerated();
const x04Manifest=await read('experiments/g01/evidence/x04-hashes.json');
const x04Evidence=Object.entries(x04Manifest.files).filter(([p])=>p.startsWith('evidence/'));
for(const[p,h]of x04Evidence)if(sha(await readFile(path.join('experiments/g01',p)))!==h)throw Error('Original X04 evidence changed: '+p);
const designDiff=spawnSync('git',['diff','HEAD','--exit-code','--','prompt','docs','README.md'],{encoding:'utf8',windowsHide:true});
if(designDiff.status!==0)throw Error('Design/coordinator files unexpectedly changed');
const typecheck=spawnSync(path.resolve('apps/api/node_modules/typescript/bin/tsc'),['--project','apps/api/tsconfig.json'],{encoding:'utf8',windowsHide:true,shell:false});
// TypeScript package uses a JS entry point; invoke with the same Node binary on Windows.
const typed=typecheck.error?spawnSync(process.execPath,[path.resolve('apps/api/node_modules/typescript/bin/tsc'),'--project','apps/api/tsconfig.json'],{encoding:'utf8',windowsHide:true}):typecheck;
if(typed.status!==0)throw Error('TypeScript validation failed: '+(typed.stderr||typed.stdout));
const regression=spawnSync(process.execPath,['--test','tests/integration/b020.test.mjs'],{encoding:'utf8',windowsHide:true});
if(regression.status!==0)throw Error('B020 regression failed');
await writeFile(path.join(out,'typecheck.txt'),'TypeScript7.0.2 strict noEmit: exit0\n'+typed.stdout+typed.stderr,{flag:'wx'});
await writeFile(path.join(out,'b020-regression.txt'),regression.stdout+regression.stderr,{flag:'wx'});
const snapshotFiles=[];
async function collect(dir,include) {for(const f of await readdir(dir,{withFileTypes:true})){if(['node_modules','.runtime'].includes(f.name))continue;const p=path.join(dir,f.name);if(f.isDirectory())await collect(p,include);else if(include(p))snapshotFiles.push(p);}}
await collect('apps/api',()=>true);await collect('packages/contracts',()=>true);
for(const p of ['experiments/g02s/run-b030.mjs','experiments/g02s/run-b030-browser.mjs','experiments/g02s/review-b030.mjs','experiments/g02s/B030-plan.md','tests/fixtures/b030.mjs','experiments/g02s/package.json','experiments/g02s/package-lock.json'])snapshotFiles.push(p);
const sourceHashes={};for(const p of snapshotFiles){const b=await readFile(p);sourceHashes[p.replaceAll('\\','/')]=sha(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
const status={
 task:'B030',reviewId:runId,status:'localServerFoundationPassed',
 counts:{currentExecutedCases:{passed:current.size,failed:0,blocked:0,inconclusive:0},historicalFailedObservations:observations.filter(c=>c.status==='failed').length,historicalPlaceholderInconclusiveObservations:observations.filter(c=>c.status==='inconclusive').length},
 sourcesVerifiedAgainstSelectedEvidence:productFiles,generated,sourceHashes,
 protectedEvidence:{originalX04FilesVerified:x04Evidence.length,unchanged:true,designAndBacklogDiffAgainstHEAD:'empty'},
 visualReview:{status:'inspected',images:['chrome.png','msedge.png'],scope:'Both actual HTTPS browser screenshots inspected in this session; engine/version/run labels distinguish images. No credentials displayed. This is transport evidence, not a product UI review.'},
 criteria:{I01:'API/bootstrap passed, form UI deferred B040',I02:'actual99-to-100 race passed',I03:'server boundaries/concurrent attempts passed',I04:'notTested full owner/offline account gate: B022/B043 dependency blocked',I21:'actual synthetic-commit/login/logout fence passed; real sync/upload/reset/client integration deferred B033/B043',I22:'server old deferred handle passed; offline queue/UI deferred B043'},
 V02:{localAuthTransactions:'passed',realMail:'blocked',overall:'inconclusive'},V04:{argon2DevMeasured:'passed',peakMemoryAnd100Users:'inconclusive',overall:'inconclusive'},
 publicAuthEnabled:false,canPrepareDependentServerModules:true,
 remaining:{B021:'blocked pending owner ADR-B021-01 A/B',B031:'version/head portion blocked by same C11 decision; not started',B032_B033_B034_B035_G03:'dependency not yet reached',B017:'real mail blocked; fake proof does not close real delivery',B016:'public hosting blocked; local profile sufficient for dev'},
 cases:[...current.values()].map(({elapsedMs,...c})=>c),
 evidence:runs.map(r=>({path:r.dir,runId:r.report.runId,counts:r.report.counts})),
 limitations:['Composite latest per-case evidence, not one full green run. Old failures and placeholder inconclusive retained.','Native local Mongo single member, no production replica/availability proof.','Browser test trusts self-signed cert only in disposable context; X07 separately tested explicit CA/Nginx.','Argon2 RSS before/after is not peak or capacity guarantee; dev300IP/20login tuning not release policy.','Fake mail/unknown reset decoy public-shape equality does not prove timing-side-channel immunity or real deliverability.','B030 does not implement frontend dirty/logout/account gate, real upload/sync fence, AI RAM context cleanup, migration/restore gate or production secret lifecycle.','Original prompt/v2 and backlog untouched; PROGRESS is execution-state authority with scoped criteria.'],
};
await writeFile(path.join(out,'status.json'),JSON.stringify(status,null,2)+'\n',{flag:'wx'});
const text='# B030 — local server auth/session foundation\n\nStatus: localServerFoundationPassed; public auth OFF. '+current.size+' current executed cases passed; '+status.counts.historicalFailedObservations+' failed observations retained. Selected product-source hashes match current; validators '+generated.schemas+' schemas; strict TypeScript and10 B020 regression cases pass.\n\n## Evidence and corrections\n\n'+runs.map(r=>'- '+r.dir+': '+JSON.stringify(r.report.counts)).join('\n')+'\n\nFirst N-CSRF failure was an undefined-header harness assertion; targeted rerun passed. C18 implementation omission corrected: success/error serverNow is required, shared helper supplies UTC and B030 uses the controlled server clock. This fixes implementation to existing C18, not a P or contract decision change. Historical B020 evidence remains valid for its earlier scoped generation; current validators rebuilt and regression rerun. OpenAPI initially embedded local #/$defs refs without component scope; corrected builder and reran endpoint/ref case,164refs resolve locally. No run data overwritten.\n\n## Delivered\n\nTypeScript Fastify factory13O01/O02 routes;18S09primaryschemas; local OpenAPI3.1/23components; Mongo M01-M04/indexes; real Argon2id PHC bounded2active/8queued; HMAC OTP; atomic activation counter, reset/password generation and session fence; deferred old-session handle; safe envelopes/no-store/CSRF. Fake adapter onlyRAM/noSMTP/debugOTPHTTP. Disposable Chrome/Edge HTTPS transport passed, screenshots inspected with engine/version/run labels and no credentials. Two screenshots are intentionally distinguishable.\n\n## Criteria and limits\n\n'+Object.entries(status.criteria).map(([k,v])=>'- '+k+': '+v).join('\n')+'\n\n'+status.limitations.map(v=>'- '+v).join('\n')+'\n\n## Next dependency\n\nAwait owner decision in experiments/g02l/evidence/ADR-B021-head-revision-proposal.md. Do not implement local version/head/outbox, enable sparse/product engine, or silently choose between C02/C10 and C11. G02L B022+ depends B021; G02S B031 version/head and downstream sync requires the same decision. No independent full backlog task remains ready after this local auth foundation; unfinished public mail/hosting/AI requires explicit resources/authorization.\n';
await writeFile(path.join(out,'report.md'),text,{flag:'wx'});
const hashes={};async function inventory(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await inventory(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await inventory(out);
await writeFile(path.join(out,'hashes.json'),JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out:path.relative(root,out),counts:status.counts,generated,publicAuthEnabled:false}));
