# ADR-B021-01 — Version create và expectedHead

Trạng thái: **accepted — chủ dự án chọn A ngày 2026-11-02 (Asia/Saigon)** qua câu hỏi về C02/C10/C11. Bản proposal/evidence cũ giữ nguyên tại experiments/g02l/evidence/ADR-B021-head-revision-proposal.md.

Version mới dùng baseRevision=0 của entity version chưa tồn tại. Payload có expectedHead riêng:

- known: {kind:"known",branchId,versionId,revision}, revision do server cấp.
- dependency: {kind:"dependency",branchId,fromMutationId}; mutation đó phải có trong dependencies. Server tra receipt/commit identity cùng owner/project trong transaction, lấy version/revision đã thực sự commit. Không sửa payload/hash/mutationId của client.

Known versionId=null/revision=0 chỉ là kỳ vọng branch chưa tồn tại/head rỗng khi tạo branch initial/undoContinuation hợp lệ; không là quyền ghi đè branch đã tồn tại. Branch descriptor ghi branchId/forkVersionId/reason, version.branchId và expectedHead.branchId phải bằng nhau. Source/fork thuộc đúng dataset/project/owner, kiểm trong commit.

Local headRevision là counter local, chỉ kiểm snapshot/context của writer; không được gửi như server revision. Snapshot lưu expectedLocalHeadVersionId/expectedLocalHeadRevision riêng với expectedHead server. Khi nối bước offline, dùng fromMutationId của mutation tạo local head chưa ACK; ACK không viết lại hash outbox. Khi head local đã đổi, dùng fallbackBranchId đã lập từ START, fork đúng source snapshot; không đổi current pointer nếu context đã chuyển.

Giữ conflict branch/no auto-merge, tombstone/generation/session fence/receipt idempotency theo C10/C11. Dependency chưa commit thì pending, receipt mất/hết hạn cần reconciliation; không dự đoán revision. Server phải trả revision/branch thực qua receipt; dependency có conflict branch phải được resolve theo kết quả thực và kiểm branch scope, không chấp nhận reference tùy ý.

Ảnh hưởng: sửa câu T C11 và thêm chi tiết C10; S08/S11 primary schemas và fixtures offline2step/hash/replay. S08 cũ chỉ draft chưa store/data sản phẩm, vì vậy hoàn thiện trước DBversion1; không tuyên bố đã migrate client production. Hash algorithm rfc8785-sha256-business-v1 không đổi; expectedHead ở trong payload nên được hash. Nếu đổi policy này sau khi có outbox thật phải version/compatibility và giữ đọc/xuất dữ liệu cũ.

B021 được mở lại; B024/B031/B033 dùng cùng quyết định. Không đổi P01–P16, không bật sparse/product engine hay dịch vụ ngoài. Nghiệm thu cần schema valid/invalid, dependency membership/scope, local-vs-server revision tách biệt, chain trướcACK, retry cùng hash và conflict/reconcile trong owning tasks.
