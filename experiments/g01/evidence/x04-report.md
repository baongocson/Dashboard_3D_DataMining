# G01–X04 — Engine browser, dữ liệu tổng hợp

Run cuối: 2026-11-02T11-56-17-043Z; bắt đầu 2026-11-02T11:56:17.537Z, kết thúc 2026-11-02T11:57:03.039Z. Kết quả: {"passed":198,"failed":0,"inconclusive":0,"blocked":20}. Đây là số ca trên 5 thuật toán × Chrome/Edge × online/offline, không phải số tính năng sản phẩm. Memory không cộng vào các ca passed; trạng thái riêng là inconclusive.

## Kết luận và phạm vi

Đủ bằng chứng đóng bước khảo sát kỹ thuật X04/B013 với các giới hạn bên dưới. Không đánh dấu toàn bộ V01/V04 đạt và không bật adapter sản phẩm. Native sparse không được hỗ trợ bởi các phiên bản được thử; không bỏ yêu cầu P, không chuyển CSR thành dense ngầm. Phần phụ thuộc sparse phải còn bị chặn hoặc tiếp tục tìm ứng viên. Peak RAM và mức tải phát hành chưa được nghiệm thu.

Đã đọc kế hoạch, B013, C04/C12/C20, thiết kế thuật toán/FE/offline/BE và harness/bằng chứng X01–X03. X04 đòi hỏi oracle độc lập, train-only, params/đa lớp/sparse/cancel/roundtrip, worker không Node/CDN/Python, offline và số đo ban đầu. V01 là xác minh thư viện; V04 là limits/FPS/100 người/release window. X01–X03 không chứng minh engine. Tái sử dụng cách Playwright Chrome/Edge, profile tạm, loopback, JSON/screenshot; không gọi runner MongoDB. B010–B013 trong backlog còn PLANNED dù có evidence các lượt chạy: không tự sửa backlog vì phạm vi chỉ experiments/g01; x04-status.json là bản đối chiếu cục bộ.

## Môi trường và lựa chọn T

- Windows_NT 10.0.26200 x64; 12th Gen Intel(R) Core(TM) i5-12450H; 12 logical CPUs; RAM 16869052416 bytes.
- Node v24.15.0; npm 11.12.1; Playwright 1.64.1; esbuild 0.28.2.
- chrome 156.0.8078.76; msedge 156.0.4314.58; headless, context/profile tạm do Playwright tạo, không profile cá nhân.
- linear: ml-regression-multivariate-linear@2.0.4; logistic: ml-logistic-regression@2.0.0; knn: ml-knn@3.0.0; kmeans: ml-kmeans@7.0.1; pca: ml-pca@4.1.1; ml-matrix 6.15.1. Tất cả các package ML và esbuild trên mang MIT; dependencies.json ghi phiên bản/giấy phép. Lock khóa dependency bắc cầu.
- Chọn module ml.js CPU JS vì có API cho cả năm thuật toán và bundle worker nhỏ (253046 bytes, không phải ngân sách RAM). TensorFlow.js Apache-2.0 đã so sánh tài liệu, không cài/benchmark. [So sánh và nguồn chính thức](x04-selection.md); [ADR đề xuất T](x04-adr.md). Chưa chốt thư viện sản phẩm.
- Có dùng Internet để đọc nguồn chính thức và tải npm trước chạy. Khi test chỉ phục vụ loopback; không cloud/email/AI/API ngoài, không Docker/MongoDB/mongosh/Nginx/Python. npm install không global, chỉ experiments/g01, --save-exact --ignore-scripts.

## Cách chạy lại

PowerShell, mở tại thư mục repo:

~~~powershell
Set-Location -LiteralPath 'D:\JS & TS\dashboard_3d_datamining\experiments\g01'
npm ci --ignore-scripts --no-audit --no-fund --cache .runtime/npm-cache
npm run x04
node x04-report.mjs
~~~

Chrome và Edge cần được cài sẵn để Playwright chọn channel. npm ci cần registry hoặc cache đầy đủ; không cần cài browser download nếu các channel hệ thống có sẵn. Mỗi run tạo thư mục timestamp mới, không ghi đè lượt cũ. Runner tự build worker, mở HTTP 127.0.0.1 cổng ngẫu nhiên, chạy online rồi cache shell/worker bằng SW, tắt network context và cho origin trả 503, reload rồi chạy lại. [Kết quả](./x04-runs/2026-11-02T11-56-17-043Z/results.json) có networkProof: navigatorOnline=false, controlled=true, request count offline và externalRequests. Không chứng minh khởi động offline lần đầu khi chưa cache. npm/Node chỉ điều phối/build, không chạy thuật toán thay browser.

