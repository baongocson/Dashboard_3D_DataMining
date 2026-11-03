# X05/B014 — Lựa chọn và cổng kiểm trước cài

02/11/2026; phụ thuộc B005 (G00 đã bàn giao). Phạm vi sửa: chỉ harness/dependency/evidence experiments/g01; tiến độ experiments/PROGRESS.md. Không mã ứng dụng hoặc bật adapter sản phẩm. Nguồn: kế hoạch §4 X05, backlog B014, F20/F21, S24, C14/C15/C20, 3D §5/6/8/9/11–14/16, FE §7/9/19. Mỗi kết quả phải là thực đo, không coi ví dụ hình học là tích hợp nghiệp vụ.

## Hai ứng viên

| Ứng viên đã tra metadata npm | Căn cứ chính thức | Lựa chọn T |
| --- | --- | --- |
| three 0.187.0, MIT | [scene/camera/renderer](https://threejs.org/manual/pages/creating-a-scene.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer), [cleanup](https://threejs.org/manual/pages/cleanup.html), [dispose](https://threejs.org/manual/pages/how-to-dispose-of-objects.html), [license](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | Chọn thử: JS thuần + DOM có sẵn, không chốt framework, PerspectiveCamera/Raycaster/OrbitControls, dispose rõ. Bundle local bằng esbuild hiện có |
| @babylonjs/core 9.33.1, Apache-2.0 | [specification](https://www.babylonjs.com/specifications/), [license](https://github.com/BabylonJS/Babylon.js/blob/master/license.md) | Không cài/benchmark: engine rộng hơn nhu cầu probe; chưa có bằng chứng nhanh/chậm hơn three |

Tài liệu và registry tra qua Internet trước test; test không CDN/asset ngoài. Nội dung upstream không thay bằng chứng browser/offline. Chưa đo thì không hứa GPU tích hợp/FPS30 hoặc export.

## Cổng ca thử định trước

- Khởi tạo WebGL thật/camera phối cảnh và9 stage theo C15; DOM2D cùng selection, source/task bất biến khi chọn/camera/theme/view.
- Form hiển thị tất cả trường fixture khi desktop/narrow; keyboard kích hoạt DOM, reduced motion theo media query, nhãn HTML thành text an toàn.
- Graph metadata50/200/1000, mỗi mức ghi visible nodes/edges và scope; nhiều nguồn có mọi cạnh, không truyền cells. FPS khi camera xoay và độ trễ pick đo thực; không ngầm hạ mục tiêu30FPS.
- Scatter3D có rowId/source, Raycaster pick đối chiếu expected row, không sampling ngầm.
- PNG đọc pixel xác nhận không đồng màu/trống, gắn caption nguồn ngoài canvas trong artifact screenshot.
- Context loss dùng WEBGL_lose_context thật, fallback2D giữ source/selection và worker đang chạy; recovery có render thật. Không có extension thì blocked, không dispatch event giả để passed.
- Chuyển cảnh20lượt: dispose geometry/material/controls, listener tracking của probe và renderer.info.memory; không coi renderer.info là peak GPU/heap hoặc chứng minh không leak vĩnh viễn.
- Chrome/Edge profile tạm; local loopback; chạy offline sau cache shell/bundle. Renderer string phải cho biết hardware/software, software không chứng minh GPU tích hợp.
- Browser không có WebGL phải ghi blocked cho3D và vẫn thử DOM2D độc lập. Nhiệm vụ sau chỉ tiếp tục phần đủ dependency, không chốt renderer sản phẩm dựa vào browser blocked.
