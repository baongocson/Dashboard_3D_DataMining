# ADR-B021-01 — Chờ quyết định hợp đồng version/head khi offline

Trạng thái: **đề xuất, chưa chấp thuận**. Không sửa P hoặc prompt/v2; chưa tạo local commit/outbox implementation. B021/B024/B033 và phần version write phụ thuộc quyết định này; auth B030 độc lập có thể tiếp tục.

## Nguồn và điểm chưa có cùng một cách hiểu

- C02, bảng baseRevision: revision kỳ vọng của đúng entity/head; tạo mới dùng0 và ID chưa tồn tại.
- C10: mutation có entityId/baseRevision; “Với save entity mới dùng baseRevision=0”; version thêm target branch/expected head.
- C11 mở đầu: “baseRevision của version create thuộc branch head”.
- M08 trong G00: headRevision là revision server; M17 receipt có revisionResults; C10 mutationId/hash phải bất biến, dependency chưa commit thì pending.

Một version mới và một branch head là hai entity khác nhau. Khi có server head revision5, tạo V1 với entityId mới thì C02/C10 cho0, C11 cho5. Sau đó offline tạo V2 từ V1 trước ACK thì client chưa có headRevision server của V1; không được tự cấp revision server hoặc sửa payload/hash của mutation đã ghi.

## Phương án A — đề xuất

Giữ baseRevision thuộc entity version được tạo (0); guard branch head riêng trong payload expectedHead. Guard có hai dạng rõ:

1. Known server head: branchId/versionId/revision xác định.
2. Head do mutation phụ thuộc tạo: branchId/fromMutationId; server tra receipt/commit identity của dependency trong transaction để lấy version/revision đúng, không thay hash/envelope client.

Ví dụ mô tả (chưa schema thực thi):

    V1: baseRevision=0, expectedHead={branchId:B, versionId:V0, revision:5}
    V2: baseRevision=0, dependencies=[M1],
        expectedHead={branchId:B, fromMutationId:M1}

Cần sửa câu T trong C11, đặc tả S11 typed dataset.version.create, local-vs-server clock ở S08/S13, fixture offline2step/ACK/mấtACK/conflict/dependencyexpiry và receipt replay. Thay đổi chỉ kỹ thuật; không bỏ conflict branch, không auto-merge, không đổi P07/P12. Có thể chọn schemaVersion mới/compatibility trước khi phát hành; hiện chưa có app data/client production nên không tự tuyên bố đã migrate.

## Phương án B

Giữ baseRevision của version create theo branch head như C11. Phải định nghĩa baseRevision versioned union hoặc một cơ chế revision-reference của dependency, khác với safe-integer đơn ở C02; entity create-if-absent là bất biến riêng. Phải cập nhật C02/C10/S02/S11/schemaVersion/consumer/hash fixtures tương ứng trước code.

Không chọn phương án âm thầm tăng revision client, sửa hash/ID trước gửi, hoặc tạo conflict branch cho mọi offline step chỉ để né khoảng trống hợp đồng.

## Tác động và phần có thể tiếp tục

B020 foundation chỉ kiểm shape/canonical hashing tổng quát, chưa version-kind semantics, nên kết quả correctness của foundation vẫn giữ phạm vi. Sáu S08 schema mới là draft chưa được local-store sử dụng; chưa đánh B021 đạt. Quota follow-up đã passed và không phụ thuộc quyết định head.

Sau quyết định: hoàn thiện ADR và các hợp đồng thật cần sửa, version/build validators, replay B020 canonical fixture có liên quan và thêm branch/offline dependency cases, rồi mới tiếp local commit/outbox. B030 auth/session/fake mail dev theo B020/B012/X07local không phụ thuộc version/head nên có thể làm trong lúc chờ.
