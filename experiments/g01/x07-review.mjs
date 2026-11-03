import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex'),out=`evidence/x07-reviews/${new Date().toISOString().replace(/[:.]/g,'-')}`;await mkdir(out,{recursive:true});
const runs=[],map=new Map(),history=[];
for(const dir of (await readdir('evidence/x07-runs')).sort()){const file=`evidence/x07-runs/${dir}/results.json`,r=JSON.parse(await readFile(file,'utf8'));if(!r.finishedAt)throw Error('unfinished run');runs.push({file,r});for(const t of r.tests){map.set(t.id,{source:file,runId:r.runId,...t});history.push({id:t.id,status:t.status,source:file});}}
const cases=[...map.values()],counts={passed:0,failed:0,inconclusive:0,blocked:0};for(const c of cases)counts[c.status]++;
const last=runs.at(-1).r,complete=cases.length===9&&cases.every(c=>c.status==='passed')&&runs.every(x=>x.r.protectedEvidenceUnchanged);
const status={experiment:'X07',task:'B016',counts:{currentExecutedCases:counts,historicalFailedCaseObservations:history.filter(t=>t.status==='failed').length},localProfile:{status:complete?'passed':'inconclusive',scope:'Synthetic loopback Windows Nginx/Node/Mongo/private-disk infrastructure survey only',canPrepareG02SLocal:complete,productServicesEnabled:false},internetHosting:{status:'blocked',reason:'No cloud resources/public hostname/trusted public TLS/mail authorization; provider not selected or deployed'},V02:{localTransactionNginxPrivateDisk:complete?'passed':'inconclusive',publicOriginTrustedTLS:'blocked',realSender:'blocked',overall:'inconclusive'},V04:{initialUploadLimitsAndHash:complete?'passed':'inconclusive',concurrent100:'inconclusive',providerQuotasDiskFull:'inconclusive',overall:'inconclusive'},V05:{logicalBackupAndLedgerReplay:complete?'passed':'inconclusive',physicalBackupCrashPowerLoss:'inconclusive',productionRestoreGateAndClientReconciliation:'inconclusive',overall:'inconclusive'},cases,history,environment:last.environment,allRunCleanup:runs.map(x=>({source:x.file,cleanup:x.r.cleanup,failure:x.r.failure})),limits:'No deletion of DB/files, no real auth, no physical cleanup or physical Mongo backup, no cloud durability or public TLS proof'};
await writeFile(`${out}/status.json`,JSON.stringify(status,null,2));
const rows=cases.map(c=>`| ${c.id} | ${c.status} | ${c.elapsedMs.toFixed(2)} | ${c.runId} |`).join('\n');
const report=`# G01–X07 / B016 — Hạ tầng local/dev

Local profile: ${status.localProfile.status};9case hiện hành passed,3failed lịch sử giữ nguyên. Có thể chuẩn bị nhánhG02S local sau các dependency B020/B012 tương ứng; không đóng toànB016/hostingInternet/V02/V04/V05. Không bật ứng dụng/sync/auth/xóa sản phẩm.

## Yêu cầu/phạm vi

B005 đã bàn giao. Đọc kế hoạchX07/G02S, backlogB016, S26/S27,F24/F27,C18–C21, WS§5–15/16 và BE§14–15, X03binary+transaction/ledger evidence. Probe chỉ experiments/g01 và PROGRESS; runtime/binary/cert/key/privatebytes/DB dưới .runtime bịignore. Không Dockercommand, không đụng PostgreSQL finance-app, không systemservice/truststore/firewall, khôngcloud/mail/AI. Chỉ dừng process do run tạo với đúngprefix/PID/APIchild/replsetinstance; DB/files gốc và runtime giữ nguyên, khôngdrop/delete/unlink.

## Lựa chọn và ADR T

[So sánh](../../x07-selection.md): nativeWindows Nginxportable vsLinuxDockerprofile chưachạy. ChọnWindowslocal để kiểm mà không thayDockerstate. [Windowsdocs](https://nginx.org/en/docs/windows.html) nêu beta/giới hạnWindows và đềnghịmainline; [download](https://nginx.org/en/download.html)1.31.8, [BSD2clause](https://nginx.org/LICENSE), [proxysemantics](https://nginx.org/en/docs/http/ngx_http_proxy_module.html). Internet chỉ tải binary official trước test, không provider resource. PinarchiveFBB1501009BE34655CC238D460714CF20391B639013F4C73859813D7938783FD/binaryC321BDC2A6ECCDAAD3C702E4DA37E2F7BBFA4FFB3CABB9E70C586F5A5E95DA44; chưa verifyPGPsignature, hash là pin byte lần tải quaHTTPS, không giả là publisher signature.

Nginx1.31.8 buildcl19.44/OpenSSL3.5.9(xemraw-V); OpenSSLCLI3.4.0 tạoRSA2048cert1ngày SAN127.0.0.1/localhost; Node${last.environment.node}, Windows${last.environment.release}, ${last.environment.cpu}, RAM${last.environment.totalMemoryBytes}. Mongo8.0.34 WiredTiger single-member realreplset, binarySHA4c9e9764cbac5be8eb92733e23ce7f70b52f8ae84b6879b4d5cc010c90ec6082 theoX03; driver7.8.0/memoryservercore11.3.0 khóa đãcó. Thư viện tênmemoryserver vẫn chạy mongod thật trên private dbPath, khôngDBmock.

TLSNodeclient dùngca=devcert/rejectUnauthorized=true, SNIlocalhost; không thaytrustOS/browser, không chứngminhpublictrustedTLS. Originloopback ổn định qua restart trongrun; mỗi run chọnport mới, không là hostname phát hành. Backendbind127.0.0.1 vàprobeupstreamtoken doNginxset; authowner là Bearerfixture, không authC07production.

T đềxuấtNginxprofile+privatefilesystem+Mongo one-node cho dev/test; không chọn cloud hoặc coiWindows là đíchproduction. Nếu chuyểnLinux/container/provider cầnchạy lại đườngpath/MIME/TLS/trustproxy/persistence/restart/backup, thựcđo quota/sleep/timeout vàgiấyphép; không tự bỏNginx/P16. Một-node không chứngminhHA. Proxyconfig sửa routineT trong probe: assets dùng ^~ để tránhgenericregex, proxy_intercept_errors off giữ mã lỗi backend; chỉ lỗiNginx tựtạo đierror_pageJSON; SSLclientSNI tách HTTPHost giả.

## Ca thực và bằng chứng

| Case | Status | elapsed ms | Run nguồn |
| --- | --- | --- | --- |
${rows}

- HTTPSNginx thực, HTTP308 tớiHTTPS, UIdeeplink shell, API/v1prefix giữ, APIunknown JSON404/no-store; missing JS/worker/font/SW404, hashedJS MIMEjavascript/immutable. Không thử appSW/CSP/releasewindow thật ở đây.
- GiảForwarded/XFF/XFP bịNginx bỏ/ghiđè, requestId32hex chuẩn hóa khớpheader/body; Hostevil421 sauTLS hợp lệ; directAPI thiếuinternaltoken403; private/storage/backup/ledger/.env/.git paths404. KhôngCORS thayfirewall; khôngphép giảownerthật.
- Metadata1MiB+1/chunk4MiB+1 cóJSON413/no-store; sourcetotal20.000.001 bịbackend413INPUT_FILE_TOO_LARGE. Source20.000.000 vàartifact25.165.824byte qua<=4MiBchunks, backendprivatefiles/hashdownload vàMongo transactionready+receipt. Chunk/complete retrykhôngtrùng, changedchunkhash409, ownerB404. Đây là probeupload, chưa đầy đủ S12/idempotency/expiry/backpressure/incomplete/crashstates sảnphẩm.
- Timeouttestproxyread1s tớiAPIđợi2s,504JSON/no-store vàDBdispatchcount1; proxy_next_upstreamoff. Productionprofile25/30/60s chưa nghiệmthu từtest1s. Không gọiAIthật; routehang chỉnumericmutationfixture.
- Nginx-t configinvalid bịchặn, processcũhealth200. RestartNode/Nginx/Mongo với cùngprivatepaths giữ2readyartifacts/hash, originNginx khôngđổi; không chứngminhcloudredeploy/machinecrash/diskloss. Cấu hìnhmalformed đượcghi mới, khôngreloadconfigxấu vàođangchạy.
- Accesslog chỉrequestId/method/$uri/status/bytes/upstreamstatus, khôngquery/body/cookie/Authorization. Errorstderr sanitizedquery trướcpersist, khôngrawerrorlogfile; syntheticquery/header sentinel khôngtrongcáclog đãthu. Không chứngminh mọi futurelogpath tựđộng antoàn; route/secretredaction phải tíchhợp B035/WS22.
- Manualmaintenance+logicalcollectionsnapshot kèmcopy2referencedartifact/hash; ledgerappend+fsync ởpathngoàibackup; postbackup logicaltombstone; restore vào DBnamespace/copybyte mới, replaytombstone, đổigeneration2/sessionEpoch2, giữlivehash. Khôngdrop/rollback/xóafile/DBgốc; khôngphysicalcleanup. Missingledger đọc ENOENT đượcghi blocked/maintenance policy, không mởrestoreservice; đây chưaca tíchhợp gate restoreAPI/clientreconciliation. Khônggọi đó làphysicalmongodump/WiredTigerbackup hoặcpowerlosssafety.

Raw results cóexpected/actual/timing/configredacted/cleanup/hash. Backupmanifest vàaccesslog mẫu ởrun13:22:28. Cả3run cleanup ownedAPI/Nginx/Mongo stopped/dataRetained, protectedEvidenceUnchanged=true. Config khôngcórealcredential, TLSprivatekey khôngGit. Snapshot/hashscript hiện hành ởreviewmanifest, rawconfigcũ giữ nguyên.

## Lỗi lịch sử/rerun

13:22:28:6passed/3failed: genericstaticregex thắngassetprefix; proxy_intercept_errors rewritebackend413; Node dùngHostevil đểverifyTLScert trước khiHTTP tớiNginx. Sửa3điểm rồi13:23:54 chỉ3cađópassed.13:25:26 chỉtimeout/no-retry vàlog vìproxyerrorhandlingvừathayđổi,2passed. Không lặp24MiBupload/restart/restoređãđạt hoặc X01–X06. Review giữnguyênprovenance từngcase, không giả cómộtfullrun9passed mới.

## Chạy lại và dừng an toàn

~~~powershell
Set-Location -LiteralPath 'D:\\JS & TS\\dashboard_3d_datamining\\experiments\\g01'
npm ci --ignore-scripts --no-audit --no-fund --cache .runtime/npm-cache
./x07-prepare.ps1
# Cần mongod8.0.34 đãcache theoX03 hoặc chuẩn bị riêng, khôngrerunX03đèevidence.
node run-x07.mjs
# Ca chọn cómục tiêu:
$env:X07_CASES='X07-TLS-routing-cache,X07-proxy-boundaries,X07-metadata-chunk-bounds'
node run-x07.mjs
Remove-Item Env:X07_CASES
node x07-review.mjs
~~~

OpenSSLCLI cầntrongPATH. Mỗi runcreateprefix/DB mới, khôngxóa runtime. Runnerfinally dùngAPIchildmessage, nginx -p <đúngrunprefix> -c nginx.conf -s quit vàrepl.stop(doCleanup:false). Không dùng taskkilltheotên/containerstop. Nếuinterrupted kiểmprefix/PID trongresults vàchỉquitNginx bằngđúngconfig của run; không dừngdịchvụkhác. Artifactruntime chỉtổnghợp, khôngthêm vàoGit. x07-prepare khôngoverwrite archive/binaryhiệncó, abortnếuhashkhác, khôngPGPverificationclaim.

## Cổng và bước kế

V02localNginx/transaction/privatepathrestart passed; publicstableURL/trustedTLS/cloudpersistentvolume/emailblocked. V04 initiallimits/hashpassed,100concurrent/diskfull/peakRAM/providerquotainconclusive. V05 logicalreplaypassed, fullphysicalbackup/powerloss/productionrestoregate/clientreconciliationinconclusive. B016 chỉ đạt localprofile choG02S theođiềukiệnkếhoạch; không đóngkhả năngInternet/G09/G10.

B017/X08fake-local vàB018/X09fake-local độclậpB005 cóthểtiếp tục, dịchvụthậtchờủyquyền/cấuhình. B020G02L cầnđốichiếuX01/X04 vàchungcontracts; B030cầnB020/B012+localprofileX07, khôngtựmởđăngkýcôngkhai khiB017realmailblocked. CácquyếtđịnhP giữ nguyên; chưacóvấnđềQ cầnchủdựán cho phầnlocalvừalàm.
`;
await writeFile(`${out}/report.md`,report);const hashes={};for(const x of runs)hashes[x.file]=sha(await readFile(x.file));for(const f of ['run-x07.mjs','x07-api.mjs','x07-prepare.ps1','x07-review.mjs','evidence/x07-selection.md'])hashes[f]=sha(await readFile(f));hashes['status.json']=sha(await readFile(`${out}/status.json`));hashes['report.md']=sha(await readFile(`${out}/report.md`));await writeFile(`${out}/hashes.json`,JSON.stringify({algorithm:'SHA-256',files:hashes},null,2));console.log(JSON.stringify({out,counts,localProfile:status.localProfile.status,internet:status.internetHosting.status},null,2));
