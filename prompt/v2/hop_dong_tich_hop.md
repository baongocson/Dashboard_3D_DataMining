# Hợp đồng tích hợp chung v2

Phiên bản: 2.0-draft; ngày 02/11/2026. Chỉ đặc tả, không phải mã nguồn hoặc schema đã triển khai. Các giải pháp T dưới đây thống nhất cách triển khai đề xuất; các yêu cầu P kế thừa tám thiết kế. Đọc phân loại trong [README](README.md).

## C01. Quyền, khả dụng và phạm vi

P: browser thực hiện parse/thống kê/làm sạch/tiền xử lý/nối–ghép/năm thuật toán. MongoDB/backend ở server. Nguồn: backend §2.1; frontend §3; offline §2–5.

| Ký hiệu | Điều kiện chính xác |
| --- | --- |
| N | Backend đích truy cập được qua HTTPS; không yêu cầu đã đăng nhập |
| S | N và phiên server hợp lệ, đúng owner, epoch, chưa hết hạn/thu hồi |
| R | Quyền đọc đúng owner theo phiên server hoặc quyền offline local; đủ metadata/nội dung cần cho hành động tại nơi thực thi |
| W | R, writer fence hiện hành, nguồn snapshot xác định, không writer cạnh tranh, khả năng commit local; không yêu cầu S cho xử lý offline |
| D | Schema, tham số, điều kiện toán học, nguồn và tài nguyên đạt validator |
| A | S, adapter/model/key sẵn sàng, quota cho phép, consent hợp lệ nếu có row content |

Đăng ký/login/forgot/resend/verify/reset dùng N + challenge/grant theo từng bước, không dùng S. Project list có thể đọc danh mục metadata local theo quyền local; mở nội dung lại kiểm tra R. Tạo project dùng S + mutationId, không yêu cầu dataset đã tồn tại. Import/concat/join cần W(project) + S + D để khởi chạy. W(project) kiểm tra phạm vi project, không đòi có version đích trước khi tạo V0. AI đưa cấu hình vào form cần W; chỉ gửi/đọc đề xuất không sửa dự án cần R + A.

Tab chỉ xem được xem bảng, thống kê/preview không ghi lịch sử chuẩn vào dự án, xoay camera, tải/xuất bằng R + D. Tạo run lưu bền, model, version, chart/config/report cần W. Preview tạm không tạo outbox; nếu muốn lưu kết quả phải chuyển thành command có W. API luôn kiểm tra quyền độc lập.

## C02. Định danh và định dạng truyền tải

T: ID đồng bộ là UUID v4 lowercase dạng chuỗi, tạo ở client được; project/dataset/version/branch/run/step/column/row/artifact/mutation/batch đều dùng ID riêng. Session/upload/intent/challenge/consent dùng opaque ID không mang quyền tự chứng minh. ID tách khỏi nhãn V0/V1; displayOrdinal local không là khóa uniqueness. Hash là SHA-256 hex lowercase trên byte chuẩn.

| Trường chung | Kiểu và quy tắc |
| --- | --- |
| schemaVersion | Số nguyên dương; hợp đồng ban đầu 1, tách khỏi phiên bản bộ tài liệu 2.0 |
| operationId/configVersion | Mã trong cây nút; configVersion số nguyên dương |
| revision | Số nguyên an toàn không âm do server cấp, tăng theo entity/head mutable; không dùng timestamp |
| baseRevision | Revision kỳ vọng của đúng entity/head; tạo mới dùng 0 và điều kiện ID chưa tồn tại |
| serverGeneration | UUID do server cấp; đổi khi restore; bắt đối chiếu nếu khác |
| cursor/snapshotId | Opaque, server cấp, có expiry; không tự giải mã lấy quyền |
| createdAtClient/createdAtServer | UTC ISO 8601 có Z; client time chỉ để truy vết |
| ownerId/projectId | Server lấy owner từ session; kiểm tra project/ref; payload ownerId nếu có phải khớp |

Metadata là JSON UTF-8, không BOM; không có undefined/NaN/Infinity. Unknown field bị từ chối trừ map mở được định nghĩa. Canonical payload hash dùng JSON canonicalization RFC 8785; chỉ hash mutation business envelope đã khai báo gồm schemaVersion/kind/entity/project/baseRevision/dependencies/payload/artifact descriptors, không gồm cookie/token, batch transport, timestamp retry hoặc server-assigned field. Tên thuật toán canonical phải ghi trong contractVersion; hai bên dùng cùng fixture trước triển khai. Canonicalization không được chấp nhận number mất chính xác.

## C03. Bảng dữ liệu, kiểu cột và lineage

T: định dạng nội bộ `table-jsonl-v1`, UTF-8, LF; manifest JSON riêng chứa formatVersion, schema, rowCount, columnOrder, chunk descriptors (artifactId/size/hash/rowStart/rowCount). Mỗi dòng JSONL gồm rowId và cells theo columnOrder; số cell phải đúng. Source byte giữ riêng, không chuẩn hóa line ending của tệp gốc. Mọi version tham chiếu manifest hoàn chỉnh; chunk không chia nửa bản ghi.

| Kiểu logic | Biểu diễn và điều kiện |
| --- | --- |
| null | JSON null; missing tách khỏi chuỗi rỗng hoặc token chưa được xác nhận |
| number | IEEE-754 hữu hạn; số nguyên vượt miền safe integer không tự parse thành number |
| string / boolean | JSON string / boolean; giữ Unicode; không render string như HTML |
| date | Chuỗi ngày `YYYY-MM-DD` sau xác nhận cách đọc |
| datetime | Chuỗi UTC ISO 8601; lưu timezone/parse policy nguồn |
| bigint / decimal | Chuỗi chuẩn và kiểu logic tương ứng; không đưa vào thuật toán số nếu chưa có chuyển kiểu được người dùng duyệt |
| json | Giá trị JSON dạng chuỗi cho trường mảng/object được giữ; engine coi như dữ liệu, không eval |

Invalid date/overflow/NaN/infinite trong tính toán tạo lỗi hoặc báo cáo lỗi có row/column ID; không biến thành null ngầm. Giá trị không xác định của metric dùng C12.

Column gồm columnId/name/logicalType/nullable/sourceColumns. Đổi tên giữ columnId; tách/gộp/one-hot/TF-IDF tạo ID mới và lineage. Imported V0 tạo rowId mới; filter/sort/scaling giữ rowId; concat/join tạo rowId mới và row lineage artifact. Join lưu danh sách nguồn theo vai trò left/right; left unmatched có nguồn right rỗng. Không dùng vị trí dòng đang hiển thị làm ID. Mỗi chunk có hash byte; manifest hash canonical metadata; không hash lại source theo bảng V0.

TF-IDF/one-hot có thể dùng `csr-v1`: manifest shape, dtype, rowIds, column feature mapping và các artifact indptr/indices/data; chỉ số little-endian uint32, data float64 little-endian. Kiểm tra shape/index bounds/nnz/hữu hạn, không densify nếu vượt limit. Adapter thuật toán không hỗ trợ sparse phải chặn hoặc yêu cầu biến đổi được duyệt, không tự chuyển.