## Fixture, oracle và seed

[fixtures.json](./x04-runs/2026-11-02T11-56-17-043Z/fixtures.json) chứa dữ liệu/kỳ vọng; x04-fixtures.mjs tái sinh scale. Sai số tuyệt đối prediction/metric 1e-9 (linear MSE gần 0: 1e-16), không dùng kết quả engine làm expected.

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

Mỗi ô dense/worker/seed/cancel/roundtrip dựa trên bốn lượt browser×network, các case ID tương ứng ở [results.json](./x04-runs/2026-11-02T11-56-17-043Z/results.json); sparse blocked là phép gọi CSR native thực, không phải phép mã hóa dense→CSR. Chrome/Edge passed chỉ nói core dense, không phủ sparse hay RAM.

| Khả năng | Linear | Logistic | KNN | K-Means | PCA |
| --- | --- | --- | --- | --- | --- |
| Browser/Worker | passed | passed | passed | passed | passed |
| Dense input | passed | passed | passed | passed | passed |
| Sparse input (native CSR solve) | blocked | blocked | blocked | blocked | blocked |
| Seed/tái lập | passed | passed | passed | passed | passed |
| Hủy tác vụ | passed | passed | passed | passed | passed |
| Xuất–nạp model | passed | passed | passed | passed | passed |
| Chrome (dense) | passed | passed | passed | passed | passed |
| Edge (dense) | passed | passed | passed | passed | passed |
| Bộ nhớ đỉnh worker | inconclusive | inconclusive | inconclusive | inconclusive | inconclusive |

Xuất file model JSON rồi parse/load trong worker mới, không fit lại, so prediction 1e-9. Bốn lib có native JSON/load; K-Means dùng portable centroids/distance/tie-policy riêng, không gọi đó là native load. Envelope kèm version, feature order, fitted mean/std, label mapping, bias/params và row IDs. Chưa phải schema C12 sản phẩm hoàn chỉnh, chưa schema validate model không tin cậy, không có UI prediction dữ liệu mới.

Cancel nhận thông báo ngay trước native fit thật trên 50k×50, gọi terminate, chặn mọi result với jobId/generation, quan sát 150ms, đợi Playwright worker close/detach tối đa3s. Lượt đầu kiểm detach quá sớm nên inconclusive; giữ nguyên evidence, sửa phép quan sát rồi chạy lại. Native fit có thể hoàn tất trước khi main thread nhận thông báo ở tác vụ nhanh; đây là terminate lifecycle + output fencing, không đo CPU instruction đang bị ngắt. Không dùng busy-loop giả. CommittedResults là counter của harness, chưa kiểm transaction/IDB sản phẩm. terminationCallMs là thời gian lời gọi, observedElapsedMs là cửa sổ quan sát, không đồng nhất với thời gian GC/RAM trả OS.

## Benchmark thực

Chỉ scale sau oracle/validation/leakage/roundtrip core đạt; sparse unsupported không được tính thành dense failure. Online 1k×4,10k×8,50k×50; offline chạy lại core và 1k×4,10k×8, không lặp mức50k. Chỉ40 query được công bố để đo predict, không tính metric tổng quát/không tự lấy mẫu train. Logistic scale 50steps lr=.0001; 50k dùng20steps lr=.00001, không so chất lượng hội tụ như oracle2000steps. K-Means3cluster max30iter; PCA tối đa3components; KNN k3. Params thực ở results, không suy ra mức tối đa hay SLA từ một lượt.

performance.now đo native fit và predict riêng; fit bao gồm native constructor/train và thông báo entered-estimator, không gồm clone X trước timestamp; totalFitPredict thêm preprocess/envelope, không bao gồm sinh dữ liệu/bundle. UI timer20ms là proxy scheduling, không FPS/input latency, job ngắn có thể0tick. Không có ngưỡng đạt tương tác được tự đặt. Peak worker RAM không có phép đo đáng tin: inconclusive, bytes=null; RAM máy không phải RAM của worker.

Trong cửa sổ offline, origin vẫn quan sát được Chrome1/Edge2 request /sw-x04.js (kiểm tra cập nhật SW của browser), đều không thể tải thành công vì origin503. Không có request worker/shell trong cửa sổ đó và externalRequests rỗng. Vì vậy chứng minh thực thi không phụ thuộc tải network thành công, không khẳng định browser hoàn toàn không thử kết nối. Đây là harness SW tối giản, chưa đạt mọi yêu cầu offline/update sản phẩm của C13.

