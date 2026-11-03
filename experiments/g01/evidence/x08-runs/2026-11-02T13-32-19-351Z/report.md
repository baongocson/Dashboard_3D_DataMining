# X08/B017 — Fake mail / controlled clock

8passed/0failed localstate cases. Realmail blocked: noauthorization/provider/sender/mailbox; zeroSMTP/cloudcalls. B017 tổng thể chưađạt, publicauth bịchặn. Kếtquả JSON tách sốca chạy khỏi realdeliveryblocked/providerV04inconclusive.

Nguồn C07/C18/C20,BE§5–6,F10/F11,planX08. Built-incrypto Nodev24.15.0([API](https://nodejs.org/docs/v24.15.0/api/crypto.html)); không newpackage/globalinstall. FakeMailAdapter chứacode chỉRAMtest, durable-style snapshotchỉverifierHMAC; không log/evidencecode/secret/password. Chỉ inmemorystate, không giả Mongo atomicactivation/reset/100account thực; X03 là evidence riêng chophần transaction.

Expected/actual từngca ởresults:6digit(CSPRNGformat vàleadingzero fixture),300s/cooldown60s/5sai/oneuse,bindingpurpose/generation/email,resendinvalidatesoldcode,5sends/hour vàperemailpurpose,accepted/failed/unknown≠delivered,grantoneuse300s/epoch/notautologin/outboxuntouched,pending24h. Clockfake chủđộng, khôngphải walltimedelivery. Trường code fixture không lưu file; report khôngchứngminh memoryerasure/lập lịch DB/timingSafe endpointhaypasswordhashing.

T quota:BE§5.2 nói5lầngửi/email/purpose/hour baoinitial;C07ceilresend5khôngbịvượt. ThaypolicyT phảiđốichiếulại cảFE/API/provider vàbáoảnhhưởng; không đổiP300s/60s/5sai. Không cóthử nghiệm Argon2/SMTP/delivery/forgotresponseoracles; khôngđóng nhữngphầnđó.

Chạy lại từexperiments/g01: node run-x08.mjs; mỗi run tạo timestampmới, không dịchvụ/network. Filemới x08-otp.mjs,run-x08.mjs,evidence/x08-selection.md vàrun này;PROGRESS; khôngapp/docs/prompt. Evidence cũ unchanged=true. Bước tiếpX09adaptergiả theoB018; realmailcầnnhiệmvụ vàcấuhìnhđượcủyquyền trước khi bật.