## C04. Registry và cấu hình thao tác

Mỗi OperationDefinition có id/configVersion/label/group/inputKinds/outputKind/configSchema/defaults/preconditions/resourceEstimator/previewHandler/executor/cancelMode/offlineCapable/learnsParameters/createsVersion. Hỗ trợ cả validator tĩnh và validator trên dữ liệu. Chưa có executor được xác minh thì capability `unavailable`, không dùng kết quả mẫu.

Mọi config có `columnIds`, chính sách missing/error phù hợp, output names nếu tạo cột; enum không có lựa chọn ngầm làm mất dữ liệu. Defaults chỉ điền form, phải xuất hiện trong preview và snapshot người dùng xác nhận. Không có dấu '*' nhận mọi tham số. Tham số engine bổ sung phải cập nhật configVersion và fixtures; backend/AI không tự tạo schema khác.

| Operation/nhóm | Trường bắt buộc theo phương pháp; kiểm tra |
| --- | --- |
| CLEAN.HTML/TRIM/NEWLINE/CASE/CHARS/NULLS | columnIds, các tùy chọn cụ thể; NULLS có tokens/caseSensitive; CHARS có quy tắc được phép, không JS tùy ý |
| CLEAN.TYPE/UNIT | targetType/parsePolicy hoặc sourceUnit/targetUnit/conversionRule; errorPolicy mặc định chặn; liệt kê lỗi |
| CLEAN.DROP_COL/RENAME_COL/SPLIT_COL/MERGE_COL | ID nguồn, tên đích không va chạm, delimiter/literal rule, missing policy; xóa hết cột bị chặn |
| CLEAN.FILTER/DROP_ROWS/DEDUP | Predicate AST allowlist, any/all; DEDUP keyColumnIds, keep first/last/none, nullEquality; thống kê dòng giữ/bỏ |
| QUALITY.OUTLIER/CLEAN.OUTLIER_APPLY | method IQR/Z-score, threshold, action report/flag/drop/clip, cột, missing policy; flag cần tên mới |
| PREP.MISS_DROP/CONST/MEAN/MEDIAN/MODE | columnIds, any/all cho drop; constant đúng kiểu; modeTiePolicy do người dùng chọn nếu hòa; không số hợp lệ thì chặn |
| PREP.MISS_GROUP | groupColumnIds, fillMethod, minValidCount, insufficientPolicy keepMissing/error/constant; constant chỉ dùng khi cấu hình rõ |
| PREP.FFILL/BFILL | orderColumnId, direction, groupColumnIds, maxGap, duplicateOrderPolicy; không truyền qua nhóm; bfill cảnh báo tương lai |
| PREP.INTERPOLATE | valueColumnIds, orderColumnId, groupColumnIds, maxGap, duplicateOrderPolicy, boundaryPolicy keepMissing/error; không extrapolate |
| PREP.MISS_FLAG | sourceColumnIds, outputNames, flagValues; tạo trước bước điền nếu cần dấu thiếu ban đầu |
| PREP.LABEL/ORDINAL/ONEHOT | sourceColumnIds, mapping hoặc orderedCategories cho ordinal, missingPolicy/unknownPolicy; label không tự coi số mã là thứ tự |
| PREP.MINMAX/STANDARD/ROBUST | numericColumnIds; range; ddof=0 cho standard; quantileRange cho robust; zeroSpreadPolicy error/constantZero được hiển thị |
| PREP.LOG/BIN | base hoặc log1p, invalidDomainPolicy error/keepMissing có xác nhận; BIN edges hoặc fitMethod, labels, closedSide, outOfRange/missingPolicy |
| PREP.TFIDF | textColumnId, tokenizerVersion/language, lowercase, stopwordSetVersion, ngramRange, minDf/maxDf/maxFeatures, emptyPolicy; estimate vocabulary/nnz |
| FEATURE.FORMULA/DATE/DROP_CONSTANT/SELECT | AST phép toán allowlist, timezone/dateParts, missingCountsAsValue; SELECT chỉ config roles, không xóa cột |
| DATA.CONCAT/JOIN | sourceVersionIds có thứ tự, column mappings/types, null/missing policy; JOIN left/right keys, inner/left, suffixes, duplicateKeyPolicy allowWithConfirmation/error |
| MODEL.* | feature IDs, target khi supervised, params có schema engineVersion, seed/split/preprocess theo C12; không dùng params tùy ý |

Predicate/formula là AST có chiều sâu/số node hữu hạn; phép cho phép: so sánh, and/or/not, isMissing; công thức +/−/×/÷ và hàm số được công bố. Không eval, regex tùy ý không giới hạn hoặc thực thi code. Bộ phương pháp đầy đủ vẫn theo cây nút, bảng này bổ sung hợp đồng không thay danh mục.

## C05. Preview, snapshot và task protocol

WorkingContext gồm accountId/projectId/datasetId/versionId/branchId, headRevision, contextRevision, writerFence, localGeneration. Nguồn nhiều dataset dùng sources[] có vai trò. localGeneration tăng khi logout/đổi account; writerFence đổi khi bàn giao. contextRevision tăng khi đổi nguồn, không tự hủy task cũ.

PreviewResult có previewId/sourceRefs/configHash/schemaVersion/scope(full|sample)/sampleMethod/sampleSeed/rowsExamined/estimatedEffects/warnings/errors/createdAt. Chỉ ghi số ảnh hưởng toàn bộ nếu scope full. Đổi config/source làm preview hết hiệu lực. Huấn luyện preview chỉ dữ liệu/điều kiện/cấu hình.

ExecutionSnapshot bất biến: taskId/runId/stepId, owner/project, sourceRefs, targetBranchId/expectedHead, config+configHash, operation/config/engine versions, seed/split nếu có, writerFence/localGeneration, contextRevisionAtStart, confirmationRefs. Mọi task event mang protocolVersion/taskId/runId/stepId/generation/fence/sequence/type; sequence tăng và bỏ event trùng/cũ.

Command: START(snapshot, inputArtifactRefs), CANCEL(taskId, reason), DISPOSE(taskId). Event: STARTED, PROGRESS(phase, completedUnits?, totalUnits?), WARNING(code), RESULT(stagedArtifactRefs, summary), FAILED(error), CANCELLED. RESULT chỉ nghĩa tính xong, không phải success. Không truyền toàn dataset qua event UI; dùng refs/transferable có quyền sở hữu buffer rõ. Không có totalUnits thì không dựng %.

Task state: ready → previewed → running → committing → succeeded; running có thể failed/cancelled/interrupted; committing chỉ kết thúc succeeded/failed, quyết định cancel phải tuần tự với local commit. Cancel trước commit thắng thì bỏ staging; commit đã thắng thì giữ output và báo hủy quá muộn. Refresh khôi phục task không terminal thành interrupted sau kiểm tra commit marker, không chạy lại.

