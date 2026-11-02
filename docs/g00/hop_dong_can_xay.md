# Danh mục JSON Schema/OpenAPI cần xây

Đầu ra B001, chỉ đặc tả Markdown; chưa tạo `.json`, `.yaml`, DTO hay generator. Căn cứ [C01–C22](../../prompt/v2/hop_dong_tich_hop.md), BE §10 và cây nút. Tên S/O và phân nhóm là **T**; không thay payload/semantics v2. Mọi V còn notTested. Task, fixture và lỗi xem [backlog](backlog.md), [fixture/lỗi](fixture_va_loi.md).

## 1. Quy tắc cho từng schema tương lai

Mỗi schema có schema ID/version, producer/consumer, field/type/required/default/enum/bounds, additionalProperties policy, examples hợp lệ/không hợp lệ có mã F/E, bất biến xuyên field và references, quy tắc migration/hash và sensitive-field redaction. Validator dữ liệu/owner/session/lineage/bytes không được giả là JSON Schema tự kiểm hết. Unknown field bị từ chối ngoài map mở được định nghĩa; schema do ứng dụng kiểm soát, không nhận schema thực thi từ người dùng.

T: dùng một nguồn schema dùng chung, schemaVersion ban đầu 1 theo C02, không lấy số 2 của bộ prompt làm phiên bản payload. Chọn dialect/validator/codegen sau B010/B013 và kiểm browser/API tương thích; chưa chốt package/dialect chỉ để viết G00. Nếu đổi công cụ mà không đổi semantics thì cập nhật ADR/fixture; nếu đổi representation/hash thì cần contract version và replay/migration. Không chứa Node driver/secret trong phần browser.

## 2. Danh mục schema

