# Đối chiếu phạm vi G00

Đầu ra B005, căn cứ P01–P16 và NÚT v2 hiện hành. Chỉ kiểm độ phủ tài liệu; không mở lại các quyết định sản phẩm, không tuyên bố test ứng dụng hay các X đã chạy. Đọc [backlog](backlog.md), [schema/API](hop_dong_can_xay.md), [MongoDB](mongodb_can_dac_ta.md), [fixture/lỗi](fixture_va_loi.md), [thao tác](danh_muc_thao_tac.md).

## 1. P01–P16 đều có nơi thực hiện

| P / bất biến giữ nguyên | Nơi thực hiện B / giai đoạn | Thao tác hoặc hành vi xuyên phần | Hợp đồng / thiết kế | Fixture và tiêu chí kiểm tra tương lai | V hiện tại |
| --- | --- | --- | --- | --- | --- |
| P01 — Website Việt, JS/TS, không Python ứng dụng, browser người dùng | B020/B035/B040/B050–B064/B110; G02–G10 | Mọi operation; parse/ML browser, DB/backend server | C01/C04–C06/C20–C21; CN §2/OFF §2 | F02/F18/F23/F24/F32; worker/browser không Node/Python/CDN runtime ngầm; I27/I35 | V01/V02/V04 notTested |
| P02 — Scope tài khoản, nhiều project/dataset/dashboard, một phiên/một writer | B022/B030/B031/B040/B072/B112; G02/G03/G06/G10 | AUTH.*, PROJECT.*, DATA.*, DASH.*, TAB.ACQUIRE và mọi API ref | C01–C03/C06–C07/C10; OFF/DB/BE | F01/F07/F08/F11/F21; owner isolation/ref validation, lock/fence/session race; I04/I15/I21–I22 | V01/V02/V04 notTested |
| P03 — Email/password/OTP và max100, reset thu hồi không mất local | B030/B017/B040/B043/B110; G01/G02S/G03/G10 | 7 AUTH.*; profile API trong O02, không thêm operation ID P | C07/C18; BE §5–6/FE §16 | F08/F10/F11; 300s/60s/5 sai, 99→100, grant/session/deferred revoke; I01–I04/I21–I22 | V02/V04 notTested |
| P04 — Mọi xử lý và 5 thuật toán trong browser cả online | B041/B050–B054/B060–B064/B083; G03–G05/G07 | DATA import/join, CLEAN/PREP/FEATURE, MODEL.LINEAR/LOGISTIC/KNN/KMEANS/PCA/RUN | C03–C06/C08/C12/C20; CN/BE | F02/F04/F05/F16–F19/F23; engine location/cancel/offline/metrics, I08/I10/I25–I27, AC19 | V01/V04 notTested |
| P05 — CSV/JSON online, source/V0 riêng, dataset mới, derived inner/left nhiều nguồn | B041/B054; G03/G04 | DATA.IMPORT/PREVIEW/JSON_FIELDS/CONCAT/JOIN | C03/C08/C10; BE §8/FE §8 | F02/F04/F12/F14; byte/source/V0, JSON không bung mảng, START online, logical retry, lineage; I05–I08 | V01/V02/V04 notTested |
| P06 — Đủ mọi phương pháp, preview/view không version | B023/B050–B057; G02L/G04 | EDA/QUALITY + 16 CLEAN +19 PREP +5 FEATURE (PCA áp ở G05) | C04–C06/C12/C20; CN §7–8/NÚT §4.3–4.6 | F05/F17/F29; **K từng mã** + valid/invalid/preview/output/fit/cancel phù hợp; I09–I13/AC08–11, không chỉ I chung | V01/V04 notTested |
| P07 — Bất biến/undo/branch/pipeline từng bước/resume chủ động | B031/B042/B043/B055/B056/B070; G02S/G03/G04/G06 | VERSION.*, PIPE.*, RUN.CANCEL/HISTORY/DETAILS | C03/C05–C06/C10–C12/C15 | F04/F06/F15/F30; giữ1–2 khi3 lỗi, không4; resume linked run; không delete hậu duệ/auto refresh; I14/I16/I20/AC23 | V01/V02/V04 notTested |
| P08 — Train-only supervised, metrics thật, không prediction mới | B060–B064; G05 | MODEL.* + RESULT.* + FEATURE.PCA_APPLY | C04/C12/C20; CN §10/NÚT §4.8–4.9 | F16–F19/F31; split/mapping/rebuild leakage, no supervised target PCA/KMeans, undefined reason/roundtrip; I25–I27 | V01/V04 notTested |
| P09 — 3D chính/cây riêng/2D/theme/panel/full params | B040/B070/B074; G03/G06 | VIEW3D.*, VERSION.*, scene/stage mapping; FE controls không mã riêng dùng cùng registry | C05/C14–C15; FE/3D | F20/F21/F32; 3D thật, chọn chưa chạy, keyboard/theme/motion/GPU/source; I34/FE04–05/29–30/3D-01–26 phù hợp | V01/V04 notTested |
| P10 — AI gợi ý/consent/key phiên/no chat/no fallback | B090–B093; G08 | 8 AI.* + session-context/providers API O10 | C01/C04/C07/C16/C18; BE/FE | F25/F26; đúng hash/provider/epoch, key RAM, accept không run, text duyệt/giữ missing/unknown; I29–I30/AC14–16 | V01/V03/V04 notTested |
| P11 — Dashboard1/2/3, source pin, PDF offline/download khác save | B064/B071–B074/B080–B083; G05–G07 | 15 CHART.*,6 DASH.*,4 REPORT.*,2 EXPORT.*, MODEL.DOWNLOAD/RESULT.EXPORT | C12–C14; CN §12/14/FE §14/17 | F19/F21–F23/F31; validators chart, ref delete, source switch, font/PDF/precision/export offline; I27–I28 | V01/V02/V04 notTested |
| P12 — Local trước, chờ sync sau gián đoạn, idempotent/conflict/byte đủ | B021–B024/B032–B033/B041–B043/B080–B083; G02–G03/G07 | SYNC.*, OFFLINE.*, mọi version/artifact commit | C05–C06/C08–C11/C13 | F06/F09/F12–F15/F23/F28; crash/partial/lost ACK/new mutation, branch/copy, gate chung tab; I12–I20/I23–I24 | V01/V02/V04 notTested |
| P13 — Logout mọi nhánh, 401 giữ local, chặn ghi muộn | B022/B030/B043/B083; G02/G03/G07 | AUTH.LOGOUT/LOGIN/RESET, TAB.ACQUIRE, late events mọi task | C05–C07/C09 | F07/F08/F11/F26; dirty snapshot sau dừng task, sync-first fail giữ, offline sạch deferred đúng phiên; I04/I15/I21–I22 | V01/V02/V04 notTested |
| P14 — Xóa online/vĩnh viễn/chặn dependency/no resurrection | Nền B034, B100–B103; G02S/G09 | PROJECT.DELETE/DATA.DELETE, CHART.DELETE hard refs; O11, old-client push | C10–C11/C14/C17–C19; BE §13 | F04/F15/F21/F27/F28; plan/ref fence, ledger/crash/tombstone, block deleted/no re-ID; I28/I31–I33/AC25–28 | V02/V05 notTested |
| P15 — Input20.000.000, mục tiêu thử không trần row/col, max100, không quota history | B023/B030/B041/B053/B054/B061–B063/B111; G02–G05/G10 | Resource estimator mọi operation, upload, TFIDF/join/model, activation | C03/C07/C20–C21 | F05/F09/F10/F14/F32; finite technical budgets không quota nghiệp vụ, input+1 chặn, output khác nguồn, đo tải actual; I02/I08/I10/I36 | V01/V02/V04 notTested |
| P16 — Nginx thật/HTTPS/origin, private/bền/transaction, manual backup/free ưu tiên | B016/B032/B035/B101–B102/B110–B113; G01/G02S/G09/G10 | Hạ tầng/health/private bytes/backup runbook (không operation mới) | C10/C13/C18–C22; WS/BE §15 | F14/F23/F24/F27/F28; persistence/restart/trust/cache/restore ledger, nguồn provider/date/cost, I33/I35–I36/WS01–25 | V02/V04/V05 notTested |

