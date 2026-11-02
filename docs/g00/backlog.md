# Backlog G00 và các nhiệm vụ triển khai kế tiếp

Nguồn: [kế hoạch](../ke_hoach_trien_khai.md), [C01–C22](../../prompt/v2/hop_dong_tich_hop.md), [nghiệm thu v2](../../prompt/v2/quyet_dinh_va_nghiem_thu.md). Quy ước tại [README G00](README.md). Mọi dòng là T phân chia công việc để đáp ứng P; không phải lệnh chạy việc đó trong G00.

## Module và cổng chung

CT=contracts/registry/data-format; ENG=browser engine; LOC=local/offline/worker; AUTH=auth/session/profile; API=API/resources; DB=metadata/transaction; STO=artifact adapter; SYN=sync; FE=giao diện; V3=3D/view model; EXP=xuất; AI=AI adapter/consent; OPS=Nginx/hosting/backup; QA=nghiệm thu.

Mỗi B triển khai có tiêu chí chung: giữ đúng P; schema/configVersion một nguồn; input/source snapshot xác định; lỗi không làm mất commit cũ; đầu ra đủ mới success; không vượt owner/session/writer/generation; báo unavailable đúng nếu V chưa đạt. Các tiêu chí trong bảng là tiêu chí riêng bổ sung. V ở cột cuối đều **notTested**, không phải passed; dấu “—” chỉ nhiệm vụ tài liệu không cần chạy V để bàn giao.

Đầu vào có ký hiệu S/O/M/IX/R/F/E tra ba tài liệu danh mục trong G00. Với nhiệm vụ xử lý nhiều operation, danh sách đầy đủ gắn task trong [bảng thao tác](danh_muc_thao_tac.md); không phải bỏ qua các mã không được viết lại trong cột tên.

## G00 — Đầu ra tài liệu của nhiệm vụ hiện tại

| Mã / trạng thái | Giai đoạn / module | Đầu vào → đầu ra | Phụ thuộc B | C | Tiêu chí bàn giao tài liệu | V |
| --- | --- | --- | --- | --- | --- | --- |
| B000 / DOC | G00 / CT, QA | Bộ v2 + kế hoạch → backlog và module ownership | — | C01–C22 | Mỗi nhiệm vụ có dependency, đầu vào/đầu ra, tiêu chí và V; không vòng lặp | —; không kết luận V đạt |
| B001 / DOC | G00 / CT, API | C + NÚT/BE → danh mục S01–S30/O01–O14 | B000 | C01–C05, C07–C18, C20–C21 | Có nơi đặc tả mọi config, DTO và endpoint, không sinh schema thực thi | — |
| B002 / DOC | G00 / DB, STO | DB/BE/C → M01–M27/IX01–IX24/R01–R18 | B001 | C02–C03, C07, C10–C11, C13, C17, C19 | Field/type/bất biến/index/query/ref/retention được nêu; không chạy migration | — |
| B003 / DOC | G00 / QA, CT | C và AC/I → F01–F32/E01–E41 | B001, B002 | C01–C22 | Fixture có expected invariant, lỗi có cách xử lý; mọi ca chưa chạy | — |
| B004 / DOC | G00 / CT, FE | Toàn bộ cây nút → một dòng mỗi operation, fit/output/gates/task | B001, B003 | C01, C04–C05, C12, C14–C17 | Bung shorthand đúng prefix; không tự thêm thuật toán/operation P mới | — |
| B005 / DOC | G00 / QA | B000–B004 → ma trận độ phủ và chỉ mục G00 | B000, B001, B002, B003, B004 | C22 | Đủ P01–P16; mỗi operation có task/tiêu chí; chỉ kiểm tài liệu | V01–V05 notTested |

## G01 — Chỉ chuẩn bị nhiệm vụ thử nghiệm, hiện chưa thực hiện

