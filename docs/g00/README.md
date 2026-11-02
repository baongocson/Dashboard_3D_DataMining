# Gói G00 — Công việc và thiết kế phục vụ triển khai

Ngày bàn giao tài liệu: 02/11/2026. Phạm vi: [G00 trong kế hoạch](../ke_hoach_trien_khai.md). Chỉ Markdown; không mã ứng dụng/schema thực thi, cài dịch vụ, chạy thử nghiệm, deploy hoặc push GitHub.

## Đọc và sử dụng

Nguồn điều phối giữ nguyên: [README v2](../../prompt/v2/README.md), [C01–C22](../../prompt/v2/hop_dong_tich_hop.md), [P01–P16/V01–V05/nghiệm thu](../../prompt/v2/quyet_dinh_va_nghiem_thu.md). Tám thiết kế v2 là nguồn chuyên phần. G00 không thay hợp đồng hoặc mở lại việc rà soát mâu thuẫn.

| Bàn giao | File | Cách dùng |
| --- | --- | --- |
| 1. Backlog có mã | [backlog.md](backlog.md) | Chọn nhiệm vụ, kiểm đầu vào/đầu ra, dependency, module, C, tiêu chí và V |
| 2a. Danh mục schema/API | [hop_dong_can_xay.md](hop_dong_can_xay.md) | S01–S30 và O01–O14: schema/payload/endpoint phải đặc tả, chưa sinh JSON/YAML |
| 2b. Thiết kế dữ liệu cần đặc tả | [mongodb_can_dac_ta.md](mongodb_can_dac_ta.md) | M01–M27, IX01–IX24, R01–R18: field/index/ref và bất biến cần chứng minh |
| 2c. Fixture/lỗi | [fixture_va_loi.md](fixture_va_loi.md) | F01–F32 là mô tả fixture, E01–E41 là danh mục lỗi, không có test result |
| 3. Tất cả thao tác | [danh_muc_thao_tac.md](danh_muc_thao_tac.md) | Một dòng/mã, kể cả mã viết tắt trong nguồn; output/fit/offline/gate/task/tiêu chí |
| 4. Độ phủ | [doi_chieu_pham_vi.md](doi_chieu_pham_vi.md) | P→task→operation→C→fixture/tiêu chí; kiểm số lượng/không có thao tác mồ côi |

## Quy ước chung

- **P:** giữ đúng quyết định nguồn, không tự đổi/giảm phạm vi. Mã P/C/I/AC/DB/BE/FE/3D/WS/OFF lấy từ v2.
- **T:** cách phân chia backlog/module, S/O/M/IX/R/F/E và tiêu chí bổ sung G00 là thiết kế đề xuất. ID mới là mã quản lý tài liệu, không là API hoặc operation ID mới. Không gán chúng thành lựa chọn sản phẩm người dùng đã duyệt.
- **V:** mọi V01–V05 hiện `notTested`; các X01–X09 chỉ là việc tương lai. Không suy ra pass từ việc đã viết tài liệu hoặc chọn fixture.
- **DOC:** đầu ra tài liệu G00 đã được soạn; **PLANNED:** việc chưa thực hiện. DOC không nghĩa ứng dụng/contract/fixture đã chạy hoặc V passed.
- **Bxxx:** nhiệm vụ có đầu ra đủ bàn giao; thứ tự là dependency, không thời hạn. Sxx/Oxx là danh mục cần xây; Mxx/IXxx/Rxx là đề xuất cần đặc tả và kiểm query/race khi triển khai.

Khi nhận nhiệm vụ: đọc nguồn/C được chỉ định và dòng thao tác; xây schema/fixtures tương ứng trong nhiệm vụ triển khai riêng; nộp expected/actual, artifact/hash/receipt/log đã lọc theo ca. Không tạo test cho mỗi nút UI nếu chỉ lặp implementation: kiểm validator, commit, quyền, retry và các ranh giới dữ liệu có ý nghĩa. Không dùng I chung thay toàn bộ kiểm tra chuyên biệt mỗi phương pháp.

## Điều kiện bàn giao G00

Gói có backlog không dependency mồ côi/vòng lặp; danh mục schema/API/field/index/ref/fixture/error; toàn bộ thao tác của NÚT có đầu ra/fit/gate/offline/task/tiêu chí; P01–P16 có nơi thực hiện. Fences, tombstone, dependency graph, generation, migration và ledger được đặt trong thiết kế từ nền tảng. Các số liệu kiểm tra độ phủ là kiểm tra tài liệu, không phải thử nghiệm kỹ thuật G01 hoặc kiểm thử ứng dụng. V còn mở không ngăn bàn giao G00 nhưng chặn bật chức năng tương ứng.

Không tự bắt đầu G01 khi G00 xong. G01 cần nhiệm vụ riêng; dữ liệu thật/email/AI/cloud/chi phí tuân thủ phạm vi được giao, không suy ra quyền từ backlog.