Đổi màn hình/nguồn trong khi chạy: task có quyền vẫn commit kết quả vào nguồn/nhánh snapshot, không vào nguồn mới. Nếu expectedHead không còn đúng thì tạo nhánh từ source snapshot trong cùng dataset. Chỉ cập nhật current pointer tự động nếu pointer/context vẫn khớp lúc START; nếu đã đổi thì giữ lựa chọn người dùng và thông báo link kết quả. Mất writer/logout/generation không khớp: bỏ RESULT, không commit. Pipeline đang chạy giữ processing head riêng cho bước kế tiếp, không dùng nguồn người dùng vừa chọn ở UI.

## C06. Local commit, crash recovery và writer

T: IndexedDB giữ metadata và commit records; byte lớn có thể ở IndexedDB hoặc file store browser. Dùng adapter, không giả định transaction DB bao trùm file ngoài. Các bước:

1. Ghi staging dưới taskId/generation, hoàn tất byte, kiểm hash/size và manifest dependency.
2. Lấy writer gate, kiểm tra account/generation/fence/cancel/expected head; chuyển staging thành dữ liệu bền vững được tham chiếu. File ngoài transaction chỉ được coi sẵn sàng sau close/verify.
3. Một transaction metadata ghi version/artifact refs, step success, branch/head phù hợp, commit marker và outbox mutation. Không await network/file I/O trong transaction.
4. Chỉ phát LocalCommitResult(commitId, entityIds, artifactIds, outboxIds, status=localCommitted) sau transaction thành công. Chưa có ACK không báo synced.

Crash trước bước 3: staging/orphan, không có version success. Crash sau bước 3: phục hồi từ commit marker dù chưa kịp cập nhật UI. Cleanup chỉ dọn staging không có reference/lease sau grace period, không xóa ready/unsynced. Lỗi byte thiếu sau restore/browser eviction đánh dấu resourceMissing, không tự nhận commit hoàn chỉnh giả. Quota lỗi giữ bản trước, không tự cắt dữ liệu.

Một Web Lock độc quyền theo accountId/projectId giữ suốt writer ownership; BroadcastChannel chỉ thông báo, không là khóa. Một critical gate theo account kiểm tra generation với commit/logout. Tab mới xin chuyển quyền; tab cũ dừng nhận command, hủy/đợi tác vụ tới điểm an toàn, vô hiệu fence, release lock; tab mới lấy lock rồi tăng fence trong transaction. Tab chết lock được giải phóng, staging được recovery. Không cướp khóa bằng timeout khi tab cũ chưa ngừng ghi. Browser không hỗ trợ khóa tương đương đã kiểm chứng thì chỉ xem, không hứa một writer bằng localStorage lease đơn giản.

## C07. Phiên, tài khoản, đăng xuất và key

P: email/mật khẩu + OTP; tối đa 100 activated; reset thu hồi mọi phiên, không xóa outbox. T: email trim phần ngoài, domain lowercase/IDNA; bản đầu canonical toàn địa chỉ lowercase, không bỏ dấu chấm/+tag, giữ display email. Password 15–128 Unicode code points, không trim/normalize/cắt; server và client cùng validator. Đây là policy kỹ thuật đề xuất, không là chứng minh thư viện auth đã hỗ trợ.

OTP response: challengeId/purpose/generation/serverNow/expiresAt/resendAvailableAt/attemptsRemaining/sendStatus(accepted|failed|unknown). OTP luôn 6 chữ số/300s/60s/5 sai; resend tăng generation, vô hiệu mã cũ. Verify/reset grant một lần; pending registration TTL đề xuất 24h, reset grant 5 phút, session tuyệt đối 7 ngày; nghiệp vụ tự kiểm expiry, TTL chỉ cleanup. OTP resend tối đa 5 lần/email/purpose/giờ; IP/login tuning theo C20, không khóa cả lớp chung NAT mặc định.

Auth/session trả userId/sessionId/authEpoch/expiresAt/serverGeneration/offlineEntitlement metadata và revocationHandle chỉ lúc cấp. Cookie HttpOnly/Secure/SameSite=Lax; token hash ở server. Mutation transaction có conditional write vào user/session fence mà login/logout/reset cũng ghi, bảo đảm thứ tự commit/thu hồi. Key AI riêng RAM gắn session/epoch, idle TTL 30 phút và không quá session expiry; handle không thay phiên. Không đưa password/OTP/key/token vào offline entitlement.

Offline entitlement chỉ cho owner đã đăng nhập trên profile đó mở kho local; expiry online không tự xóa quyền làm việc local. Đây không là bảo vệ chống chủ máy đọc browser storage hoặc cam kết mã hóa dữ liệu tại rest. Khi phiên thu hồi, local chuyển needsReauth, dừng sync, giữ dữ liệu. Không cho đăng nhập owner khác vào vùng làm việc khi owner cũ còn outbox: yêu cầu reauth đúng owner để xử lý hoặc đi qua logout online có xác nhận bỏ dữ liệu; offline còn outbox thì chặn đổi tài khoản như chặn logout. Không tự chuyển outbox sang owner mới.

Logout: đóng account gate, dừng writer/worker mọi tab trước khi chụp dirty set; làm đúng bảng OFF §9. Sync-first lỗi thì giữ local/phiên làm việc; discard online cần xác nhận phạm vi. Sau thu hồi, xóa toàn bộ local riêng tài khoản, kể cả draft, model, scene RAM, cache riêng; giữ cache app công khai. Khi logout offline sạch chỉ giữ sessionId+revocationHandle tối thiểu trong hàng đợi riêng; deferred revoke idempotent chỉ tác động phiên cũ, không phiên mới. Nhận 401 không Clear-Site-Data.

## C08. Import và kết hợp khi mạng gián đoạn

P: import/concat/join mới chỉ khởi chạy online, tính browser; mỗi lần import tệp tạo dataset mới; concat/join tạo dataset dẫn xuất mới/V0, inner/left. Không thay nguồn hoặc nối thêm tệp vào dataset cũ. Byte nguồn tối đa 20.000.000.

T: POST import-intents body gồm logicalImportId, datasetId, versionId(V0), mutationId, kind(import|concat|join), projectId, sourceRefs hoặc file{name,size,format}, configHash. Response intentId/logicalImportId/expiresAt/serverNow/sourceRevisions; TTL đề xuất 30 phút. Intent ràng buộc session/owner/project/nguồn và các ID logic. Cấp intent không công bố dataset. Preview cục bộ không cấp quyền khởi chạy sau này; khi bấm Áp dụng phải có S, intent hợp lệ và confirmation configHash.

| Mất kết nối ở mốc | Hành vi |
| --- | --- |
| Chưa START được server intent/phiên chấp nhận | Không khởi chạy/không tạo dataset; giữ form/preview nếu được |
| Đã START hợp lệ, worker đang xử lý | Được hoàn tất local theo C06 nếu quyền local vẫn còn; hiện “Đã lưu trên máy — nhập chưa được máy chủ xác nhận” |
| Local đã commit, upload/ACK chưa xong | Giữ intent/ID/outbox; chờ người dùng sync sau kết nối lại |
| Server đã commit nhưng mất ACK | Query receipt; không tạo dataset/intent logic mới |
| Refresh trước local commit | interrupted, bỏ phần dở; chạy lại phải chủ động, online và xin intent hợp lệ |

