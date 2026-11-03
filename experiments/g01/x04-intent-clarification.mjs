// Documentary correction only: no browser/ML rerun and no historical overwrite.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const prior='evidence/x04-audits/2026-11-02T12-48-34-664Z';
const id=new Date().toISOString().replace(/[:.]/g,'-'),out='evidence/x04-audits/'+id;
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await readFile(prior+'/status-corrected.json'),old=JSON.parse(bytes);
for(const[p,h]of Object.entries(old.originalHashes))if(hash(await readFile(p))!==h)throw Error('Original evidence changed '+p);
await mkdir(out,{recursive:true});
const status={...old,kind:'post-run-audit-intent-wording-clarification-no-ML-rerun',reviewId:id,supersedes:{file:prior+'/status-corrected.json',sha256:hash(bytes),scope:'Screenshot intent wording/status only; counts, memory and capability closure unchanged'},screenshots:{...old.screenshots,status:'inconclusive',consistencyStatus:'passed',creatorIntentStatus:'inconclusive',needsOwnerOrAuthorCrossCheck:true,explanation:'Runner renders only IDs/status/shape fields; reconstructed payloads and PNG bytes match. This explains consistency of identical images, but does not independently establish that the creator intended the Chrome and Edge screenshots to be identical. Keep intent as a point requiring owner/author cross-check; do not conclude the images are wrong or copied. JSON retains browser versions; screenshots alone do not establish browser identity.'}};
await writeFile(out+'/status-corrected.json',JSON.stringify(status,null,2)+'\n',{flag:'wx'});
const report='# X04 — đính chính diễn đạt về ý định hai ảnh\n\nBản audit trước dùng “cố ý”/“intentionally”; mã runner chỉ chứng minh cơ chế render, không độc lập xác nhận ý định tác giả. Không suy ra ý định từ việc payload/PNG trùng nhau.\n\n- Consistency: passed — biểu thức runner chỉ đưa ID/status/shape vào ảnh, hai payload tái dựng và bytePNG giống nhau.\n- Creator intent: inconclusive — **điểm cần chủ dự án/tác giả đối chiếu**: hai ảnh có được chủ ý thiết kế giống nhau hay không.\n- Không kết luận ảnh sai hoặc copy, không đổi/xóa ảnh/run/audit trước, không chạy lại ML/browser.\n- Counts giữ nguyên:198passed/20blocked/0inconclusive ca thực,5workerPeakMemory findingsinconclusive. Khảo sát dense được đóng có giới hạn; sparse solve/product enablement vẫnblocked, Voverallinconclusive.\n\nAudit được bổ sung: '+prior+'. status mới chứa supersedes SHA; hashes mới bao gồm status/report/source. Tất cả originalHashes từ audit cũ đã được kiểm lại không đổi.\n';
await writeFile(out+'/report-corrected.md',report,{flag:'wx'});
const hashes={};for(const p of ['status-corrected.json','report-corrected.md'])hashes[p]=hash(await readFile(out+'/'+p));
await writeFile(out+'/hashes.json',JSON.stringify({algorithm:'SHA-256',priorAudit:{path:prior+'/status-corrected.json',relativeTo:'experiments/g01',sha256:hash(bytes)},source:{path:'x04-intent-clarification.mjs',relativeTo:'experiments/g01',sha256:hash(await readFile(fileURLToPath(import.meta.url)))},outputsRelativeTo:'this audit directory',outputs:hashes},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,consistencyStatus:'passed',creatorIntentStatus:'inconclusive',originalEvidenceUnchanged:true}));
