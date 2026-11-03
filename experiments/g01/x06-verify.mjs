// Independent PDF verification, immutable review outputs, no browser rerun.
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex'),out=`evidence/x06-reviews/${new Date().toISOString().replace(/[:.]/g,'-')}`;await mkdir(out,{recursive:true});
const map=new Map(),runs=[],historicalFailures=[];
for(const dir of (await readdir('evidence/x06-runs')).sort()){const file=`evidence/x06-runs/${dir}/results.json`,r=JSON.parse(await readFile(file,'utf8'));if(!r.finishedAt)throw Error('unfinished run');runs.push({file,r});for(const b of r.browsers)for(const m of b.modes)for(const c of m.cases){const key=`${b.channel}/${m.network}/${c.id}`;map.set(key,{browser:b.channel,version:b.version,network:m.network,source:file,...c});if(c.status==='failed')historicalFailures.push({key,source:file,actual:c.actual});}}
const cases=[...map.values()],counts={passed:0,failed:0,inconclusive:0,blocked:0};for(const c of cases)counts[c.status]++;
const groups=new Map();for(const c of cases.filter(c=>c.id.startsWith('X06-pdf-')&&c.status==='passed')){const file=`${path.dirname(c.source)}/${c.actual.file}`,h=sha(await readFile(file));if(h!==c.actual.sha256)throw Error('artifact hash mismatch');if(!groups.has(h))groups.set(h,{hash:h,file,selected:c.actual.selected,expectedPageCount:c.actual.pageCount,equivalentArtifacts:[]});groups.get(h).equivalentArtifacts.push(file);}
const checks=[];let index=0;
for(const g of groups.values()){const prefix=`${out}/pdf-${++index}`,textFile=`${prefix}.txt`,bboxFile=`${prefix}-bbox.html`;
const info=execFileSync('pdfinfo',[g.file],{encoding:'utf8',windowsHide:true});
const python=process.env.X06_QA_PYTHON??'C:/Users/LAPTOP/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
execFileSync(python,['x06-pdf-inspect.py',g.file,prefix],{windowsHide:true});execFileSync('pdftoppm',['-r','85','-png',g.file,prefix],{windowsHide:true});
const text=(await readFile(textFile,'utf8')).normalize('NFC'),flat=text.replace(/\s+/g,' '),fonts=JSON.parse(await readFile(`${prefix}-fonts.json`,'utf8')),bounds=JSON.parse(await readFile(`${prefix}-bounds.json`,'utf8'));const boundsPassed=bounds.boundsPassed;
const full=g.selected.includes('quality'),textPassed=flat.includes('Không xác định')&&flat.includes('target hằng')&&flat.includes('Kết luận do người dùng nhập')&&flat.includes('A-V0')&&(full?flat.includes('Nguyễn, Đặng, Trường')&&flat.includes('Ắ ằ ễ ộ ự')&&flat.includes('Cột số 55')&&flat.includes('PC1 giải thích 100% phương sai'):!flat.includes('Chất lượng dữ liệu')&&!flat.includes('Biểu đồ và nguồn'));
const pageCount=Number(info.match(/Pages:\s+(\d+)/)?.[1]),embeddedFont=fonts.length>0&&fonts.every(f=>f.name.includes('NotoSans')&&f.embedded&&f.toUnicode),passed=textPassed&&boundsPassed&&embeddedFont&&pageCount===g.expectedPageCount&&(!full||bounds.imageCount>0);
await writeFile(`${prefix}-pdfinfo.txt`,info);
checks.push({...g,status:passed?'passed':'failed',pageCount,textPassed,boundsPassed,embeddedFont,charCount:bounds.charCount,imageCount:bounds.imageCount,renderedPages:(await readdir(out)).filter(f=>f.startsWith(`pdf-${index}-`)&&f.endsWith('.png')),renderPrefix:prefix,visualInspection:'pending; inspect PNGs before closing B015'});}
const last=runs.at(-1).r;const review={experiment:'X06',task:'B015',kind:'independent Poppler verification, no export rerun',counts:{executedCases:counts,historicalFailures:historicalFailures.length,workerPeakMemory:{inconclusive:1,scope:'finding only, not an executed case'}},cases,historicalFailures,environment:last.environment,pdfGroups:checks,visualInspection:'pending',technicalSurveyClosure:'inconclusive',V01:'inconclusive until visual QA and product integration as applicable',V04:'inconclusive; timing/bytes only, peak memory not measured',runs:runs.map(r=>r.file),popplerVersion:execFileSync('pdftoppm',['-v'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})};
await writeFile(`${out}/verification.json`,JSON.stringify(review,null,2));const hashes={};for(const f of await readdir(out))hashes[f]=sha(await readFile(`${out}/${f}`));await writeFile(`${out}/hashes.json`,JSON.stringify({algorithm:'SHA-256',files:hashes},null,2));
console.log(JSON.stringify({out,counts,groups:checks.map(g=>({file:g.file,status:g.status,textPassed:g.textPassed,boundsPassed:g.boundsPassed,embeddedFont:g.embeddedFont,pageCount:g.pageCount,renderedPages:g.renderedPages})),visualInspection:'pending'},null,2));