Không gọi local success là import server hoàn tất. Tạo mới khi đang offline luôn bị chặn; hoàn tất local của tác vụ đã START online không phải cho nhập offline mới. Intent hết hạn/phiên đổi: khi online reauth, trước hết query receipt; nếu chưa commit thì renew qua cùng POST với logicalImportId/mutationId/entity IDs cũ và kiểm tra lại nguồn. Nguồn đã xóa thì RESOURCE_DELETED; config đổi tạo attempt mới có ID mới được liên kết, không sửa payload của mutation cũ. Import intent snapshot được gắn mutation, không chỉ gửi file rời.

Concat giữ thứ tự nguồn và dòng nguồn, mapping cột rõ; join không match null theo mặc định hiển thị, không trim/coerce khóa ngầm. Inner loại unmatched theo cấu hình đã duyệt, left giữ mọi dòng trái; thứ tự output ổn định theo nguồn trái rồi thứ tự nguồn phải. Duplicate keys cần estimate và xác nhận allowWithConfirmation; không tự dedup. Chính sách null/duplicate khác phải được chọn rõ và ghi snapshot.

## C09. Kết nối và cổng đồng bộ

State riêng: network(online|offline|unknown), server(reachable|unreachable|maintenance), auth(valid|expired|revoked|unknown), syncGate(auto|awaitingUser), sync(idle|running|partial|failed|synced|conflict). navigator.onLine chỉ là tín hiệu.

| Sự kiện | Cổng/hành vi |
| --- | --- |
| Phiên làm việc mới online, outbox rỗng, không cờ chờ cũ | auto; local commit mới tự sync |
| Offline, request transport failure, gateway 502/504 hoặc core API unavailable/maintenance | Ghi bền awaitingUser ở account/profile; broadcast mọi tab, kể cả chưa có outbox; lỗi 503 riêng mail/AI không tự đóng cổng sync khi core API vẫn khỏe |
| Server trở lại/cold start xong | Giữ awaitingUser; hiện Đồng bộ ngay khi có pending |
| 401/thu hồi | Dừng gửi, needsReauth; không xóa outbox; reauth không tự mở cổng chờ trước đó |
| Người dùng bấm Đồng bộ ngay khi S | Chụp snapshot pending, sync; không cho tab khác chụp cùng mục đồng thời |
| Toàn bộ snapshot được ACK, gồm conflict đã được giữ thành công | Chuyển auto, mục mới phát sinh sau snapshot thuộc lượt sau |
| Partial ACK/lỗi | Giữ awaitingUser và các mục chưa ACK; không tự gửi lại phần còn lại sau lỗi |
| Không có pending | Giữ cờ chờ qua refresh; không dùng việc rỗng để tự mở cổng |

Một sync coordinator theo account/profile dùng lock riêng, không phụ thuộc project writer. Bấm lại sau lỗi tạo/reuse transport batch nhưng giữ mutationId; không tự retry AI. Có thể backoff hữu hạn các chunk trong một lượt người dùng đang cho chạy; kết thúc lượt lỗi phải chờ retry chủ động. Lỗi 422/413 không tự retry. Validation/auth/provider AI lỗi không mặc định là mất mạng toàn ứng dụng.

## C10. Artifact và sync mutation

ArtifactDescriptor: artifactId/purpose/formatVersion/mediaType/sizeBytes/sha256/projectId/dependencyArtifactIds. Purpose enum source/tableManifest/tableChunk/rowLineage/sparse/model/metrics/chartImage/pdf. Tải qua backend quyền owner; signed URL chưa thuộc bản đầu.

Upload declaration trả uploadId/chunkSizeBytes/expiresAt/receivedChunks. Chunk byte thuần có index, offset, length, sha256; server xác minh chunk và toàn file, retry cùng index khác hash bị từ chối. Complete chỉ chuyển verified staging, chưa ready public. Metadata transaction gắn ref mới chuyển ready. Cancel upload không xóa artifact ready còn dùng. Chunk/byte ngoài policy bị 413; storage đầy 503, giữ outbox.

Mutation envelope bắt buộc: mutationId/kind/projectId/entityId/schemaVersion/baseRevision/dependencies/payload/payloadHash; versions thêm target branch/expected head, operation snapshot và artifact refs. Enum kind gồm project.create/rename, dataset.create/rename, dataset.version.create, dataset.head.select, workflow.save, run.create/update, run.step.commit, chart.save/delete, dashboard.save, model.save, report.save, reopenState.save, ai.acceptance.record. Delete project/dataset đi deletion plan nhưng cùng commit service; không có arbitrary collection upsert. Với save entity mới dùng baseRevision=0; patch lưu snapshot mới có revision, lịch sử run input cũ bất biến.

POST batches khai báo batchId/serverGeneration/schemaVersion/mutations/artifacts/atomicGroups; response kế hoạch needsUpload/alreadyPresent/rejected, không ACK commit sớm. POST commit chỉ nhận mutation IDs đã khai báo, không thay payload. Một atomic group nhỏ gồm version + artifact refs + step thành công + head + receipt; không ACK nửa nhóm. Run lớn chia group theo step; phụ thuộc chưa commit thì pending, không rollback group trước. Backend validate shape/nguồn/size/hash/acyclic lineage, không tuyên bố server tính lại metric.

Receipt unique(ownerId, mutationId), lưu canonicalHash, kết quả entity/artifact/revision, conflict refs, serverGeneration. Cùng ID khác hash → IDEMPOTENCY_MISMATCH; cùng hash trả kết quả tương đương. Receipt/metadata/fence commit cùng transaction hỗ trợ. Không giữ transaction lúc upload, gọi mail/AI hoặc tính toán. Outbox giữ mutation tới ACK đúng ID/hash/generation; batch status partial không đánh dấu cả batch synced.

ACK: batchId/status(committed|partial|rejected), acknowledged[{mutationId,payloadHash,entityIds,artifactIds,revisions,outcome(committed|conflictPreserved),conflictRefs}], pending[{mutationId,code,retryable}], rejected[{mutationId,code}], cursor/serverGeneration/requestId. Các tập không giao nhau; mọi mutation phải có một kết quả. ACK snapshot cũ không xác nhận mutation mới.

## C11. Revision conflict, tombstone và resync

T đã chốt A (ADR-B021-01, 2026-11-02): baseRevision của version create thuộc entity version mới (=0); guard branch head nằm riêng trong payload expectedHead. Config dùng revision của entity; project manifest revision là snapshot, không gây conflict tất cả entity không liên quan. Trong transaction kiểm tra tombstone project/dataset và session fence trước commit.

expectedHead có hai dạng: known {kind:"known",branchId,versionId,revision} với revision server; hoặc dependency {kind:"dependency",branchId,fromMutationId}, trong đó fromMutationId phải thuộc dependencies. Server resolve receipt/commit identity đúng owner/project trong transaction, không sửa payload/hash/mutationId client. Dependency chưa commit thì pending; thiếu receipt cần reconciliation, không đoán revision. known versionId=null/revision=0 chỉ dùng branch mới/head rỗng hợp lệ, không ghi đè branch có head. Counter head local tách expectedLocalHeadVersionId/expectedLocalHeadRevision trong S08; không dùng làm server revision. Branch ID phải khớp version/guard và kết quả dependency thực; conflict branch vẫn theo quy tắc dưới.