| Mã / trạng thái | Giai đoạn / module | Đầu vào → đầu ra | Phụ thuộc B | C | Tiêu chí nghiệm thu tương lai | V notTested |
| --- | --- | --- | --- | --- | --- | --- |
| B010 / PLANNED | G01 / CT, LOC | S02/S03, F02–F05 → X01 serializer/hash/CSR report + ADR | B005 | C02–C03, C20 | Roundtrip precision/IDs/hash, size/RAM theo X01; I09–I10 | V01,V04 |
| B011 / PLANNED | G01 / LOC | S07/S08, F06–F09 → X02 lock/commit/SW report | B005 | C05–C06, C09, C13 | Không hai writer/late commit; crash/quota giữ bản trước; I12–I15/I24 | V01,V04 |
| B012 / PLANNED | G01 / AUTH, DB | M01–M04/M14–M21, F10–F14/F27 → X03 transaction/fence/ledger report | B005 | C07, C10–C11, C17, C19 | 99→100, receipt một lần, fence/references/ledger recovery; I02/I19/I21/I31–I33 | V02,V05 |
| B013 / PLANNED | G01 / ENG | S04/S17–S19, F16–F19 → X04 năm engine + fit/sparse/serializer matrix | B005 | C04, C12, C20 | Mỗi thuật toán có params/cancel/roundtrip và expected độc lập; I10/I25–I27 | V01,V04 |
| B014 / PLANNED | G01 / FE, V3 | S24, F20–F21 → X05 UI/render/GPU/PNG report | B005 | C14–C15, C20 | 3D thật/2D/row picking/cleanup, đo visible nodes; I34/I36 | V01,V04 |
| B015 / PLANNED | G01 / EXP, LOC | S20/S21/S23, F22–F23 → X06 PDF/font/export/offline report | B005 | C13–C14, C20 | Tiếng Việt/nguồn đúng, export offline không fetch ẩn; I27 | V01,V04 |
| B016 / PLANNED | G01 / OPS, STO | S26/S27, F24/F27 → X07 hosting/Nginx/storage/restore matrix | B005 | C18–C21 | Chứng minh Nginx/transaction/private disk/restart/hash/ledger độc lập; I33/I35 | V02,V04,V05 |
| B017 / PLANNED | G01 / AUTH, OPS | S09, F10–F11 → X08 mail/OTP report khi được giao gửi thật | B005 | C07, C18, C20 | Provider accepted khác delivered; không plaintext; chưa có mail thì chưa bật auth công khai | V02,V04 |
| B018 / PLANNED | G01 / AI | S25, F25–F26 → X09 consent/unknown/key report | B005 | C07, C16, C18 | Một dispatch/request, đúng payload, key RAM, không fallback; I29–I30 | V01,V03,V04 |

## G02L và G02S — Hai nhánh nền dùng cùng hợp đồng

