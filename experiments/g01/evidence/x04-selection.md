# X04 — Lựa chọn dependency trước khi cài

Ngày: 02/11/2026. B013; C04/C12/C20; V01/V04. Đây là lựa chọn T cho harness local/dev, chưa chọn engine sản phẩm và chưa chứng minh browser/sparse/hiệu năng bằng việc đọc README.

## So sánh

| Lựa chọn | Căn cứ chính thức / lợi ích | Giới hạn / quyết định |
| --- | --- | --- |
| Các module ml.js riêng lẻ | [ml.js](https://github.com/mljs/ml) công bố JavaScript cho browser; module có API trực tiếp cho 5 thuật toán, dense arrays/Matrix, các serializer riêng | Chọn thử: CPU JS, gói riêng theo thuật toán, bundle worker local. Browser/offline phải chạy thật; synchronous training sẽ hủy bằng terminate worker. Chưa công bố sparse native |
| TensorFlow.js | [Môi trường chính thức](https://www.tensorflow.org/js/guide/platform_environment), [Apache-2.0](https://github.com/tensorflow/tfjs/blob/master/LICENSE); browser/Node và nhiều backend | Không cài trong X04 này: cần tự dựng thêm thuật toán/serialization cho một số mục, thêm biến backend/tensor lifetime. Không kết luận là không làm được; chưa benchmark so tốc độ |

## Phiên bản đã tra npm trước cài

| Thuật toán/công cụ | Package chính xác | Giấy phép | API và nguồn upstream |
| --- | --- | --- | --- |
| Linear Regression | ml-regression-multivariate-linear 2.0.4 | MIT | [MLR(x,y), intercept/statistics, predict](https://github.com/mljs/regression-multivariate-linear); kiểm load/toJSON trong package đã khóa |
| Logistic Regression | ml-logistic-regression 2.0.0 | MIT | [train/predict, One-vs-All](https://github.com/mljs/logistic-regression); ml-matrix đầu vào, nhãn cần mapping liên tục; bias phải kiểm trong source |
| KNN classification | ml-knn 3.0.0 | MIT | [new KNN, predict, toJSON/load](https://github.com/mljs/knn); serializer lưu training tree, không hứa model nhỏ |
| K-Means | ml-kmeans 7.0.1 | MIT | [kmeans, seed/init, nearest](https://github.com/mljs/kmeans), [API](https://mljs.github.io/kmeans/); nếu không có native serializer sẽ thử portable centroids, phân biệt rõ |
| PCA | ml-pca 4.1.1 | MIT | [PCA và projection](https://github.com/mljs/pca), [API](https://mljs.github.io/pca/); kiểm getExplainedVariance/toJSON/load trong bản cài |
| Matrix cho adapter | ml-matrix 6.15.1 | MIT | [upstream](https://github.com/mljs/matrix); không coi Matrix dense là CSR sparse |
| Bundle local cho worker | esbuild 0.28.2 | MIT | [platform browser/bundling](https://esbuild.github.io/api/#platform); chỉ build harness, bundle vào .runtime, không CDN |

Các phiên bản/giấy phép từ npm registry được đối chiếu package.json/LICENSE sau cài và lưu manifest/hash. Tài liệu upstream hỗ trợ lựa chọn API, không thay phép kiểm. Chỉ cài trong experiments/g01, --save-exact, lockfile; không chạy script cài tùy package, không cài global. esbuild dùng platform binary optional dependency nếu có, kiểm build thực tế sau cài.

## Cổng thử nghiệm đã định trước

- Small fixtures + oracle, train-only leakage sentinel, seeded split/repeat, validation và roundtrip phải chạy trước scale.
- Cả 5 chạy worker trong Chrome/Edge và chạy lại khi offline sau precache local. Không có fetch bên ngoài khi test; ghi mọi request quan sát được.
- Sparse native: API dense không là bằng chứng sparse. Thử CSR riêng, không densify. Unsupported ghi blocked; guard rejection được đánh giá riêng, không tính là sparse solve passed.
- Model JSON + fitted preprocessing + feature/label mapping phải sang worker mới để load/predict; không so một instance với chính nó.
- Cancel phải chặn kết quả muộn và chấm dứt worker thực; không busy-loop giả thay thuật toán. Đo thời gian; worker memory nếu không đo đáng tin thì ghi inconclusive, không ước lượng thành số đo.
- Không Docker/MongoDB/email/AI/cloud. Chỉ thay file bên trong experiments/g01. Không ghi đè bằng chứng X01–X03. ADR X04 sẽ ghi kết quả chọn T, không sửa thiết kế P.
