# Quyết định, điểm cần kiểm chứng và nghiệm thu v2

Ngày: 02/11/2026. Chỉ cập nhật tài liệu; chưa thực thi các ca kiểm thử ứng dụng dưới đây. P/T/V/Q theo [README](README.md). Hợp đồng C01–C22 tại [hợp đồng tích hợp](hop_dong_tich_hop.md).

## 1. Danh mục nguồn và quyết định sản phẩm P

| Mã | File trong bộ v2 | Phạm vi căn cứ |
| --- | --- | --- |
| CN | [thiet_ke_chuc_nang_he_thong_.md](thiet_ke_chuc_nang_he_thong_.md) | Nghiệp vụ, toàn bộ tiền xử lý/ML, version, AI, chart, PDF; AC01–AC30 |
| NÚT | [thiet_ke_caynut_dieukien.md](thiet_ke_caynut_dieukien.md) | Operation IDs, menu, input/output và enable/disable |
| OFF | [thiet_ke_offline.md](thiet_ke_offline.md) | Local commit, chuẩn bị offline, đồng bộ chủ động, phiên/tab/logout |
| DB | [thiet_ke_mongodb.md](thiet_ke_mongodb.md) | Metadata/artifact, lineage, revision, receipt, xóa, migration |
| BE | [thiet_ke_backend.md](thiet_ke_backend.md) | Auth/OTP, import intent, mutation/ACK, AI key, deletion/backup |
| FE | [thiet_ke_frontend.md](thiet_ke_frontend.md) | Màn hình, theme, tham số, panel AI, dashboard, ngữ cảnh |
| 3D | [thiet_ke_3d.md](thiet_ke_3d.md) | Bản đồ chính, cây version riêng, view model, fallback |
| WS | [thiet_ke_webserver.md](thiet_ke_webserver.md) | Nginx thật, HTTPS/origin, routes/cache, deployment |

P01: Website tiếng Việt; JS/TS, không Python trong ứng dụng; người dùng chỉ cần browser. CN §2, OFF §2.

P02: Tài khoản riêng, không chia sẻ/cộng tác/phân vai; mỗi project nhiều dataset/workflow/dashboard; một phiên online/account, một writer tab/project. CN §3–4, OFF §5/10.

P03: Email/mật khẩu hệ thống và OTP 6 số/5 phút/60 giây/5 sai/một lần; tối đa 100 activated; reset thu hồi phiên, giữ unsynced local. BE §2.1/5–6, FE §16. Provider email chưa chọn.

P04: Parse, thống kê, xử lý, nối/ghép và năm thuật toán trong browser/worker cả khi online. Năm thuật toán: Linear Regression, Logistic Regression, KNN classification, K-Means, PCA. BE §2.1, CN §10.

P05: CSV/JSON mới online; source byte bất biến, V0 là bảng parse; JSON flatten object không bung mảng; mỗi file dataset mới. Nối/ghép online, browser, dataset dẫn xuất mới/V0, inner/left, mọi nguồn. BE §2.1/8, FE §8 cập nhật CN §6.3/NÚT §4.2/DB §8.

P06: Toàn bộ phương pháp đã chốt CN §7–8/NÚT §4.4–4.6 đều giữ; không giảm scope khi chia đợt. Preview/view/filter để xem không version; áp biến đổi mới version.

P07: Version bất biến, undo đổi pointer, làm tiếp từ cũ tạo branch; pipeline commit từng bước, lỗi giữ trước đó, chạy tiếp chủ động. CN §5/9/13.

P08: Split supervised trước fit train; không target/split supervised bắt buộc lên PCA/K-Means; metric đúng bài toán, không bịa; chỉ lưu/tải model, không prediction mới. CN §10, NÚT §4.8–4.9.

P09: Bản đồ 3D thật làm chính trong project; cây version riêng; có 2D tương đương. Dark mặc định/có light, tham số hiện đầy đủ, panel phải. 3D §2, FE §2/7/9.

P10: AI ngữ cảnh, không chat/RAG; chỉ gợi ý; consent trước row content; key riêng chỉ RAM theo phiên; không tự provider/key fallback. BE §2.1/11, FE §13.

