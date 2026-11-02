# Prompt giao nhiệm vụ cho Agent — Thiết kế MongoDB và lưu trữ dữ liệu

**Đề tài:** Xây dựng hệ thống dashboard tương tác 3D quản lý và trực quan hóa toàn bộ quy trình khai phá dữ liệu.

**Ngôn ngữ:** Tiếng Việt. Giải thích thuật ngữ ngắn gọn, phù hợp người mới học database.

**Ngày cập nhật:** 02/11/2026.

**Trạng thái:** Prompt và đặc tả yêu cầu thiết kế, chưa phải schema đã triển khai hoặc báo cáo kiểm thử.

## 1. Vai trò, nhiệm vụ và tài liệu căn cứ

Bạn là kiến trúc sư dữ liệu và kỹ sư backend JS/TS phụ trách MongoDB, lưu trữ file và hợp đồng đồng bộ cho đề tài trên. Hãy tạo đặc tả đủ cụ thể để agent lập trình triển khai sau này.

Bản này cập nhật prompt MongoDB cũ trong cuộc trò chuyện, đối chiếu trực tiếp ba tệp:

1. `thiet_ke_chuc_nang_he_thong.md`: nghiệp vụ chung, tài khoản, dự án, nhiều dataset, phiên bản, thuật toán, AI, dashboard, PDF và xóa.
2. `thiet_ke_caynut_dieukien.md`: mã thao tác, điều kiện R/W/S/D/A và loại đầu ra.
3. `thiet_ke_offline.md`: chạy browser, lưu cục bộ, phiên đăng nhập, khóa nhiều tab, đồng bộ, xung đột và đăng xuất.

Tên tệp có thể được chuẩn hóa trong bộ tài liệu sau này; đối chiếu nội dung thực tế được cung cấp. Nếu thiếu tệp, nêu rõ phần chưa đối chiếu; không tuyên bố đã đọc. Không sửa ba tệp nguồn trong nhiệm vụ này.

Nhiệm vụ hiện tại là **thiết kế**, không tự sửa repository, cài database, tạo tài nguyên đám mây, chạy migration hoặc triển khai dịch vụ. Có thể đưa schema, payload và pseudocode minh họa vào đặc tả. Khi được giao triển khai riêng, đọc hướng dẫn repository trước.

Phân biệt rõ yêu cầu đã chốt, đề xuất kỹ thuật và điểm cần kiểm chứng. Với xung đột chưa giải quyết, chỉ rõ nguồn và tác động; không âm thầm thay yêu cầu.

## 2. Các thay đổi thay thế prompt MongoDB cũ

| Nội dung cũ | Yêu cầu hiện tại |
| --- | --- |
| Workspace ẩn danh, chưa bắt buộc đăng nhập | Bắt buộc đăng nhập để làm việc; tài nguyên thuộc tài khoản |
| Chưa rõ dự án và dataset | Một tài khoản có nhiều dự án; mỗi dự án có nhiều dataset và nhiều dashboard |
| Chưa xét offline | Browser lưu và chạy offline; MongoDB nằm trên máy chủ, không truy cập được khi mất mạng |
| Mặc định xử lý ở backend | Năm thuật toán bản đầu chạy trong browser cả online và offline |
| Chưa chốt kích thước | Mục tiêu kiểm thử khoảng 10.000–50.000 dòng, khoảng 50 cột đầu vào, 20 MB/tệp; kiểm tra riêng đầu ra phình lớn |
| Một phiên bản chỉ cần một nguồn | Biến đổi thông thường có cha; nối/ghép phải giữ tất cả phiên bản nguồn |
| Chỉ lưu kết quả toàn lần chạy | Lưu từng bước; lỗi bước sau vẫn giữ đầu ra bước trước đã commit |
| Chỉ lưu biểu đồ và mô hình | Bổ sung dashboard, báo cáo PDF, nguồn PCA, tiền xử lý đã fit và truy vết AI |
| Chưa có giao thức đồng bộ | ID ổn định, chống gửi trùng, snapshot, revision, xác nhận và nhánh xung đột |
| Xóa chưa xét thiết bị cũ | Xóa vĩnh viễn chỉ online; dấu vết xóa ngăn đồng bộ làm sống lại dữ liệu |
| Yêu cầu chuẩn bị mã khởi tạo ngay | Hiện chỉ đặc tả thiết kế; mã triển khai là nhiệm vụ riêng |

Giữ nguyên yêu cầu **JS/TS, tuyệt đối không dùng Python trong ứng dụng**, giữ file gốc, phiên bản bất biến và quyền quyết định của người dùng.

## 3. Ranh giới kiến trúc

1. Website truy cập qua link; người dùng không cài Node.js, MongoDB, Docker hoặc Nginx trên máy.
2. Backend và MongoDB chạy trên máy chủ. Browser chỉ gọi API đã xác thực; không có URI hoặc thông tin đăng nhập MongoDB ở frontend.
3. Browser dùng kho cục bộ và worker theo thiết kế offline. IndexedDB/Cache Storage không phải một bản MongoDB chạy trong browser.
4. Năm thuật toán bản đầu: Linear Regression, Logistic Regression, KNN phân lớp, K-Means và PCA, chạy trong browser khi đủ tài nguyên. Không buộc kết quả phải lên máy chủ mới công nhận lưu cục bộ thành công.
5. MongoDB lưu metadata, cấu hình, quan hệ, trạng thái và lịch sử. File nguồn, bảng phiên bản, mô hình, ma trận lớn, kết quả theo dòng và PDF nên lưu dạng artifact riêng theo chính sách thiết kế.
6. Không tạo một collection cho mỗi nút, mỗi cột hoặc mỗi phương pháp. Không nhúng dataset, vocabulary lớn, log hay toàn bộ lịch sử tăng không giới hạn trong một document.
7. Danh mục thao tác dùng chung cho giao diện, quy trình và AI. Lưu `operationId` và phiên bản schema cấu hình; không viết ba mô hình cấu hình khác nhau cho cùng một thao tác.
8. Ngoài các thuật toán bản đầu, chỉ thiết kế điểm mở rộng; không biến Decision Tree, Random Forest, DBSCAN, luật kết hợp hoặc dự đoán dữ liệu mới thành yêu cầu bắt buộc.

