# B020 — Shared contracts, data-format và registry nền

Kết quả: passed. 50 ca correctness (10 nhóm × Node + Chrome/Edge online/offline), 2 đối chiếu hash browser/API đạt. Hai API check offline blocked có chủ ý; 40 ca package trong worker vẫn chạy offline. Không cộng API bị tắt vào ca đã đạt, không cộng lại capability findings. Không bật operation sản phẩm.

## Căn cứ, phạm vi và phụ thuộc

B020/G02L phụ thuộc B010/B013. Đọc kế hoạch G02L, backlog, S01–S04/S18–S19, E01–E41, B004 toàn145 mã; C02–C05/C12/C18 và các fixture F01–F05/F16–F19/F32. X01 sáu fixture/hash/CSR đã đạt trên Node/Chrome/Edge; chưa suy ra importer20MB/peak RAM đạt. X04 audit cho phép đóng khảo sát dense, sparse native vẫn blocked. B020 không bật engine nên không dùng sparse blocked để bỏ P. B021 cần thêm B011; quota browser tự nhiên của X02 còn inconclusive.

Phạm vi CT theo BE§4/quyết định§6: packages/contracts, packages/data-format, packages/operation-registry; tests/fixtures và integration; harness/evidence experiments/g02l và nhật ký experiments/PROGRESS.md theo người dùng. Không root package/workspace/config, không apps/API/worker business/UI, không sửa docs/prompt/backlog hoặc evidence G01. Manifest/lock mỗi package riêng cho bước này; monorepo scaffold có thể lập ở task cần apps, không cần hỏi một lựa chọn kỹ thuật thường lệ.

## Lựa chọn và ADR T

