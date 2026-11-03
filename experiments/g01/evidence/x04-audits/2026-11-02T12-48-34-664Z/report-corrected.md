# X04 — Đối chiếu và hiệu chỉnh cách tổng hợp

Không chạy lại ML. Run gốc 2026-11-02T11-56-17-043Z được giữ nguyên.

## Kết quả hiệu chỉnh

- Ca chạy thực: {"passed":198,"failed":0,"inconclusive":0,"blocked":20} (218 ca).
- Kết luận peak memory: {"passed":0,"failed":0,"inconclusive":5,"blocked":0} (5 mục chưa đo được, không phải 5 ca mới đã chạy).
- Tổng findings nếu cần một bảng: {"passed":198,"failed":0,"inconclusive":5,"blocked":20} (223 mục).
- V01/V04 vẫn inconclusive, tách riêng để không đếm trùng cấp tiêu chí.

Số inconclusive=0 ở status cũ chỉ đếm cases/scale của results.json; không cộng capability.workerPeakMemory. Phạm vi đếm chưa rõ gây hiểu lầm, không phải phép đo RAM đạt. Bản này đặt tên từng nhóm và cộng 5 findings riêng. Không sửa hoặc chạy lại dữ liệu gốc.

## Quyết định đóng khảo sát

B013 yêu cầu params/cancel/roundtrip/expected độc lập và matrix fit/sparse/serializer. X04 §4 yêu cầu capability sparse rõ. C03 cho phép chặn adapter không hỗ trợ sparse, C12/C20 không cho công bố capability chưa được kiểm. Do đó khảo sát ứng viên dense có thể đóng với giới hạn; sparse solve vẫn blocked. Không đóng toàn G01/V01/V04, không bật adapter sản phẩm, không bỏ yêu cầu P hoặc tự densify. Nhánh phụ thuộc sparse cần giải pháp/kiểm chứng tiếp theo; nhiệm vụ G01 độc lập như B014/B015 được phép tiếp tục theo kế hoạch §1/§5.

## Hai ảnh Chrome/Edge

SHA256 cả hai: a8fe4a55f8e9c58cc2714bf057830043f55551f174a206a72a38b31ea0a2332f. Kích thước 1150×8238. Tái dựng payload đúng biểu thức runner, identicalPayloads=true. Runner chụp bảng chỉ có ID/status và kích thước scale, cố ý không có browser/version/timing; vì các trạng thái giống nhau nên output giống nhau là nhất quán với cách tạo ảnh. Không kết luận ảnh sai/copy. Ảnh không chứng minh danh tính browser; kết quả JSON lưu riêng Chrome 156.0.8078.76, Edge 156.0.4314.58. Không thay ảnh gốc.

## Tái lập

Từ experiments/g01 chạy: node x04-audit.mjs. Mỗi audit tạo thư mục timestamp mới. status-corrected.json gồm counts, memory findings, kết luận, đối chiếu ảnh và hash các đầu vào; hashes.json bao gồm hash đầu vào và các output audit. Không cần browser/Mongo/Docker/network cho audit này.