P01–P16 đều có nơi thực hiện; bảng này không xác nhận chúng đã được triển khai/kiểm thử. Những hành vi không có mã nút (profile, health, private bytes, manifest, migrations, CSRF, ledger) vẫn có task/schema/API/ref/fixture riêng, không biến thành thao tác dataset mới.

## 2. Độ phủ thao tác và công việc

Từ cây nút: **145 mã thao tác**, bao gồm CHART.SCATTER3D, nhóm VIEW3D và camera local ở phụ lục; bung mỗi nhánh shorthand thành mã đầy đủ. Các mã này đã nằm trong v2; không tạo mã nghiệp vụ mới để tăng số lượng. Mỗi dòng tại danh mục thao tác có K-mã, ít nhất một task B, C, S, F, loại output, fit/offline/gate và V notTested.

| Nhóm | Số mã | Task chính / giai đoạn | Kiểm tra riêng không được bỏ |
| --- | --- | --- | --- |
| AUTH | 7 | B030/B040/B043; G02S/G03 | N/S/challenge/grant; bảng logout/epoch/OTP |
| PROJECT | 6 | B031/B040/B043/B100; G02S/G03/G09 | CRUD nguồn/owner, reopen, delete/ledger |
| TAB | 1 | B022/B043; G02L/G03 | Một writer và bàn giao an toàn |
| DATA | 8 | B041/B054/B100; G03/G04/G09 | Mỗi file mới, JSON/intent/join/delete |
| EDA | 3 | B050; G04 | View/stat không version; mẫu/undefined |
| QUALITY | 3 | B050; G04 | Report chưa sửa, mở đúng config |
| CLEAN | 16 | B042/B051; G03/G04 | K từng method, unsafe HTML/type/error/token/dedup/outlier |
| PREP | 19 | B052/B053; G04 | Toàn bộ missing/encoding/scaling/log/bin/TF-IDF; fitScope |
| FEATURE | 5 | B053/B062; G04/G05 | Công thức/date/constant/roles/PCA apply riêng |
| PIPE | 7 | B055/B056; G04 | Config/map/check/run/resume/atomic step |
| RUN | 3 | B022/B056/B070; G02L/G04/G06 | Cancel/commit ordering/history/source |
| MODEL | 11 | B060–B064; G05 | Đủ5 engines/config/check/run/save/download |
| RESULT | 6 | B063/B064/B073; G05/G06 | Metric đúng loại/undefined/compare/export |
| AI | 8 | B091/B092; G08 | Consent/request/accept/dismiss/text/provenance |
| CHART | 15 | B071/B073; G06 | Đủ8 chart types và7 actions, pin source/delete refs |
| DASH | 6 | B072; G06 | Create/rename/open/add/remove/order, layout1/2/3 |
| VIEW3D | 5 | B040/B074; G03/G06 | Rotate/zoom/pick/reset/save camera local |
| VERSION | 4 | B042/B043/B070; G03/G06 | List/compare/undo/select, DAG/branch |
| EXPORT | 2 | B064/B073; G05/G06 | CSV/JSON/result precision/format đã verify |
| REPORT | 4 | B073; G06 | Config/preview/generate/download, không buộc save |
| OFFLINE | 3 | B080; G07 | Prepare/status/remove, quota/no unsynced loss |
| SYNC | 3 | B024/B033/B082; G02/G07 | Now/retry/conflict, shared gate/ACK |
| **Tổng** | **145** | **22 nhóm** | **145 K-mã trong bảng thao tác** |

