# X09/B018 — Fake consent/adapter protocol

8 passed / 0 failed. Không networkclient/provider thật; realprovider blocked, V01/V03/V04 overall chưa đạt. Không đóng B018 phần thật/G08 hoặc bật AI. Chỉ Nodecrypto/canonicalize5.1.0 đã có, không dependency mới.

Nguồn C07/C16/C18, BE§11, FE§13, F25/F26, planX09; expected/actual/timing/scope từng ca ở results.json. Consent prepare+confirm không dispatch; canonical hash exact business context/source/provider/model/epoch, key handle không vào hash; request không nhận row thêm; TTL600s; privatekey RAM idle1800s/session expiry/provider binding/rotation/logout không fallback; oneshot requestid/approval, unknown sau controlled100ms không redispatch; late original result resolve unknown, cancel/revoke ignored; invalid operation/cột/params/shape rejected; accept chỉ config; audit không row/key/prompt/token. Hostile text chỉ data, không eval/command.

T: fakeprovider/strict PREP.MISS_MEAN feature1 allowlist dùng để kiểm mechanism, không full S04/S25 registry/schemas chưa B020. Chưa đánh giá đầy đủ text candidates/provenance, HTTP SSRF/cookie CSRF/owner API/endpoints/browserpanel/reload/cost/retention/rateconcurrency. DurableAuditMap mô phỏng ngoài object, không durable disk/process restart. Keylost test là object reconstruction, không gọi là backend restart thật. Các giới hạn còn ở B090–B093/G08; không đánh dấu V03 passed.

Provider thật cần lựa chọn/quyền gửi/retention/quota/cost hợp lệ và nhiệm vụ ủy quyền riêng; không hỏi lại P hoặc tự fallback key/provider. Đổi adapter/registry/auditstore/session protocol phải replay hash/consent/idempotency/unknown/privacy/latewrite và ghi ADR.

Chạy từ experiments/g01: node run-x09.mjs; timestamp mới, không dịch vụ/secret thật. File mới x09-consent.mjs, run-x09.mjs, evidence/x09-selection.md và run này; PROGRESS. Evidence cũ unchanged=true. Tiếp theo đánh giá đầu vào B020/G02L và G01 gates; không coi mọi V đã đạt vì fake passed.
