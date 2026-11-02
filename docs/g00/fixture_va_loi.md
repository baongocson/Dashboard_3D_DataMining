# Danh mục fixture và lỗi cần chuẩn hóa

Đầu ra B003, liên kết [backlog](backlog.md), [schema/API](hop_dong_can_xay.md), [MongoDB](mongodb_can_dac_ta.md). **Chỉ mô tả fixture/expected outcomes, chưa tạo dữ liệu fixture, test script, fault injector hoặc chạy test.** Tất cả actual/evidence = chưa có, V01–V05 = notTested. F/E là ID tài liệu T, không operation mới.

## 1. Quy tắc bàn giao fixture tương lai

Mỗi fixture có ID/version/purpose/source synthetic, account/project/entity IDs, schema/engine/build versions, input/config, expected invariant/oracle độc lập, tolerance khi số thực, clock/network/crash schedule nếu cần, allowed artifacts và sensitive fields. Dataset source/manifest/row IDs/hash phải tái tạo được; không dùng số mẫu giả làm kết quả ứng dụng. Không sao chép dữ liệu thật/secret vào repo. Fixture lỗi ghi cả dữ liệu phải còn sau thất bại, không chỉ assert có thông báo lỗi.

Chia cấp: fixture tối thiểu để kiểm đúng; fixture biên để kiểm validation; fixture quy mô G01/G10 khi được giao đo. Bật fault injection/clock giả chỉ trong test, không phát hành như quyền client điều khiển expiry. Threshold/tolerance engine và perf phải có lý do/bằng chứng, không chọn sau khi thấy kết quả chỉ để pass. Rerun chỉ khi thay đổi/failure/risk chưa giải quyết yêu cầu; không chạy mọi bộ cho sửa tài liệu.

## 2. Fixture cần xây