| Mã / trạng thái | Giai đoạn / module | Đầu vào → đầu ra | Phụ thuộc B | C | Tiêu chí nghiệm thu tương lai | V notTested |
| --- | --- | --- | --- | --- | --- | --- |
| B020 / PLANNED | G02L / CT | Danh mục S/E + X01/X04 → shared schemas, serializer và registry versioned | B010, B013 | C02–C05, C12, C18 | Browser/API cùng fixtures/hash; một schema config/mã; I09–I11 | V01,V04 |
| B021 / PLANNED | G02L / LOC | S08/M cục bộ, F06/F09 → staging/local commit/outbox/recovery | B020, B011 | C05–C06 | Version/history/outbox cùng commit marker, crash/quota không success giả; I12–I13 | V01,V04 |
| B022 / PLANNED | G02L / LOC | S07/S08, F07/F08 → worker protocol/generation/writer/account gate | B021 | C01, C05–C07 | Một writer, cancel/transfer/logout từ chối RESULT cũ; I04/I14–I15 | V01,V04 |
| B023 / PLANNED | G02L / ENG, LOC | S05/S06/S28, F05/F06 → preview/fingerprint/resource budget | B020, B022 | C04–C06, C20 | Preview cũ vô hiệu, scope mẫu rõ, không cấp phát vượt budget; I10–I12 | V01,V04 |
| B024 / PLANNED | G02L / LOC, SYN | S08/S11, F13/F15 → outbox snapshot/sync gate local/reopen refs | B021, B022 | C06, C09–C11 | Cờ chờ bền giữa tab/refresh, ACK đúng snapshot; I17–I18 | V01,V04 |
| B030 / PLANNED | G02S / AUTH, DB | S09/O01–O02/M01–M04, F10–F11 → auth/OTP/profile/session fence | B020, B012, B016 | C01, C07, C18 | Auth N không đòi phiên; activate tối đa 100, reset/revoke fence; I01–I04/I21–I22 | V02,V04; mail thật cần B017 |
| B031 / PLANNED | G02S / API, DB | S10/S13/O03–O04/M05–M09, F01/F12 → project/dataset/version metadata + revisions | B030 | C02–C03, C08, C10–C11 | Owner/ref/lineage đúng; source/version bất biến, không cross-project ref; DB01/05/07/25 | V02 |
| B032 / PLANNED | G02S / STO, API | S12/O05/M14–M15, F12/F14 → private chunk upload/verify/download/cleanup | B031, B010 | C03, C10, C18, C20–C21 | Hash byte server xác minh, verified staging khác ready, không URL public; BE11/DB24/I35 | V02,V04 |
| B033 / PLANNED | G02S / SYN, DB | S11/O06/M16–M19, F13–F15 → commit/receipt/partial ACK/conflict/reconcile | B032, B030 | C07, C09–C11, C18 | Mutation/hash mismatch từ chối; atomic group không ACK nửa; I18–I22 | V02,V04 |
| B034 / PLANNED | G02S / API, DB | S14–S19/S20–S22, F01/F16 → resource/run/ref/generation nền | B031, B033 | C10–C15, C17, C19 | Schema loại output đúng; dependency fence/tombstone kiểm ngay từ mọi mutation; DB18/BE20 | V02,V05 |
| B035 / PLANNED | G02S / OPS, API | S01/S28–S30/O12–O14, F24/F32 → capabilities/health/errors/compatibility/Nginx dev | B030, B032, B033 | C18, C20–C21 | API JSON/no-store/MIME/private redaction đúng; I35; readiness không lộ secret | V01,V02,V04 |

## G03–G05 — Luồng tích hợp và xử lý

