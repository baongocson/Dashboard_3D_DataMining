# X08/B017 — Chỉ adapter mail giả và clock local

Đọc B017/planX08,C07/C18/C20,F10/F11,BE§5–6. B005 đạt; không cần chọn/cài package/provider cho fakeprobe. Dùng Node24.15.0 built-incrypto randomInt cho6digit, createHmac/timingSafeEqual choverifier, randomBytes grant; [API chính thức](https://nodejs.org/docs/latest-v24.x/api/crypto.html). Không tự viết cryptoalgorithm, không thêm dependency/toànbộauth/PW hashing. Đây là OTPstate-machineprobe, chưa Mongo transactionAuth; X03 mới là evidence riêng transaction99→100.

Hai loại môi trường: fakeinmemorylocal chọn chạy; SMTP/provider thật không được ủy quyền và không sender/hộpthư cấuhình nênblocked. Fakeaccepted khôngphải delivered. Khônggửithư cảngaylocalhostSMTP, không ngoại mạng. OTPchỉởRAM messagefake đểtestpossession; durable-style snapshotchỉHMAC và metadata, evidence khôngcode/plaintext/password/secret.

Expected:6digits/300s/cooldown60s/5wrong/pergeneration/purpose/one-time, resendinvalidatesoldcode vàcannotmutatechallengeidentity, max5sends/email/purpose/hour theoBE§5.2 (baoinitial; cũngkhôngvượt C07 ceilingresend5), khôngIPglobalblock; fakeaccepted/failed/unknown khôngactivateauto; uniformforgotresponse; resetgrant1use/300s/epoch; verifiers boundemail/purpose/generation, expired TTLrecordchưacleanupvẫnbịreject. Timestampscontrolledclockđượcnêu, khôngphảiđộtrễprovider.

Phạmvi filechỉexperiments/g01/{x08-*,run-x08.mjs,evidence/x08-*}, PROGRESS. Khôngapp/docs/prompt/backlog hoặc dịchvụthật. Thaycap tuning/transport/provider/hmacbinding phảireplayOTP/privacy/senderdelivery; chưapublicauth.