| ID | Đặc tả input/tình huống | Expected / bằng chứng cần có sau này | Task / S / ca nguồn |
| --- | --- | --- | --- |
| F01 | Hai owner A/B, A có hai project, trùng tên dataset/nhãn V1; ID hợp lệ và ref chéo owner/project | Owner không đọc/ghi/tải/AI/xóa dữ liệu B; 404 không lộ existence; IDs khác labels; clocks không quyết priority | B020/B030–B035; S01/S02/S13; AC30/DB25/BE08 |
| F02 | CSV delimiter/encoding/header khác nhau, Unicode/HTML/quotes/newlines, dòng lệch/rỗng; JSON records/object/mảng/đường dẫn va chạm | Source byte nguyên; preview rõ, accepted parse tạo V0 riêng; lỗi không tự drop; mảng không tự nhân dòng, mỗi file dataset mới | B010/B041/B050/B051; S03/S10; I05–I06/AC01–03/08 |
| F03 | Cùng metadata khác key order; null/empty/'null', ±0, finite/nonfinite, safe/unsafe integers, decimal/date/timezone | Canonical hash giống khi semantic envelope như nhau; nguồn hash theo byte; precision không mất; invalid values lỗi có row/column ID | B010/B020; S02/S03; I09 |
| F04 | A/V2 và B/V1 join: unique/duplicate/null/unmatched/many-to-many; concat mappings; undo tạo nhánh; hard/historical refs | Row order/mapping và mọi nguồn đúng; inner/left đúng policy duyệt; không dedup/trim key ngầm; graph DAG; guard dự toán đầu ra | B031/B054/B070/B100; S03/S10/S13/S24/S26; I08/AC04/23 |
| F05 | One-hot/TF-IDF vocabulary/nnz lớn, CSR invalid indices/shape, dense adapter unsupported; các mức limit−1/limit/limit+1 | Không densify/cấp phát vượt budget; bounds rõ, no fallback sample; source20MB khác feature/output limits | B010/B013/B023/B053/B061; S03/S04/S28; I10/AC11 |
| F06 | Worker START/RESULT; cancel/refresh/crash trước/sau byte close, metadata transaction, commit marker và UI success | Chỉ commit đủ mới success; sau crash giữ version/history/outbox nhất quán; interrupted không tự chạy lại; phần dở không node/version | B011/B021–B023/B042; S05/S06/S08; I11–I14/AC21/29 |
| F07 | Hai tab cùng project và project khác; transfer trong lúc worker chạy, tab chết, event trễ/fence cũ | Một writer/project, không cướp bằng timeout; khác project được chỉnh ở tab khác; event mất fence không commit | B011/B022/B056; S06/S07; I15/AC22 |
| F08 | Offline/online × dirty/clean, sync-first fail/success, discard confirmed/cancel; đổi account, scene/worker/request còn trả | Đúng bảng OFF §9; offline dirty chặn, clean deferred revoke đúng phiên; logout mọi tab, không key/data owner cũ trong RAM/cache | B022/B030/B043/B083; S07/S09/S24; I04/I15/I22/AC28 |
| F09 | Local quota khi source/result/prepare, byte bị eviction, staging/orphan còn ref/upload lease | Giữ commit trước/unsynced; không ready giả; không cleanup file active/referenced; removal offline không xóa server | B021/B080; S08/S12/S23; I12–I13/I23/AC29 |
| F10 | Controlled server clock; OTP correct/wrong5/expired/resend60s/generation cũ/purpose sai; 99 active + 2 verify concurrent | 6 số/300s/60s/5 sai đúng server; active≤100, OTP một lần, pending không giành user cũ; accepted mail không tự delivered | B012/B017/B030; S09; I01–I03/BE01–04 |
| F11 | Login B thu hồi A giữa upload/commit; reset grant reuse/passwordGeneration sai; deferred old handle khi có phiên mới | Commit trước/thu hồi có thứ tự, sau thu hồi chặn; đúng owner reauth giữ local; grant/handle không quyền ngoài mục đích | B012/B030/B033; S07/S09/S11; I21–I22/BE05–07 |
| F12 | Logical import với intent/expiry/configHash; network mất trước START/sau START/sau local commit/server commit; renew epoch mới | Local/server/ACK status khác nhau; receipt query trước renew; IDs cũ retry, source deleted chặn, offline không khởi chạy mới | B031/B032/B041/B054; S10/S12; I06–I07 |
| F13 | Batch nhiều atomic groups; mutation phát sinh sau snapshot; ACK mất/trùng/partial; cùng ID khác hash; receipt expired | Retry đúng outcome; không ACK nửa group, không ACK mục mới; mismatch từ chối; expired phải reconcile, không coi mới | B024/B033/B082; S08/S11/S16; I18–I20/BE12–14 |
| F14 | Chunk retry/different hash/index/offset/size/complete twice; storage unavailable/full; input 20.000.000−1/equal/+1, output lớn hơn nguồn | Verify server byte/hash, không nhân chunk; ready chỉ sau reference commit; input+1 chặn dù chunk; output hợp lệ không bị trần nguồn | B032/B041; S12; BE09/11, WS09–13 |
| F15 | Server/local head và config cùng đổi; conflict retry; server deleted khi client offline; metadata/ref missing | Giữ hai phía branch/copy, không dashboard rebind ngầm; blockedDeleted giữ local, không re-ID; source không thuộc owner bị chặn | B033/B082/B103; S13/S16; I20/I32/AC24/27 |
| F16 | Dataset row IDs cố định, split có seed/stratify; target đổi tên/unknown categories; nguồn đã fit full | Lưu split mapping, chỉ fit train, warn leakage và dựng lại; supervised preprocessing intermediate không dataset version | B060/B064; S17/S18; I25/AC12 |
| F17 | Group missing thiếu mẫu, hòa mode, order trùng, ffill/bfill qua nhóm, nội suy biên; scaling zero spread, encoding/TF-IDF fit | Người dùng thấy/chọn policy; không global fill/extrapolate/cross-group; mapping/scope train fit đúng, bfill cảnh báo tương lai | B052/B053/B060; S04/S18; AC09–12/I25 |
| F18 | Tiny supervised data với nghiệm kiểm được và confusion matrix giả định TP=2/FP=1/FN=0/TN=1; model export/reload | Metric oracle: accuracy=3/4, precision=2/3, recall=1, F1=4/5; kiểm metric độc lập khỏi training. Fit linear y=2x+1 với tolerance được ghi; logistic/KNN params/split/serializer đúng, không áp exact weights tùy solver | B013/B061/B063/B064; S17–S19; I25–I27 |
| F19 | PCA dữ liệu hạng biết trước; clusters có số điểm khác nhau/duplicate/all same, nhãn hoán vị; silhouette invalid | PCA variance/rank/row mapping, tọa độ so với sign ambiguity/tolerance; K-Means so phân hoạch không exact số nhãn; không ép supervised split; silhouette invalid reason/cost guard | B013/B062/B063/B071; S17/S19/S20; I26/3D-21 |
| F20 | 9 stages, nhiều step cùng stage; 50/200/1.000 metadata nodes nhiều nguồn, scope chỉ tải một phần | Explore khác run; counts lấy đúng run; graph sources không mất do filter, pagination nêu phạm vi; measured nodes/FPS không dữ liệu giả | B014/B070/B074/B111; S24; 3D-01–12/20/I34/I36 |
| F21 | 8 chart types valid/invalid axes, TopN/Khác/missing; chart dùng hai dashboards; source switch lỗi; camera/GPU loss | Validator theo loại; pinned source, refs chặn delete; layout1/2/3/order responsive; pick row đúng; GPU loss không cancel worker; local camera không version | B014/B071/B072/B074; S20/S21/S24; I28/I34/FE16–18 |
| F22 | PDF nhiều trang tiếng Việt, bảng/PNG/PCA caption/undefined metric/conclusion đã duyệt; CSV/JSON dates/bigint | Font/dấu/bố cục/nguồn đúng, không rỗng/cắt chữ; download không tạo report bắt buộc; export precision chính sách rõ | B015/B073; S22; I27/AC18/FE28 |
| F23 | App/project manifest nhiều trang, snapshot hết hạn/project đổi, lazy module thiếu; ngắt Internet reload deep link, SW pending update | Một snapshot, byte/hash/dependencies đủ mới ready; không fetch CDN/font/worker ẩn; không ép reload giữa task; app cache khác account store | B011/B015/B080/B081; S23/S30; I23–I24/WS16–18 |
| F24 | Nginx chain/Host/Forwarded spoof, `/api` sai, thiếu JS/sw/font; JSON/binary biên, private download, health/cookie/log | HTTPS/Nginx thật trong môi trường được phép; API lỗi JSON/no-store, static404 không shell; trust chain/cookies/limits/retry/log không leak | B016/B035/B110; S01/S12/S29; I35/WS01–23 |
| F25 | AI context tổng hợp/row consent, đổi hash/provider/model/source/epoch sau duyệt; malicious row/output và text thiếu căn cứ | Chỉ exact payload duyệt gửi adapter, output qua registry; accept config chưa chạy; text có provenance/giữ missing khi thiếu căn cứ | B018/B091/B092; S04/S25; I29/AC14–16 |
| F26 | AI request dispatch rồi timeout/unknown/retry/poll/cancel; key riêng reload/logout/backend restart/epoch đổi | Không dispatch lặp hoặc provider/key fallback; unknown có giải thích; không key/row trong local/DB/log/cache/backup | B018/B090/B091/B093; S25; I30/BE23–25 |
| F27 | Dependency chen giữa plan/commit; plan expired; cleanup crash/refs active; backup trước xóa/ledger append+DB crash/restore cũ/ledger missing | Fence chặn race; markedDeleted khác cleaned; ledger durable ngoài rollback; restore replay xóa/generation mới; thiếu ledger maintenance, không tái sinh | B012/B016/B100–B103; S26/S27; I31–I33/DB21–22/27 |
| F28 | Schema/client cũ + outbox, manifest/cursor/receipt expired, serverGeneration sau restore; migration crash | Giữ unsynced, reconcile/full snapshot có plan, không chấp nhận retry vô điều kiện; old build trong window T, không xóa site data | B081/B082/B102; S16/S23/S30; I20/I24/I33 |
| F29 | **Một case set cho từng dòng CLEAN/PREP/FEATURE/EDA/QUALITY**: valid/minimal/invalid/empty/missing/constant/limit/cancel/preview; output oracle thủ công hoặc phép kiểm độc lập | Theo validation đặc thù từng dòng bảng thao tác, giữ P06; không test chỉ sao chép implementation; SELECT/config/view không version, transform đúng lineage/version; tham số fit có learned-state fixture | B050–B057; S04–S06; AC05/08–11, NÚT §4.3–4.6 |
| F30 | Workflow record-from-steps/prebuilt/reorder/mapping/type mismatch; lỗi/hủy bước3, resume mới; đổi UI source trong run | Config snapshot không sửa lịch sử; 1–2 còn, 4 không chạy; resume linked run, không auto refresh; processing head khác UI pointer | B055/B056/B070; S14/S15; I16/AC06–07 |
| F31 | Undefined denominator/target test hằng/thiếu mẫu; chart empty/all missing/constant corr/negative pie/X trùng | Metric có status/reason không fake0/NaN; chart bị chặn cụ thể, line ordering/aggregation đúng; report giữ undefined đúng nguồn | B063/B071/B073; S19/S20/S22; I26–I28 |
| F32 | Untrusted names/HTML/AST sâu/unknown fields, unsupported schema/operation; tải 10→25→50→100 metadata/sync/chunk với AI giả | Không eval/leak/arbitrary schema; reason/error fields safe; perf report p50/p95/error/RAM/cold start/bandwidth riêng, không dùng mục tiêu làm actual | B020/B035/B091/B111/B112; S01/S04/S25/S28; FE31/I29/I35–I36 |

