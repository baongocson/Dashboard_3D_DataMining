# Bảng trường, index và tham chiếu MongoDB cần đặc tả

Đầu ra B002; căn cứ DB §5–17 và C02–C03/C07/C10–C11/C13/C17/C19. Đây là **T thiết kế logic** và checklist schema tương lai, không collection đã tạo, không Mongoose/model/migration. Tên vật lý có thể gộp/tách bằng ADR nhưng phải giữ bất biến/query/retention. V02/V04/V05 đều notTested.

## 1. Quy tắc field dùng chung

`U`=UUID string lowercase; `O`=opaque string; `R`=safe integer revision ≥0; `T`=UTC ISO 8601 ở API, ánh xạ BSON Date lưu server time; `H`=SHA-256 hex; `Ref`=ID có scope; `!`=required. MongoDB `_id` của entity đồng bộ ánh xạ trực tiếp U; không trộn ObjectId/chuỗi cùng khóa. ID điều khiển server có thể O theo C02, biểu diễn phải ghi trong schema cụ thể.

Entity tài khoản có `_id!`, `schemaVersion!`, `ownerId!`; entity dự án thêm `projectId!`. Owner lấy từ phiên, kiểm nhất quán mọi parent/ref. `createdAtServer!` server gán; `createdAtClient?` chỉ audit; `updatedAtServer` chỉ entity mutable. Content committed, IDs/owner/project/source/operation snapshot bất biến; sửa config/head tăng revision nguyên tử. Status lifecycle có enum/transition, không trường completed dùng chung cho local/save/sync.

Mỗi field khi viết schema phải bổ sung bảng required/default/limits/null policy/enum/mutable/security/migration. Mặc định: field nghiệp vụ không tự điền nếu thiếu, optional field vắng mặt thay vì tùy ý null; server timestamps/revision có nguồn cấp duy nhất. Bounds lớn dựa limits profile C20: logs/cột/vocabulary/matrix/lineage quá lớn là artifact, không array tăng vô hạn trong doc. Không dùng tên cột người dùng làm Mongo update path.

## 2. Danh mục field theo nhóm

