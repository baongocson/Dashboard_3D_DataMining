# G01–X05 / B014 — Khảo sát renderer

Review 2026-11-02T13-00-57-446Z. Đủ bằng chứng đóng khảo sát kỹ thuật X05 trên máy này. Chưa bật renderer sản phẩm; V01/V04 tổng thể vẫn inconclusive. Tổng hợp hiện hành: {"passed":36,"failed":0,"inconclusive":0,"blocked":0}; mọi case có source/runId trong status.json. Giữ 16 quan sát failed lịch sử, không sửa thành passed. Không chạy lại X04.

## Nguồn/phụ thuộc/phạm vi

B014 chỉ phụ thuộc B005, đã bàn giao G00. Đọc kế hoạch §4 X05/§5, backlog B014, C14/C15/C20, S24, F20/F21, 3D §5–14/16, FE §7/9/19. Nhiệm vụ độc lập được phép làm khi sparse X04 bị chặn theo kế hoạch §1/§5. Chỉ sửa experiments/g01 harness/package/evidence và experiments/PROGRESS.md được người dùng giao. Không app/API/schema sản phẩm, dịch vụ/cloud/mail/AI, commit/push/deploy hoặc container.

## Lựa chọn, môi trường và ADR T

[Lựa chọn trước cài](../../x05-selection.md): three0.187.0 MIT, so với Babylon9.33.1 Apache2 không cài/benchmark. Nguồn chính thức: [scene](https://threejs.org/manual/pages/creating-a-scene.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer), [cleanup](https://threejs.org/manual/pages/cleanup.html), [dispose](https://threejs.org/manual/pages/how-to-dispose-of-objects.html), [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE), [Babylon specs](https://www.babylonjs.com/specifications/) và [license](https://github.com/BabylonJS/Babylon.js/blob/master/license.md). Internet chỉ tra docs/npm trước test; bundle local không CDN/font/texture ngoài. Không hứa tương thích dựa trên tài liệu mà chưa chạy.

T: đề xuất three + DOM, PerspectiveCamera/Raycaster/OrbitControls và renderer persistent/dispose scene khi đổi view. Đây là lựa chọn probe, không tự chốt framework sản phẩm. Nếu đổi engine cần replay picking, camera, controls, offline assets/hash, export, loss/recovery, disposal và so bundle/license; không đổi P09 hay dùng CSS nghiêng làm 3D. Không cần quyết định chủ dự án cho chi tiết T này vì giữ đúng yêu cầu hiện hành.

Windows_NT 10.0.26200; 12th Gen Intel(R) Core(TM) i5-12450H; RAM 16869052416bytes/12logical CPUs. Node v24.15.0, npm11.12.1, Playwright1.64.1, esbuild0.28.2. Chrome156.0.8078.76; Edge156.0.4314.58. Headless, profile/context tạm, viewport1280×900 và390×900, pixelRatio1, loopback127.0.0.1 cổng ngẫu nhiên. GPU thực: ANGLE (Intel, Intel(R) UHD Graphics (0x000046A3) Direct3D11 vs_5_0 ps_5_0, D3D11); WebGL2/ANGLE Direct3D11, Intel UHD tích hợp trên máy này, không suy ra mọi thiết bị hay software renderer đều đạt.

## Kết quả và tiêu chí

| Case | Chrome online | Chrome offline | Edge online | Edge offline |
| --- | --- | --- | --- | --- |
| X05-DOM-stage-form-keyboard | passed | passed | passed | passed |
| X05-perspective-stage-pick | passed | passed | passed | passed |
| X05-scatter-row-PNG | passed | passed | passed | passed |
| X05-graph-50 | passed | passed | passed | passed |
| X05-graph-200 | passed | passed | passed | passed |
| X05-graph-1000 | passed | passed | passed | passed |
| X05-cleanup-20 | passed | passed | passed | passed |
| X05-real-context-loss | passed | passed | passed | passed |
| X05-dispose | passed | passed | passed | passed |

- 9 stage đúng nhóm C15; selection bằng Raycaster và DOM dùng chung state; chọn/camera/2D không đổi sourceRef/taskId/versionCount fixture. Đây là điều hướng probe, không thực thi processing nghiệp vụ.
-12 input fixture hiển thị và không clip ngang ở1280/390px, dọc cuộn trang; Enter chọn stage; light/dark và prefers-reduced-motion được kiểm. Không thay bài kiểm toàn bộ form registry/accessibility/screen-reader/contrast của sản phẩm.
- Scatter3point có row mapping; chiếu điểm giữa rồi click thật, row-1/source A-V0 khớp. PNG từ canvas, đọc pixels qua2D canvas, số màu mẫu>1, dimensions/hash và source/camera trong actual. Ảnh canvas không tự có caption nguồn; nguồn nằm sidecar JSON/screenshot, chưa nghiệm thu export cuối C14/P11. PNG và screenshot gốc ở source run của case.
- Graph nhiều nguồn, n−2 nodes có cả cạnh parent và source;50/200/1000 node không cells/secret. Lượt sửa dùng Frustum.intersectsObject đo object trong camera, không chỉ đếm visible flag. Mọi node hiện trong fixture này; chưa thử phân trang/filter/picking tới version metadata thiếu byte.
- WEBGL_lose_context thật → DOM2D, selection/source/task snapshot giữ nguyên, worker tính tổng sin10000 phần tử theo tick vẫn tiến; restore thật rồi render. Đây là worker numeric độc lập, không phải late-commit/application task integration. [Khronos extension](https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/) và [context-loss](https://wikis.khronos.org/webgl/HandlingContextLost).
-20 scene switches: dispose geometry/material, renderer tái dùng, geometries trở0 giữa scene, texture nội bộ giữ1 ổn định, listener probe4/canvas1, dispose cuối listener0/canvas0. renderer.info không là byte GPU/peak RAM; không chứng minh không leak vô hạn hoặc listener nội bộ OrbitControls/JS heap. Peak RAM: inconclusive; không có số đo giả.

## Timing/FPS

performance.now đo build, requestAnimationFrame timestamp60frames khi camera xoay, FPS=1000×frames/sum(frame delta), p95 frame interval. Một trial, không warm/cold thống kê hay SLA. Target30 theo3D§13.2 được công bố trước chạy. DOM list đầy đủ1000button trong probe; không hạ số node để cứu FPS. Renderer on-demand ngoài benchmark/OrbitControls tương tác; reduced-motion không tự chạy benchmark trong UI, script đo là tác vụ test chủ động.

| Browser/mode | Total nodes | Trong frustum | Edges | Build ms | FPS | p95 frame ms | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chrome/online | 50 | 50 | 96 | 18.60 | 144.47 | 7.10 | passed |
| chrome/online | 200 | 200 | 396 | 13.10 | 144.02 | 7.10 | passed |
| chrome/online | 1000 | 1000 | 1996 | 33.30 | 135.01 | 7.10 | passed |
| chrome/offline | 50 | 50 | 96 | 13.20 | 147.37 | 7.10 | passed |
| chrome/offline | 200 | 200 | 396 | 16.00 | 142.68 | 7.10 | passed |
| chrome/offline | 1000 | 1000 | 1996 | 30.80 | 138.87 | 7.20 | passed |
| msedge/online | 50 | 50 | 96 | 18.00 | 141.64 | 7.20 | passed |
| msedge/online | 200 | 200 | 396 | 13.20 | 143.99 | 7.10 | passed |
| msedge/online | 1000 | 1000 | 1996 | 28.00 | 135.86 | 7.10 | passed |
| msedge/offline | 50 | 50 | 96 | 11.80 | 147.41 | 7.10 | passed |
| msedge/offline | 200 | 200 | 396 | 14.80 | 142.61 | 7.10 | passed |
| msedge/offline | 1000 | 1000 | 1996 | 27.70 | 141.19 | 7.10 | passed |

## Lỗi và chạy lại có mục tiêu

- Run12:53:41: cleanup guard đòi texture0 bị failed, restore timeout; không xóa lỗi. Lượt12:55:44 chỉ cleanup/context-loss bổ sung snapshot: texture luôn1 ổn định, geometry0 giữa scene, worker vẫn chạy lúc lost. Đây là chẩn đoán, không tự chuyển failed thành pass.
- Sửa harness: so texture với baseline trước vòng scene thay vì0 (tài liệu three cho phép internal allocation); giữ extension reference trước lose thay vì gọi getExtension lúc lost trả null. Bổ sung frustum count. Đây là lỗi harness, không kết luận renderer lib lỗi.
- Lượt12:58:10 chỉ graph50/200/1000, cleanup, context-loss và dispose, tất cả passed. Không lặp DOM/picking/PNG đã đạt vì đường logic đó không đổi; status.json giữ provenance từng case, không giả có một full run36passed.
- Các raw run có protectedEvidenceUnchanged=true với evidence X01–X04/audit; không ghi đè cũ. Offline có SW kiểm update có thể request loopback/sw-x05.js nhận503; không có request external thành công/record ngoài origin. Không tuyên bố browser tuyệt đối không thử kết nối. SW probe chỉ cache3file, không phải full app readiness C13.

## Chạy lại

PowerShell:

~~~powershell
Set-Location -LiteralPath 'D:\JS & TS\dashboard_3d_datamining\experiments\g01'
npm ci --ignore-scripts --no-audit --no-fund --cache .runtime/npm-cache
# Full X05 khi có thay đổi cần replay toàn probe:
node run-x05.mjs
# Chỉ ca cần kiểm (mỗi ca lặp Chrome/Edge, online/offline):
$env:X05_CASES='X05-cleanup-20,X05-real-context-loss'
node run-x05.mjs
Remove-Item Env:X05_CASES
node x05-review.mjs
~~~

Cần Chrome/Edge có sẵn; không Docker/Mongo/mongosh/Nginx/Python. Bundle platform=browser. Mỗi run/review timestamp mới; manifest hashes.json. Lượt cuối có snapshot source/lock/license. npm ci có thể cần registry/cache, test offline sau đã cache, không quảng bá first-load offline.

## Đối chiếu V và phần sau

B014/S24/F20/F21/C14–C15/C20: render/camera/pick/PNG/fallback/UI base/scale/dispose probe có evidence. 3D-01/02/09/18/19/20/23/25/26 và I34/I36 chỉ được kiểm trong phạm vi fixture nói trên; toàn nghiệp vụ chưa đạt. V01 renderer probe passed; V04 chỉ benchmark thiết bị ban đầu passed; overallV01/V04 và peak RAM inconclusive. G03/G06 còn cần registry/forms, full source lineage, account/writer generation, actual worker/store/history integration, pagination, caption export và offline readiness; chưa bật capability sản phẩm từ probe.

Tiếp theo B015/X06 độc lập (phụ thuộc B005). G02L/B020 còn phải đối chiếu X01/X02 giới hạn và X04 audit; G02S/B030 cần B016/X07. Chưa có quyền mail/cloud/AI thật; B017/X08, B018/X09 chỉ fake/local trước theo kế hoạch.

File đổi: package.json/lock thêm exactthree; mới x05-probe.mjs,x05-shell.html,run-x05.mjs,x05-review.mjs,evidence/x05-selection.md,raw x05-runs,review này; tiến độ PROGRESS. Không sửa thiết kế/backlog/app. Artifact list/hash ở hashes.json; expected/actual/error từng case tại run source.