## 3. Danh mục lỗi

Mỗi lỗi thực thi phải có code ổn định, nguồn phát, field/path/scope an toàn, retryable, serverNow/requestId khi qua API, tác động tới outbox/commit và thông điệp tiếng Việt. Không log row payload/secret để giải thích. HTTP status cụ thể theo C18; lỗi browser nội bộ không ép thành HTTP. Conflict đã giữ branch/copy thành công là ACK outcome, không trả lỗi bắt client tạo lại.

Các code có nhãn **T mới** là đề xuất đặt tên cho tình huống đã có trong hợp đồng, không tính năng mới; B020 chuẩn hóa enum/version trước triển khai. Code khác lấy từ C18/BE §10.3. Timeout/cancel/success là lifecycle, không phải mọi trường hợp đều response error; E35/E39 là event/UI status khi phù hợp.

| ID / code | Nguồn / HTTP | Retry và dữ liệu phải giữ / hành động | Fixture/task |
| --- | --- | --- | --- |
| E01 VALIDATION_FAILED | UI/ENG/API 400/422 | Sửa field/config/domain, giữ nguồn/commit trước; không auto drop/null | F02/F17/F29; B020/B050–B057 |
| E02 UNSUPPORTED_OPERATION | Registry/API 422 | Không chạy phương pháp chưa capability, không thay thuật toán ngầm | F05/F32; B020/B035 |
| E03 INVALID_SOURCE | ENG/API 422 | Giữ local; chọn/kiểm nguồn refs/schema/lineage hợp lệ | F01/F04; B031/B041 |
| E04 AUTH_REQUIRED | API 401 | Dừng gửi, giữ outbox; đăng nhập đúng owner | F01/F08; B030/B043 |
| E05 SESSION_EXPIRED | API 401 | Giữ local/offline entitlement, reauth; không mở sync gate cũ tự động | F11; B030/B082 |
| E06 SESSION_REVOKED | API 401 | Fence chặn commit, giữ local; đúng owner reauth | F11; B030/B033 |
| E07 FORBIDDEN | API 403 hoặc 404 thống nhất | Không retry/tiết lộ owner khác; không đổi owner payload | F01; B030/B031 |
| E08 RESOURCE_NOT_FOUND | API 404 | Không coi là offline/không tồn tại owner khác; giữ dữ liệu local chưa sync | F01; B031 |
| E09 CSRF_INVALID | API 403 | Lấy bootstrap hợp lệ, không retry mutation mù; no secret details | F10/F24; B030/B035 |
| E10 REVISION_CONFLICT | API 409 khi chưa preserve | Đối chiếu/nhánh/copy; đã preserve phải ACK outcome, giữ hai phía | F15; B033/B082 |
| E11 IDEMPOTENCY_MISMATCH | API 409 | Không retry cùng ID với nội dung khác; giữ cả bằng chứng/local | F13/F14; B033 |
| E12 DEPENDENCY_EXISTS | API 409 | Không cascade; hiển thị refs hợp lệ và xử lý trước | F21/F27; B071/B100 |
| E13 ACCOUNT_LIMIT_REACHED | API 409 | Không activate >100 hoặc xóa account cũ; không retry mù | F10; B030 |
| E14 RESOURCE_DELETED | API 410 | blockedDeleted giữ byte local, không re-ID/sync liên tục | F15/F27; B082/B103 |
| E15 CURSOR_EXPIRED | API 410 | Full snapshot/reconcile, giữ outbox, không tự coi server trống | F28; B033/B080 |
| E16 RECONCILIATION_REQUIRED | API 410 | Đối chiếu IDs/hash/generation trước retry; giữ local | F13/F28; B082/B102 |
| E17 INPUT_FILE_TOO_LARGE | API/UI 413 | Chặn nguồn >20.000.000, không chunk để vượt; giữ dự án cũ | F14; B041 |
| E18 ARTIFACT_LIMIT_EXCEEDED | API/LOC 413 khi API | Dùng ngưỡng output riêng đã công bố, không tự giảm mẫu | F05/F14; B032/B053 |
| E19 PAYLOAD_TOO_LARGE | API/proxy 413 | Metadata/HTTP bound, không đổi limit toàn hệ thống thành 20MB | F24; B035/B110 |
| E20 OTP_INVALID | API 422 | Trừ attempts nguyên tử, không lộ OTP/email existence | F10; B030 |
| E21 OTP_EXPIRED | API 422 | Resend theo cooldown, mã cũ không sống lại | F10; B030 |
| E22 OTP_ATTEMPTS_EXCEEDED | API 422 | Không verify sau 5 sai/mã, resend đúng policy | F10; B030 |
| E23 ARTIFACT_NOT_READY | API 422/pending ACK | Giữ outbox/group, không công bố version hay ACK nửa group | F12/F13; B032/B033 |
| E24 HASH_MISMATCH | API/LOC 422 khi API | Không ready/commit; kiểm byte/reupload chủ động đúng identity | F03/F14; B020/B032 |
| E25 RATE_LIMITED | API 429 | Retry-After nếu biết; không spam/khóa cả NAT bằng ngưỡng chưa đo | F10/F32; B030/B111 |
| E26 AI_QUOTA_EXCEEDED | API 429 | Không fallback provider/key; chưa dispatch có thể người dùng chọn lại | F26; B090/B093 |
| E27 STORAGE_CAPACITY_EXCEEDED | API 503 | Giữ commit trước/local/outbox; không tự xóa history | F09/F14; B032 |
| E28 STORAGE_UNAVAILABLE | API 503 | Giữ outbox; lỗi core sync đóng gate theo C09, lỗi AI riêng không giả offline toàn app | F14; B032/B033 |
| E29 MAIL_UNAVAILABLE | API 503 | Không activate/delivered giả; resend theo cooldown, giữ local | F10; B017/B030 |
| E30 AI_UNAVAILABLE | API 503 | Core vẫn dùng; detail reason key/model/unconfigured an toàn; không auto đổi dịch vụ | F25/F26; B090–B093 |
| E31 CLIENT_SCHEMA_UNSUPPORTED | API 409 theo C18 | Upgrade/reconcile có bảo toàn outbox; không xóa site data | F28; B081/B082 |
| E32 LOCAL_QUOTA_EXCEEDED — T mới | LOC, không HTTP mặc định | Không success; bản trước/unsynced giữ, gỡ offline sạch có xác nhận | F09; B021/B080 |
| E33 WRITER_FENCE_LOST — T mới | LOC/điều phối | Không late commit, bỏ staging an toàn; xin writer không cướp lock | F07/F08; B022 |
| E34 PREVIEW_STALE — T mới | Điều phối | Xem trước lại đúng config/source, không dùng confirmation cũ | F06; B023 |
| E35 TASK_INTERRUPTED — T mới | Recovery event | Không auto resume; mở commit gần nhất, giữ bước trước | F06/F30; B021/B056 |
| E36 RESOURCE_LIMIT_EXCEEDED — T mới | ENG/LOC, API422 nếu cần | Chặn trước allocate/compute quá cost, không tự sample/feature drop | F05/F19; B023/B053/B063 |
| E37 OFFLINE_RESOURCE_MISSING — T mới | LOC/SW | Không ready giả, chỉ mở nội dung đủ; không fetch ẩn | F09/F23; B080/B081 |
| E38 CONSENT_INVALID — T mới | AI/API 422 | Dựng/duyệt lại exact payload/provider/epoch; không dispatch | F25; B091 |
| E39 AI_REQUEST_UNKNOWN — T mới | AI lifecycle/UI | Poll requestId hiện tại, không tự gọi provider lần hai/đổi key | F26; B091 |
| E40 LEDGER_UNAVAILABLE — T mới | OPS/API 503 | Chặn nhận xóa, giữ pending/maintenance; không mở ghi restore thiếu ledger | F27; B101/B102 |
| E41 UPSTREAM_UNAVAILABLE — T mới | Nginx 502/503/504 | JSON/no-store/requestId; core unavailable đóng sync gate, không retry mutation/AI ở proxy | F24; B035/B110 |

Auth credential sai cần phản hồi chung không lộ account; T dùng E01 kèm reason an toàn trong schema public auth, không trả chi tiết password/hash. Cancel chủ động là trạng thái cancelled; không hiển thị như lỗi dữ liệu. Đa lớp/metric undefined dùng MetricRecord reason S19, không nhất thiết E01 làm thất bại toàn run. Cùng quy tắc cho unavailable module, không mọi lỗi 503 đều là mất Internet.

## 4. Chuẩn hóa enum và bàn giao

B020 chuẩn hóa enum/error detail schema với S01/S04/S06, B030/B035/B091/B100 phát lỗi theo đúng lớp. Nếu đổi tên code T mới trước release phải cập nhật toàn bộ FE/API/worker/SW và F/operation criteria; không thêm alias khác nhau tùy module. I/AC/DB/BE/FE/3D/WS/OFF vẫn là kế hoạch nghiệm thu, hiện chưa case nào trong tài liệu này được tuyên bố đã chạy.