Một task được dùng lại bởi nhiều thao tác nhưng không bỏ K từng thao tác. Một thao tác MODEL.* có thể mở cấu hình và run sau; không coi việc chọn thuật toán đã huấn luyện. Output union của dataset import/workflow là có chủ ý, không ép mọi hành động vào version. Các operation T từ v2 như FEATURE.PCA_APPLY/OFFLINE.REMOVE/camera giữ nhãn T và gate tương ứng.

## 3. Hợp đồng xuyên phần và nơi chịu trách nhiệm

| C | Task thiết kế/xây chính | Artifact G00 / kiểm tra tương lai |
| --- | --- | --- |
| C01 | B001/B004 → B022/B030/B040 | S04/S07/S09, K gates R/W/N/S/D/A, F01/F07/F10 |
| C02 | B001/B002 → B020/B031 | S02/M chung, canonical/revision/ID, F03/F13 |
| C03 | B001/B002 → B020/B041/B054 | S03/M06–M09/M14/R03–R06, F02–F05 |
| C04 | B001/B004 → B020/B050–B057 | S04 mỗi operation, F29 + K từng mã |
| C05 | B001/B004 → B022/B023/B040/B056 | S05/S06/S15/S24, F06/F07/F30 |
| C06 | B001/B003 → B021/B022 | S07/S08, F06–F09, I12–I15 |
| C07 | B001/B002 → B030/B043 | S09/M01–M04/fence, F08/F10–F11 |
| C08 | B001 → B041/B054 | S10/M06–M07, F04/F12/F14 |
| C09 | B001/B003 → B024/B033/B082 | S08/S11, F13/F15, I17–I18 |
| C10 | B001/B002 → B032/B033/B034 | S11/S12/M14–M18/IX17, F12–F14 |
| C11 | B001/B002 → B033/B082/B103 | S16/M19–M20/M27, F15/F28 |
| C12 | B001/B004 → B060–B064 | S17–S19, F16–F19/F31, fitScope K |
| C13 | B001/B002 → B080/B081 | S23/S30, F09/F23/F28 |
| C14 | B001/B004 → B071–B074 | S20–S22/M13/refs, F21–F23/F31 |
| C15 | B001/B004 → B040/B070/B074 | S24, F20/F21, I34 |
| C16 | B001/B002 → B090–B093 | S25/M26, F25/F26, I29–I30 |
| C17 | B001/B002 → B034/B100/B101 | S26/M09/M20–M23, F27, I31–I32 |
| C18 | B001/B003 → B020/B035 | S01/O01–O14/E01–E41, F24/F32 |
| C19 | B002/B003 → B101/B102 | S27/M21/M24/M25, F27/F28, I33 |
| C20 | B001/B003 → B023/B035/B111 | S28/V/X profiles, F05/F14/F32, I36 |
| C21 | B001/B003 → B035/B081/B110 | S29/S30, F23/F24/F28, I24/I35 |
| C22 | B000–B005 → B112/B113 | Backlog/coverage/ADR/evidence, không có task mồ côi |

