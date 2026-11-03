# ADR-X04-01 — Đề xuất T cho engine browser và serializer

Trạng thái: đề xuất dựa trên thử nghiệm local; không thay P, không tự chốt stack sản phẩm. Evidence hiện hành xem x04-latest.json, x04-report.md và x04-status.json.

Chọn thử các module ml.js CPU JavaScript, version exact trong package/lock, bundling bằng esbuild. Lý do: API trực tiếp cho năm thuật toán, browser worker không cần backend GPU/WASM/Python, giấy phép MIT; dense/oracle/offline/multiclass/roundtrip đã chạy thực tế. So sánh TensorFlow.js Apache-2.0 và nguồn chính thức ở x04-selection.md; không có benchmark đối đầu, không tuyên bố ml.js nhanh hơn.

Các adapter thử phải thêm bias column và label mapping cho Logistic; numeric mean-impute/std fit train-only. Chính sách unknown category của probe là error, không tự coi là quyết định encoding cho sản phẩm. Các estimator đồng bộ được cô lập worker riêng, hủy bằng terminate + generation fence; không hứa cooperative pause/resume.

K-Means 7.0.1 không có native JSON/load tương đương bốn thư viện còn lại trong API đã thử. Đề xuất T: portable centroid serializer version riêng, lưu distance squared-Euclidean/tie-first, params/feature order. Đã so native.nearest với worker mới đọc JSON. Ảnh hưởng: chỉ suy luận gán cụm, không resume fitting hay khôi phục mọi native metadata. Nếu thay engine/khoảng cách/tie rule, cần version/migration và chạy lại oracle/roundtrip. Không trộn portable serializer với native loader.

Native CSR bị từ chối ở năm phiên bản. Đề xuất T: registry khai báo dense-only, từ chối sparse bằng lý do rõ trước fit; chỉ bật workload dense đã qua guard. Không chuyển ngầm/densify, không bỏ TF-IDF/one-hot hay thuật toán trong P. Cần thử sparse engine hoặc luồng chuyển đổi tường minh có cost/memory proof ở công việc tiếp theo. Thay lựa chọn thư viện sẽ ảnh hưởng bundle/cache, license, precision/tie, serializer/version, trained artifacts và cần chạy lại X04.

Chưa chứng minh peak RAM, memory estimate guard, FPS hay100 người. Không dùng một lượt benchmark để chốt SLA hay hạ ngân sách P. Đủ evidence cho kết luận khảo sát không có nghĩa các adapter đã được phép bật trong ứng dụng; các gate G04/G05/G07 và V01/V04 còn hiệu lực.