- Branch head thay đổi: giữ server head, tạo nhánh local có conflictOf/source snapshot; ID nhánh xung đột server lưu trong receipt, retry trả đúng nhánh cũ.
- Workflow/chart/dashboard thay đổi: giữ server entity; tạo conflict copy ID ổn định ánh xạ mutationId, không tự đổi dashboard ref. Người dùng mở/chọn bản sao hoặc cập nhật bản gốc bằng mutation mới với revision hiện tại; sửa mapping/ref phải validate. Không có auto-merge.
- Current pointer: local theo thiết bị được giữ khi chưa sync; báo khác biệt server. Chọn từ UI là command riêng, không do xem lịch sử.
- Server đã xóa: không tạo branch/copy hoặc ID mới. Mutation chuyển blockedDeleted, bỏ khỏi lịch gửi tự động nhưng không xóa byte local. Cho xem/xuất CSV/JSON hoặc đầu ra sẵn có của chính owner theo quyền local; gỡ bản local cần xác nhận mất dữ liệu. Không có khôi phục/import dự án ngầm. Muốn phục hồi thành tính năng mới là Q.

T: receipt replay giữ tối thiểu 90 ngày; snapshot manifest 30 phút; cursor change log 90 ngày. Các giá trị cấu hình được; expired response 410 + requiresReconciliation. Tombstone và tài nguyên ID/generation đã xóa không tự TTL trong bản đầu. Receipt hết hạn không nhận lại mutation như mới: đối chiếu entity ID/hash/lineage và durable commit identity; nếu không chứng minh được, trả RECONCILIATION_REQUIRED, giữ local. Không tạo version mới để né hết receipt.

Reconciliation: dừng push → reauth → lấy serverGeneration và manifest mới → so entity/artifact IDs/hash/tombstone với local/outbox → nhận ACK đã có bằng chứng, blockedDeleted cho tài nguyên xóa, branch conflict cho khác revision → người dùng xem kế hoạch rồi sync theo cổng. Không tự gửi lại nội dung khác cùng ID, không xóa outbox để ép upgrade. Generation khác sau restore cần quy trình C19 trước cho ghi.

## C12. Split, fit, model và metric

P: train/test chỉ bắt buộc với supervised; PCA/K-Means không có target/split supervised bắt buộc. Fit train rồi transform test; fit trung gian không tự thành dataset version. Nguồn đã fit toàn bộ phải cảnh báo và cho dựng lại từ nguồn phù hợp.

T: supervised split config gồm testRatio (0,1), seed, strategy random|stratified, targetColumnId; default form testRatio=0.2/seed=42, user thấy trước chạy. Lưu split artifact rowId→train/test và engine version, không chỉ seed. Stratified đề xuất cho classification; không đủ mẫu mỗi lớp thì chặn/cho sửa split, không tự chuyển cách chia. Dataset có thứ tự thời gian cần cảnh báo random leakage; time split là mở rộng, không giả đã hỗ trợ.

FittedPipeline có orderedSteps(operationId/configVersion, fitScope=train|full, learnedArtifactRefs), featureOrder, targetMapping, unknown/missingPolicy, sourceRefs, engine/serializer versions. Encoding/vocabulary/scaler/PCA trong supervised pipeline fit train. K-Means/PCA toàn dữ liệu lưu fitScope=full và nguồn. PCA artifact có rowId/component coordinates/eigenvalues/explainedVarianceRatio/cumulative; áp vào bảng là operation áp dụng riêng có config/preview/confirmation, ID đề xuất FEATURE.PCA_APPLY.

MetricRecord: name/value(number|null)/status(defined|undefined|notApplicable|notComputed)/reason/evaluationSet/params/sampleInfo. Không dùng 0 thay undefined. Classification luôn lưu class order và confusion matrix; precision/recall/F1 trình bày per-class, macro và weighted khi hợp lệ; lớp có mẫu số 0 ghi undefined và quy tắc aggregate kèm số lớp bị loại, không che bằng 0. Binary positiveClass do người dùng xác nhận. Accuracy test rỗng bị chặn. Regression R² undefined khi target test hằng hoặc không đủ mẫu; MAE/MSE/RMSE cần mẫu hữu hạn. Silhouette cần 2 ≤ số cụm không rỗng ≤ n−1; toàn bộ khoảng cách vượt limit thì đề xuất sample cụ thể và cần chấp thuận trước, không tự giảm mẫu.

Model artifact gồm model bytes, serializerVersion, engineVersion, fittedPipeline, feature/target mapping, split refs, metric refs; phải thử export và tái nạp trong kiểm thử kỹ thuật, không biến thành tính năng prediction/import model cho người dùng. Đa lớp và sparse support khai báo capability theo engine được đo; chưa kiểm chứng thì không hiện đã hỗ trợ. Tham số hợp lệ cần schema cụ thể từ adapter, không hứa mọi hyperparameter của mọi thư viện.

## C13. Manifest offline và release compatibility

ProjectManifest gồm manifestVersion/snapshotId/projectId/projectRevision/serverGeneration/createdAt/expiresAt/nextPageCursor, entities[{id,type,revision,sourceRefs,artifactIds}], artifacts[{id,format,sizeBytes,sha256,dependencies}], requiredCapabilities, compatibleAppBuilds. Mọi trang thuộc một snapshot; snapshot hết hạn tạo mới, giữ các byte đã xác minh để reuse theo ID/hash. Không trộn trang revision mới. File gốc/current version dùng mở thông thường; prepare toàn dự án gồm mọi version hoàn chỉnh, workflow/run/step, chart/dashboard/model/metric/report đã lưu tại snapshot. Dataset dẫn xuất không có tệp gốc giả.

AppManifest tách riêng: buildId/contractVersions/localSchemaVersion/staticEntries(url,size,sha256,kind)/capabilities/compatibilityWindow. App shell, font Việt, workers, engine, renderer, shaders và bộ xuất đều có trong danh mục cần thiết; URL tải không là artifact ID. Không để project manifest tự khai báo URL tùy ý để SW fetch.

LocalOfflineStatus lưu snapshotId/buildId, expected/present/missing IDs, verifiedAt, status(notPrepared|downloading|ready|incomplete), scope(currentContext|fullProject). ready khi tất cả dependency và capability thật có trên máy. Project mới thay đổi thì đánh giá lại, không giữ nhãn full-ready của snapshot cũ. Cleanup tài nguyên dùng chung phải xét reference mọi dự án. Gỡ offline chỉ khi phạm vi không còn unsynced/task ghi, có xác nhận; không xóa server.