Luồng chính cần thể hiện trong sơ đồ:

**Browser/worker → commit cục bộ → hàng đợi đồng bộ → API xác thực → file staging → kiểm tra → commit metadata MongoDB → xác nhận máy chủ.**

AI là tích hợp online độc lập; không phải đường bắt buộc để xử lý, vẽ biểu đồ hoặc xuất PDF.

## 4. Tài khoản, phiên và quyền sở hữu

- Ai có link cũng mở được website, nhưng phải đăng nhập để làm việc với dữ liệu.
- Không chia sẻ, cộng tác hay phân vai admin/editor/viewer. Mọi API vẫn kiểm tra quyền sở hữu.
- Nhà cung cấp và phương thức xác thực chưa chốt. Thiết kế ánh xạ danh tính ngoài với tài khoản nội bộ; không mặc định phải tự lưu mật khẩu trong MongoDB.
- Một tài khoản chỉ có một phiên trực tuyến hợp lệ trên một máy tại một thời điểm. Đăng nhập máy B thu hồi phiên máy A; các tab cùng browser profile dùng chung phiên.
- Thu hồi phải có hiệu lực khi kiểm tra và commit API, kể cả upload đã bắt đầu trước khi phiên bị thu hồi. Không chỉ kiểm tra một lần lúc bắt đầu tác vụ dài.
- Máy offline vẫn làm việc theo quyền offline đã ghi nhận; khi trở lại phải xác thực đúng tài khoản trước đồng bộ. Không xóa dữ liệu cục bộ vì phiên hết hạn hoặc bị thu hồi.
- Đăng xuất offline không còn thay đổi chờ: xóa dữ liệu tài khoản cục bộ, giữ yêu cầu tối thiểu thu hồi đúng phiên cũ khi có mạng. Không thu hồi nhầm phiên mới.

Agent phải thiết kế session generation/epoch hoặc cách tương đương để request cũ không commit sau logout/đổi phiên. Việc kiểm tra tính hợp lệ ở tầng ứng dụng không được chỉ dựa vào TTL tự dọn bản ghi.

Mọi đối tượng dự án cần xác định được `ownerId`, `projectId` và phạm vi tài nguyên. Nếu lặp các trường này để truy vấn nhanh, phải kiểm tra chúng nhất quán với đối tượng cha. Không tin `ownerId` do client gửi; lấy tài khoản từ phiên máy chủ.

## 5. Đối tượng nghiệp vụ và nhóm collection đề xuất

Tên dưới đây là điểm xuất phát; agent có thể gộp/tách với lý do về truy vấn, kích thước, cập nhật và tính nhất quán. Những đối tượng cần hỗ trợ không nhất thiết tương ứng một collection riêng.

| Nhóm đề xuất | Nội dung tối thiểu |
| --- | --- |
| `users` | Danh tính nội bộ, ánh xạ provider, trạng thái tài khoản và mốc phiên hiện hành |
| `sessions` | Phiên/thiết bị, hạn dùng, thu hồi; không lưu token nguyên văn không cần thiết |
| `projects` | Chủ sở hữu, tên, revision, thông tin phục vụ mở dự án |
| `datasets` | Dự án, tên, loại imported/derived, file gốc nếu có, V0, nhánh và phiên bản đang làm việc |
| `dataset_versions` | Nội dung bất biến, artifact bảng, schema cột, nguồn, thao tác, run/step tạo ra nó |
| `dataset_branches` | Dataset, điểm tách nhánh, đầu nhánh và lý do tạo, nếu dùng collection riêng |
| `workflows` | Cấu hình có revision, các bước, operationId, tham số và yêu cầu ánh xạ cột |
| `workflow_runs` | Snapshot đầu vào/cấu hình, nơi thực thi, trạng thái tổng, thời gian và lần chạy trước nếu chạy tiếp |
| `run_steps` | Thứ tự, snapshot thao tác, đầu vào/đầu ra, trạng thái, lỗi/cảnh báo; có thể nhúng nếu giới hạn rõ |
| `charts` | Loại, cấu hình, phiên bản hoặc artifact nguồn, lấy mẫu và tham chiếu cột |
| `dashboards` | Các chart tham chiếu, thứ tự/bố cục, revision |
| `models` | Thuật toán, serializer, tham số, nguồn, split, pipeline đã fit, metric và artifact |
| `reports` | Nội dung PDF đã lưu, snapshot nguồn, các phần được chọn và artifact; không bắt lưu mọi lần tải |
| `artifacts` | File hoặc đối tượng lưu trữ, hash, kích thước, định dạng, vòng đời, nguồn và quyền sở hữu |
| Nhóm đồng bộ | Batch, mutation chống gửi trùng, revision/cursor và xác nhận; thiết kế gọn, có chính sách lưu giữ |
| Nhóm xóa | Dấu vết xóa và trạng thái dọn tài nguyên tối thiểu để chống phục hồi từ client cũ |
| Truy vết AI | Đề xuất, duyệt và thay đổi đã áp dụng; có thể nhúng vào snapshot thao tác hoặc lưu riêng có giới hạn |

Nếu giữ tên `workspace`, phải định nghĩa chính xác ánh xạ với tài khoản/dự án và lý do cần thêm. Không dùng workspace ẩn danh thay cho tài khoản đã chốt.