P11: Nhiều dashboard, layout 1/2/3 cột, thứ tự bằng nút; chart pin nguồn; PDF chọn phần/font offline, download khác lưu report. FE §14/17, CN §12/14.

P12: Local trước/server sau; sau gián đoạn chờ Đồng bộ ngay, shared tab gate; retry idempotent, conflict giữ cả hai phía; đủ byte trước success. OFF §6–8, BE §9.

P13: Logout theo bảng OFF §9; không mất dữ liệu vì 401; dừng mọi writer/worker, chặn ghi muộn. CN §15.3/17.

P14: Xóa online/vĩnh viễn, chặn dependency ngoài phạm vi; tombstone ngăn tái sinh; không cascade ngầm. BE §2.1/13 cập nhật CN §16/DB §15.

P15: 20.000.000 byte input; 10k–50k dòng/~50 cột mục tiêu thử; 100 concurrent mục tiêu, không SLA; không quota nghiệp vụ số version/tổng project. BE §2.1, WS §2.

P16: HTTPS/Nginx thật, origin ổn định, metadata MongoDB/artifact riêng bền; ưu tiên miễn phí, provider chưa chọn; backup thủ công trước demo/thay đổi lớn. WS §2/5; BE §15.

## 2. Sửa mâu thuẫn/diễn đạt đã phát hiện

| Mã rà soát | Nguồn trước | Hoàn thiện trong v2 | Phân loại |
| --- | --- | --- | --- |
| M01 | NÚT §3.2/4.1 | N không phiên, S có phiên; auth public dùng N, challenge/grant đúng mục đích; C01/C07 | T làm rõ điều kiện |
| M02 | OFF §3 và CN §6.2 | Bỏ chức năng thay nguồn/nối tệp vào dataset cũ; chỉ import mới hoặc concat/join riêng | P05, sửa diễn đạt |
| M03 | FE §8.1/BE §8.1 | Tách START online, localCommitted, serverCommitted, acknowledged; mất mạng sau START cho local finish, refresh không auto resume; C08 | T bám hành vi BE |
| M04 | CN §17/FE §6/3D §7 | Commit nguồn snapshot, không chuyển current pointer UI đã đổi, mất fence thì bỏ; C05 | T |
| M05 | DB §11.1/NÚT §4.11/3D §11.3 | Camera chỉ lưu local bằng hành động rõ; chart save riêng cần W; C14 | T, không gán user đã chọn |
| M06 | FE §3/12 | Train/test chỉ supervised; PCA/K-Means không ép supervised split | P08 |
| M07 | OFF §8.2/BE §9.1/WS §13 | Bảng network/server/auth/syncGate độc lập; cờ chờ bền qua tab/refresh; C09 | T |
| Tên file | Các hậu tố/hoa-thường/tên chức năng không khớp | Tám basename thật trong bảng §1; không tìm file (1)/(2) thay bản hiện hành | Biên tập |
| Quyết định cũ | CN/NÚT/DB để mở auth/join/delete/layout | Cập nhật đúng các quyết định BE/FE đã ghi rõ chốt, không hỏi lại | P03/P05/P09–P11/P14 |
| Quota | DB §14 và BE §2.1 | Không quota nghiệp vụ project/version, vẫn finite limits có cấu hình | P15 + C20 T |
| Nginx | BE §14.3 | Proxy hosting không thay Nginx thật; ứng viên không đáp ứng ghi chưa đạt | P16 |

Không áp quy tắc file mới nhất thắng. Các sửa P đều có nguồn cụ thể; các cách xử lý T có thể thay qua quyết định kiến trúc ghi rõ ảnh hưởng và cập nhật hợp đồng/ca nghiệm thu.

## 3. Hoàn thiện 19 nhóm hợp đồng còn thiếu