SW chỉ cache tài nguyên công khai theo app manifest, navigation fallback shell đã chuẩn bị; API riêng tư không cache chung. Việc lưu có chủ đích vào kho tài khoản qua C06 không bị cấm bởi HTTP no-store. Deploy upload static mới trước shell/SW; giữ build cũ trong cửa sổ hỗ trợ. T: ban đầu hỗ trợ current + previous build tối thiểu 30 ngày, phải kiểm chứng storage trước deploy; hết cửa sổ client cũ chỉ được mở/xuất dữ liệu có thể đọc, upgrade/migration giữ outbox trước khi push lại. Không ép reload giữa task/commit/sync. Migration có journal, backup cục bộ hoặc bước chuyển có thể phục hồi, không xóa database khi lỗi.

## C14. Chart, dashboard, report và tùy chọn khung nhìn

ChartConfig gồm chartId/configVersion/revision/sourceRef(version|resultArtifact)/columnIds, type, axes, aggregation, missingPolicy, sampleInfo, rendererVersion. Các loại và điều kiện theo cây nút §4.11. SampleInfo gồm populationSize/renderCount/method/seed/excludedCount/reason; chỉ ảnh hưởng render. Cột ID không tự là số đo. PCA scatter sourceRef phải chỉ model/run artifact và component IDs/phương sai. Đổi source tạo config revision mới qua validator; lỗi giữ bản cũ.

Dashboard gồm id/revision/name/layoutColumns(1|2|3)/orderedItems[{itemId,chartId}]; responsive giảm số cột nhìn không ghi đè layout desktop. Gỡ item không xóa chart. T: chặn CHART.DELETE nếu chart còn trong dashboard hoặc report đã lưu tham chiếu trực tiếp; hiện danh sách để gỡ/đổi tham chiếu chủ động trước. Xóa dataset cũng xét chart/model/workflow/report và dataset dẫn xuất phụ thuộc. Không áp cascade ngầm. Report đã đóng gói ảnh/PDF độc lập có source provenance lịch sử; không tự coi provenance là nội dung source còn tồn tại. Phân biệt hard reference cần nguồn để dựng lại và historical reference chỉ mô tả nguồn đã dùng; historical-only không ngăn xóa nếu artifact của report còn đủ, phải thể hiện trong deletion plan.

ReportSnapshot gồm selectedSections, sourceRefs, run/model/chart revisions, metric records, userConclusion hoặc approvedAiConclusion, generatedAt, locale=vi, fontVersion, optional pdfArtifactId. Download không bắt lưu report; lưu report cần W và sync mutation. Đề xuất định dạng ban đầu chart PNG, 3D PNG có nguồn/camera/sample chú thích, model gói JSON+binary theo serializer; chỉ bật sau kiểm chứng. CSV export có encoding/delimiter/header/missing policy, JSON export khai báo cách biểu diễn date/bigint/decimal; không ngầm mất độ chính xác. PDF worker dùng font local; thiếu tài nguyên báo lỗi, không gọi dịch vụ ngoài thay thế ngầm.

Camera thay đổi chỉ trong RAM. T: nút “Lưu góc nhìn trên máy” lưu local theo account/profile/project/view; tab chỉ xem được lưu tùy chọn cá nhân này, không outbox/version. Screen/filter/current context khôi phục theo C05, camera chỉ phục hồi từ lần lưu rõ ràng; không sync camera hoặc tạo chart config khi xoay. Lưu camera vào chart phải là CHART.SAVE rõ ràng có W.

## C15. View model và sự kiện 3D

StageViewModel: stageId/label/operationIds/mode(explore|run)/contextRef/runId?/state/reasonCodes/stepSummaries. stageId enum: ingest, quality, cleaning, missing, features, exploration, algorithm, training, export. Operation registry cấp stage mapping; không suy ra thành công từ animation. Nhiều bước cùng stage hiển thị completed/failed/cancelled counts từ run đang chọn.

VersionGraph: nodes[{versionId,datasetId,branchId,label,parentVersionId?,sourceVersions,operationId,runId,rowCount,columnCount,localAvailability,syncStatus}], edges[{edgeId,sourceVersionId,targetVersionId,relation,role,sourceOrder}], pagination/visibleScope. `relation` là enum parent|source; role/order cho left/right/concat. Không tạo node từ preview/task lỗi; không dùng version label làm ID. Graph metadata không chứa cells/secret.

Scene events: SELECT_STAGE(stageId), INSPECT_VERSION(versionId), OPEN_VERSION_DATA(versionId), CONTINUE_FROM_VERSION(versionId), PICK_ROW(sourceRef,rowId), SAVE_CAMERA(viewId,camera), CHANGE_VIEW_MODE(2d|3d). Adapter UI chuyển command tới điều phối; scene không tự gọi API hay đổi head. CONTINUE đổi ngữ cảnh có cảnh báo draft; chỉ áp biến đổi mới tạo nhánh. PICK_ROW kiểm row lineage và nguồn trước hiện chi tiết. Task kết quả cũ không tự focus scene.

GPU error/context lost: hủy render loop/dispose resources, chuyển DOM 2D với selection/context/task còn nguyên. Tab chỉ xem vẫn dùng scene và đọc; không chạy command có output bền. Nhãn text escape, bàn phím qua DOM, theme/motion theo FE. Số nút hiển thị, sample scatter và render quality công bố; giới hạn vẽ không là giới hạn lịch sử.

## C16. AI context, consent và audit

AiContext gồm task(suggestCleaning|suggestPreprocess|suggestChart|suggestAlgorithm|explainQuality|explainResult|imputeText), sourceRefs, contextVersion, schemaSummary, aggregateStats, optional rowPayload, constraints, providerId/modelId/keyContextHandle. Backend chỉ dựng request từ context đã duyệt + template ứng dụng cố định, không tự lấy thêm row từ artifact. Key/handle không nằm trong business context hash.

T: consent hai giai đoạn để tránh payload đổi sau duyệt. POST `/ai/consents` dùng S/CSRF, body task/sourceRefs/provider/model/context; server validate, trả consentId/contextHash/payloadPreview/expiresAt/serverNow. Không gọi provider ở bước này; nội dung có row giữ RAM TTL 10 phút, không DB/log. UI hiển thị đúng payloadPreview là dữ liệu sẽ gửi (cùng provider/model và mô tả template cố định); người dùng bấm Đồng ý → POST `/ai/consents/:id/confirm` với hash; trả approval token gắn owner/session/epoch/hash/provider/model, dùng một requestId. POST `/ai/requests` mang consentId/approvalToken/requestId; server so lại hash, không nhận thêm row từ request. Không có row vẫn validate context, không buộc popup consent từng thống kê. RAM mất/expiry/config/source đổi thì yêu cầu dựng và duyệt lại, không fallback ngầm.

Nếu retry requestId đã dispatch, trả trạng thái hiện tại/receipt, không gọi provider hai lần; approve token đã dùng chỉ truy vấn/retry đúng requestId, không cho tạo request khác. Revoked session chặn dispatch/kết quả; provider có thể đã nhận dữ liệu. Timeout sau dispatch không rõ → unknown; poll trạng thái, không auto retry có phí.