Với mỗi collection cuối cùng, agent phải bàn giao bảng trường: tên, kiểu, bắt buộc, mặc định, giới hạn kích thước, validation, bất biến/có thể sửa, index, tham chiếu, chính sách xóa và ví dụ document nhất quán.

## 6. ID, revision và schema dùng chung online/offline

- ID phải tạo được khi offline và ổn định sau đồng bộ; không thay ID rồi làm hỏng tham chiếu. Đề xuất một quy ước nhất quán như UUID dạng chuỗi cho đối tượng đồng bộ, hoặc quy ước khác có giải thích.
- Nếu dùng ObjectId/BSON UUID, đặc tả rõ biểu diễn trong TypeScript, JSON API và kho browser; không trộn tùy ý chuỗi/ObjectId của cùng một khóa.
- Số V0/V1/... chỉ phục vụ trình bày, không làm định danh toàn cục hoặc khóa chống gửi trùng. Hai nhánh có thể phát sinh đồng thời; không phụ thuộc bộ đếm máy chủ để tạo phiên bản offline.
- Có `schemaVersion` cho payload/đối tượng cần migration, `configVersion`/phiên bản operation và phiên bản thư viện xử lý khi cần tái hiện.
- Phân biệt thời gian client cung cấp và thời gian máy chủ ghi nhận. Không dùng đồng hồ client để quyết định ghi đè, thứ tự đồng bộ hoặc quyền ưu tiên.
- Revision dùng cho kiểm soát cập nhật đồng thời; cursor dùng để phân trang/đọc thay đổi nếu chọn cách đó. Định nghĩa rõ chúng khác thời gian và số phiên bản hiển thị.
- Tách trạng thái lưu cục bộ, trạng thái đồng bộ, trạng thái xử lý, xác thực và sẵn sàng offline. Máy chủ không biết mọi thay đổi chưa được gửi từ browser.

## 7. Tệp nguồn, V0 và cấu trúc bảng

### 7.1. Nhập dữ liệu

- Chỉ nhập CSV/JSON mới khi online và máy chủ truy cập được, phiên hợp lệ. Mỗi tệp tạo dataset mới; không thay file nguồn hay nối ngầm vào dataset cũ.
- Lưu byte tệp nguồn bất biến và cấu hình đọc. **Tệp nguồn khác V0:** V0 là bảng đã parse và được chấp nhận.
- CSV lưu delimiter, encoding, header và chính sách lỗi được duyệt. Không âm thầm bỏ dòng lỗi.
- JSON lưu đường dẫn danh sách bản ghi, cách flatten object, ánh xạ đường dẫn–cột và cách xử lý mảng. Bản đầu không tự bung mảng thành dòng.
- Dataset dẫn xuất từ nối/ghép có V0 riêng nhưng không giả tạo một file người dùng đã tải lên; các file nguồn nằm ở các dataset nguồn.
- Tệp hỏng/rỗng/vượt giới hạn hoặc lưu chưa đủ không được trở thành dataset thành công.

### 7.2. Schema và định dạng dữ liệu xử lý

Agent phải đề xuất định dạng bảng phiên bản và hợp đồng serializer JS/TS: kiểu cột, null, ngày, boolean, số lớn/độ chính xác nếu hỗ trợ, giá trị không hữu hạn và encoding. Không mặc định JSON biểu diễn được mọi giá trị tính toán mà không mất thông tin.

Mỗi cột cần định danh ổn định hoặc cơ chế ánh xạ tương đương, tên hiển thị, kiểu và lineage khi cần. Quy định đổi tên, tách/gộp, one-hot, TF-IDF và cột tạo mới; lưu snapshot schema đúng phiên bản. Tên cột có dấu chấm hoặc ký tự đặc biệt không nên trở thành đường dẫn cập nhật MongoDB trực tiếp.

Giữ tham chiếu dòng gốc cho kết quả theo điểm/dòng, lọc/sắp xếp, PCA và scatter 3D. Với join, một dòng đầu ra có thể liên quan nhiều dòng nguồn; có thể lưu mapping lớn thành artifact. Không dùng chỉ số dòng hiện đang hiển thị làm định danh ổn định.

Mục tiêu kiểm thử đầu vào khoảng 10.000–50.000 dòng, khoảng 50 cột, 20 MB/tệp. Đề xuất cấu hình giới hạn sau parse/join/encoding/TF-IDF, artifact và bộ nhớ worker. Không coi 50 cột là giới hạn đã chốt cho ma trận đặc trưng.

## 8. Phiên bản, nhánh và nguồn dữ liệu

- Mỗi biến đổi thành công tạo phiên bản hoàn chỉnh mới. Nội dung, nguồn và cấu hình tạo phiên bản đã commit là bất biến.
- Thao tác chỉ xem, phát hiện chất lượng, thống kê, lọc bảng để xem, chọn đặc trưng cho mô hình hoặc sửa cấu hình không tự tạo dataset version.
- `parentVersionId` biểu diễn quan hệ trước đó trong cùng dataset nếu có. `sourceVersions[]` hoặc cấu trúc tương đương biểu diễn đầy đủ nguồn xuyên dataset của nối/ghép. Phân biệt hai vai trò; không ép mọi phiên bản có một cha duy nhất.
- Hoàn tác/chọn lại bản làm việc là thay con trỏ có revision và có lịch sử phù hợp; không sửa/xóa nội dung phiên bản. Xử lý tiếp từ bản cũ tạo nhánh mới.
- Nối dòng và join phải lưu thứ tự nguồn, phiên bản chính xác, ánh xạ cột, khóa, loại join, chính sách null/trùng/xung đột tên và operation snapshot.
- **Đề xuất chưa chốt riêng:** nối/ghép tạo dataset dẫn xuất mới, chỉ online; bản đầu inner/left join. Giữ nhãn đề xuất, không tự biến thành yêu cầu đã duyệt.
- Biểu đồ/mô hình cũ vẫn trỏ nguồn cũ. Không tự cập nhật theo `currentVersionId` khi nguồn thay đổi.
- Khi đồng bộ xung đột, giữ nội dung cục bộ thành nhánh riêng; không ghi đè nhánh máy chủ hoặc tự đổi nhánh đang dùng của máy chủ. Trả thông tin để người dùng chọn.

