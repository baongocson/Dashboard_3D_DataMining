// Derive the readable X04 report from a completed run; never edits project designs.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const latest=JSON.parse(await readFile('evidence/x04-latest.json','utf8'));
const base=path.dirname(latest.results),r=JSON.parse(await readFile(`evidence/${latest.results}`,'utf8'));
const algs=['linear','logistic','knn','kmeans','pca'];
const entries=r.browsers.flatMap(b=>b.modes.flatMap(m=>m.algorithms.map(a=>({browser:b.channel,network:m.network,...a}))));
const counts={passed:0,failed:0,inconclusive:0,blocked:0};
for(const a of entries)for(const c of [...a.cases,...a.scale])counts[c.status]++;
const allCases=(alg,suffix)=>entries.filter(a=>a.algorithm===alg).flatMap(a=>a.cases.filter(c=>c.id.endsWith(suffix)));
const status=(alg,suffix)=>{const cases=allCases(alg,suffix);return cases.length!==4?'inconclusive':cases.every(c=>c.status==='passed')?'passed':cases.some(c=>c.status==='failed')?'failed':cases.some(c=>c.status==='inconclusive')?'inconclusive':'blocked';};
const capabilities={};for(const a of algs)capabilities[a]={browserWorker:status(a,'dense-oracle'),dense:status(a,'dense-oracle'),sparse:status(a,'sparse-native'),seedRepeat:status(a,'seed-repeat'),cancel:status(a,'cancel'),modelRoundtrip:status(a,'fresh-worker-roundtrip'),chrome:entries.filter(e=>e.algorithm===a&&e.browser==='chrome').every(e=>e.cases.filter(c=>!c.id.endsWith('sparse-native')).every(c=>c.status==='passed'))?'passed':'inconclusive',edge:entries.filter(e=>e.algorithm===a&&e.browser==='msedge').every(e=>e.cases.filter(c=>!c.id.endsWith('sparse-native')).every(c=>c.status==='passed'))?'passed':'inconclusive',workerPeakMemory:'inconclusive'};
const complete=entries.length===20&&!r.browsers.some(b=>b.failure)&&counts.failed===0&&counts.inconclusive===0;
const verification={experiment:'X04',task:'B013',runId:r.runId,results:latest.results,counts,capabilities,closure:{status:complete?'passed':'inconclusive',scope:'technical investigation of five dense CPU browser candidates, with sparse unsupported explicitly recorded; not approval to enable product adapters',allProductRequirementsAccepted:false},V01:{status:'inconclusive',verified:'Five dense worker engines; offline cached reload; licenses/versions; seed repeat; multiclass classifiers; numeric/text/category train-only probe; technical model reload; terminate and target close',blocked:'Native CSR solve in all five selected versions',remaining:'UI/3D/chart/export/local-store integration and production serializer/pipeline validators are outside X04'},V04:{status:'inconclusive',verified:'Per-estimator fit/predict timing, bounded termination, page timer proxy, 1k/10k/50k synthetic cases on this machine',remaining:'Trustworthy per-worker peak RAM, FPS, 100 concurrent users and release window not verified'},protectedEvidenceUnchanged:r.protectedEvidenceUnchanged};
await writeFile('evidence/x04-status.json',JSON.stringify(verification,null,2));
const rows=[['Browser/Worker','browserWorker'],['Dense input','dense'],['Sparse input (native CSR solve)','sparse'],['Seed/tái lập','seedRepeat'],['Hủy tác vụ','cancel'],['Xuất–nạp model','modelRoundtrip'],['Chrome (dense)','chrome'],['Edge (dense)','edge'],['Bộ nhớ đỉnh worker','workerPeakMemory']].map(([label,key])=>`| ${label} | ${algs.map(a=>capabilities[a][key]).join(' | ')} |`).join('\n');
const scaleRows=entries.flatMap(a=>a.scale.map(s=>{const v=s.actual?.value;return `| ${a.browser}/${a.network} | ${a.algorithm} | ${s.rows??''} × ${s.cols??''} | ${v?.trainRows??''} | ${v?.queryRows??''} | ${v?.fitMs?.toFixed(2)??''} | ${v?.predictMs?.toFixed(2)??''} | ${s.actual?.uiHeartbeat?.maxTickGapMs?.toFixed(2)??''} | ${s.status} |`;})).join('\n');
const matrixFile=`${base}/results.json`;
const dependencies=JSON.parse(await readFile(`evidence/${base}/dependencies.json`,'utf8'));
const report=`# G01–X04 — Engine browser, dữ liệu tổng hợp

Run cuối: ${r.runId}; bắt đầu ${r.startedAt}, kết thúc ${r.finishedAt}. Kết quả: ${JSON.stringify(counts)}. Đây là số ca trên 5 thuật toán × Chrome/Edge × online/offline, không phải số tính năng sản phẩm. Memory không cộng vào các ca passed; trạng thái riêng là inconclusive.

## Kết luận và phạm vi

${complete?'Đủ bằng chứng đóng bước khảo sát kỹ thuật X04/B013 với các giới hạn bên dưới.':'Chưa đủ bằng chứng đóng X04.'} Không đánh dấu toàn bộ V01/V04 đạt và không bật adapter sản phẩm. Native sparse không được hỗ trợ bởi các phiên bản được thử; không bỏ yêu cầu P, không chuyển CSR thành dense ngầm. Phần phụ thuộc sparse phải còn bị chặn hoặc tiếp tục tìm ứng viên. Peak RAM và mức tải phát hành chưa được nghiệm thu.

Đã đọc kế hoạch, B013, C04/C12/C20, thiết kế thuật toán/FE/offline/BE và harness/bằng chứng X01–X03. X04 đòi hỏi oracle độc lập, train-only, params/đa lớp/sparse/cancel/roundtrip, worker không Node/CDN/Python, offline và số đo ban đầu. V01 là xác minh thư viện; V04 là limits/FPS/100 người/release window. X01–X03 không chứng minh engine. Tái sử dụng cách Playwright Chrome/Edge, profile tạm, loopback, JSON/screenshot; không gọi runner MongoDB. B010–B013 trong backlog còn PLANNED dù có evidence các lượt chạy: không tự sửa backlog vì phạm vi chỉ experiments/g01; x04-status.json là bản đối chiếu cục bộ.

## Môi trường và lựa chọn T

- ${r.environment.os} ${r.environment.release} ${r.environment.arch}; ${r.environment.cpu}; ${r.environment.logicalCPUs} logical CPUs; RAM ${r.environment.totalMemoryBytes} bytes.
- Node ${r.environment.node}; npm ${r.environment.npm}; Playwright ${r.environment.playwright}; esbuild ${r.environment.esbuild}.
- ${r.browsers.map(b=>`${b.channel} ${b.version}`).join('; ')}; headless, context/profile tạm do Playwright tạo, không profile cá nhân.
- ${Object.entries(r.versions).map(([a,v])=>`${a}: ${v}`).join('; ')}; ml-matrix 6.15.1. Tất cả các package ML và esbuild trên mang MIT; dependencies.json ghi phiên bản/giấy phép. Lock khóa dependency bắc cầu.
- Chọn module ml.js CPU JS vì có API cho cả năm thuật toán và bundle worker nhỏ (${dependencies.bundleBytes} bytes, không phải ngân sách RAM). TensorFlow.js Apache-2.0 đã so sánh tài liệu, không cài/benchmark. [So sánh và nguồn chính thức](x04-selection.md); [ADR đề xuất T](x04-adr.md). Chưa chốt thư viện sản phẩm.
- Có dùng Internet để đọc nguồn chính thức và tải npm trước chạy. Khi test chỉ phục vụ loopback; không cloud/email/AI/API ngoài, không Docker/MongoDB/mongosh/Nginx/Python. npm install không global, chỉ experiments/g01, --save-exact --ignore-scripts.

## Cách chạy lại

PowerShell, mở tại thư mục repo:

~~~powershell
Set-Location -LiteralPath 'D:\\JS & TS\\dashboard_3d_datamining\\experiments\\g01'
npm ci --ignore-scripts --no-audit --no-fund --cache .runtime/npm-cache
npm run x04
node x04-report.mjs
~~~

Chrome và Edge cần được cài sẵn để Playwright chọn channel. npm ci cần registry hoặc cache đầy đủ; không cần cài browser download nếu các channel hệ thống có sẵn. Mỗi run tạo thư mục timestamp mới, không ghi đè lượt cũ. Runner tự build worker, mở HTTP 127.0.0.1 cổng ngẫu nhiên, chạy online rồi cache shell/worker bằng SW, tắt network context và cho origin trả 503, reload rồi chạy lại. [Kết quả](./${matrixFile}) có networkProof: navigatorOnline=false, controlled=true, request count offline và externalRequests. Không chứng minh khởi động offline lần đầu khi chưa cache. npm/Node chỉ điều phối/build, không chạy thuật toán thay browser.

## Fixture, oracle và seed

[fixtures.json](./${base}/fixtures.json) chứa dữ liệu/kỳ vọng; x04-fixtures.mjs tái sinh scale. Sai số tuyệt đối prediction/metric 1e-9 (linear MSE gần 0: 1e-16), không dùng kết quả engine làm expected.

| Thuật toán | Oracle độc lập | Params nhỏ / trường hợp biên |
| --- | --- | --- |
| Linear | y=2x+1; test 4,5 → 9,11; MAE/MSE 0 | intercept; statistics=false; empty/ragged/nonfinite/target length/constant |
| Logistic | Hai lớp theo dấu x, accuracy=1; ba cụm trái/phải/trên | bias column rõ; mapping nhãn; numSteps=2000, lr=.01; một lớp/steps/lr sai |
| KNN | Khoảng cách Euclidean k=1, lớp theo hàng xóm; ba lớp hình học | k=0 và k>train bị chặn; serializer giữ dữ liệu train |
| K-Means | centers (0,1),(10,11), inertia=4; silhouette từ các căn khoảng cách trong fixture | label permutation không ảnh hưởng; k sai; silhouette một cluster bị chặn |
| PCA | covariance eigenvalues 20/3,0; variance 1; abs(PC1)=3√2; reconstruction | chấp nhận đảo dấu eigenvector; SVD, centered, không scale; component sai/constant bị chặn |

Metric classifier đối chiếu TP=2,FP=1,FN=0,TN=1: accuracy .75, precision 2/3, recall 1, F1 .8. Undefined denominator trả null cùng reason; constant-target R² null + reason. Probe metric chưa thay thế module metrics sản phẩm hay đầy đủ average/positive-label UI.

Leakage sentinel: train [0,null,2], mean=1, std=√(2/3); test ±10000 không thay fitted state (mean leak nếu fit chung 3334). Vocabulary blue/red từ train, IDF blue=ln(3/2)+1; từ testonly không được thêm; one-hot chỉ a/b, unknown category bị lỗi. Dense TF-IDF raw-count và CSR/one-hot được so từng phần tử; đây là probe tokenizer lower/whitespace, không triển khai mọi phương pháp C04. Dự đoán test cực đoan không thay state model/PCA. PCA phục vụ đánh giá kỹ thuật chỉ transform held-out, sản phẩm PCA/K-Means full-fit không có split supervised.

Seed42 dùng Mulberry32/Fisher–Yates; kiểm cùng seed cùng row IDs, khác43 khác split, train/test không giao. Fixture oracle dùng partition cố định có row IDs, không ngụ ý đã random split fixture này. Scale supervised split80/20, train dùng đủ80%; K-Means/PCA fit đủ input. Native K-Means thêm thử initialization=random seed42 hai lượt; các estimator còn lại deterministic, không tuyên bố có native seed. Data scale seed123. Metadata splitSeed42 trong run unsupervised là cấu hình harness, không phải tham số estimator.

## Capability matrix

Mỗi ô dense/worker/seed/cancel/roundtrip dựa trên bốn lượt browser×network, các case ID tương ứng ở [results.json](./${matrixFile}); sparse blocked là phép gọi CSR native thực, không phải phép mã hóa dense→CSR. Chrome/Edge passed chỉ nói core dense, không phủ sparse hay RAM.

| Khả năng | Linear | Logistic | KNN | K-Means | PCA |
| --- | --- | --- | --- | --- | --- |
${rows}

Xuất file model JSON rồi parse/load trong worker mới, không fit lại, so prediction 1e-9. Bốn lib có native JSON/load; K-Means dùng portable centroids/distance/tie-policy riêng, không gọi đó là native load. Envelope kèm version, feature order, fitted mean/std, label mapping, bias/params và row IDs. Chưa phải schema C12 sản phẩm hoàn chỉnh, chưa schema validate model không tin cậy, không có UI prediction dữ liệu mới.

Cancel nhận thông báo ngay trước native fit thật trên 50k×50, gọi terminate, chặn mọi result với jobId/generation, quan sát 150ms, đợi Playwright worker close/detach tối đa3s. Lượt đầu kiểm detach quá sớm nên inconclusive; giữ nguyên evidence, sửa phép quan sát rồi chạy lại. Native fit có thể hoàn tất trước khi main thread nhận thông báo ở tác vụ nhanh; đây là terminate lifecycle + output fencing, không đo CPU instruction đang bị ngắt. Không dùng busy-loop giả. CommittedResults là counter của harness, chưa kiểm transaction/IDB sản phẩm. terminationCallMs là thời gian lời gọi, observedElapsedMs là cửa sổ quan sát, không đồng nhất với thời gian GC/RAM trả OS.

## Benchmark thực

Chỉ scale sau oracle/validation/leakage/roundtrip core đạt; sparse unsupported không được tính thành dense failure. Online 1k×4,10k×8,50k×50; offline chạy lại core và 1k×4,10k×8, không lặp mức50k. Chỉ40 query được công bố để đo predict, không tính metric tổng quát/không tự lấy mẫu train. Logistic scale 50steps lr=.0001; 50k dùng20steps lr=.00001, không so chất lượng hội tụ như oracle2000steps. K-Means3cluster max30iter; PCA tối đa3components; KNN k3. Params thực ở results, không suy ra mức tối đa hay SLA từ một lượt.

performance.now đo native fit và predict riêng; fit bao gồm native constructor/train và thông báo entered-estimator, không gồm clone X trước timestamp; totalFitPredict thêm preprocess/envelope, không bao gồm sinh dữ liệu/bundle. UI timer20ms là proxy scheduling, không FPS/input latency, job ngắn có thể0tick. Không có ngưỡng đạt tương tác được tự đặt. Peak worker RAM không có phép đo đáng tin: inconclusive, bytes=null; RAM máy không phải RAM của worker.

Trong cửa sổ offline, origin vẫn quan sát được Chrome1/Edge2 request /sw-x04.js (kiểm tra cập nhật SW của browser), đều không thể tải thành công vì origin503. Không có request worker/shell trong cửa sổ đó và externalRequests rỗng. Vì vậy chứng minh thực thi không phụ thuộc tải network thành công, không khẳng định browser hoàn toàn không thử kết nối. Đây là harness SW tối giản, chưa đạt mọi yêu cầu offline/update sản phẩm của C13.

| Browser/mode | Algo | Input | Train thực | Query | Fit ms | Predict ms | Max timer gap ms | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${scaleRows}

Guard 10.000.000 dense cells và2.000.000 pairwise được thử vượt và trả lỗi trước fit/tính khoảng cách, không tự sample. Fixture guard tái dùng cùng row nên không phải stress RAM. Chưa thực thi memory estimate guard536870912bytes, chưa mô phỏng toàn pipeline/phình feature/20MB import; cần G04/G05 và V04 trước bật workload tương ứng.

## Đối chiếu và việc còn lại

- B013/C04: core numeric mean-impute/std, train-only text/category probe, seed/params/đa lớp có evidence; chưa toàn bộ phương pháp tiền xử lý.
- C12/I25–I27: metric oracle, undefined reason, technical JSON roundtrip có evidence; cần schema hoàn chỉnh, fitted pipeline phức hợp, feature-order/tampered-model validation và save/download tích hợp.
- C20/I10: shape/cell/pair guards và timing có evidence; native sparse blocked; peak RAM inconclusive; chưa chứng minh mọi tổ hợp50k×50 dưới ngân sách/100 user.
- V01 overall inconclusive: ML dense được kiểm trực tiếp; sparse blocked; UI/3D/chart/local-store/export tích hợp còn riêng. V04 overall inconclusive: chỉ số local ban đầu, chưa FPS/100 người/release window. P01–P16 giữ nguyên.
- Trước bật adapter: hoàn thiện B060–B064, C04/C12/C20 guards/validation, serializer version và offline cache/migration; sparse input phải bị chặn rõ hoặc chọn sparse engine khác rồi kiểm chứng. ADR chỉ là T đề xuất.

## Bằng chứng và thay đổi

[Status JSON](x04-status.json), [selection](x04-selection.md), [ADR](x04-adr.md), [dependencies](./${base}/dependencies.json), [fixtures](./${base}/fixtures.json), [Chrome screenshot](./${base}/chrome-summary.png), [Edge screenshot](./${base}/msedge-summary.png), [hash manifest](x04-hashes.json). results chứa expected/actual/error theo case, timings, offline requests, artifacts/model SHA.

Chỉ đổi package.json/package-lock.json và tạo run-x04.mjs, x04-engine.mjs, x04-fixtures.mjs, x04-worker.mjs, x04-report.mjs cùng evidence X04 trong experiments/g01. Không sửa docs/prompt/README root hay app. Không cài dịch vụ. Các run cũ X04 giữ để phân biệt lỗi quan sát harness/sửa metric/guard/encoding và full-fit unsupervised; chỉ run cuối là kết quả hiện hành. Hash bằng chứng X01–X03 trước/sau runner: ${r.protectedEvidenceUnchanged}. Không đưa .runtime/node_modules/cache/profile vào Git.
`;
await writeFile('evidence/x04-report.md',report);
const names=['run-x04.mjs','x04-engine.mjs','x04-fixtures.mjs','x04-worker.mjs','x04-report.mjs','package.json','package-lock.json','evidence/x04-report.md','evidence/x04-status.json','evidence/x04-selection.md','evidence/x04-adr.md',...(await readdir(`evidence/${base}`)).map(n=>`evidence/${base}/${n}`)];
const hashes={algorithm:'SHA-256',runId:r.runId,files:{}};for(const name of names)hashes.files[name]=createHash('sha256').update(await readFile(name)).digest('hex');await writeFile('evidence/x04-hashes.json',JSON.stringify(hashes,null,2));
console.log(JSON.stringify({run:r.runId,counts,closure:verification.closure,statusFile:'evidence/x04-status.json'},null,2));