| Mã / trạng thái | Giai đoạn / module | Đầu vào → đầu ra | Phụ thuộc B | C | Tiêu chí nghiệm thu tương lai | V notTested |
| --- | --- | --- | --- | --- | --- | --- |
| B040 / PLANNED | G03 / FE, V3 | S05/S24, cây nút → shell/3D thật/2D/form/theme/trung tâm task | B022, B023, B030, B035, B014 | C01, C04–C05, C15 | Chọn stage chưa chạy; tham số hiện đủ, nguồn/trạng thái rõ; FE03–06/3D-01–05 | V01,V04 |
| B041 / PLANNED | G03 / FE, ENG, SYN | S10/S12, F02/F12/F14 → CSV/JSON/import intent/local V0/ACK/renew | B024, B032, B033, B040 | C03, C05–C06, C08–C10 | Hai file hai dataset, JSON không bung mảng, từng mốc mất mạng đúng; I05–I07/AC01–03 | V01,V02,V04 |
| B042 / PLANNED | G03 / ENG, FE | CLEAN.HTML/PREP.MISS_MEDIAN, F02/F06 → V1/V2 có preview/undo/branch | B041, B023 | C04–C06, C10–C11 | Mỗi bước một version, đúng source, hoàn tác không xóa; AC05/23/I11–I15 | V01,V04 |
| B043 / PLANNED | G03 / FE, SYN | F07/F08/F13–F15 → end-to-end reopen/logout/reauth/head/history UI | B042, B033, B030 | C05–C07, C09–C11 | Mất ACK không trùng; đổi source không đổi pointer ngầm; logout mọi nhánh; I04/I14–I22 | V01,V02,V04 |
| B050 / PLANNED | G04 / ENG, FE | S04/S05, F02/F29 → EDA/quality/view filters/outlier report | B043 | C01, C03–C05 | Read-only không version, thống kê mẫu/undefined đúng; AC08/FE08/NÚT §4.3 | V01,V04 |
| B051 / PLANNED | G04 / ENG, FE | S04/S06, F02/F29 → toàn bộ CLEAN.* và version preview | B042, B050 | C03–C06 | HTML an toàn, chuyển kiểu lỗi không null, tokens/units rõ; AC05/08/I09/I11–I13 | V01,V04 |
| B052 / PLANNED | G04 / ENG, FE | S04/S06, F17/F29 → missing đủ 10 phương pháp | B051 | C04–C06, C12 | Group fallback được chọn; fill không qua nhóm, nội suy không extrapolate, cờ trước fill; AC09/I25 | V01,V04 |
| B053 / PLANNED | G04 / ENG, FE | S04/S03, F05/F17/F29 → encoding/scaling/log/bin/TF-IDF/feature/select | B052, B013 | C03–C06, C12, C20 | Đủ mọi phương pháp, ordinal khác label, log domain/CSR limits đúng; AC10–11/I10/I25 | V01,V04 |
| B054 / PLANNED | G04 / ENG, API, FE | S10/S03, F04/F12 → concat/inner-left join online + nhiều nguồn | B041, B053 | C03, C05–C06, C08, C10 | Dataset dẫn xuất V0, null/duplicates/estimate/order/lineage rõ; AC04/I08 | V01,V02,V04 |
| B055 / PLANNED | G04 / FE, CT | S14/S04, F30 → workflow editor/save/map/validate | B053, B054, B034 | C04–C05, C10–C12 | Một registry, mapping kiểm kiểu/vai trò; config edit không sửa history; AC07 | V01,V02 |
| B056 / PLANNED | G04 / ENG, LOC | S14/S15, F07/F30 → sequential runner/cancel/resume linked run | B055 | C05–C06, C10–C12 | Bước 3 lỗi giữ 1–2, không bước 4, không auto resume; AC06/I16 | V01,V04 |
| B057 / PLANNED | G04 / QA, CT | Danh mục operation + F29/F30 → checklist phương pháp/params và evidence | B050, B051, B052, B053, B054, B056 | C04, C20, C22 | Không operation nào chỉ hiện tên; mỗi method có valid/invalid/preview/output/fit case | V01,V04 |
| B060 / PLANNED | G05 / ENG, FE | S17/S18, F16–F17 → split/train-only fitted pipeline/leakage checks | B057, B013 | C04–C05, C12 | Row split lưu, full-fit leakage cảnh báo/dựng lại; I25 | V01,V04 |
| B061 / PLANNED | G05 / ENG | S17–S19, F16/F18 → Linear/Logistic/KNN adapters | B060 | C05, C12, C20 | Mỗi thuật toán worker/cancel/split/params đúng, k≤train; I25–I26 | V01,V04 |
| B062 / PLANNED | G05 / ENG | S17/S19, F18–F19 → K-Means/PCA + áp PCA riêng | B060 | C03–C05, C12, C20 | Không target/split supervised, row lineage/phương sai/cluster đúng; I26 | V01,V04 |
| B063 / PLANNED | G05 / ENG, FE | S19, F18/F19/F31 → metrics/undefined/Silhouette/compare | B061, B062 | C12, C20 | Metric oracle độc lập, zero denominator có reason; so nguồn/split; I26 | V01,V04 |
| B064 / PLANNED | G05 / EXP, API | S18/S19, F16/F18 → model save/download/serializer roundtrip | B063, B034 | C10, C12, C14 | Kèm fitted pipeline/feature order/serializer; chưa prediction UI; I27 | V01,V02,V04 |

## G06–G08 — Kết quả, offline và AI