AiProposal: proposalId/requestId/task/contextHash/sourceRefs/provider/model/operationId/configVersion/columnIds/suggestedParams/reason/conditions/estimatedImpact/textCandidates?/status. Text candidate có rowId/columnId/value|null/reason/confidenceLabel; confidence không chứng minh sự thật. Validator chặn operation/cột ngoài allowlist. Accept chỉ điền form; apply text người dùng duyệt từng phạm vi và lưu provenance trong operation/version. AI không gọi command/xóa/huấn luyện.

Audit bền chỉ request/task/source/hash/provider/model/times/status/structuredProposal/acceptedFields/runRef; không row payload/prompt nguyên văn/key. T: đề xuất chưa nhận giữ RAM tối đa 24h hoặc tới expiry/logout, audit metadata 90 ngày; phần đã chấp nhận lưu cùng version/history và không tự xóa khi audit TTL hết. Người dùng có thể bỏ đề xuất; không biến audit thành chat. Provider retention ngoài hệ thống là V phải công bố trước bật adapter, không hứa xóa dữ liệu đã gửi provider bằng logout.

## C17. Deletion plan, phụ thuộc và tính bất biến

P: chỉ S + W, vĩnh viễn, không thùng rác; chặn dependency ngoài phạm vi. T: dependency graph gồm references cần nguồn còn tồn tại: dataset derivation, chart dựng lại, workflow source cố định, model phụ thuộc artifacts, report chưa đóng gói. Provenance lịch sử không tự xóa nguồn nhưng khi nguồn bị xóa phải hiện “Nguồn đã xóa”; artifact dùng chung còn ref không được dọn. Quy tắc hard/historical theo loại relation, không tùy tiện đổi để vượt validation.

POST deletion-plan body scope(project|dataset), resourceIds, expectedRevisions; response planId/planToken/expiresAt(5 phút)/scopeRevision/hardDependencies/historicalImpacts/artifactRefs/estimatedBytes/blockedReasons. Plan gắn owner/project, không mang quyền bỏ qua session. Dataset bị chặn thì không cấp executable token; project plan gồm toàn tài nguyên con nhưng không nguồn/dataset ngoài project.

Sau xác nhận và xử lý local dirty/tasks, POST deletions(planToken, mutationId, confirmationHash). Transaction kiểm lại phiên/revisions/dependencies; mọi create-reference tham gia project dependency fence để tránh race. Ghi tombstone + deletion job + receipt trước dọn file. Response 202 deletionId/state=markedDeleted; GET state markedDeleted|cleaning|completed|failed, retryable/remaining counts. API đọc/ghi mới trả 410 sau mark; completed chỉ khi dọn vật lý phạm vi đã xong. Cleanup có lease và fence, tôn trọng references còn sống. Tombstone không chứa byte có thể phục hồi. Local offline cũ xử lý C11; revoke không xóa server data.

## C18. API envelope, endpoint bổ sung và lỗi

REST `/api/v1`, same origin. Success `{data, requestId, serverNow}`; error `{error:{code,message,details,retryable},requestId,serverNow}`. Details chỉ field paths/IDs của owner; không stack/secret/row content. UTC server time cho expiry. Pagination pageSize mặc định 20/max100; cursor opaque. HTTP 202 chỉ đang xử lý, không success commit. BE §10 là danh mục endpoint; bảng này bổ sung request/response chuẩn, không sinh API chạy năm thuật toán server.

| Endpoint bổ sung | Input → output |
| --- | --- |
| GET `/capabilities` | Công khai: supportedContractVersions/authPolicy/publicAppBuild; authenticated mới có account-specific storage/AI availability, không secret |
| GET `/operations` | Registry version/schema/defaults/capabilities; không trả mã thực thi hoặc secret |
| POST `/ai/consents`, POST `/ai/consents/:id/confirm` | C16; S + CSRF, không gọi provider |
| POST `/sync/reconciliations` | serverGeneration/known entities/hash/pending summaries → reconciliationId/pages/actions; không đẩy byte hay ghi entity trong bước đối chiếu |
| GET `/sync/reconciliations/:id` | Snapshot kế hoạch cùng owner; expiry và requiresNewSnapshot |
| GET `/projects/:id/dependencies` | scope/entity IDs → hard/historical refs phân trang cùng owner |

Mutation kind có JSON Schema riêng, additionalProperties=false; endpoint ghi CRUD không được né sync/deletion service. `expectedRevisions` và baseRevision ở request body là chuẩn v2, không dùng If-Match đồng thời khác giá trị. Không bật generic PATCH tùy collection. Tên/email không đưa vào path/query có thể log; password/OTP/key/consent tokens chỉ body được redact. Auth public vẫn kiểm CSRF/Origin và rate limit phù hợp; cần bootstrap CSRF không yêu cầu S.

| HTTP/code | Quyết định client |
| --- | --- |
| 400/422 VALIDATION_FAILED, INVALID_SOURCE, UNSUPPORTED_OPERATION | Sửa trường; không tự bỏ dòng/đổi thuật toán |
| 401 AUTH_REQUIRED/SESSION_EXPIRED/SESSION_REVOKED | Giữ local, reauth đúng owner, dừng gửi |
| 403 CSRF_INVALID; 404 RESOURCE_NOT_FOUND | Không lộ owner khác; không coi là offline |
| 409 REVISION_CONFLICT/DEPENDENCY_EXISTS/IDEMPOTENCY_MISMATCH | Người dùng giải quyết; conflictPreserved đã ACK không gửi lại như lỗi |
| 410 RESOURCE_DELETED/CURSOR_EXPIRED/RECONCILIATION_REQUIRED | C11, không tái tạo |
| 413 INPUT_FILE_TOO_LARGE/ARTIFACT_LIMIT_EXCEEDED/PAYLOAD_TOO_LARGE | Nêu đúng loại limit và giá trị |
| 422 ARTIFACT_NOT_READY/HASH_MISMATCH/OTP_INVALID/OTP_EXPIRED | Không commit; trạng thái cụ thể |
| 429 RATE_LIMITED/AI_QUOTA_EXCEEDED | Retry-After nếu biết; không retry AI unknown |
| 503 STORAGE_UNAVAILABLE/STORAGE_CAPACITY_EXCEEDED/MAIL_UNAVAILABLE/AI_UNAVAILABLE | Giữ outbox; phân biệt module unavailable với server transport failure |
| 409 CLIENT_SCHEMA_UNSUPPORTED | Upgrade có bảo toàn local/outbox |

Nginx tạo 413/502/503/504 phải theo envelope/no-store, không HTML; `requestId` được chuẩn hóa một lần và truyền suốt. Không áp error_page SPA cho API. Số attempt/retry timeout không thay OTP limits.

## C19. Backup, restore và deletion ledger

P: backup thủ công trước demo/thay đổi lớn, gồm DB và byte artifact; không thêm automation. T: backup manifest ghi backupId/serverGeneration/app/schema versions/DB snapshot marker/artifact hashes/ledger offset. Bật maintenance, chặn commit mới và đợi active transaction hữu hạn; snapshot DB + copy referenced artifacts và verify trước báo xong. Không có local unsynced trong backup server. Key riêng RAM và OTP plaintext không vào backup.