Agent phải minh họa ít nhất: V0 → V1 → V2, hoàn tác về V1 rồi tạo V3; join hai nguồn; hai thiết bị phát sinh nhánh khác nhau.

## 9. Quy trình, lần chạy và commit từng bước

- Hỗ trợ thao tác đơn và quy trình nhiều bước. Snapshot gồm owner/project, các version nguồn, ánh xạ cột, operationId/configVersion, tham số, seed/split nếu có, nơi thực thi và quyền/revision tại thời điểm chạy.
- Sửa workflow không sửa snapshot lịch sử. Chạy tiếp sau lỗi là lượt mới có `resumesRunId`/`resumesStepId` hoặc tương đương, không sửa lại lịch sử đã xảy ra.
- Run có thể cập nhật vòng đời; đầu vào/cấu hình đã khóa và đầu ra bước đã commit không được viết lại. Giới hạn kích thước log/cảnh báo; chi tiết lớn lưu phân trang hoặc artifact.
- Mỗi bước biến đổi thành công commit một version riêng. Nếu bước 3 lỗi/hủy, giữ kết quả bước 1–2 và không chạy bước 4. Run tổng thể phản ánh thất bại/hủy sau một phần hoàn thành, không rollback ngầm toàn quy trình.
- Loại đầu ra phù hợp cây nút: `view`, `version`, `artifact`, `config`, `control`. Không ép PCA/huấn luyện/thống kê thành phiên bản bảng.
- PCA mặc định tạo artifact tọa độ/phương sai; áp dụng tọa độ thành dataset version là thao tác khác có xác nhận.
- Preview lưu tạm có hạn nếu cần, không đổi con trỏ. Đổi form/nguồn làm mất hiệu lực preview cũ.
- Đóng tab/refresh hủy phần chưa hoàn tất; mở lại đánh dấu phần dở là gián đoạn và phục hồi commit gần nhất. Chuyển tab hoặc mất mạng không tự hủy worker browser.
- Tác vụ server mở rộng phải có cancel/lease/timeout, kiểm tra quyền và từ chối commit kết quả muộn. Không hứa nhận sự kiện đóng tab tức thời hoặc chạy tiếp nền sau đóng tab.

Đặc tả bảng chuyển trạng thái run/step và trạng thái lưu riêng. Không dùng một trường `completed` để đồng thời khẳng định đã tính xong, đã lưu trên máy và đã đồng bộ.

## 10. Mô hình, đánh giá và tiền xử lý đã fit

- Năm thuật toán browser theo mục 3; PCA là giảm chiều, K-Means là phân cụm, không bắt có nhãn hay split supervised.
- Với supervised: lưu nguồn, đặc trưng, nhãn, train/test, seed, stratify nếu có và cách tái hiện split. Seed đơn lẻ không đủ nếu thứ tự hàng hoặc phiên bản thư viện đã đổi; có thể lưu mapping row ID/split thành artifact.
- Lưu pipeline đã fit trên train: tham số điền missing, scaler, mapping encoding/unknown, vocabulary/IDF, PCA và thứ tự đặc trưng nếu có. Fit trung gian train/test không tự thành phiên bản đầy đủ dataset.
- Ghi phạm vi fit (`train` hay toàn dữ liệu), nguồn và cảnh báo rò rỉ từ các bước trước. Không cho rằng split sau tiền xử lý toàn bộ dữ liệu tự khắc phục rò rỉ.
- Metric phải có tên, giá trị, tập đánh giá, cách tổng hợp đa lớp hoặc tham số liên quan. Không tính được thì lưu trạng thái/lý do, không dùng số 0 giả hay giá trị NaN gây mất thông tin khi serialize.
- K-Means lưu nhãn/tâm/kích thước cụm; PCA lưu phương sai giải thích/tích lũy và tọa độ gắn row ID. Kết quả lớn là artifact.
- So sánh run phải đọc được nguồn, split, pipeline, đặc trưng và phiên bản thư viện; cảnh báo khi khác điều kiện.
- Lưu định dạng serializer và phiên bản, thư viện/runtime tương thích, file mô hình cùng tiền xử lý đủ để tải. Không mặc định dùng pickle hoặc định dạng chỉ dành cho Python.
- Bản đầu chỉ xem kết quả và tải mô hình; không thêm endpoint dự đoán trên mẫu/tệp mới thành bắt buộc.

## 11. Biểu đồ, dashboard, PDF và AI

### 11.1. Biểu đồ và dashboard

Hỗ trợ Histogram, Box, Bar dọc/ngang, Line, Scatter, Heatmap tương quan, Pie/Donut và Scatter 3D theo điều kiện cây nút. Lưu loại, cấu hình trục/nhóm/phép gộp/bins/Top N/missing, cột, version hoặc result artifact chính xác, cấu hình lấy mẫu nếu có và phiên bản renderer/config khi cần.

Một dự án có nhiều dashboard; dashboard tham chiếu chart và thứ tự/bố cục. Gỡ chart khỏi dashboard không xóa chart nguồn. Chart có thể được dùng ở nhiều dashboard; chính sách xóa chart phải xử lý tham chiếu rõ ràng. Không bắt buộc kéo thả.