| Mã rà soát | Đặc tả v2 | Phần cần tạo khi triển khai, chưa được tuyên bố đã có |
| --- | --- | --- |
| H01 | C04 registry/config/default/validator/output | JSON Schema từng operation và fixtures |
| H02 | C02–C03 IDs/table/CSR/canonical hash/lineage | Serializer roundtrip/precision/hash fixtures |
| H03 | C05–C06 commands/events/transaction/recovery | Worker/local adapter và crash injection |
| H04 | C06–C07 Web Lock/fence/account gate | Race tests/tab kill/owner switch |
| H05 | C08 intent/expiry/renew/idempotency | DTO/OpenAPI online intent |
| H06 | C10/C18 mutation/atomic groups/ACK/errors | Schema theo từng kind, transaction fixtures |
| H07 | C11 retention/tombstone/reconciliation/deleted local | Full resync và receipt expiry tests |
| H08 | C11 conflict copy/branch/new mutation | Conflict UI và reference validation |
| H09 | C13 app/project manifest/SW/release window | Build manifest/migration journal |
| H10 | C12/C20 split/fit/metric/model/capability | Chọn/kiểm chứng engine và adapter params |
| H11 | C20 finite resource profile | Đo limits theo thiết bị/hạ tầng, publish capability |
| H12 | C14–C15 refs/chart delete/scene events | Chart schema/stage mapping/graph pagination |
| H13 | C14/C20 export/PDF/font/capability gate | Thử PNG/model roundtrip/PDF offline |
| H14 | C16 context/consent/hash/proposal/audit | AI adapter giả, DTO và consent tests |
| H15 | C07/C18 policy/session/bootstrap | Auth schemas/fence/rate limit tuning |
| H16 | C17 hard/historical dependency/plan/token/job | Reference-fence concurrency và cleanup |
| H17 | C19 durable deletion ledger/restore generation | Thử restore snapshot cũ kèm deletion mới |
| H18 | C20–C21 tiêu chí provider/routing/runtime | Chọn hosting/mail/storage/TLS bằng bằng chứng |
| H19 | §5 bên dưới và ma trận gốc | Dữ liệu thử, logs/receipts/screenshots/reports thực |

Đã bổ sung hợp đồng bằng văn bản không đồng nghĩa đã tạo OpenAPI thực thi, cài package hoặc đo hiệu năng. Các trường lõi và trạng thái không được thay tùy module khi triển khai.

## 4. Những điểm còn mở đúng bản chất

| Mã | Loại | Việc còn lại | Điều kiện trước khi làm phần phụ thuộc |
| --- | --- | --- | --- |
| V01 | V | UI/3D/chart/local-store/ML/export libraries và phiên bản | Kiểm browser/offline/license/serializer/cancel/đa lớp/sparse, khóa phiên bản |
| V02 | V | Hosting/URL/TLS/MongoDB/artifact/mail sender | Chứng minh Nginx thật/HTTPS/transaction/private persistent storage/email thật; không triển khai Internet nếu thiếu |
| V03 | V | AI provider/model chung/adapter/key và retention | Kiểm API/chi phí/quota/khả năng schema và dữ liệu gửi; chưa bật dịch vụ chung nếu chưa cấu hình |
| V04 | V | Limits/FPS/100 người đồng thời/release window | Benchmark thực, báo đạt/chưa đạt; không tự giảm scope P |
| V05 | V | Bảo vệ backup/ledger và quy trình restore | Chứng minh ledger không rollback theo snapshot, thử restore trước demo |
| Q01 | Q nếu phát sinh | Không có phương án miễn phí đáp ứng P | Trình bằng chứng và lựa chọn cho người dùng; không tự mua/bỏ Nginx/đổi privacy |
| Q02 | Q nếu phát sinh | Muốn thêm join offline, right/full, chia sẻ, prediction, package project, khôi phục tài nguyên xóa | Ngoài scope hiện hành; cần giao việc/quyết định mới |
| Q03 | Q nếu phát sinh | Muốn tự giảm mẫu, bỏ phương pháp, gửi thêm row/đổi provider có phí | Không được coi là tối ưu kỹ thuật ngầm; cần quyết định/consent tương ứng |

Không cần người dùng chọn lại auth/join/delete/layout đã chốt. Không biến lựa chọn package thông thường thành yêu cầu người dùng quyết định; agent có thể đề xuất T có kiểm chứng V. Bản hoàn thiện tài liệu này không giả định Q01–Q03 đã được chấp thuận.

## 5. Ma trận nghiệm thu tích hợp bổ sung

Mỗi ca cần ghi environment/build/schema/engine versions, fixture IDs, bước thực hiện, expected/actual, bằng chứng và pass/fail. Tất cả hiện **chưa chạy**. Giữ toàn bộ AC01–AC30/DB01–DB27/BE01–BE29/FE01–FE31/3D-01–3D-26/WS01–WS25 và OFF §13; các ca dưới bổ sung ranh giới xuyên module, không thay thế.