Deletion ledger bền nằm ngoài vòng rollback của snapshot dữ liệu: append entries(resource/owner/project/generation/revision/deletedAt/jobId), durable trước công nhận deletion. Dùng storage riêng tư bền vững với write-ahead intent/reconciliation; không đòi transaction DB bao trùm storage. Nếu ledger append thành công nhưng DB chưa mark thì recovery hoàn tất intent; khi chưa xác định được thì giữ deletion pending/maintenance, không báo đã xóa xong. Không được mở cửa xóa nếu ledger đang unavailable. Ledger giữ tối thiểu từ backup cũ nhất còn cho restore; không tự TTL các entries còn cần.

Restore: vào môi trường riêng/maintenance → verify snapshot bytes/hash → đọc ledger mới nhất ngoài snapshot → áp lại tombstone/deletion và cleanup tương ứng → đổi serverGeneration/thu hồi phiên/key tạm → kiểm tra references/ready artifacts → reconciliation client → mới mở commit. Ledger thiếu/không chứng minh đầy đủ thì giữ read-only/maintenance, yêu cầu nhóm vận hành xử lý, không silently resurrect. Thử restore cả deletion xảy ra sau backup; rollback UI không restore DB cũ.

## C20. Limits, capability và kiểm chứng

P: 20.000.000 byte nguồn; 10k–50k dòng/~50 cột là mục tiêu thử, không giới hạn cứng; 100 activated là trần nghiệp vụ, 100 concurrent là mục tiêu. Không trần nghiệp vụ số version/tổng dung lượng project; không storage vô hạn.

T: profile kỹ thuật khởi đầu để benchmark, chưa là khả năng đã chứng minh:

| Biến | Giá trị khởi đầu đề xuất |
| --- | --- |
| metadataBodyMaxBytes / chunkMaxBytes | 1.048.576 / 4.194.304 |
| artifactMaxBytes | 268.435.456 mỗi artifact; chunk protocol cho lớn hơn 20 MB |
| workerMemoryBudgetBytes | 536.870.912 budget ước lượng, không cam kết browser đo/giới hạn được RAM cứng |
| denseMatrixMaxCells | 10.000.000; cần dự toán cả bản sao/input/output/workspace |
| sparseMaxNnz / featureMaxCount | 10.000.000 / 20.000 |
| outputRowMaxCount | 1.000.000; guard sau join/concat, không trần đầu vào 50k |
| exactPairwiseMaxPairs | 2.000.000; KNN test×train/Silhouette phải kiểm tra trước |
| mutationsPerBatch / mutationsPerAtomicGroup | 100 / 20; nhóm lớn hơn phải chia theo dependency hợp lệ, không phá atomic version |
| perAccountConcurrentUploads / perInstanceUploads | 2 / 8 |
| perProjectWriteTasks / perAccountAiRequests | 1 / 1 |
| stagingGrace / request upload expiry | 24 giờ / 1 giờ; active lease chống dọn nhầm |

Chặn khi bất kỳ estimate vượt ngưỡng; mức thực có thể thấp hơn do thiết bị/storage. Estimates gồm UTF-8→chuỗi, JSON objects, matrix copies, vocabulary, joins nhiều–nhiều, PCA work buffers. Capability công bố limits profile version và lý do unavailable; chạy lại kiểm tra actual allocations, không dùng số ước lượng làm bằng chứng chắc chắn. Không giảm mẫu/đổi feature ngầm. Thay limits sau đo phải cập nhật config + docs + frontend/backend/Nginx/platform, giữ input max là P.

Engine adapter phải có config schema với mọi tham số chỉnh được, domain/defaults, binary/multiclass support, sparse/dense, cancelMode/cooperative|terminate, serializer roundtrip, offline dependency hashes, license/version và kết quả thử. Chưa chọn package nên không bịa tên tham số engine hay hỗ trợ đa lớp. Muốn giảm phạm vi thuật toán/phương pháp bắt buộc vì thư viện không hỗ trợ là Q, không tự bỏ. Thay thư viện đáp ứng cùng yêu cầu là chi tiết kỹ thuật có thể đề xuất.

Hosting/mail/storage/AI provider và Node/Fastify/Nginx versions vẫn V. Trước chọn phải tra nguồn chính thức hiện hành, ghi ngày, miễn phí/trial/thẻ/expiry, CPU/RAM/sleep/upload/TLS/URL ổn định/DB transaction/storage persistence/sender. Không đạt Nginx thật/HTTPS/private storage/transaction thì ghi chưa đáp ứng, không thay yêu cầu bằng proxy hosting.

## C21. Nginx và release contract

UI+API một origin ổn định. `/api/v1` giữ nguyên prefix, API không tồn tại trả JSON lỗi; UI deep link fallback shell; `/assets`/worker/font/sw.js thiếu trả 404, không HTML 200. Backend stream private file, Nginx không public alias. index/sw/manifest no-cache; static hash immutable; private API/artifact/AI và lỗi no-store. SW chỉ cache allowlist app.

TLS termination xác định trên deployment profile; trust proxy chỉ exact hops/CIDRs, CSRF/cookie/PUBLIC_ORIGIN cùng origin. Nếu platform có proxy đứng trước vẫn phải có Nginx thật. Không tin Host/Forwarded tùy ý, không dùng CORS thay firewall nội bộ. Nếu đổi origin phải có kế hoạch đồng bộ từ origin cũ; redirect không di chuyển IndexedDB/outbox.

Body/chunk limit khớp C20 có tính overhead; metadata 1 MiB không chặn binary route 4 MiB. Timeout khởi đầu connect 5s, metadata deadline backend 25s/proxy 30s, upload/download inactivity 60s, AI backend adapter deadline < proxy total-platform budget; không giữ HTTP request suốt training local. Tắt upstream retry mutation/AI ở bản đầu. Nginx log lọc query/body/secret và propagate requestId; CSP theo build đã thử, không unsafe-eval mặc định. Release cũ/SW/migration theo C13; rollback xem compatibility, không xóa site data.

## C22. Ranh giới triển khai, bàn giao và dependency

Thứ tự: thống nhất P/T/Q/V → contracts/registry/serializer → kiểm chứng engine/hạ tầng → local commit+worker+writer song song về tiến độ với auth/artifact/sync (không bắt buộc chia agent) → vertical slice import/biến đổi/sync → đầy đủ phương pháp/workflow/ML → 3D/chart/report → offline manifest/AI/deletion/restore → Internet/load/upgrade nghiệm thu. Thiết kế xóa, session fence và migration từ đầu, không đợi cuối mới đổi schema.

Đầu ra thiết kế tiếp theo là JSON Schema/OpenAPI triển khai từ hợp đồng này, field/index tables và fixtures, không một bản hợp đồng khác. Mỗi thay đổi contract phải ghi version, compatibility, bên bị ảnh hưởng và ca nghiệm thu. Trước sinh code phải có nhiệm vụ triển khai riêng; bản prompt v2 không phải lệnh tự deploy/gửi mail/gọi AI trả phí. Xem [ma trận nghiệm thu](quyet_dinh_va_nghiem_thu.md) để biết bằng chứng và các điểm V còn chưa đạt.