| Mã / trạng thái | Giai đoạn / module | Đầu vào → đầu ra | Phụ thuộc B | C | Tiêu chí nghiệm thu tương lai | V notTested |
| --- | --- | --- | --- | --- | --- | --- |
| B070 / PLANNED | G06 / V3, FE | S24/S15, F04/F20–F21 → version DAG/history/compare/source links/stage-run | B040, B056, B062 | C05, C11, C15 | Graph đủ mọi nguồn, không xóa node tùy ý, metadata thiếu byte rõ; 3D-08–12/I34 | V01,V04 |
| B071 / PLANNED | G06 / FE, ENG | S20, F19/F21/F31 → đủ 8 chart + preview/pin/source/save/edit/delete | B050, B063, B034, B014 | C03, C05, C12, C14 | Validator từng chart, đổi nguồn lỗi giữ cũ, refs chặn delete; AC17/I28 | V01,V02,V04 |
| B072 / PLANNED | G06 / FE, API | S21, F21 → dashboard 1/2/3/order/add/remove | B071 | C10, C14 | Responsive giữ layout desktop, gỡ item không xóa chart; FE17/I28 | V01,V02 |
| B073 / PLANNED | G06 / EXP, FE | S22, F22–F23/F31 → CSV/JSON/chart/result/PDF/export-report snapshot | B064, B071, B072, B015 | C03, C12–C14 | Đúng version/metric/tiếng Việt; download khác save report; I27 | V01,V04 |
| B074 / PLANNED | G06 / FE, V3 | S24/S28, F20–F21 → picking/camera/2D/GPU/dispose/accessibility/mobile | B070, B071 | C01, C14–C15, C20 | Bàn phím/giảm motion/theme; save camera local; I34/FE29–30 | V01,V04 |
| B080 / PLANNED | G07 / LOC, API | S23/O08, F09/F23 → snapshot manifests/prepare/resume/ready/remove | B073, B074, B033 | C06, C10, C13 | Đủ byte/dependency mới ready, không trộn trang snapshot, gỡ không mất unsynced; I23 | V01,V02,V04 |
| B081 / PLANNED | G07 / LOC, OPS | S23/S30, F23/F28 → SW/lazy assets/migration/release window | B080, B011, B016 | C13, C18, C21 | Offline reload không fetch ẩn, old chunk/migration giữ outbox; I24 | V01,V02,V04 |
| B082 / PLANNED | G07 / SYN, FE | S11/S16, F13/F15/F28 → conflict UI/full reconcile/receipt expiry/blockedDeleted | B043, B080 | C09–C11, C13, C18 | Không merge ngầm, không re-ID deleted; partial/outbox đúng; I18–I20/I32 | V01,V02,V04 |
| B083 / PLANNED | G07 / QA, LOC | F06–F09/F16–F23/F28 → offline toàn tác vụ/logout/reauth evidence | B081, B082, B064 | C06–C07, C09–C14 | Chạy 5 thuật toán khi đủ local, mọi nhánh logout, không network ẩn; OFF §13/I04/I17/I22–I27 | V01,V02,V04 |
| B090 / PLANNED | G08 / AI, AUTH | S25/O10, F25–F26 → session context/key RAM/provider adapter giả | B030, B018, B064, B073 | C07, C16, C18 | Key chỉ RAM/epoch/TTL, provider allowlist, không fallback; I30 | V01,V03,V04 |
| B091 / PLANNED | G08 / AI, FE | S25, F25/F32 → consent/approved hash/request/unknown/cancel | B090 | C01, C05, C16, C18 | Payload đổi token hết hiệu lực; requestId không dispatch lặp; I29–I30 | V01,V03,V04 |
| B092 / PLANNED | G08 / FE, AI, ENG | S04/S25, F25/F29 → suggest/explain/accept/dismiss/text apply/provenance | B091, B057, B063, B071 | C04–C06, C12, C16 | Accept chỉ config; text duyệt từng giá trị; không căn cứ giữ missing; AC14–16 | V01,V03,V04 |
| B093 / PLANNED | G08 / AI, OPS | X09/provider evidence → adapter thật/capability/audit-retention | B092, B018 | C07, C16, C20 | Dữ liệu tổng hợp khi được giao, quota/privacy/unknown/key thật đạt trước bật | V01,V03,V04 |

