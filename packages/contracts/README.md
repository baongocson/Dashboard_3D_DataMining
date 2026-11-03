# Shared contracts — B020 foundation

Nguồn chuẩn: prompt/v2/C02–C05,C12,C18 và docs/g00/S01–S04. JSON Schema draft2020-12, schemaVersion1, không phải version2 của prompt.

T: chọn AJV8.20.0 MIT compiler build-time + standalone validators bundled thành ESM thuần. Browser/API nhập cùng artifact, không compile schema từ user và không cần unsafe-eval. So Zod4.6.7 MIT: có JSONSchema conversion nhưng JSON Schema là nguồn chính đã được yêu cầu; tránh thêm nguồn TS schema song song. Nguồn chính thức: https://ajv.js.org/standalone.html, https://ajv.js.org/json-schema.html, https://github.com/ajv-validator/ajv/blob/master/LICENSE, https://zod.dev/json-schema.

Phạm vi B020: S01/S02/S03 core, S04 registry/config envelope, C12 MetricRecord/fitted-pipeline metadata foundation. Không triển khai đủ S05–S30/O01–O14 trước task phụ trách. Chưa có method executor/params được kiểm thì config schema phương pháp nhận false và registry unavailable. Đây là chặn an toàn, không coi phương pháp đã làm; khi task B050–B064 tạo schema/executor phải tăng configVersion và chạy fixture riêng, giữ version cũ không hợp lệ.

Các package trong packages/ là phạm vi CT được nêu trong BE§4 và quyết định§6; tests/fixtures/integration theo cấu trúc dự kiến. Không sửa root workspace/config hoặc tạo apps trong B020; mỗi package tự có manifest/lock, tests dùng nguồn chung. Thay compiler/schema dialect phải regenerate/replay Node+browser; thay representation/hash phải version/migrate/replay receipts/outbox/artifacts. Không bật sparse/engine sản phẩm từ X04; chưa đủ V04 peakRAM/quota không công bố quy mô hỗ trợ.
