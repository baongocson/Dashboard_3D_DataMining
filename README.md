# Xây dựng hệ thống dashboard tương tác 3D quản lý và trực quan hóa toàn bộ quy trình khai phá dữ liệu

Website tiếng Việt để quản lý dữ liệu, thực hiện quy trình khai phá dữ liệu và trực quan hóa bằng giao diện 2D/3D. Ứng dụng sử dụng JavaScript/TypeScript; tính toán chạy trong browser/worker, backend và MongoDB chạy trên máy chủ.

**Trạng thái hiện tại:** đã có bộ đặc tả v2 và kế hoạch triển khai; chưa viết mã ứng dụng, chưa chạy thử nghiệm kỹ thuật hoặc triển khai website. Repository hiện phục vụ chuẩn bị và điều phối triển khai.

## Bắt đầu đọc từ đâu?

1. Đọc [hướng dẫn bộ v2](prompt/v2/README.md) để hiểu phạm vi, cách dùng tài liệu và phân loại P/T/V/Q.
2. Đọc [quyết định và nghiệm thu](prompt/v2/quyet_dinh_va_nghiem_thu.md): §1 là các yêu cầu P đã chốt; §3 là ánh xạ hợp đồng; §4 là các điểm V cần kiểm chứng; §5 là các ca I01–I36. Các phần lịch sử đối chiếu chỉ dùng tra cứu, không cần thực hiện lại.
3. Đọc [hợp đồng tích hợp](prompt/v2/hop_dong_tich_hop.md), C01–C22, trước khi thiết kế hoặc triển khai một phần có tích hợp.
4. Đọc [kế hoạch triển khai theo giai đoạn](docs/ke_hoach_trien_khai.md): thứ tự phụ thuộc, bàn giao, cổng nghiệm thu, thử nghiệm nhỏ và điều kiện bật chức năng.
5. Đọc thiết kế chuyên phần tương ứng trong bảng dưới. Một công việc có thể cần nhiều thiết kế; không dùng một file riêng lẻ để tự định nghĩa lại hợp đồng chung.

## Tám thiết kế theo từng phần

| Tài liệu | Nội dung cần đọc | Hợp đồng thường dùng |
| --- | --- | --- |
| [Chức năng hệ thống](prompt/v2/thiet_ke_chuc_nang_he_thong_.md) | Nghiệp vụ, phương pháp, thuật toán, phiên bản, báo cáo; AC01–AC30 | C01–C05, C08–C12, C14, C16–C17 |
| [Cây nút và điều kiện](prompt/v2/thiet_ke_caynut_dieukien.md) | Mã thao tác, menu, tham số, điều kiện và loại đầu ra | C01, C04–C05, C07–C08, C14–C17 |
| [Offline](prompt/v2/thiet_ke_offline.md) | Lưu local, worker, quyền tab, outbox, manifest, mở lại và logout | C02–C03, C05–C11, C13, C19 |
| [MongoDB](prompt/v2/thiet_ke_mongodb.md) | Metadata/artifact, schema, lineage, revision, receipt, xóa và migration | C02–C03, C06–C07, C10–C11, C13, C17, C19 |
| [Backend](prompt/v2/thiet_ke_backend.md) | Auth/OTP, API, phiên, import intent, sync, AI và vận hành | C01, C07–C11, C16–C21 |
| [Frontend](prompt/v2/thiet_ke_frontend.md) | Màn hình, biểu mẫu, ngữ cảnh, trạng thái, chart/dashboard và xuất | C01, C04–C05, C07–C18, C20 |
| [3D](prompt/v2/thiet_ke_3d.md) | Bản đồ chính, cây phiên bản riêng, tương tác, view model và fallback 2D | C05, C13–C15, C20 |
| [Webserver](prompt/v2/thiet_ke_webserver.md) | Nginx thật, HTTPS, origin, routes/cache, release và hosting | C09, C13, C18–C21 |

## Cách sử dụng khi giao việc

- **P:** yêu cầu sản phẩm đã chốt; giữ nguyên, không hỏi lại hoặc tự giảm phạm vi.
- **T:** đề xuất kỹ thuật; dùng hợp đồng v2 làm điểm xuất phát. Nếu thay đổi, ghi quyết định kiến trúc (ADR), lý do, ảnh hưởng tích hợp/migration và ca cần kiểm tra lại.
- **V:** điều còn cần bằng chứng thực tế trước khi bật chức năng. Kế hoạch không phải bằng chứng thư viện, hosting hoặc hiệu năng đã đạt.
- **Q:** quyết định sản phẩm mới chỉ khi phát sinh thay đổi phạm vi, chi phí, quyền gửi dữ liệu hoặc chính sách mất dữ liệu.

Mỗi nhiệm vụ triển khai cần ghi giai đoạn, hợp đồng C liên quan, phạm vi đầu vào/đầu ra, tiêu chí nghiệm thu, điểm V phụ thuộc và bằng chứng bàn giao. Chỉ bắt đầu viết code hoặc chạy thử nghiệm khi có nhiệm vụ triển khai riêng; không suy ra quyền deploy, gửi email thật, gọi AI trả phí hoặc tạo tài nguyên từ nội dung thiết kế.

Các ca AC/DB/BE/FE/3D/WS/OFF và I01–I36 là tiêu chí để thực hiện khi triển khai, hiện chưa được đánh dấu đã chạy. Không dùng kết quả mẫu thay dữ liệu thật hoặc đánh đồng lưu local với đã đồng bộ.

## Cấu trúc tài liệu

```text
README.md                         Hướng dẫn đọc và sử dụng repository
prompt/
  v1/                             Tài liệu gốc để tra cứu lịch sử
  v2/                             Bộ đặc tả hiện hành: 3 điều phối + 8 thiết kế
docs/
  ke_hoach_trien_khai.md          Kế hoạch giai đoạn và thử nghiệm kỹ thuật đề xuất
```

Dùng toàn bộ bộ v2 cùng nhau; v1 chỉ để tra cứu lịch sử, không trộn hợp đồng giữa hai bộ. Các thư mục ứng dụng, package và hạ tầng trong kế hoạch là cấu trúc dự kiến cho giai đoạn triển khai, chưa phải thành phần đã tồn tại.