## G09–G10 — Xóa, phục hồi và nghiệm thu phát hành

| Mã / trạng thái | Giai đoạn / module | Đầu vào → đầu ra | Phụ thuộc B | C | Tiêu chí nghiệm thu tương lai | V notTested |
| --- | --- | --- | --- | --- | --- | --- |
| B100 / PLANNED | G09 / API, DB, FE | S26/M20–M23/R graph, F27 → deletion plan/token/fence/tombstone/jobs/UI | B034, B082, B092, B072 | C10–C11, C14, C17–C19 | Không cascade, race dependency chặn, physical completion trung thực; I28/I31 | V02,V05 |
| B101 / PLANNED | G09 / DB, STO, OPS | S27/M21/M24, F27 → durable ledger/write-ahead/reconcile/cleanup | B100, B012, B016 | C17, C19 | Crash ledger/DB phục hồi, ledger lỗi chặn xóa; không dọn file còn ref; I31–I33 | V02,V05 |
| B102 / PLANNED | G09 / OPS, SYN | S27/S30, F27/F28 → manual backup/restore/generation/reauth/runbook | B101, B083 | C07, C11, C19, C21 | Backup DB+bytes; restore cũ áp ledger mới; không đủ thì maintenance; I33 | V02,V05 |
| B103 / PLANNED | G09 / QA, FE | F15/F27 → delete→old-client push/blockedDeleted/export local | B101, B102 | C11, C17, C19 | Không tái sinh/re-ID, local giữ đúng owner, gỡ có xác nhận; I32 | V01,V02,V05 |
| B110 / PLANNED | G10 / OPS | S29/S30, X07/X08 → Internet HTTPS/Nginx/origin/private storage/release | B035, B081, B093, B103, B017 | C13, C18–C21 | Không bypass/private cache; actual platform límites đồng bộ; WS01–24/I35 | V01,V02,V03,V04,V05 |
| B111 / PLANNED | G10 / QA, OPS | F24/F32 + limits profile → tải 10/25/50/100, cold start/FPS/RAM report | B110 | C20–C21 | Tách metadata/upload/AI giả; công bố actual, không tự hạ P; I36/BE28–29/WS25 | V01,V02,V04 |
| B112 / PLANNED | G10 / QA | Toàn bộ checklist/matrices/fixtures → P/C/operation evidence release | B111, B057, B064, B074, B083, B093, B103 | C01–C22 | Mọi P/operation có kiểm chuyên biệt; I01–I36 và ma trận nguồn đủ bằng chứng | V01–V05 |
| B113 / PLANNED | G10 / OPS, QA | B112/runbooks/ADR → hồ sơ bàn giao/demo/giới hạn và việc còn lại | B112, B102 | C19–C22 | Chưa đạt ghi rõ, không gọi release nghiệm thu nếu gate còn thiếu; không push/deploy ngoài nhiệm vụ | V01–V05 |

## Handoff và thay đổi T

Mỗi dòng triển khai nộp artifact/schema version, expected/actual, log đã lọc/receipt/hash/ảnh phù hợp, V nào được kiểm trên môi trường nào. Chưa có dữ liệu đó thì trạng thái vẫn PLANNED/notTested. B017/B093/B110 chỉ chạy phần dịch vụ thật khi được giao và có cấu hình hợp lệ; danh mục này không cho phép gửi mail/cloud/AI trả phí.

Nếu đổi cách chia task T nhưng vẫn đáp ứng P: ghi ADR, cập nhật task dependencies/coverage/operation rows/S/M/F/E liên quan, kiểm không mất mã. Nếu đổi serializer/hash/DB/session/lock/engine: chỉ rõ migration/compatibility/replay ca C/I bị ảnh hưởng. Không hỏi lại P và không coi package/provider đã chọn chỉ vì có module trong backlog.