| Mã / nhóm logic T | Trường riêng phải đặc tả (ngoài field chung) | Validation/default/mutability/retention cần ghi | Task / C |
| --- | --- | --- | --- |
| M01 users | canonicalEmail:string!, displayEmail:string!, displayName:string!, passwordHash:string!, status:pending/active/disabled!, authEpoch:R!, passwordGeneration:R!, currentSessionId:Ref?, activatedAt:T? | Email canonical theo C07; hash không plaintext; active một lần, epoch/passwordGeneration tăng qua auth transaction; tên mutable qua profile; không xóa account bản đầu | B030; C07 |
| M02 sessions | sessionId:O!, userId:U!, tokenHash:H!, authEpoch:R!, deviceId:U!, issuedAt/expiresAt:T!, revokedAt:T?, revocationHandleVerifier:H!, state! | Session token/handle không nguyên văn DB/log; same profile chung phiên; expiry nghiệp vụ tự kiểm, TTL chỉ cleanup; epoch/fence conditional write trong mutation | B030/B033; C07/C10 |
| M03 auth_challenges | challengeId:O!, purpose:register/reset!, canonicalEmail!, generation:R!, otpVerifier:H!, expiresAt/resendAvailableAt:T!, attemptsRemaining:int!, consumedAt:T?, sendStatus!, pendingPasswordHash?, pendingDisplayName? | OTP verifier HMAC server; purpose/generation binding; mã mới vô hiệu cũ; 5 sai/300s/60s; pending không chiếm active slot, không đổi password user cũ | B030; C07 |
| M04 auth_control | Hai record/nhóm độc lập: activationCounter{_id cố định,count:int!,revision:R!}; resetGrant{grantId:O!,verifier:H!,userId!,passwordGeneration!,expiresAt!,consumedAt?} | Không nhúng grant array vào counter; count<100 cùng transaction activate; reset grant một lần, 5 phút T; hash password/grant không key gốc; reset epoch cùng transaction | B030; C07 |
| M05 projects | name:string!, revision:R!, dependencyFence:R!, state:active/deleted!, defaultContextRef? | Create online, tên không ID; dependencyFence tham gia mọi create-reference/xóa; không nhúng toàn danh mục resource/history; con trỏ thiết bị ở M27 | B031/B034; C10/C17 |
| M06 datasets | name!, kind:imported/derived!, sourceArtifactId:Ref?, parseConfigRef?, v0VersionId:Ref!, defaultBranchId:Ref?, state!, revision:R! | Imported phải giữ byte source + parse config; derived không tạo source upload giả; source/V0 tách biệt; rename không đổi artifact cũ | B031/B041/B054; C03/C08/C10 |
| M07 dataset_versions | datasetId!, branchId!, parentVersionId:Ref?, sourceVersions:ordered Ref[]!, tableManifestId:Ref!, schemaRef!, rowCount:int!, columnCount:int!, operationSnapshot!, runId?/stepId?, contentHash:H! | Bất biến sau commit; parent cùng dataset, sources có roles/order; acyclic; schema/row lineage lớn là artifact; label Vn không unique toàn cục | B031/B042/B054; C02–C03/C10–C11 |
| M08 dataset_branches | datasetId!, forkVersionId:Ref?, headVersionId:Ref!, headRevision:R!, reason:initial/undoContinuation/syncConflict!, conflictOf:Ref? | Head CAS theo branch; undo không delete hậu duệ; retry conflict branch trả cùng ID qua receipt | B031/B033; C11 |
| M09 resource_references | sourceEntityId/type!, targetEntityId/type!, relation!, strength:hard/historical!, artifactId?, sourceRevision:R!, roles/order? | Một relation type có chính sách cố định C14/C17; source/target cùng owner/project, không stale refs sau config revision; không tự đổi strength để vượt xóa | B034/B100; C03/C14/C17 |
| M10 workflows | name!, revision:R!, steps:[stepDefinition]!, requiredColumns/roles!, mappingRules!, configVersion! | Ordered operation IDs/config versions, bounds số bước; chỉnh workflow không sửa run snapshot; workflow source cố định tạo hard ref | B055; C04/C10/C12 |
| M11 workflow_runs | workflowId?, executionLocation=browser!, inputSnapshot!, status!, started/endedAt?, resumesRunId?/resumesStepId?, outputRefs!, summary! | Input khóa; lifecycle mutable có transitions; run single-op vẫn được; partial failure giữ steps; log chi tiết lớn không nhúng vô hạn | B034/B056; C05/C10/C12 |
| M12 run_steps | runId!, stepOrdinal:int!, operationId/configVersion!, sourceSnapshot!, paramsSnapshot!, status!, staged/committedOutputRefs!, commitIdentity?, warningsSummary?, errorCode?, durations? | Unique thứ tự trong run; output committed bất biến, không artifact success giả cho interrupted; server lưu client-reported compute trung thực | B034/B056; C05/C10/C12 |
| M13 resource_documents | Nhóm chart: type/sourceRef/axes/aggregation/sampleInfo/rendererVersion; dashboard: layoutColumns/orderedItems; model: algorithm/engine/serializer/split/fittedPipeline/metric/artifact refs; report: selectedSections/sourceRevisions/conclusion/font/pdf ref; tất cả revision! | Là nhóm logic, có thể tách collections; mỗi type có schema S18–S22 riêng; pinned nguồn, chart shared dashboard; download không bắt lưu report; no arbitrary discriminator payload | B034/B064/B071–B073; C12/C14 |
| M14 artifacts | purpose!, formatVersion!, sizeBytes:int!, sha256:H!, mediaType!, storageKey:string!, state!, dependencyArtifactIds!, readyAt?, referencedBySummary? | Private/internal key, không public URL bền; verified staging chưa ready; cùng ID khác hash từ chối; source≤20.000.000 byte, output limit khác; refs đầy đủ trước ready | B032; C03/C10 |
| M15 uploads | uploadId:O!, artifactId!, sessionId/epoch!, expectedSize/hash!, chunkSize!, receivedChunkRecords/ref!, state!, leaseToken!, leaseUntil!, expiresAt! | Offset/index/hash consistency, bounds number chunks; chunk array lớn tách bounded record; active lease chống cleanup; file temp không backup artifact ready | B032; C10/C20 |
| M16 sync_batches | batchId:U!, schemaVersion!, serverGeneration!, mutationIds/atomicGroupRefs!, state!, snapshotHash!, created/expiresAt! | Snapshot tối đa batch limits, status partial; không chứa byte; group độc lập ACK riêng, group phụ thuộc atomic; deviceId không quyền | B033; C09–C10 |
| M17 mutation_receipts/commit identities | mutationId:U!, canonicalHash:H!, entityIds!, artifactIds!, revisionResults!, outcome!, conflictRefs!, committedAt!, serverGeneration!, replayUntil! | Unique owner+mutationId; receipt/metadata/fence transaction; replay≥90 ngày T; durable commit identity còn để reconcile sau receipt hết; không unconditional reinsert | B033; C10–C11 |
| M18 project_changes/cursors | projectId!, sequence/serverCursorKey!, entity/type!, revision!, mutationId!, changeKind!, tombstoneRef?, createdAt! | Cursor opaque ở API, không timestamp priority; giữ 90 ngày T rồi requiresReconciliation; không TTL tombstone theo changelog | B033/B080; C11/C13 |
| M19 conflicts | conflictId!, conflictOf!, kind:branch/configCopy!, serverRef!, localCopyRef!, mutationId!, base/serverRevision!, state! | Bản sao entity thật có ID ổn định; record conflict chỉ refs, không ghi đè server; quyết định người dùng là mutation mới; không tự đổi dashboard binding | B033/B082; C11 |
| M20 tombstones | entityId/type!, owner/project/dataset scope!, deletionRevision/generation!, deletedAt!, deletionJobId! | Không byte dữ liệu để restore; không TTL bản đầu; project tombstone chặn con; phải còn đủ commit/generation identity cho old client | B034/B100; C11/C17 |
| M21 deletion ledger | entryId/jobId!, owner/project/resource IDs!, serverGeneration!, deletionRevision!, state:prepared/applied!, createdAt!, durableOffset/checksum! | **Ngoài vòng rollback DB snapshot**, không giả collection cùng snapshot đủ; Mongo chỉ giữ offset/intent counterpart nếu cần; append durable trước công nhận deletion, reconcile crash | B101; C19 |
| M22 deletion/maintenance_jobs | jobId!, kind!, scope!, state!, planRef?, attempt/int!, leaseToken!, leaseUntil!, nextRetryAt?, remainingRefs!, errorCode? | Lease fencing, bounded batches, retry idempotent; orphan cleanup kiểm active uploads/refs/grace; completed chỉ khi dọn thật; failure không mất tombstone | B100/B101; C10/C17/C19 |
| M23 deletion_plans | planId:O!, tokenVerifier:H!, scope!, expectedRevisions!, dependencySnapshotHash!, expiresAt!, blockedReasons!, confirmationHash? | 5 phút T; revalidate fence/ref trước mark; blocked không executable token; token/expiry không thay session | B100; C17 |
| M24 backup_manifests | backupId!, sourceGeneration!, schema/app versions!, dbMarker!, artifactManifestRef/hash!, ledgerOffset!, createdAt!, verificationState!, storageRef! | Byte manifest/bản backup private ngoài live snapshot khi cần; không user key/OTP plaintext; manual, không scheduler tự động; restore report lưu evidence refs | B102; C19 |
| M25 server_state | generation:U!, supportedContractVersions!, limitsProfileVersion!, maintenance/readiness state!, migrationVersion! | Singleton/control scope không owner giả; restore đổi generation/thu hồi session; client cũ phải reconcile; không đưa secret env vào doc | B035/B102; C11/C19–C21 |
| M26 ai_audit | requestId!, sourceRefs!, task!, contextHash!, provider/model!, timestamps!, status!, proposalSummary?, acceptedFields/runRefs? | Không key/row payload/prompt nguyên văn; accepted provenance còn ở version/history; audit metadata 90 ngày T; live key/consent row RAM không collection | B090–B093; C16 |
| M27 client_reopen_state | ownerId!, deviceId!, projectId!, dataset/version/branch/dashboard/screen refs!, revision!, updatedAtServer! | Local unsynced context thắng server cũ, không map mọi device vô hạn trong project; camera cá nhân local không tự sync; ref deleted/thiếu tài nguyên có fallback | B024/B043/B082; C05/C11/C13–C14 |