Đổi nguồn chart là hành động chủ động có validation; lỗi giữ nguồn/config cũ. Scatter 3D từ PCA phải lưu nguồn tọa độ, component và phương sai giải thích. Góc nhìn chỉ lưu khi chọn lưu cấu hình, không ghi MongoDB mỗi lần xoay chuột.

### 11.2. Báo cáo

PDF gồm các phần người dùng chọn, tham chiếu chính xác version/run/chart/model, kết luận người dùng hoặc AI đã duyệt, thời điểm và artifact PDF nếu chọn lưu vào dự án. Phân biệt tạo/tải PDF với lưu báo cáo. Font/tài nguyên xuất có bản offline; không bắt gọi server/AI để tạo PDF từ tài nguyên đã có.

### 11.3. Truy vết AI

AI chỉ gợi ý, không tự thực thi. Chấp nhận cấu hình chưa tạo version; áp dụng thay đổi đã duyệt mới tạo version theo operation chuẩn.

Lưu metadata tối thiểu cần truy vết: loại đề xuất, version nguồn, operation/cột liên quan, provider/model nếu biết, trạng thái duyệt và liên kết run/step đã áp dụng. Với giá trị văn bản do AI điền, lưu nguồn AI và phạm vi được chấp nhận; có thể giữ missing khi thiếu căn cứ.

Mặc định gửi schema/thống kê tổng hợp. Nếu gửi nội dung từng dòng, phải hiển thị và nhận đồng ý cho đúng payload trước; có thể lưu hash/phạm vi và thời điểm đồng ý thay vì sao chép dữ liệu nhạy cảm vào log. Không dùng hash như bằng chứng dữ liệu đúng. Không lưu bí mật đăng nhập hoặc toàn bộ prompt/dataset mặc định.

## 12. Giao thức đồng bộ bắt buộc

### 12.1. Trách nhiệm hai phía

- Client giữ kho cục bộ và outbox bền vững. MongoDB chỉ giữ những thay đổi máy chủ đã nhận; không thay outbox bằng một hàng đợi server rồi coi offline đã được giải quyết.
- Online liên tục: commit cục bộ trước, sau đó tự đồng bộ.
- Sau mất mạng: đợi người dùng bấm “Đồng bộ ngay”; các tab dùng chung trạng thái chờ. Thành công mới bật lại tự đồng bộ tới lần mất mạng tiếp theo.
- Xác thực đúng tài khoản trước gửi. Đồng bộ lỗi giữ dữ liệu/hàng đợi; không tự đánh dấu đã đồng bộ hoặc bật tự gửi hậu mất mạng.
- Snapshot lượt đồng bộ chỉ gồm đối tượng hoàn chỉnh tại điểm chụp. Kết quả mới phát sinh sau đó thuộc lượt tiếp theo, không được xác nhận nhầm.

### 12.2. Payload và xử lý phía máy chủ

Đề xuất hợp đồng gồm `batchId`, `mutationId`, device/client ID, schemaVersion, base revision, đối tượng/nguồn liên quan, danh mục artifact và hash. Session lấy từ xác thực; ID thiết bị không phải quyền truy cập.

Thứ tự xử lý phải bảo đảm:

1. Kiểm tra phiên, chủ sở hữu, trạng thái xóa và giới hạn.
2. Nhận file staging, hỗ trợ gửi lại/chia khối theo mức phù hợp; kiểm tra hash, kích thước và định dạng.
3. Kiểm tra tham chiếu cùng tài khoản/dự án, nguồn đầy đủ và quan hệ phiên bản hợp lệ.
4. Kiểm tra revision; nếu xung đột, lưu nhánh riêng theo chính sách bên dưới.
5. Commit metadata/đầu nhánh và receipt chống gửi trùng nhất quán; chỉ công bố khi artifact sẵn sàng.
6. Trả ACK liệt kê chính xác mutation/object/artifact đã commit và revision/cursor mới.

Mất phản hồi sau commit rồi gửi lại phải trả kết quả tương đương, không tạo thêm version/model/chart logic. Cùng mutationId nhưng nội dung khác phải bị từ chối, không coi là retry hợp lệ.

Có thể commit theo mutation/nhóm phụ thuộc thay vì giữ transaction cho toàn bộ lịch sử lớn. Phải định nghĩa partial ACK và trạng thái batch; không báo cả batch thành công khi còn phần thiếu. Không giữ transaction database trong lúc chờ upload hoặc chạy thuật toán.

### 12.3. Xung đột

- Không dùng last-write-wins dựa timestamp client. Dùng base revision và kiểm soát cập nhật đồng thời.
- Nếu server đã thay đổi, giữ đầu ra cục bộ thành nhánh riêng; không tự gộp hoặc ghi đè.
- Không phải mọi xung đột là bảng dữ liệu: agent phải đặc tả cách giữ bản cấu hình cạnh tranh của workflow/chart/dashboard/trạng thái mở dự án trong nhánh hoặc bản sao xung đột, đủ để người dùng chọn.
- Nếu phía server đã xóa tài nguyên, không tạo nhánh làm sống lại nó. Trả lỗi đã xóa, giữ bản cục bộ theo chính sách xử lý của offline; không tự gửi dưới ID mới.
- Giới hạn lưu receipt/cursor phải an toàn với client offline lâu. Nếu đã dọn lịch sử cần để retry, yêu cầu đối chiếu lại manifest/full resync phù hợp; không xem client cũ là chưa từng đồng bộ rồi chấp nhận lại tùy ý.

## 13. Chuẩn bị offline, nhiều tab và mở lại

