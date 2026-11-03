# B021 local store kernel

LocalStore dùng IndexedDB version1, account namespace riêng, metadata và byte trong IDB. B022 phải kiểm offline entitlement/account và giữ WebLock trước initialize/advanceWriter/start/stage/commit; đây là kernel, không tự chứng minh quyền bằng ownerId truyền vào.

Luồng: initialize metadata đã biết → advanceWriter dưới lock → chụp S08 → start → stage byte đã hash → commit version. Không có parse/import/ML executor/UI/network. Test fixtures gắn operation snapshot tổng hợp để kiểm lưu trữ, không bật operation registry đang unavailable.

stage copy byte/descriptor, kiểm sha/size ngoài transaction, lưu add-only theo ID. prepare chỉ đọc graph dependency cần cho version, không quét mọi byte/account. Kiểm table manifest/chunk/shape/types/hash và lineage nếu có; source scope được kiểm lại khi commit. B023 còn phải đặt budget trước cấp phát/parse cho quy mô lớn.

commit hash cả hai ứng viên branch ngoài transaction; transaction strict kiểm account generation/project/dataset/fence/task/source/byte presence, chọn branch theo expectedLocalHead, ghi artifact refs/version/branch/history/step/task/marker/outbox cùng nhau. Chỉ trả localCommitted sau oncomplete; RESULT chưa gọi commit không success. Cancel trước transaction thắng thì không metadata success; marker có trước cancel giữ output. Không xóa orphan/staging/unsynced trong B021.

ADR-B021-01 A: baseRevision version mới0; server expectedHead known revision hoặc dependency fromMutationId riêng trong payload/hash. localHeadRevision chỉ counter local. Branch descriptor giữ fork/reason gốc của branch khi nối tiếp; chỉ tạo fallback branch từ source snapshot nếu local head đã đổi, không ghi đè main head. Context đổi thì không tự chuyển pointer.

Retry cùng commit/version/task phải cùng payloadHash; đổi nội dung bị IDEMPOTENCY_MISMATCH. Task lưu source snapshot bất biến; caller không được dùng active UI context thay snapshot. Recovery chỉ đánh running task fence/generation cũ interrupted sau lấy writer mới, không auto resume; marker phục hồi metadata đã commit. openVersion kiểm byte lại; thiếu/corrupt trả resourceMissing, giữ metadata/outbox. TTL/browser eviction/power-loss không được suy là đã bảo đảm.

Chạy từ root:

    npm run build --prefix packages/contracts
    node --test tests/integration/b020.test.mjs tests/integration/b021-contract.test.mjs
    apps/api/node_modules/.bin/tsc --project apps/web/tsconfig.json
    node experiments/g02l/run-b021.mjs
    node experiments/g02l/run-b021-crash.mjs

Dependencies esbuild/Playwright local experiments/g02l và Chrome/Edge. Crash harness chỉ Browser.crash trên browser process/profile do nó tạo, giữ profile trong .runtime; không kill theo tên/PID bên ngoài. Native quota test dùng bucket1MiB/tải2MiB, không lấp physical disk. Native duplicate ConstraintError kiểm rollback giữa transaction; missing-byte test là read-visibility injection không xóa dữ liệu. IDB strict có bằng chứng browser crash, không thay kiểm power-loss hoặc miễn eviction.

T: IDB byte adapter tránh ranh giới file ngoài transaction giai đoạn này. Đổi OPFS phải kiểm close/hash/reference/marker/recovery/quota lại; byte formats/hash không tự đổi. Primary references: https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction ; https://developer.chrome.com/docs/web-platform/storage-buckets .

S08 seed-local và apply-head-decision chỉ lịch sử bootstrap/transition draft; không rerun đè primary JSON hoặc migration database hiện có. Chưa có dữ liệu app production cần migrate; migration/releases thuộc B081. Chưa ACK/syncgate/outbox cleanup (B024), actual writer/account/worker protocol (B022), preview budgets (B023).