Credential/OTP verifier có thể cần salt/algorithm version/key version nhưng **không** key HMAC bí mật trong challenge. Chọn hash/driver/runtime và bounds cụ thể sau G01; trường secret chỉ runtime secret store theo BE, không trong project/artifact/log. M21/M24 mô tả cả kho ngoài DB; không mặc định transaction MongoDB bao trùm byte/ledger.

## 3. Index/query cần đặc tả và đo

Index dưới là danh mục T cần thiết kế trong B002/B030–B035/B100–B102; không tuyên bố query plan đã đo. Mọi entity có primary `_id`; các index business unique chỉ có khi đúng scope. Unique optional field phải partial theo kiểu/status, không để null/thiếu gây collision ngoài ý định. TTL chỉ cleanup, không thực thi quyền/expiry hay xóa dữ liệu chưa sync.

| ID | Nhóm và key đề xuất | Loại / query / điều kiện |
| --- | --- | --- |
| IX01 | M01 canonicalEmail | Unique cho user identity; canonical rule C07; pending challenge không được chiếm email user active |
| IX02 | M02 tokenHash; sessionId | Unique lookup session; raw token không lưu; sessionId primary/unique theo representation |
| IX03 | M02 userId, authEpoch, revokedAt; expiresAt | Scope revoke/current session; expiresAt TTL cleanup sau grace, vẫn kiểm epoch/expiry nghiệp vụ |
| IX04 | M03 challengeId; canonicalEmail,purpose,generation | Unique challenge ID; lookup resend/verify generation, không thay OTP purpose |
| IX05 | M03 expiresAt; M04 resetGrant expiresAt | TTL dọn pending/grant theo policy; pending registration cleanup 24h T, expiry OTP 5 phút vẫn riêng |
| IX06 | M04 counter singleton; reset grant verifier | Primary singleton activation CAS; grant verifier unique, user/passwordGeneration lookup reset |
| IX07 | M05 ownerId,updatedAtServer,_id | Project list có cursor/sort; tên project không unique toàn owner |
| IX08 | M06 ownerId,projectId,updatedAtServer,_id | Dataset list/project scope; imported/derived filter nếu query thực cần |
| IX09 | M07 datasetId,branchId,createdAtServer,_id; parentVersionId | History cursor/parent lookup; không unique display Vn, không sort ưu tiên theo client clock |
| IX10 | M08 datasetId,_id; headVersionId | Branch/head CAS theo _id+headRevision; fork/source liên quan history |
| IX11 | M09 ownerId,projectId,targetEntityId,strength | Incoming dependency plan/xóa; lọc hard refs, historical impacts |
| IX12 | M09 sourceEntityId,sourceRevision,targetEntityId,relation | Outgoing refs và replace config refs; uniqueness phải bao gồm role/order nếu nhiều cạnh cùng target có ý nghĩa |
| IX13 | M10/M13 ownerId,projectId,type?,updatedAtServer,_id | Resource lists theo loại; tách collection thì không dùng type discriminator index vô ích |
| IX14 | M11 projectId,createdAtServer,_id; M12 runId,stepOrdinal | History pagination; unique runId+stepOrdinal, snapshot immutable |
| IX15 | M14 ownerId,projectId,state,_id; artifactId/source refs | Artifact lookup/cleanup references; hash không unique toàn hệ thống hay dùng để lộ file owner khác |
| IX16 | M15 uploadId; uploadId,chunkIndex | Unique upload; unique chunk identity cho retry, stored hash mismatch bị từ chối; leaseUntil lookup cleanup không TTL xóa active |
| IX17 | M16 ownerId,batchId; M17 ownerId,mutationId | Unique batch/receipt; canonicalHash compare, receipt transaction atomically cùng metadata |
| IX18 | M17 replayUntil; durable commit entity/mutation identity | Cleanup receipt replay không xóa bằng chứng cần reconcile; nếu không chứng minh được thì reject/reconcile, không coi mới |
| IX19 | M18 projectId,sequence; createdAtServer | Cursor ordered unique theo scope; retention 90 ngày T tạo expired signal, không mất tombstone |
| IX20 | M19 ownerId,projectId,state,_id; ownerId,mutationId | Conflict list và retry unique mapping tới đúng conflict copy |
| IX21 | M20 ownerId,entityType,entityId; projectId,datasetId? | Unique tombstone resource scope, query ancestor deleted; không TTL tùy tiện |
| IX22 | M22 state,nextRetryAt,leaseUntil; M23 planId,expiresAt | Claim/retry/fencing; plan expiry query/cleanup, không tự hoàn tất deletion khi TTL plan xóa |
| IX23 | M26 ownerId,projectId,createdAtServer,_id; requestId | Audit/history bounded, request idempotency theo owner/session; live AI request state không đồng nghĩa chỉ audit đủ chống dispatch lặp |
| IX24 | M27 ownerId,deviceId,projectId; M25 singleton; M24 backupId | Unique reopen per device/project; control lookup; backup manifest identity, ledger offset lookup ở ledger adapter |