- Mở dự án thông thường không tải toàn bộ lịch sử. API cần phân trang/lấy tài nguyên theo yêu cầu.
- Tự giữ file gốc, version hiện tại và tài nguyên liên quan; mọi version mới phát sinh trên máy phải được giữ, kể cả chưa đồng bộ.
- “Lưu để dùng offline” tải toàn bộ tài nguyên dự án tại một snapshot: file gốc, mọi version hoàn thành, workflow/run/step, chart/dashboard, model/metric và tài nguyên thực thi cần thiết.
- Agent phải thiết kế project resource manifest có revision/snapshot, danh sách tham chiếu, kích thước/hash và đường lấy file được kiểm soát. Tài nguyên ứng dụng công khai tách với tài nguyên riêng tài khoản.
- Tính đầy đủ phải kiểm tra ở thiết bị: server không tự khẳng định browser còn đủ file chỉ vì đã tải trước đây. Snapshot thay đổi phải đánh giá lại trạng thái, không đánh dấu tải dở là sẵn sàng.
- Có thể lưu thông tin chuẩn bị theo thiết bị để hỗ trợ, nhưng đó không phải bằng chứng mọi byte còn trên máy. URL tải hết hạn không được làm định danh bền vững của artifact.
- Lưu trạng thái mở lại: dataset/version/branch, dashboard/màn hình hợp lệ. Tách trạng thái cục bộ theo thiết bị khỏi trạng thái đã đồng bộ để bản server cũ không ghi đè tiến độ chưa đồng bộ.
- Một project chỉ có một tab writer; khóa browser do module offline quản lý. Khóa local không thay validation API, revision hoặc kiểm tra phiên máy chủ.
- Chuyển quyền phải dừng writer cũ trước writer mới; kết quả muộn không commit vào nguồn khác hoặc sau logout. Nếu dùng lease/fencing cho server, ghi rõ phạm vi, không tuyên bố khóa server ngăn tức thời một thiết bị offline.

## 14. Lưu trữ file và tính nhất quán

- Đề xuất object storage và lớp adapter độc lập nhà cung cấp; có thể dùng ổ đĩa bền vững khi phù hợp triển khai. Không dựa vào ổ đĩa tạm của dịch vụ hosting.
- Ưu tiên gói miễn phí, nhưng chưa chốt nhà cung cấp. Nếu lựa chọn cụ thể, kiểm tra tài liệu chính thức hiện hành về dung lượng, băng thông, giới hạn đối tượng, tính riêng tư và chi phí; ghi ngày/nguồn. Không hứa miễn phí vĩnh viễn.
- Artifact có ID ổn định, storage key nội bộ, hash, size, MIME/định dạng thực, trạng thái staging/ready/deleting hoặc tương đương, chủ sở hữu và tham chiếu nguồn.
- File riêng tư; tải qua API hoặc URL tạm sau kiểm tra quyền. Không trả storage key như bằng chứng quyền hoặc công khai bucket dữ liệu.
- Database transaction không bao trùm object storage. Đề xuất staging → kiểm tra → commit metadata → dọn phần thừa, có retry và xử lý crash ở mọi ranh giới.
- Xác minh artifact tồn tại/đủ trước công bố version. Dọn orphan phải có khoảng an toàn, kiểm tra tham chiếu và upload đang hoạt động; không xóa nhầm file còn được nhiều version sử dụng.
- Có quota/tổng dung lượng theo tài khoản/dự án phù hợp, phân biệt giới hạn upload với kích thước sau parse và dung lượng tất cả phiên bản.
- Backup/restore phải bao phủ metadata và artifact nhất quán; mô tả phát hiện thiếu file sau khôi phục. Không coi chỉ backup MongoDB là đã backup dữ liệu đầy đủ.

## 15. Xóa vĩnh viễn, dấu vết xóa và đăng xuất

### 15.1. Xóa dự án/dataset

- Chỉ khi máy chủ truy cập được, phiên hợp lệ, quyền đúng và đã xác nhận phạm vi. Không xóa offline, không có thùng rác.
- Hiện file gốc, version, artifact và phụ thuộc. **Đề xuất:** chặn xóa dataset khi còn phụ thuộc ngoài phạm vi; không cascade sang dataset nguồn/dẫn xuất khác âm thầm.
- Tác vụ đang chạy/thay đổi chưa đồng bộ phải được giải quyết rõ; không ngầm bỏ thay đổi.
- Chặn ghi mới và ghi dấu vết xóa trước khi dọn file/metadata. Tiến trình xóa nhiều tài nguyên phải thử lại được; API không báo đã dọn xong vật lý nếu còn đang dọn.
- Dấu vết tối thiểu gồm chủ sở hữu/phạm vi, ID đối tượng, revision/generation và thời điểm cần thiết, không phải bản dữ liệu để khôi phục. Kiểm tra xóa project khi nhận mutation cho đối tượng con.
- Thiết kế thời hạn dấu vết/cursor để thiết bị offline lâu không khôi phục dữ liệu. Nếu dọn dấu vết, dùng cơ chế generation hoặc bắt đối chiếu lại đủ an toàn; không TTL tùy tiện rồi cho phép upsert đối tượng cũ.
- Không xóa artifact còn tham chiếu hợp lệ ngoài phạm vi. Khóa/chính sách đồng thời phải tránh thao tác mới tạo phụ thuộc trong lúc kiểm tra và xóa.

### 15.2. Đăng xuất

Giữ nguyên bảng hành vi trong file offline:

| Tình huống | Hành vi |
| --- | --- |
| Offline, còn thay đổi chờ | Chặn đăng xuất, có Hủy |
| Offline, không còn thay đổi chờ | Xóa dữ liệu tài khoản cục bộ; thu hồi đúng phiên cũ khi có mạng |
| Online, còn thay đổi chờ | “Đồng bộ rồi đăng xuất”, “Vẫn đăng xuất”, “Hủy” |
| Đồng bộ rồi đăng xuất bị lỗi | Giữ dữ liệu và trạng thái làm việc |
| Chọn Vẫn đăng xuất | Xác nhận mất thay đổi chưa đồng bộ, xóa dữ liệu tài khoản cục bộ |
| Online, không còn thay đổi chờ | Đăng xuất và xóa dữ liệu tài khoản cục bộ |