## 4. Trạng thái bàn giao và giới hạn

- Đã soạn 7 file Markdown G00; B000–B005 là DOC theo nghĩa đầu ra tài liệu, không nghĩa runtime đã đạt.
- Kiểm tra cấu trúc tài liệu cần xác nhận: task IDs và dependencies tồn tại/không chu trình; source operation set bằng145 rows không trùng; P đủ16; schema30/API14/M27/index24/ref18/fixture32/error41 có nơi dùng; link nội bộ hợp lệ. Kết quả kiểm tra thực tế báo khi bàn giao, không tự gán test runtime.
- V01–V05 **notTested**; X01–X09 **chưa thực hiện**. Thư viện/provider/package versions, performance, quota/FPS/100 concurrent và ledger durability chưa có bằng chứng.
- Các trường/index/ref là thiết kế cần đặc tả trước code/migration; không JSON Schema/OpenAPI thực thi được sinh trong G00. F là mô tả fixture, E là enum cần chuẩn hóa; không tạo app/tests/services/deploy.
- Giữ nguyên `prompt/v2/`, `docs/ke_hoach_trien_khai.md` và README gốc; chỉ tạo tài liệu trong `docs/g00/`. Các nhóm T đổi cần ADR cập nhật links/coverage/schema/fixtures, không thay P; không yêu cầu người dùng chọn lại P.

## 5. Kết quả kiểm tra cấu trúc tài liệu G00

Đối chiếu ngày 02/11/2026 bằng cách đọc Markdown và danh mục nguồn, không khởi động ứng dụng/dịch vụ hoặc thực hiện X/I:

| Phép đối chiếu tài liệu | Kết quả |
| --- | --- |
| Số file G00 | 7 file Markdown |
| Backlog | 64 nhiệm vụ: 6 DOC, 58 PLANNED; ID duy nhất, dependencies tồn tại, không chu trình |
| Operation source → bảng G00 | 145 → 145 mã, không thiếu/thừa/trùng; có K-mã/task/C/S/F/V cho mỗi dòng |
| P | 16/16 có dòng ánh xạ nhiệm vụ và tiêu chí kiểm tra |
| Danh mục cần xây | 30 S, 14 O, 27 M, 24 IX, 18 R, 32 F, 41 E; mã liên tục/duy nhất theo từng danh mục |
| Liên kết/tham chiếu/định dạng | Đã kiểm file đích tồn tại, mã B/S/O/M/IX/R/F/E tham chiếu hợp lệ, fence Markdown đóng, không lỗi ký tự thay thế hoặc whitespace cuối dòng |
| Trạng thái ứng dụng/thử nghiệm | Không viết/chạy app; F chưa được tạo thành dữ liệu; X/I chưa chạy; mọi V vẫn notTested |

Độ phủ tài liệu không chứng minh tính đúng của implementation. Báo cáo fixture/test/benchmark/hosting sẽ là đầu ra của các nhiệm vụ PLANNED khi được giao riêng. Không chuyển DOC thành V passed hoặc release ready.