| Ca | Fixture/bước thực hiện | Kết quả và bằng chứng phải thu | Đối chiếu nguồn |
| --- | --- | --- | --- |
| I01 | Browser sạch, chưa có cookie: register/login/forgot | N cho vào form/API; S private vẫn chặn; không vòng lặp | FE01, BE01 |
| I02 | 99 activated, verify đồng thời hai challenge | Tổng 100; một verify từ chối rõ; OTP tiêu thụ tối đa một lần | BE02–03 |
| I03 | OTP sai 5 lần/resend sớm/mã generation cũ | 5 phút/60 giây/5 sai đúng serverNow, cũ không sống lại | BE01–04, FE01 |
| I04 | Owner A offline có V mới, cố login B | Dữ liệu A không lộ/chuyển B; outbox giữ, luồng logout đúng | AC28/30, OFF §13.9/11 |
| I05 | Hai file cùng tên, JSON object/mảng/tên cột va chạm | Hai dataset/source byte/V0 riêng, flatten cấu hình không nhân dòng | AC01–03, DB01–02 |
| I06 | Import mất mạng trước START/sau START/sau local commit/sau server commit | Đúng từng hàng C08; receipt không tạo dataset thứ hai | FE09, BE09/12 |
| I07 | Intent hết hạn/phiên đổi rồi retry | Reauth/query receipt/renew cùng logical IDs; không tạo trùng | C08, BE05/12 |
| I08 | Join duplicate/null/many-to-many và output vượt limits | Preview estimate/null policy rõ, chặn trước cấp phát, đủ lineage left/right | AC04, BE10, 3D-09 |
| I09 | Number lớn/date/null/string 'null'/CSV HTML | Serializer không mất precision/nhầm missing, label an toàn | AC08/30, FE31 |
| I10 | TF-IDF/one-hot sparse và adapter chỉ dense | Không densify ngoài budget; config/capability nêu rõ | AC11, OFF §13.15 |
| I11 | Đổi form sau preview; bấm apply cũ | Hash/source mismatch chặn, không version mới | DB04, FE06 |
| I12 | Worker RESULT nhưng storage đầy | Không success/version dở; bản trước mở được | AC29, FE26, 3D-06 |
| I13 | Crash trước/sau commit marker, file ngoài transaction | Không success trước commit; sau commit phục hồi version/history/outbox nhất quán | AC21, DB24 |
| I14 | Task A/V1 chạy, UI chọn B/V0, task xong | Output ở A, B không đổi current pointer, link kết quả đúng | FE19, 3D-16 |
| I15 | Tab cũ chạy, bàn giao writer/tab chết/logout | Một writer, fence cũ không commit; không cướp khóa bằng timeout | AC22, FE23/25 |
| I16 | Pipeline bước 1–2 commit, bước 3 lỗi/hủy | Giữ 1–2, không bước 4; resume lượt mới linked old run | AC06–07, BE16 |
| I17 | Worker tiếp tục khi mạng mất, server cold start, refresh gate | Tiếp tục compute; mọi tab chờ nút, cờ chờ qua refresh | AC19–20, WS20 |
| I18 | Sync snapshot trong khi task mới commit; partial ACK | ACK đúng IDs/hash, phần mới/chưa ACK còn pending | FE21, BE14/18 |
| I19 | Mất ACK; retry cùng mutation; cùng ID khác hash | Một entity/conflict copy; mismatch từ chối | AC24, BE12–13 |
| I20 | Head/config server đổi; receipt hết hạn | Nhánh/copy giữ cả hai, không auto dashboard rebind; resync không duplicate | DB13/26, FE24 |
| I21 | Login/reset thu hồi giữa upload và commit | Session fence ngăn commit sau thu hồi, local giữ | BE05, DB14 |
| I22 | Logout offline sạch rồi login phiên mới, gửi deferred revoke cũ | Chỉ phiên cũ bị thu hồi, không xóa dữ liệu server | BE07, OFF §13.11 |
| I23 | Full prepare có phân trang, project đổi/manifest expiry/mất file | Một snapshot; ready chỉ sau verify dependencies, missing hiện rõ | BE19, FE22 |
| I24 | Deploy SW khi task/outbox còn, client previous build | Không ép reload/xóa DB; chunk cũ còn, migration crash phục hồi | WS17–18, OFF §13.14 |
| I25 | Supervised source fit toàn bộ, split/impute/TF-IDF/PCA | Cảnh báo, fit train, split row IDs tái hiện; không version trung gian giả | AC12–13, DB18 |
| I26 | PCA/K-Means không target; test target hằng; class không predicted | Không ép supervised split; metric undefined có lý do, không số 0 giả | FE12, NÚT §4.9 |
| I27 | Model export/reload kỹ thuật; PDF/chart PNG offline | Roundtrip metadata đúng, tiếng Việt/nguồn rõ, không gọi mạng ẩn | AC18–19, FE28 |
| I28 | Chart pinned V1, V2 mới; chart còn dashboard/report ref | Không tự đổi source, xóa bị chặn theo hard refs | AC17, DB17 |
| I29 | AI consent rồi đổi context/provider/source/epoch | Token/hash cũ bị từ chối, chỉ payload đã duyệt được gửi adapter giả | AC14–16, BE22 |
| I30 | AI timeout sau dispatch, retry/requestId/logout/restart | unknown không gọi lặp; không key/row trong DB/log/cache/backup | BE23–25, FE14–15 |
| I31 | Xóa có dependency mới chen giữa plan/commit | Fence chặn race; token stale từ chối; không cascade ngoài scope | AC25–26, BE20 |
| I32 | Server xóa, client offline gửi version cũ | 410/blockedDeleted; local còn để xem/xuất; không re-ID/tái sinh | AC27, BE21 |
| I33 | Backup trước xóa, xóa sau đó, restore backup cũ | Ledger áp lại xóa, generation mới, không mở ghi khi ledger thiếu | BE27, WS24 |
| I34 | GPU context lost/2D/đổi cảnh nhiều lần | Task/source giữ, DOM truy cập đủ, không listener/GPU leak vô hạn | 3D-18/19/26 |
| I35 | API path sai/static thiếu/413/502/Nginx retry/cookie/log | JSON/no-store/MIME đúng; không retry mutation/AI, secret không log | WS03–14/22 |
| I36 | Benchmark 10→25→50→100, upload riêng/AI giả; 50/200/1000 graph nodes | Báo p50/p95/error/RAM/cold start/FPS/visible nodes, công bố giới hạn thực | BE28–29, WS25, 3D-20 |