| Browser/mode | Algo | Input | Train thực | Query | Fit ms | Predict ms | Max timer gap ms | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chrome/online | linear | 1000 × 4 | 800 | 40 | 6.10 | 0.30 | 20.10 | passed |
| chrome/online | linear | 10000 × 8 | 8000 | 40 | 22.00 | 0.40 | 21.30 | passed |
| chrome/online | linear | 50000 × 50 | 40000 | 40 | 264.10 | 0.40 | 21.00 | passed |
| chrome/online | logistic | 1000 × 4 | 800 | 40 | 23.60 | 0.30 | 21.00 | passed |
| chrome/online | logistic | 10000 × 8 | 8000 | 40 | 154.60 | 0.30 | 21.60 | passed |
| chrome/online | logistic | 50000 × 50 | 40000 | 40 | 1429.90 | 0.50 | 22.10 | passed |
| chrome/online | knn | 1000 × 4 | 800 | 40 | 2.30 | 7.60 | 21.60 | passed |
| chrome/online | knn | 10000 × 8 | 8000 | 40 | 21.80 | 71.60 | 20.80 | passed |
| chrome/online | knn | 50000 × 50 | 40000 | 40 | 203.70 | 1621.20 | 21.40 | passed |
| chrome/online | kmeans | 1000 × 4 | 1000 | 40 | 2.90 | 0.00 | 20.30 | passed |
| chrome/online | kmeans | 10000 × 8 | 10000 | 40 | 5.50 | 0.00 | 21.30 | passed |
| chrome/online | kmeans | 50000 × 50 | 50000 | 40 | 30.30 | 0.10 | 22.10 | passed |
| chrome/online | pca | 1000 × 4 | 1000 | 40 | 3.80 | 0.10 | 0.00 | passed |
| chrome/online | pca | 10000 × 8 | 10000 | 40 | 30.60 | 1.00 | 20.60 | passed |
| chrome/online | pca | 50000 × 50 | 50000 | 40 | 804.60 | 1.50 | 21.00 | passed |
| chrome/offline | linear | 1000 × 4 | 800 | 40 | 2.60 | 0.10 | 0.00 | passed |
| chrome/offline | linear | 10000 × 8 | 8000 | 40 | 15.10 | 0.10 | 20.70 | passed |
| chrome/offline | logistic | 1000 × 4 | 800 | 40 | 25.60 | 0.20 | 20.90 | passed |
| chrome/offline | logistic | 10000 × 8 | 8000 | 40 | 189.80 | 0.30 | 21.70 | passed |
| chrome/offline | knn | 1000 × 4 | 800 | 40 | 2.90 | 7.30 | 20.60 | passed |
| chrome/offline | knn | 10000 × 8 | 8000 | 40 | 23.90 | 91.30 | 20.70 | passed |
| chrome/offline | kmeans | 1000 × 4 | 1000 | 40 | 2.90 | 0.10 | 0.00 | passed |
| chrome/offline | kmeans | 10000 × 8 | 10000 | 40 | 6.60 | 0.10 | 20.80 | passed |
| chrome/offline | pca | 1000 × 4 | 1000 | 40 | 4.50 | 0.50 | 0.00 | passed |
| chrome/offline | pca | 10000 × 8 | 10000 | 40 | 35.90 | 0.30 | 20.30 | passed |
| msedge/online | linear | 1000 × 4 | 800 | 40 | 4.30 | 0.20 | 20.20 | passed |
| msedge/online | linear | 10000 × 8 | 8000 | 40 | 16.60 | 0.40 | 20.90 | passed |
| msedge/online | linear | 50000 × 50 | 40000 | 40 | 223.60 | 0.50 | 21.00 | passed |
| msedge/online | logistic | 1000 × 4 | 800 | 40 | 17.80 | 0.20 | 21.60 | passed |
| msedge/online | logistic | 10000 × 8 | 8000 | 40 | 157.10 | 0.30 | 21.10 | passed |
| msedge/online | logistic | 50000 × 50 | 40000 | 40 | 1491.60 | 0.40 | 22.70 | passed |
| msedge/online | knn | 1000 × 4 | 800 | 40 | 1.70 | 4.70 | 20.80 | passed |
| msedge/online | knn | 10000 × 8 | 8000 | 40 | 20.30 | 72.60 | 20.70 | passed |
| msedge/online | knn | 50000 × 50 | 40000 | 40 | 216.80 | 1797.30 | 21.40 | passed |
| msedge/online | kmeans | 1000 × 4 | 1000 | 40 | 2.40 | 0.20 | 20.40 | passed |
| msedge/online | kmeans | 10000 × 8 | 10000 | 40 | 4.00 | 0.00 | 21.50 | passed |
| msedge/online | kmeans | 50000 × 50 | 50000 | 40 | 29.50 | 0.10 | 21.30 | passed |
| msedge/online | pca | 1000 × 4 | 1000 | 40 | 4.80 | 0.40 | 20.60 | passed |
| msedge/online | pca | 10000 × 8 | 10000 | 40 | 47.00 | 0.40 | 20.50 | passed |
| msedge/online | pca | 50000 × 50 | 50000 | 40 | 853.40 | 1.40 | 21.00 | passed |
| msedge/offline | linear | 1000 × 4 | 800 | 40 | 3.20 | 0.20 | 0.00 | passed |
| msedge/offline | linear | 10000 × 8 | 8000 | 40 | 15.70 | 0.00 | 20.50 | passed |
| msedge/offline | logistic | 1000 × 4 | 800 | 40 | 27.80 | 0.20 | 20.50 | passed |
| msedge/offline | logistic | 10000 × 8 | 8000 | 40 | 150.30 | 0.20 | 20.80 | passed |
| msedge/offline | knn | 1000 × 4 | 800 | 40 | 1.50 | 4.60 | 20.90 | passed |
| msedge/offline | knn | 10000 × 8 | 8000 | 40 | 17.20 | 71.10 | 20.90 | passed |
| msedge/offline | kmeans | 1000 × 4 | 1000 | 40 | 4.20 | 0.10 | 21.20 | passed |
| msedge/offline | kmeans | 10000 × 8 | 10000 | 40 | 5.80 | 0.10 | 20.30 | passed |
| msedge/offline | pca | 1000 × 4 | 1000 | 40 | 3.50 | 0.20 | 0.00 | passed |
| msedge/offline | pca | 10000 × 8 | 10000 | 40 | 27.10 | 0.40 | 20.40 | passed |

