# B023 — preview fingerprint và resource budget

Dependency B020/B022 passed, reviewB02215-41-43-651Z; đọc C04/C05/C06/C20,S05/S06/S28,F05/F06,I10–I12. Scope packages/contracts primary schemas/limits và generated build; apps/web/src/local/preview.ts/resource-budget.ts; fixtures/integration và experiments/g02l; PROGRESS. Không bật operation/ML/nhập liệu/UI/sync, không sửa P/C20 limits đã ghi.

T: profile local-dev-v1 giữ nguyên số C20. Resource plan do adapter/estimator đáng tin cậy tạo từ source metadata, không lấy estimate thấp từ client làm quyền cấp phát. Pure checked arithmetic trước typed array, include byte/string/object/copies/workspace/vocabulary/sparse/join/pairwise; chặn unknown không thể lập upper bound. Budget là upper-bound policy/heuristic, không browser RAM hard limit.

Preview fingerprint khóa owner/project/source refs+hash/config/context/generation/limits profile+estimator version. Đổi bất kỳ thành phần liên quan phải preview lại, không auto sửa config/giảm mẫu/densify. scope/sample policy explicit, sample count không là affected full count. Trước execute tính lại fingerprint/estimate, cấp permit cho callback/allocator; không tính “được approve” chỉ dựa previewId client.

Registry sản phẩm145method vẫn unavailable; preview/execute sản phẩm từ chối. Fixture inject estimator synthetic riêng instance để kiểm framework, không sửa catalog/defaults/executor. Method-specific estimator/preview/fit checks còn B050–B064. B040 phải dùng approved-start path, B041 phải guard trước parse, không coi foundation này đã tích hợp UI/import.

Kiểm boundary−1/equal/+1, safe-integer overflow, 20MBsource riêng artifact256MiB, outputrow không trần50kinput, dense/CSR/nnz/features/pairs/copies/UTF16+objects, no alloc callback when blocked; fingerprint stale source/config/limits/implementation, full/sample labels, default unavailable registry. Node+Chrome/Edge online/offline pure logic, typed allocations nhỏ, không lấp RAM/disk.
