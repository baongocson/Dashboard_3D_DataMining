# Bộ prompt hợp nhất v2

Ngày đối chiếu: 02/11/2026. Trạng thái: đặc tả tài liệu, chưa triển khai ứng dụng.

## Phạm vi và cách đọc

Tám tài liệu gốc và README trong thư mục cha được giữ nguyên. Tám file cùng tên ở đây là bản làm việc v2; không trộn một prompt v2 với hợp đồng của bản gốc. Không tạo mã nguồn, cài dịch vụ hoặc triển khai chỉ vì tài liệu mô tả cách triển khai.

Đọc theo thứ tự:

1. [Quyết định, điểm mở và nghiệm thu](quyet_dinh_va_nghiem_thu.md).
2. [Hợp đồng tích hợp chung](hop_dong_tich_hop.md), các mục C01–C22.
3. [Chức năng hệ thống](thiet_ke_chuc_nang_he_thong_.md).
4. [Cây nút và điều kiện](thiet_ke_caynut_dieukien.md).
5. [Offline](thiet_ke_offline.md), [MongoDB](thiet_ke_mongodb.md), [backend](thiet_ke_backend.md).
6. [Frontend](thiet_ke_frontend.md), [3D](thiet_ke_3d.md), [webserver](thiet_ke_webserver.md).

## Giá trị của các phát biểu

- **P — yêu cầu sản phẩm đã chốt:** có căn cứ cụ thể trong tám nguồn; không tự thay đổi.
- **T — thiết kế kỹ thuật v2:** giải pháp bổ sung trong lần hoàn thiện này để các phần cùng một hợp đồng. Đây là đề xuất triển khai có thể thay bằng ADR có lý do và cập nhật tất cả bên liên quan; không gọi là lựa chọn người dùng đã xác nhận riêng.
- **V — cần kiểm chứng:** package/provider/hiệu năng/chi phí và ngưỡng tài nguyên thực tế. Phải có bằng chứng trước công bố hỗ trợ hoặc triển khai Internet.
- **Q — cần quyết định sản phẩm nếu phát sinh:** tính năng ngoài phạm vi, thay đổi quyền gửi dữ liệu, chi phí hoặc chính sách làm mất dữ liệu. Không tự chọn thay người dùng.

Các mục C01–C22 là hợp đồng T, trừ các bất biến P được ghi nguồn. Tám prompt giữ yêu cầu chuyên ngành và tiêu chí nghiệm thu gốc; hợp đồng chung là nơi định nghĩa thuật ngữ/trạng thái/payload xuyên module. Không lặp lại một phiên bản khác trong từng module. Khi phát hiện khác biệt mới, dừng phần phụ thuộc, ghi nguồn và ảnh hưởng; không dùng ngày sửa file để tự quyết ưu tiên.

## Giao việc tiếp theo

Agent nhận một phần phải đọc hợp đồng liên quan, lập bảng đầu vào/đầu ra, dùng ID/trạng thái chung và đối chiếu nghiệm thu. Chỉ viết code khi được giao riêng. Không cần người dùng chọn những chi tiết kỹ thuật thường lệ; trình bày T và kiểm chứng V. Những mục Q thực sự mới cần người dùng quyết định trước khi làm phần phụ thuộc.

Các tham chiếu kỹ thuật trong tài liệu gốc được giữ làm nguồn lịch sử, không phải tuyên bố đã được kiểm tra lại trong lần hợp nhất này. Chưa chọn nhà cung cấp hoặc phiên bản package, chưa kiểm thử thuật toán/hosting hay chứng minh 100 người đồng thời.