### Bằng chứng và điều kiện kết thúc

- Không coi viết fixture/schema/test plan là test đã chạy. Mỗi kết quả cần receipt, metadata/hash, log đã redact hoặc ảnh/video phù hợp.
- Engine/model/export phải thử dữ liệu thực và lỗi; không dùng screenshot mẫu thay hợp đồng.
- Tất cả P có ca đối chiếu; T quan trọng C01–C22 có I01–I36; V phải có báo cáo trước bật capability.
- Không đạt 100 concurrent/FPS/ngưỡng thử thì báo số đạt và điểm nghẽn, không tự xóa phương pháp hay đổi mục tiêu.
- Chỉ triển khai Internet khi Nginx/HTTPS/auth/private storage/backup và các ranh giới mất dữ liệu đạt; chưa có nhiệm vụ triển khai thì dừng ở tài liệu.

## 6. Cấu trúc repo giai đoạn sau

Giữ `prompt/` gốc; `prompt/v2/` là bộ đã hoàn thiện này. Khi được giao code mới tạo `apps/web`, `apps/api`, `packages/contracts`, `packages/operation-registry`, `packages/data-format`, `packages/browser-engine`, `infra/nginx`, `tests/fixtures`, `tests/integration`, `tests/e2e`. Không tạo scaffold/package/env/config runtime trong nhiệm vụ sửa prompt.

Các hợp đồng được triển khai một nguồn trong packages, không copy TS/schema vào cả web/api/worker. Provider và UI framework không cần quyết định chỉ để hoàn tất bước tài liệu. Cần ADR khi giải pháp T thay đổi, gồm lý do/ảnh hưởng/compatibility/ca nghiệm thu; không ghi đè yêu cầu P bằng quyết định kỹ thuật.