Đăng xuất áp dụng mọi tab, hủy worker và chặn request/kết quả cũ ghi trở lại. Không xóa tài nguyên đã đồng bộ trên server. Xác định ranh giới: mutation đã commit trước thu hồi có thể đã tồn tại; mutation commit sau thu hồi phải bị chặn. Không hứa request đang bay luôn bị thu hồi khỏi mạng tức thời.

## 16. Validation, index và migration

Agent phải đề xuất validation ở API, nghiệp vụ và MongoDB; nêu rõ MongoDB không tự kiểm tra đầy đủ quan hệ xuyên collection. Chỉ cho cập nhật trường được phép; không chuyển JSON/filter tùy ý của người dùng thành toán tử database.

Các nhóm index cần đánh giá theo query thực tế:

- Chủ sở hữu + cập nhật gần nhất cho danh sách dự án.
- Chủ sở hữu + project + loại tài nguyên cho truy vấn có phạm vi.
- Dataset + nhánh + quan hệ/version để liệt kê lịch sử có phân trang.
- Project + thời điểm máy chủ/ID cho lịch sử run, run + thứ tự step.
- Danh tính provider duy nhất; session theo owner/status và thời hạn khi phù hợp.
- Khóa chống gửi trùng theo owner + mutationId và batch/mutation relation.
- ID dấu vết xóa theo phạm vi owner/project/resource; revision/cursor nếu dùng.
- Artifact và nguồn/tham chiếu để kiểm tra phụ thuộc, dọn file an toàn.

Nêu field, unique/partial/TTL nếu có, lý do và trade-off cho từng index; không tạo index cho mọi trường. Trường tùy chọn trong unique index phải xử lý null/thiếu đúng mục đích. Không coi tên dataset, số V hoặc hash file là duy nhất toàn hệ thống.

Thiết kế migration schema và tương thích client cũ: reject/upgrade rõ khi payload không tương thích, không tự xóa outbox hoặc bản offline chưa gửi. Không chạy migration phá hủy dữ liệu như một bước tự động trong nhiệm vụ thiết kế.

Nếu đề xuất transaction MongoDB, phải ghi điều kiện deployment cần có và phương án chạy môi trường phát triển phù hợp; không mặc định mọi MongoDB standalone đều hỗ trợ cùng khả năng. Chọn driver/Mongoose và phiên bản cụ thể chỉ sau khi kiểm tra tài liệu chính thức nếu cần chốt.

## 17. Hợp đồng API cần bàn giao

Đề xuất method/path, request/response, quyền, giới hạn, chống gửi trùng và lỗi cho các nhóm:

1. Kiểm tra phiên, đăng nhập theo provider được chọn, thu hồi đúng phiên.
2. Tạo/liệt kê/mở/đổi tên dự án; lấy manifest snapshot và thay đổi có phân trang.
3. Nhập file, tạo dataset + V0 sau khi đủ tài nguyên; tải artifact có quyền.
4. Xem dataset/version/nhánh, đổi version đang làm việc bằng revision phù hợp.
5. Lưu workflow, chart, dashboard, model, báo cáo và trạng thái mở lại được đồng bộ.
6. Tạo sync batch, khai báo/upload artifact, commit mutation, query receipt và ACK.
7. Xem nhánh/bản cấu hình xung đột; chọn nguồn làm việc có kiểm tra revision.
8. Xem lịch sử run/step và thông tin hủy server task nếu thực tế có.
9. Xem phụ thuộc trước xóa, xác nhận xóa online và xem tiến độ dọn.

Các endpoint dữ liệu phải phân biệt thiếu xác thực, phiên bị thu hồi, sai quyền, đã xóa, revision conflict, thiếu artifact, payload không tương thích và vượt giới hạn. Mã lỗi nên ổn định để frontend/offline xử lý. Không cần triển khai thuật toán trên backend chỉ để có endpoint chạy cho năm thuật toán browser.

Mọi trường client báo cáo về kết quả tính toán phải được kiểm tra cấu trúc, nguồn và phạm vi. Máy chủ lưu kết quả client gửi không đồng nghĩa đã tự tính lại hoặc chứng minh metric đúng; thể hiện nguồn thực thi trung thực.

## 18. Sản phẩm thiết kế phải bàn giao

1. Bảng yêu cầu đã chốt, đề xuất và điểm chưa xác minh; bảng thay đổi so với prompt cũ.
2. Sơ đồ kiến trúc và quan hệ bằng Mermaid, phân biệt browser/metadata server/file storage.
3. Danh sách collection cuối cùng, lý do nhúng/tham chiếu và bảng trường chi tiết.
4. Ví dụ document liên kết nhất quán: tài khoản → dự án → hai dataset → V0/biến đổi/join → run/step → chart/dashboard/model/report; có retry, nhánh xung đột và dấu vết xóa.
5. Quy ước ID/revision/time/schema và ánh xạ TypeScript–API–MongoDB–kho browser.
6. State machine hoặc bảng trạng thái cho run/step, artifact, sync batch/mutation và xóa.
7. Pseudocode lưu phiên bản, commit step, hoàn tác/tạo nhánh, sync retry/conflict, kiểm tra phiên lúc commit và xóa an toàn.
8. Index, validation, migration, quota, dọn file và backup/restore.
9. Hợp đồng API tích hợp với frontend/backend/offline, không tự thay hợp đồng đã chốt ở ba nguồn.
10. Ma trận nghiệm thu có bước thực hiện, kết quả mong đợi và bằng chứng dữ liệu cần quan sát.

Chỉ cung cấp code TypeScript/schema minh họa trong tài liệu nếu giúp làm rõ. Script khởi tạo, model triển khai và migration thực tế sẽ thực hiện khi có nhiệm vụ riêng.

