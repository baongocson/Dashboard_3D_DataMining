# API — B030 local-dev

TypeScript chạy bằng Node 24.15.0 native type stripping, Fastify 5.12.8, Mongo driver7.8.0. Không có auto-listen hoặc production entry point. createApp(AuthService) phục vụ integration; harness sở hữu listener/process và secret ngẫu nhiên riêng từng lần. FakeMailAdapter chỉ RAM, không HTTP endpoint xem OTP.

Chạy từ root repo:

    npm ci --prefix packages/contracts --ignore-scripts
    npm run build --prefix packages/contracts
    npm ci --prefix apps/api --ignore-scripts
    npm ci --prefix experiments/g02s --ignore-scripts
    apps/api/node_modules/.bin/tsc --project apps/api/tsconfig.json
    node experiments/g02s/run-b030.mjs
    node experiments/g02s/run-b030-browser.mjs

Browser harness cần Playwright local experiments/g01 và Chrome/Edge đã cài. MongoDB harness dùng binary có sẵn experiments/g01/.runtime/mongod-8.0.34.exe; không tự download, không dùng container. OpenSSL local có sẵn dùng certificate tổng hợp1ngày, chỉ bypass trust trong profile test tạm; không thay truststore. Cần quyền tạo process/listener loopback. Mỗi lần tạo evidence và namespace mới, giữ DB, chỉ dừng MongoDB thuộc harness.

Hợp đồng: packages/contracts/schemas/auth-*.json, error/success envelope có serverNow theo C18; OpenAPI openapi/auth.local.v1.json (build bằng scripts/build-auth-openapi.mjs). Schema primary, không rerun seed-auth.mjs; seed chỉ lịch sử bootstrap không overwrite. Sau sửa schema phải build validators và regression.

T: Argon2id m19456KiB/t2/p1/salt16/hash32, tối đa2hash đồng thời/8đợi, dùng PHC library có version. Secret HMAC tối thiểu32byte do caller cấp, không ghi DB; đổi secret vô hiệu verifier OTP chưa dùng và CSRF token cũ, phải có kế hoạch quản lý secret trước public. Email trim ngoài/IDNA domain/toàn địa chỉ lowercase, giữ dấu chấm/+tag/display; password15–128code points giữ nguyên byte/Unicode. Display name1–100không control/all-whitespace, không diễn dịch HTML.

M01 users active riêng, pending ở M03. IX01 emailunique; M02 tokenunique, owner/epoch, expiry TTL có grace1ngày; M03 cleanup24h tách OTPexpiry300s; M04 activationCounter và reset_grants tách collection. Counter khởi tạo0 chỉ DB mới. Không dùng prepareAuth để tự sửa counter trên dữ liệu cũ: migration/import phải đối chiếu số active trước mở đăng ký. Session7ngày tuyệt đối; mọi quyền check expiry, không dựa TTL.

Transaction fence: withFence(token, callback) cập nhật có điều kiện user và session trong cùng transaction với write của caller. Không tách callback ra ngoài hoặc chỉ đọc epoch. Callback có thể chạy lại khi driver retry; không gửi mail/network hoặc làm side effect không transactional bên trong. Login/logout/reset ghi cùng user/session fence. B033 phải dùng primitive này và test với mutation thực; test B030 dùng synthetic commit collection, chưa thay thế I21 end-to-end.

OTP HMAC ràng buộc challenge/email/purpose/generation; mail gọi sau transaction, sendStatus ban đầu unknown, không tự gửi lại khi process chết. Resend có cooldown60s;5wrong/300s; tổng5send/email/purpose/hour gồm initial (T bảo thủ đáp ứng BE/C07). IP dev300/request-action/15phút, login20/email/15phút là tuning ban đầu, không cam kết NAT/tải. Reset không lộ identity trong response shape; unknown reset trả grant mồi không có quyền DB. Đây không chứng minh chống mọi timing side channel hoặc real mail/quota.

Local profile chỉ test/development và HTTPS loopback; auth công khai bị chặn bởi B017realmail/hosting/secret/rate tuning. Chưa có UI/logout dirty/outbox/account switching, AI RAM context cleanup hook, production migration/restore gate hay100user benchmark. 401 không Clear-Site-Data. Không coi B030 server subset là toàn bộ I04/I21/I22 đã nghiệm thu.