| ID | Những schema con/field cần đặc tả | Producer → consumer | Task xây / C | Fixture / tiêu chí |
| --- | --- | --- | --- | --- |
| S01 | Success/ErrorEnvelope, error details allowlist, requestId/serverNow, Pagination/Cursor/RetryAfter | API/proxy → FE/SYN | B020/B035; C18/C21 | F01/F24/F32; status/JSON/no-store, không secret, retryable đúng |
| S02 | UUID/opaque IDs, sourceRefs/roles, revision/baseRevision/serverGeneration, time/hash/canonical business envelope | CT → mọi module | B020; C02 | F01/F03/F13; hash đồng nhất, revision không timestamp, ID không label |
| S03 | Column/schema/type/cell, JSONL row/chunk/manifest, CSR shape/index/data, row lineage one-to-many, parse policies | ENG/LOC → API/STO/V3 | B020/B041/B054; C03 | F02–F05; roundtrip/precision/hash/lineage/sparse limits |
| S04 | OperationDefinition + một config schema cho **từng mã** trong bảng thao tác; params/domain/defaults/output/learnsParameters/estimator/offline/cancel/capability | Registry → form/worker/workflow/AI/API | B020/B050–B057/B060–B064; C04/C12 | F05/F17–F19/F29–F31; không missing operation, configVersion đúng, không params tùy ý |
| S05 | WorkingContext, PreviewRequest/Result, configHash/scope/sample/affected counts/warnings/confirmation | FE/ENG → điều phối | B023/B040; C05 | F06/F16/F21; đổi config/source vô hiệu preview, số mẫu không giả full |
| S06 | ExecutionSnapshot, START/CANCEL/DISPOSE, task events/progress/sequence/generation/fence, result staged refs, task/run terminal states | Điều phối ↔ worker/LOC/FE | B022/B023/B056; C05–C06 | F06–F08/F30; RESULT không success, cancel/commit ordering, đúng snapshot |
| S07 | WriterOwnership/transfer request/fence, account gate/generation, offline entitlement/deferred revocation metadata, local-only preferences | LOC/AUTH → mọi tab | B022/B030/B074; C01/C06–C07/C14 | F07–F08/F11; không key/password trong kho local, chỉ một writer |
| S08 | StagingRecord/commit marker/LocalCommitResult/OutboxMutation/syncGate/snapshot membership/reopen local state | LOC/SYN → FE/SYN | B021/B024/B043; C06/C09–C11 | F06/F09/F13/F15; transaction refs/history/outbox, ACK đúng mục |
| S09 | Register/Login/Profile; OTP challenge/purpose/generation/attempts/sendStatus/server clocks; forgot/verify/reset grant; session/epoch/revoke/bootstrap CSRF | FE ↔ AUTH | B030; C07/C18 | F10–F11; 6 số/300s/60s/5 sai, 100 activated, session fence |
| S10 | ImportIntent create/renew/response; imported/derived kind, logical IDs, file size/format, source revisions, configHash/expiry | FE/ENG ↔ API | B041/B054; C08 | F02/F04/F12/F14; START online, retry cùng ID, nguồn xóa chặn |
| S11 | Batch declaration/atomicGroups/dependencies; typed mutation **mỗi kind C10**; canonicalHash; commit request/ACK/partial/rejected/receipt | SYN ↔ API/DB | B024/B033; C09–C11 | F13–F15; ACK disjoint/đủ mục, retry/hash mismatch, atomic group không nửa |
| S12 | ArtifactDescriptor/purpose/format/hash/size; upload/chunk status/complete/cancel; binary stream headers; staging/ready/deleting | STO/API ↔ LOC/SYN | B032; C03/C10/C18/C20 | F12/F14/F24; byte/hash đúng, source limit khác artifact, quyền tải |
| S13 | User-safe project/dataset/version/branch metadata; parent/source refs, head/select mutation, imported source vs derived V0 | API/DB ↔ LOC/FE | B031/B042; C02–C03/C10–C11 | F01/F04/F15; immutable content, branch không xóa bản mới, owner/ref |
| S14 | WorkflowDefinition/revision/ordered steps/config versions, column mapping/static/dynamic validation/resume relation | FE/ENG ↔ API | B055/B056; C04–C05/C10/C12 | F17/F30; mapping theo type/role, input config snapshot không đổi |
| S15 | Run/Step immutable input, mutable lifecycle, location=browser, view/version/artifact/config/control output union, warnings/error limits/history cursor | ENG/LOC ↔ API/FE/V3 | B034/B056/B070; C05/C10/C12/C15 | F06/F30; từng bước commit, interrupted không output giả, status read-only |
| S16 | Conflict branch/copy descriptors, conflictOf, reconciliation plan/pages/actions/expiry, blockedDeleted, cursor expired | API/SYN ↔ FE/LOC | B033/B082; C11 | F13/F15/F28; không auto merge/re-ID, retry không copy trùng |
| S17 | AlgorithmConfig theo **từng 5 thuật toán**, feature/target roles, params schema, split ratio/seed/stratify/row IDs, cost checks | FE → ENG/API | B060–B062; C04/C12/C20 | F16–F19; không supervised split PCA/K-Means, schema params gắn engine |
| S18 | FittedPipeline ordered steps/fitScope/learned artifacts/unknown policy; model manifest/serializer/runtime/feature order/target mapping | ENG → EXP/API/LOC | B060/B064; C12 | F16–F18; train-only, roundtrip metadata/bytes, không prediction endpoint |
| S19 | MetricRecord undefined reason/evalSet/params/sample; class order/confusion, regression/cluster/PCA result artifact/compare context | ENG → FE/EXP/API | B063; C12 | F18/F19/F31; no fake zero/NaN, đối chiếu nguồn/split, cost sample consent |
| S20 | ChartConfig cho từng loại/trục/aggregation/TopN/missing/sample/renderer, source switch/save/delete mutation | FE/ENG ↔ API/V3 | B071; C14 | F19/F21/F31; validator theo chart, pinned source, lỗi giữ cũ |
| S21 | Dashboard 1/2/3 columns/ordered item IDs/chart refs/revision; add/remove/order | FE ↔ API | B072; C14 | F21; gỡ không xóa chart, responsive không ghi đè desktop |
| S22 | ExportRequest/format capability; ReportSnapshot selected sections/source revisions/metric/provenance/conclusion/font/PDF ref | FE/EXP ↔ LOC/API | B073; C03/C12/C14 | F22–F23/F31; đúng nguồn/font, tải không bắt lưu, không HTML report bắt buộc |
| S23 | ProjectManifest snapshot/cursor/pages/expiry/artifact dependencies; AppManifest build/static hash/capability/compatibility; LocalOfflineStatus scopes | API/build/LOC → SW/FE | B080/B081; C13 | F09/F23/F28; cùng snapshot, đủ byte mới ready, giữ old builds theo policy |
| S24 | StageViewModel/run counts, VersionGraph nodes/edges/pagination, scene events, row pick, local camera/view preferences | Điều phối ↔ V3/DOM | B040/B070/B074; C14–C15 | F04/F20–F21; graph không cells/secrets, source snapshot, GPU loss không mất task |
| S25 | AI context/tasks, consent preview/hash/confirm/token/expiry, request identity/state, session-context, proposal/accepted fields/text provenance/audit | FE/AI ↔ API | B090–B093; C07/C16 | F25–F26/F32; đúng payload/epoch/provider, key RAM, unknown không tự dispatch |
| S26 | Dependency hard/historical graph, plan/scope/expectedRevisions/token/hash/expiry, deletion mutation/job/tombstone/fence | API/DB ↔ FE | B034/B100/B101; C14/C17 | F04/F27; reference race, không cascade, completion byte thật |
| S27 | BackupManifest/artifact hashes/ledger offset; write-ahead ledger entry/state, restore report/generation/maintenance | OPS/STO/DB ↔ SYN/API | B101/B102; C19 | F27–F28; ledger ngoài rollback, thiếu ledger không mở ghi |
| S28 | Capability/limits profile/authPolicy/operation availability/engine/runtime/license evidence reference | API/registry → FE/ENG/OPS | B023/B035/B111; C20 | F05/F24/F32; chưa verify không bật, input max P không đổi |
| S29 | HTTP deployment profile: origin/TLS/proxy trust/API prefix/MIME/cache/body/timeout/requestId/redaction/health | OPS → API/build/QA | B035/B110; C18/C21 | F24; tài liệu policy/headers, không phải JSON Schema cho binary body hoặc mã Nginx |
| S30 | Compatibility/server state/client migration journal/schema range/reconciliation generation/release rollout/rollback | LOC/API/OPS → client | B035/B081/B102; C11/C13/C19/C21 | F23/F28; old client/outbox giữ, restore buộc reconcile |