## 19. Ma trận đối chiếu và nghiệm thu tối thiểu

| Mã | Tình huống phải đặc tả | Bằng chứng mong đợi |
| --- | --- | --- |
| DB01 | Hai file nhập vào một project | Hai dataset, byte nguồn/V0 và lịch sử riêng; AC01–03 |
| DB02 | JSON flatten, giữ mảng theo lựa chọn | Có parse config/mapping, không tự nhân dòng; AC02 |
| DB03 | Xóa HTML rồi điền thiếu | Hai version riêng và snapshot đúng; AC05, AC08–11 |
| DB04 | Preview/lọc xem/đổi biểu mẫu | Không tạo version; preview cũ không áp dụng nhầm |
| DB05 | Nối/ghép hai nguồn | Giữ tất cả nguồn, cấu hình khóa và lineage; AC04 |
| DB06 | Pipeline lỗi/hủy ở bước 3 | Giữ commit bước 1–2, không tạo version dở; AC06–07 |
| DB07 | Hoàn tác rồi làm tiếp | Có nhánh mới, không xóa V mới hơn; AC23 |
| DB08 | Browser chạy rồi mất mạng/refresh | Mất mạng tiếp tục, refresh chỉ phục hồi commit; AC19, AC21 |
| DB09 | Tạo V6–V8 offline rồi mở lại | Giữ đủ dữ liệu cục bộ; server chưa nhận không được báo đã đồng bộ |
| DB10 | Có mạng lại, tab khác cũng mở | Chờ chủ động đồng bộ, không tab nào vượt trạng thái chờ; AC20, AC22 |
| DB11 | Sync khi bước khác đang chạy | ACK đúng snapshot; kết quả mới còn chờ |
| DB12 | Server commit nhưng mất ACK | Retry không trùng; cùng mutationId khác payload bị từ chối; AC24 |
| DB13 | Server và local cùng thay đổi | Giữ hai nhánh, cả cấu hình cạnh tranh nếu có; AC24 |
| DB14 | Phiên bị thu hồi giữa upload/commit | Không commit bằng phiên cũ; dữ liệu local được giữ; AC28, AC30 |
| DB15 | Hai tab/chuyển writer | Không ghi kép, kết quả muộn không đổi sai nguồn; AC22 |
| DB16 | Tải offline toàn dự án bị gián đoạn | Manifest không báo đầy đủ giả; tải lại theo tham chiếu/hash |
| DB17 | Biểu đồ cũ và dashboard | Version mới không tự đổi nguồn; gỡ chart không xóa nguồn; AC17 |
| DB18 | Huấn luyện, K-Means và PCA | Split/fit đúng loại, metric có lý do khi thiếu, artifact có row lineage; AC12–13 |
| DB19 | AI gợi ý và điền văn bản | Không đổi dữ liệu trước duyệt; truy vết đúng nội dung được chấp nhận; AC14–16 |
| DB20 | PDF chọn phần, xuất offline | Đúng nguồn/metric/font; tải không bắt lưu report; AC18 |
| DB21 | Xóa offline/server lỗi/còn phụ thuộc | Chặn hoặc xử lý đúng phạm vi, không cascade ngầm; AC25–26 |
| DB22 | Thiết bị offline gửi sau xóa | Không tái sinh project/dataset/con của nó; AC27 |
| DB23 | Logout theo mọi nhánh | Không xóa server data, request cũ không ghi lại; AC28 |
| DB24 | Lưu hết quota/upload hỏng/crash | Giữ commit trước, không có version ready trỏ file thiếu; AC29 |
| DB25 | Tài khoản khác đoán ID/tham chiếu/file | API từ chối, không rò rỉ hoặc nhận sync sai chủ; AC30 |
| DB26 | Client cũ, receipt/cursor hết hạn | Đối chiếu lại an toàn, không mất outbox hoặc phục hồi đối tượng đã xóa |
| DB27 | Restore metadata và file | Phát hiện thiếu/mismatch, không tuyên bố dữ liệu đầy đủ giả |

Đối chiếu thêm toàn bộ AC01–AC30 của tài liệu chức năng và tiêu chí file offline. Đây là kế hoạch kiểm thử cho giai đoạn triển khai, không tuyên bố đã chạy test chỉ vì đã hoàn thành đặc tả.

## 20. Giới hạn phạm vi và tiêu chí chất lượng

- Không mở rộng sang desktop, server cài tại máy người dùng, chia sẻ/cộng tác, nhập Excel/database nguồn, gói xuất/nhập toàn dự án hoặc dự đoán mới như yêu cầu bắt buộc.
- Không tự bỏ các phương pháp tiền xử lý đã chốt; mô hình dữ liệu phải lưu được cấu hình và tham số fit của chúng mà không hardcode theo một lĩnh vực/tên cột.
- Không yêu cầu người dùng quyết định chi tiết kỹ thuật thường lệ. Chủ động đề xuất có căn cứ, nhưng giữ nhãn đề xuất cho các quyết định nghiệp vụ chưa chốt: đầu ra/online của nối–ghép, loại join và chính sách chặn xóa phụ thuộc.
- Với lựa chọn thư viện, driver, dịch vụ hoặc khả năng kỹ thuật cụ thể, kiểm tra nguồn chính thức hiện hành khi chốt; nếu chưa kiểm chứng thì ghi rõ, không cam kết chi phí/hiệu năng/khả năng giả.

Ưu tiên: **không mất dữ liệu đã commit, không đồng bộ sai tài khoản, không ghi đè nhánh, không nhận kết quả dở là thành công, không tái sinh tài nguyên đã xóa, và biểu diễn đúng khác biệt giữa lưu trên máy với đồng bộ lên máy chủ.**
