// Finalize only after explicitly recorded visual inspection of current rendered PDFs.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const out=process.argv[2];if(!out?.startsWith('evidence/x06-reviews/'))throw Error('Pass the verified review directory');
const sha=b=>createHash('sha256').update(b).digest('hex'),v=JSON.parse(await readFile(`${out}/verification.json`,'utf8'));
const visual=JSON.parse(await readFile(`${out}/visual-review.json`,'utf8'));if(visual.status!=='passed'||v.pdfGroups.some(g=>g.status!=='passed'))throw Error('Verification or visual review incomplete');
for(const g of v.pdfGroups)for(const p of g.renderedPages)if(!visual.inspectedPages.includes(p))throw Error(`Missing visual review ${p}`);
const complete=v.cases.length===16&&v.cases.every(c=>c.status==='passed');
const status={...v,visualInspection:visual,technicalSurveyClosure:complete?'passed':'inconclusive',V01:{pdfWorkerFontOfflineSurvey:complete?'passed':'inconclusive',overall:'inconclusive',remaining:'Product report UI, arbitrary sections/long content, source resolution, migrations and all export integration remain unverified'},V04:{initialTimingsBytes:'passed',peakWorkerMemory:'inconclusive',overall:'inconclusive'},verifiers:{poppler:'26.07.0',pypdf:'6.10.0',pdfplumber:'0.11.9',scope:'Python tools are independent artifact QA only, never browser/product code'},productCapabilityEnabled:false};
await writeFile(`${out}/status-final.json`,JSON.stringify(status,null,2));
const times=v.cases.filter(c=>c.id.startsWith('X06-pdf-')).map(c=>`| ${c.browser}/${c.network} | ${c.actual.selected.join(',')} | ${c.actual.pageCount} | ${c.actual.sizeBytes} | ${c.actual.exportMs.toFixed(2)} |`).join('\n');
const report=`# G01–X06 / B015 — Xuất/PDF/font/offline

Khảo sát kỹ thuật: ${status.technicalSurveyClosure}.16case hiện hành passed,10failed lịch sử giữ nguyên. Review gom từng case từ các run, không tuyên bố một full rerun mới. OverallV01/V04 vẫn inconclusive; peak worker heap chưa đo; chưa bật exporter sản phẩm.

## Yêu cầu và phạm vi

Phụ thuộc B005 đạt. C03/C12/C13/C14/C20; F22/F23/F31; S20/S21/S23; AC18/FE28/I27 và kế hoạch §4X06. Chỉ experiments/g01 harness/dependency/evidence và PROGRESS. Không app/backend/services thật, không Docker/Mongo/Nginx/cloud/mail/AI. PNG X05 và model PCA X04 là fixture tổng hợp có input hash; không sửa evidence đó, không thử prediction UI.

## Lựa chọn T / ADR

[So sánh trước cài](../../x06-selection.md): pdf-lib1.17.1 + @pdf-lib/fontkit1.1.1 MIT, JS thuần chạy browser worker; jsPDF4.2.1 MIT là ứng viên không cài/benchmark. [API và browser](https://pdf-lib.js.org/), [PDFDocument](https://pdf-lib.js.org/docs/api/classes/pdfdocument), [MIT](https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md), [jsPDF](https://github.com/parallax/jsPDF). T đề xuất explicit layout + section selection và embedded font local, không server PDF service. Thay library cần replay glyph/selection/source/image/precision/worker/cancel/offline, thay font cần bytehash/version/license/glyph/width/wrapping/pagination và cache migration; không tự thay P11.

NotoSans-Regular TTF lấy từ [upstream](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans), [OFL1.1](https://raw.githubusercontent.com/notofonts/noto-fonts/main/LICENSE), lưu nguyên font/OFL trong assets/x06-font. Font569208bytes SHA256 b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5. Bytehash là định danh nguồn; URL main không là version bất biến, không tải lại tự động khi rerun. Unicode normalizeNFC trước layout, không bỏ dấu; NFDfixture được đối chiếu ngữ nghĩa tương đương. Chưa chốt font/package sản phẩm.

Môi trường worker: Node${v.environment.node} điều phối; Windows${v.environment.release}, ${v.environment.cpu}, RAM${v.environment.totalMemoryBytes}; npm11.12.1, Playwright1.64.1/esbuild0.28.2 như lock snapshot. Chrome156.0.8078.76/Edge156.0.4314.58 headless, profiles tạm, loopback. SkillPDF dùng cho QA, scopedartifact theo người dùng. Poppler26.07.0 có pdfinfo/pdftoppm; pdffonts/pdftotext/pdfimages không có nên verifier đầu blocked (lưu attempt-error). Dùng pypdf6.10.0 + pdfplumber0.11.9 sẵn trong bundled runtime để đọc font/text/bounds; không cài toàn hệ thống, không Python trong browser/product.

## Fixture và expected/actual

- PDFfull4pages: bảng55row qua2page, header/source, tiếng Việt Nguyễn/Đặng/Trường/Ắằễộự, ảnh scatterPNG3point từX05 + caption tách rõ ảnh không phải tọa độPCA, phương sai PC1 từfixture, params/metric undefined/userConclusion. Metrics-only1page không có section quality/chart.
- Accuracy .75 là fixture confusion matrix có dòng nguồn synthetic-run-classifier; R² null reason target hằng có nguồn synthetic-run-linear; header PCA không được hiểu rằng metric classifier thuộc PCA. Bổ sung chú thích rồi chỉ rerun PDFcases, không sửaPDFcũ. Mọi source là tổng hợp.
- CSVUTF8/noBOM/comma/CRLF/header, alwaysquote nonnull, escapequote/newline, null token\\N khác empty và stringnull; exactbyte oracle checked. JSONtyped envelope giữ bigint9007199254740993, decimal123456789012345678.123456789, dates2026-11-02/2024-02-29 dưới dạngstring với logicalType. Không hứa spreadsheet auto-importCSV giữtype; policy là Tprobe, cầnUI xác nhận khi triển khai. InvalidNaN/Infinity/unsafeinteger bị chặn, không null/ngầm mấtprecision.
- AppManifest entries URL/size/SHA256 gồm workerbundle/font/chart/model/shell; manifest riêng không tự hash chính nó. SWcache public probeonly, cacheverify exactdependency trước job. Thiếu font→MISSING_DEPENDENCY, corruptmodel→HASH_MISMATCH trướcworker, không networkfallback. Model chỉ byteverified, technical modelreload đã ởX04, không gọi đó là kiểm lại ởX06.
- Cắt networkcontext + origin503 rồi reload/export Chrome/Edge: proof online=false/SWcontrolled=true; origin request cửa sổ cuối rỗng; externalRequests rỗng. Không first-load offline hay fullProject readiness sản phẩm.

## Bằng chứng độc lập và visualQA

8PDF hiện hành có2hashgroup: 4bản full byteidentical và4metrics-only byteidentical qua2browser×2network. verification.json nêu file/hash/provenance từng bản; render từng byte-distinctPDF đủ5trang, không phải bỏ xem trang khác. pypdf tríchtext đúng dấu/sections/source/reason; fontNoto embedded/subset/ToUnicode; pdfplumber mọi char bbox nằm trong page; cóimage ởfull; pdfinfo pagecount khớp.

Đã xem cả5PNG mới nhất: chữ Việt rõ, bảng không cắt, ảnh có nội dung/caption nguồn rõ, header/footer/pagecount đúng, không chồng/tràn/glyph ôvuông. visual-review.json ghi danh sách đã xem và giới hạn85dpi; không suy ra template mọi chiều dài đã đạt. status-final.json đóng khảo sát sauvisual; verification.json pending cũ giữ nguyên như bước trung gian. Hashes-final.json bổ sung output mới, không ghi đèhashes banđầu.

## Số đo

Bundlebrowser-worker2198080bytes; font569208bytes; PNG17729bytes; model628bytes. performance.now trongworker bao gồm create/embed/layout/save/reload, không build/download/postMessage. Một lượt/fixture, không SLA hay peakRAM. FullPDF27733bytes, metrics-only12169bytes.

| Browser/network | Selected sections | Pages | PDFbytes | Export ms |
| --- | --- | --- | --- | --- |
${times}

## Lỗi giữ lại / rerun có lý do

13:06:45:6pass/10fail. Ca injection dùng Responsefont hai lần khi restorecache nên bodyused, finally không restoremodel khiến offlinefail; không lỗi libPDF. Sửa cloneResponse.13:07:49 chỉmissing/corrupt online +mọi caoffline bị ảnh hưởng,10pass.13:11:20 chỉPDF8case sau bổ sung nguồn metric. Không rerun X04/X05 hoặcCSV/dependency đã đạt. Rawrun/evidence cũ hashunchanged=true; packages thay đổi chỉ dependencyharnesslocal, các manifesthash lịch sử không bị viết lại.

## Chạy lại

Từ experiments/g01:

~~~powershell
npm ci --ignore-scripts --no-audit --no-fund --cache .runtime/npm-cache
# FullX06 khi có lý do cần replaytoànbộ:
node run-x06.mjs
# Hoặc ca cầnkiểm, không lặp mọi case:
$env:X06_CASES='online:X06-missing-and-corrupt-dependency,offline:*'
node run-x06.mjs
Remove-Item Env:X06_CASES
node x06-verify.mjs
# Xem các PNG trongreview mới, ghi visual-review.json sau khi xem thật:
node x06-finalize.mjs <evidence/x06-reviews/review-id>
~~~

X06_QA_PYTHON có thể chỉ bundledpython khác; cần pypdf/pdfplumber và Popplerpdfinfo/pdftoppm trongPATH. Font/assets đã vendored, không tải lại ngoài khi test. Mỗi run/review timestamp mới. Không tự approvevisual khi chưa xem.

## Giới hạn / việc sau

Chưa kiểm mọi sự kết hợp section/dữliệu bất kỳ, charttypes, hugePDF/RAM/cancelPDF, projectsource resolver/savepermissions, releasewindow/migration/offline toànproject. CSVnulltoken collisionpolicy cóguard trongprobe nhưng chưacase riêng; không coi đó là nghiệmthu toànserializer. V01PDF/font/localofflineprobe passed; V04 timingbytes banđầu passed, peakworkerRAM/100user/release vẫn inconclusive. Phải hoàn thiện B073/B080/B081 trước bậtcapability tươngứng.

File đổi: package*.json thêm exactpdf-lib/fontkit; assets/x06-font(font+OFL); x06-worker.mjs/run-x06.mjs/x06-verify.mjs/x06-pdf-inspect.py/x06-finalize.mjs; evidence/x06-selection.md/runs/reviews; PROGRESS. Giữ nguyên app/docs/prompt và evidenceX01–X05. Tiếp theo B016/X07: đọc C18–C21/F24/F27/S26/S27/WS/BE, preflightNginx/TLS/storage/Mongo dev trước khi chạy; không cloud hay containerfinance-app.
`;
await writeFile(`${out}/report-final.md`,report);
const hashes={};for(const f of await readdir(out))if(f!=='hashes-final.json')hashes[f]=sha(await readFile(`${out}/${f}`));for(const f of ['x06-finalize.mjs','x06-verify.mjs','x06-pdf-inspect.py','assets/x06-font/NotoSans-Regular.ttf','assets/x06-font/OFL.txt'])hashes[f]=sha(await readFile(f));await writeFile(`${out}/hashes-final.json`,JSON.stringify({algorithm:'SHA-256',files:hashes},null,2));console.log(JSON.stringify({out,status:status.technicalSurveyClosure,counts:status.counts},null,2));