JSON Schema draft2020-12 là nguồn chính; 160 file JSON gồm15 core/defs và145 method schemas chưa khả dụng. schemaVersion1 tách khỏi promptv2. Chọn AJV8.20.0 MIT + esbuild0.28.2 MIT build-time standalone ESM, không runtime compile/eval ở browser. Zod4.6.7 MIT đã so tài liệu/metadata nhưng không cài: JSON Schema conversion có thêm nguồn schema so với mục tiêu JSON Schema làm chuẩn. Nguồn [AJV standalone](https://ajv.js.org/standalone.html), [JSON Schema](https://ajv.js.org/json-schema.html), [license](https://github.com/ajv-validator/ajv/blob/master/LICENSE), [Zod](https://zod.dev/json-schema). canonicalize5.1.0 được X01 kiểm và cài exact cho data-format. Thay compiler/dialect cần regenerate/replay cả Node/browser/CSP; đổi representation/hash phải contractVersion/migration/replay receipts/outbox/artifacts. Không thêm Node driver vào browser.

JSON schemas là primary; scripts/seed-foundation.mjs là lịch sử bootstrap một lần với exclusive writes, không chạy lại hoặc dùng để ghi đè schema đã sửa. scripts/build.mjs chỉ đọc JSON nguồn để sinh validators/index/hash build-manifest. check-generated.mjs kiểm mọi hash/source list trước test; build lỗi không thể được che bởi test chạy validator cũ. Generated artifact450399bytes, worker bundle theo source run. Worker được reconstruct bằng đúng entry/dependency và SHA trùng bundle đã chạy, lưu cùng review để kiểm về sau.

T định dạng lineage-jsonl-v1 được triển khai theo các trường row/dataset/version/role/sourceOrder C03, không là join executor. Business hash rfc8785-sha256-business-v1 ghi rõ các trường schemaVersion/kind/entityId/projectId/baseRevision/dependencies/payload/artifacts; không mutationId/payloadHash/cookie/token/batch/retrytime. Object key order canonical; array order giữ nguyên vì roles/dependencies/feature order có ý nghĩa. Không có dữ liệu sản phẩm cũ được migrate, X01 prototype không được coi là schema app đã phát hành.

## Bàn giao và expected/actual

S01: envelope error/success và whitelist41 mã nguồn; E35/E39 là lifecycle nên không chấp nhận làm API error. Details chỉ path/field/scope/limit/count/entityIDs, không value/raw row/secret; unknown field rejected. S02 UUIDv4 lowercase/revision safe/hash/UTC pattern, canonical JSON guard. UTC pattern không thay mọi kiểm tra lịch/expiry domain; date/datetime cell có kiểm ngày hợp lệ trong data-format.

S03: Column/row/table manifest, artifact descriptors, CSR manifest/binary LE, row-lineage JSONL. Typed date/bigint/decimal/JSON giữ chuỗi, null khác empty/string-null, source bytes không bị chuẩn hóa. JSON number là finite/safe integer nếu là integer; -0 chuẩn hóa thành0 theo JSON/RFC8785, không hứa giữ negative-zero table bit. Raw duplicate escaped keys/unsafe integer/nonfinite/cycles/getter/sparse-array/nonJSON rejected, không covert NaN thành null. JSON_POLICY maxDepth128/maxNodes100000 là technical guard công khai, chưa thay resource estimator B023 và không cam kết mọi cấu hình20k feature fit budget.

Chunk target4MiB không là trần record: một row lớn hơn target vẫn nguyên trong chunk riêng nếu không vượt artifactMax268435456. Chunk transport server khác internal table chunk. Hash/size/UTF8/LF/BOM/count/order/ID/cell checks phát hiện lỗi; không mutate nguồn hoặc densify CSR. CSR bytes đối chiếu literal uint32/float64 LE; row/feature mapping giữ. B020 không cung cấp hàm sparse→dense hay claim sparse engine solve.

S04: registry version1 có đủ145 IDs đúng thứ tự B004, metadata source/gates/task/criterion/fit policy, 1 config schema version1/mã. Chưa method executor thì config nhận false và capability unavailable; requireAvailable từ chối. OperationDefinition tổng quát có điều kiện available phải có handler refs/defaults/evidence refs, nên không thể bật placeholder bằng đổi cờ. Label hiện là technical ID ở các operation unavailable; nhãn Việt và params/domain/defaults/preview/estimator/executor được bổ sung ở task owning method/FE trước khi bật. Không gọi false schema là config thực thi xong. ConfigVersion phải tăng khi method schema/params thay đổi; không diễn giải version1 bị khóa như version2.

C12 metadata foundation: MetricRecord defined finite hoặc null+reason, fitted pipeline metadata train/full và helper supervised không nhận full-fit learned steps. Chưa pipeline runner/stratification/unknown-category training/metric calculation/model serializer sản phẩm; đó là B060–B064. Mutation envelope có kind whitelist C10 nhưng payload map chưa thay typed mutation schemas/ref/owner/session validation B030–B034.

## Kiểm chứng

Node24.15.0 / Windows10.0.26200 / i5-12450H / RAM16869052416bytes; npm11.12.1; Chrome156.0.8078.76 và Edge156.0.4314.58, Playwright1.64.1, temp profiles, loopback. SHA canonical X01 7921516a892fd931ddad5f2ecaf4a351d259832f84c7c170f76a99825f8d8865 khớp. Fixture metric browser/API cùng SHA237185c40dcc0aad9373885906f9b4ba1ad2b98f5626506196480ee518075cb1. CSP default/script/worker/connect self, không unsafe-eval, vi phạm quan sát=0. Offline sau precache shell/client/worker + context offline/origin503; API cố ý không gọi offline, không giả API online.

10 nhóm: RFC canonical; strict JSON adversarial; schema/error privacy; typed table roundtrip; bad bytes/manifests/dates; CSR exact LE/invalid/hash; multi-source lineage; 145 schema/capability gate; metric/fit scope; mutation business hash. Test fixtures chứa oracle độc lập (literal canonical/hash/bytes/date/typed strings/metadata), không sao kết quả thư viện làm expected. TAP test assertion durations không là benchmark serializer; chưa đo peak RAM/import20MB/50k throughput trong B020 và không biến nó thành SLA.

Lỗi phát triển đã sửa: AJV strictRequired thiếu khai báo reason trong nhánh else; test camera nhầm control được đối chiếu B004 và sửa expected=config, không đổi catalog; mở rộng OperationDefinition thiếu type object ở nested condition bị strictTypes chặn và đã sửa. Test từng chạy với generated cũ sau build lỗi nên đã thêm check-generated để fail-fast; chỉ run cuối13:59:53 là evidence schema mới, Node test sau guard đã pass. Raw browser run13:56:53 giữ nguyên; không rerun X04 hoặc G01 khác.

## Lệnh tái lập

Từ repo: npm ci --prefix packages/contracts --ignore-scripts; npm ci --prefix packages/data-format --ignore-scripts; npm ci --prefix experiments/g02l --ignore-scripts. Sau đó npm run build --prefix packages/contracts; kiểm exit0 rồi node --test tests/integration/b020.test.mjs; node experiments/g02l/run-b020.mjs; node experiments/g02l/review-b020.mjs. Chrome/Edge cần sẵn; CI không được tiếp tục sau build failed. Không cần Mongo/Nginx/Docker/mail/AI/cloud cho B020. Rerun chỉ khi source/fixture/gate thay đổi; hashes.json ghi nguồn/artifact.

## Trạng thái và bước sau

B020 foundation đạt phạm vi task chia trong S/B; không hoàn thành toàn bộ method schemas hay S05–S30. V01 validators/formats đã có evidence Node/API/browser/offline; overallV01/V04 vẫn inconclusive. Operation enabled=0. B021 có thể bắt đầu nền local staging/metadata commit/outbox/recovery, đọc C06/F06/F09 và X02; quota tự nhiên chưa đạt phải công bố, không giả đã kiểm. B030 có nhánh độc lập sau B020/B012/X07 local nhưng mail thật vẫn chặn public auth. P01–P16 giữ nguyên; không commit/push/deploy.