Guard 10.000.000 dense cells và2.000.000 pairwise được thử vượt và trả lỗi trước fit/tính khoảng cách, không tự sample. Fixture guard tái dùng cùng row nên không phải stress RAM. Chưa thực thi memory estimate guard536870912bytes, chưa mô phỏng toàn pipeline/phình feature/20MB import; cần G04/G05 và V04 trước bật workload tương ứng.

## Đối chiếu và việc còn lại

- B013/C04: core numeric mean-impute/std, train-only text/category probe, seed/params/đa lớp có evidence; chưa toàn bộ phương pháp tiền xử lý.
- C12/I25–I27: metric oracle, undefined reason, technical JSON roundtrip có evidence; cần schema hoàn chỉnh, fitted pipeline phức hợp, feature-order/tampered-model validation và save/download tích hợp.
- C20/I10: shape/cell/pair guards và timing có evidence; native sparse blocked; peak RAM inconclusive; chưa chứng minh mọi tổ hợp50k×50 dưới ngân sách/100 user.
- V01 overall inconclusive: ML dense được kiểm trực tiếp; sparse blocked; UI/3D/chart/local-store/export tích hợp còn riêng. V04 overall inconclusive: chỉ số local ban đầu, chưa FPS/100 người/release window. P01–P16 giữ nguyên.
- Trước bật adapter: hoàn thiện B060–B064, C04/C12/C20 guards/validation, serializer version và offline cache/migration; sparse input phải bị chặn rõ hoặc chọn sparse engine khác rồi kiểm chứng. ADR chỉ là T đề xuất.

## Bằng chứng và thay đổi

[Status JSON](x04-status.json), [selection](x04-selection.md), [ADR](x04-adr.md), [dependencies](./x04-runs/2026-11-02T11-56-17-043Z/dependencies.json), [fixtures](./x04-runs/2026-11-02T11-56-17-043Z/fixtures.json), [Chrome screenshot](./x04-runs/2026-11-02T11-56-17-043Z/chrome-summary.png), [Edge screenshot](./x04-runs/2026-11-02T11-56-17-043Z/msedge-summary.png), [hash manifest](x04-hashes.json). results chứa expected/actual/error theo case, timings, offline requests, artifacts/model SHA.

Chỉ đổi package.json/package-lock.json và tạo run-x04.mjs, x04-engine.mjs, x04-fixtures.mjs, x04-worker.mjs, x04-report.mjs cùng evidence X04 trong experiments/g01. Không sửa docs/prompt/README root hay app. Không cài dịch vụ. Các run cũ X04 giữ để phân biệt lỗi quan sát harness/sửa metric/guard/encoding và full-fit unsupervised; chỉ run cuối là kết quả hiện hành. Hash bằng chứng X01–X03 trước/sau runner: true. Không đưa .runtime/node_modules/cache/profile vào Git.