## 4. Tham chiếu và bất biến xuyên nhóm

Không có foreign key tự động đủ cho mọi quan hệ MongoDB. API/commit service kiểm cùng owner/project, acyclic lineage, trạng thái tài nguyên xóa, revision và session fence. Mọi create hard ref tham gia project dependency fence; xóa revalidate trong cùng thứ tự ghi, không chỉ query trước transaction.

| ID | Từ → tới | Bất biến / chính sách xóa / ca tương lai |
| --- | --- | --- |
| R01 | M02/M03/M04 → M01 | Đúng user/purpose/passwordGeneration/epoch; active count một lần; I01–I04/I21–I22 |
| R02 | M05 → owner M01 | Session-derived owner; không client đổi owner/project qua PATCH; DB25 |
| R03 | M06 → M05/M14/M07 | Imported source+V0 hoàn chỉnh, derived mọi nguồn; source immutable; I05–I08 |
| R04 | M07 parent → M07 cùng dataset | Không chu trình/không parent branch/head sai; undo không xóa versions; AC23 |
| R05 | M07 sourceVersions → M07 nhiều dataset | Cùng project/owner, roles/order và row lineage; hard dependency ngăn xóa nguồn đang dùng; I08/I31 |
| R06 | M07/M08 → manifest M14 / head M07 | Đủ byte/ref trước ready; head CAS không overwrite conflict; I12/I19–I20 |
| R07 | M10 → registry config/source M07 | Operation/config versions snapshot, fixed-source hard refs; mapping mới không sửa run cũ; I16 |
| R08 | M11/M12 → M10/M07/M14/M11 trước | Snapshot/step output bất biến; resumes không sửa lượt cũ; I16/I25 |
| R09 | chart M13 → version/result artifact M07/M14 | Pin source, type/columns valid, hard ref nếu dựng lại cần nguồn; I28 |
| R10 | dashboard M13 → chart M13 | itemId/order độc lập, gỡ không xóa chart; chart delete chặn refs; I28 |
| R11 | model M13 → M07/M14/M12 | Split/fitted pipeline/metric/engine lineage đủ, không source giả; I25–I27 |
| R12 | report M13 → M07/M12/M13/M14 | Hard khi còn phải dựng lại, historical nếu đã đóng gói đủ; provenance nguồn đã xóa hiện rõ; I27/I28/I31 |
| R13 | M15 → M14 + M02 + M05 | Upload đúng phiên/purpose/owner, không commit sau revoked; byte staging không public; I21 |
| R14 | M16/M17 → entity/M14/M19 | Một hash/mutation; refs/receipt/fence atomic group, retry kết quả tương đương; I18–I20 |
| R15 | M18/M19/M27 → resource/version/head | Cursor expired buộc reconcile; giữ local pointer chưa sync; copy không tự rebind dashboard; I20/I24 |
| R16 | M23/M22/M20/M21 → project/resource/ref graph | Plan không bypass fence; durable ledger/tombstone chặn con/old client; I31–I33 |
| R17 | M24 → snapshot DB/M14/M21/M25 | Backup đủ hash/ledger offset; restore generation mới, replay ledger sau backup trước mở ghi; I33 |
| R18 | M26 → owner/source/request/accepted run/version | Audit không row/key; nguồn đã chấp nhận giữ provenance; session revoke chặn kết quả cũ; I29–I30 |

Local lock/commit marker/outbox/SW nằm browser, không coi MongoDB thay kho local. Offline entitlement được client quản lý theo owner, không là quyền gọi API. Snapshot manifests có thể là dữ liệu dựng từ DB + kho snapshot có expiry; không bắt tạo collection cho mọi DTO/nút.

## 5. Cổng đặc tả trước migration

B031/B034 phải bổ sung field limits/mutable rules và query plans cụ thể, fixtures liên kết nhất quán; B030/B033 chứng minh transaction/session fence; B100/B101 chứng minh reference/deletion fence và ledger. Mọi index TTL/unique phải có null/expiry/race fixture. Chưa chạy explain/transaction/migration hay tạo database trong G00. Thay cách bố trí T cần ADR và cập nhật S/R/F/IX, không đổi quyền/lineage/bất biến P.