S04 là danh mục schema cần xây cho **mọi operation**, nhưng không ép UI-only/view/control có executor biến đổi dữ liệu. S17 là schema tham số engine theo kết quả V01, không bịa tên hyperparameter. Schema cross-link dùng stable IDs; không nhúng dataset/vocabulary/log tăng vô hạn trong metadata.

## 3. Danh mục OpenAPI phải mô tả

Base `/api/v1`, `:id` ở bảng phải chuyển path parameter OpenAPI đúng tên khi triển khai. Mỗi method cần request/response/error schema Sxx, security N/S/CSRF/challenge/grant, scopes, bounds/cursor, idempotency/baseRevision, content type, expiry/retry và example fixtures. O13–O14 là phần chung áp dụng endpoint, không endpoint ghi nghiệp vụ mới.

| ID / task | Method + path cần xây | Schema / security / kiểm tra |
| --- | --- | --- |
| O01 / B030 | POST `/auth/register`, `/auth/otp/resend`, `/auth/register/verify`, `/auth/login`, `/auth/password/forgot`, `/auth/password/verify`, `/auth/password/reset`; GET `/auth/csrf` **T đề xuất đường dẫn bootstrap** | S01/S09; N, Origin/CSRF bootstrap không đòi S; verify đúng purpose/grant; F10–F11 |
| O02 / B030 | GET `/auth/session`; POST `/auth/logout`, `/auth/revoke-deferred`; GET và PATCH `/me` | S09/S07; S cho private, deferred chỉ handle phiên cũ; PATCH tên hiển thị không email/owner; F08/F11 |
| O03 / B031/B041 | GET và POST `/projects`; GET `/projects/:id`, `/projects/:id/datasets`; POST `/projects/:id/import-intents` | S10/S13/S11; S; create/renew logical IDs, cùng commit service; F01/F12 |
| O04 / B031/B034 | GET `/datasets/:id/versions`, `/datasets/:id/branches`, `/versions/:id`, `/projects/:id/resources`, `/resources/:id`, `/runs/:id/steps` | S13–S15/S18–S22; S+owner; read cursor, metadata khác artifact bytes; F01/F04/F30 |
| O05 / B032 | POST `/artifacts/uploads`; PUT `/artifacts/uploads/:id/chunks/:index`; POST `/artifacts/uploads/:id/complete`; GET và DELETE `/artifacts/uploads/:id`; GET `/artifacts/:id/content` | S12/S01; S/fence/owner; binary MIME/size/hash/offset, DELETE staging không ready; F12/F14/F24 |
| O06 / B033 | POST `/sync/batches`; POST `/sync/batches/:id/commit`; GET `/sync/batches/:id`, `/sync/receipts/:mutationId` | S11/S08; S/CSRF, baseRevision, typed mutation allowlist, ACK chính xác; F13–F15 |
| O07 / B033/B082 | GET `/projects/:id/conflicts`; POST `/sync/reconciliations`; GET `/sync/reconciliations/:id` | S16; S+owner, không push byte khi đối chiếu, chọn copy qua mutation mới; F15/F28 |
| O08 / B080 | GET `/projects/:id/manifest`, `/projects/:id/changes` | S23/S16/S30; S, snapshot/cursor expiry, không trộn revision; F23/F28 |
| O09 / B035/B020 | GET `/capabilities`, `/operations` | S28/S04; public subset không secret, account limits private cần S; source registry version; F05/F32 |
| O10 / B090–B093 | GET `/ai/providers`; POST và DELETE `/ai/session-context`; POST `/ai/consents`; POST `/ai/consents/:id/confirm`; POST `/ai/requests`; GET `/ai/requests/:id`; POST `/ai/requests/:id/cancel` | S25/S09; S+CSRF, request hash/session epoch, key RAM/body redact; F25–F26 |
| O11 / B100/B101 | GET `/projects/:id/dependencies`; POST `/projects/:id/deletion-plan`, `/projects/:id/deletions`; GET `/deletions/:id` | S26/S27; S+W confirmation/plan/reference fence; dependency query có scope; F27 |
| O12 / B035/B110 | GET `/health/live`, `/health/ready`; Nginx `/healthz` **ngoài `/api/v1`** | S01/S29; public tối thiểu hoặc monitoring theo deployment, không secret; healthz không chứng minh DB ready; F24 |
| O13 / B035/B110 | Lỗi backend và lỗi Nginx của mọi path API, kể cả path không tồn tại/413/502/503/504 | S01/S29; JSON status/no-store/requestId, không SPA fallback; F24/F32 |
| O14 / B020/B035/B081 | Components/securitySchemes/CSRF/session/challenge; parameters/cursor/serverNow/revisions; examples và compatibility | S01/S02/S07/S09/S30; baseRevision body theo C18, không hai nguồn If-Match khác giá trị; F01/F28 |

Không thêm endpoint server training/prediction hoặc API ghi CRUD song song bỏ qua sync service. Rename project/dataset, chart/workflow/dashboard/model/report save, head/select/reopen state và AI acceptance dùng typed mutations S11. Xóa project/dataset dùng plan/service chung O11. Backup/restore/ledger là vận hành qua runbook trong scope hiện hành, không tự bổ sung public admin API.

## 4. Cổng trước triển khai contract

B020 tạo schema shared sau các thử nghiệm đã được giao; B030–B035 biến O thành OpenAPI/fixtures theo cùng S. V01 kiểm dialect/browser validator/precision/engine params, V02 kiểm transaction/auth/upload, V03 kiểm AI adapter, V04 kiểm bounds, V05 kiểm ledger. Tất cả hiện notTested. Không sửa payload để “cho test qua”; thay representation T cần ADR cập nhật S/M/operation/F/E và backward compatibility theo C22.
