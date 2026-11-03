# X07/B016 — Phạm vi local và lựa chọn T trước chạy

Phụ thuộcB005; S26/S27,F24/F27,C18–C21,WS§5–15/WS03–14/19/22–24,BE§14–15. Đã đọcX03: Mongo8.0.34 binary đã có, transaction/fsync/ledger logicalrestore từng được thử nhưng không thay X07 Nginx/storage/TLS/restart. Không gọi lại run-mongo.mjs vì sẽ ghi đèx03-results.json.

Phạmvi sửa: experiments/g01 harness/evidence/.runtime và PROGRESS. Không app/cloud/mail/AI, khônginstallglobal/service/truststore/firewall; khôngDockercommands hoặc containerfinance-app. Runtime certificates/privatekeys và binary/data khôngGit. Chỉprocess tạo bởiX07, prefix/PID riêng, loopback127.0.0.1. Dừng Nginx chỉ qua đúng prefix/config của run, không killtheotên process.

| Ứng viên dev | Căn cứ | Quyếtđịnh T |
| --- | --- | --- |
| NativeWindows portable Nginx + Node loopback + localprivate disk + Mongo one-member wiredTiger | [Windowsdocs](https://nginx.org/en/docs/windows.html), [download](https://nginx.org/en/download.html), [licenseBSD2clause](https://nginx.org/LICENSE); OpenSSL3.4.0 cósẵn, Mongo8.0.34 đãcache | Chọn thửlocal. OfficialWindowsdocs đềnghịmainline1.31.8, chứkhônghứaWindowsbeta đạt tải production. Nginx chỉconsoleapplication, khôngcàidịchvụ. TLSselfsigneddev cóSAN127.0.0.1, chỉclientprobe trustcerttườngminh, khôngtrustOS |
| LinuxDocker profile táchriêng vớiNginx/Node/Mongo | Cóthể phùhợpđíchLinuxnhưngchưađượcđo và cócontainerkhác cầntránh | Khôngchạy/khôngthayđổicontainer hoặcDockerstate; Windowsprobe khôngchứngminhLinux/cloudstorage |

Không chọn providerInternet, không tạo tài nguyên hoặc nhận credit/thẻ. Miễn phí/sleep/URLtrustedTLS/providerpersistentvolume vẫn V02 blocked đối vớiInternet và được tách khỏi kếtquảlocal. Local/dev không cần quyếtđịnhsảnphẩm mới; không tự giảm P16. Nginx thaypackage/version cầnchạy lạiHTTP/TLS/routing/cache/error/log/body/restart; đổistorage/DB/ledger cầnbackup/hash/reference/generation/tombstone/replay.

Expected: Nginx thậtHTTPSloopback origin cốđịnhtrongrun, UIdeeplink; APIprefix/no-storeJSON404/413/502/504; MIMEstaticmissing404; ownerprivateupload/download20MBsource vàartifact>20MBchunk4MiB; hashbyte/tổnglimit; giảHost/forwarded/secretquery khôngvượtrouting/logpolicy; mutationtimeout khôngretry. Configbad bịnginx-tchặn vàoldprocesscònchạy. Restartbackend/Nginx/Mongo dùngsameprivatepath giữhash/metadata; manualbackupDB+bytes rồideletionledgerdurable ởpath ngoàisnapshot, restorevàreplay/generation/sessionrevoke; ledgerthiếugiữmaintenance. Không mởproduction/write service từprobe. Kiểm từngkhả năng bằngactual, thiếuquyền/côngcụ thìblocked thayvìproxygiả.

Nguồnproxy semantics: [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html). Bodymetadata1MiB, chunk4MiB; source20.000.000byte không làm trầnartifact. Timeoutprobe có thể rútngắn để thửnhanh nhưng phải khai báo khác profileproduction25/30/60s, không nghiệmthuSLA từtimeouttest.
