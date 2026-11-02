# Prompt giao nhiệm vụ cho Agent — Thiết kế cây nút và điều kiện

**Đề tài:** Dashboard tương tác 3D quản lý và trực quan hóa quy trình khai phá dữ liệu.

**Ngày đối chiếu:** 02/11/2026.

**Nguồn nghiệp vụ:** `thiet_ke_chuc_nang_he_thong.md` do người dùng cung cấp. Tài liệu này cập nhật cây nút đã trao đổi theo bản chức năng đó; không thay thế đặc tả nghiệp vụ chung. Đây là yêu cầu thiết kế, chưa phải báo cáo triển khai.

## 1. Nhiệm vụ agent và nguyên tắc phạm vi

Thiết kế hệ thống điều khiển bằng menu, nút và biểu mẫu tiếng Việt. Người dùng thực hiện từng thao tác, xem kết quả rồi chọn bước tiếp; cũng có thể cấu hình quy trình và chạy tuần tự. Không bắt buộc kéo thả hoặc thao tác trong không gian 3D.

- Chỉ thiết kế trong nhiệm vụ này; triển khai repository khi được giao riêng.
- Frontend, backend, tiền xử lý và huấn luyện dùng JS/TS. Năm thuật toán bản đầu chạy trong browser, cả online/offline khi đủ tài nguyên. Worker xử lý nặng để giao diện vẫn phản hồi.
- Website có backend và MongoDB trên máy chủ; người dùng không phải cài chúng. Browser không kết nối trực tiếp database bằng thông tin đăng nhập MongoDB.
- Một tài khoản sở hữu tài nguyên riêng; một dự án có nhiều dataset, quy trình và dashboard. Mỗi dataset có V0 và lịch sử riêng. Một dự án chỉ có một tab giữ quyền chỉnh sửa.
- CSV/JSON là đầu vào bản đầu; Excel, nguồn database và các thuật toán mở rộng không được hiện thành chức năng đã hỗ trợ.
- Đọc thêm tài liệu offline, MongoDB, frontend, backend và 3D nếu được cung cấp. Không tuyên bố đã đọc các tài liệu vắng mặt. Khi có xung đột, nêu rõ để giải quyết.
- Các lựa chọn inner/left join, tạo dataset dẫn xuất mới online và chặn xóa dataset còn phụ thuộc ngoài phạm vi là đề xuất mặc định của tài liệu nguồn, chưa được chốt riêng. Giữ nhãn “đề xuất” khi triển khai thiết kế.

## 2. Kết quả rà soát cây nút cũ

| Nội dung | Điều chỉnh |
| --- | --- |
| Chỉ có menu dữ liệu tổng quát | Bổ sung dự án, nhiều dataset, bộ chọn phiên bản và nhánh |
| Có Excel/kết nối database nguồn | Đưa ra khỏi phạm vi bản đầu; CSV/JSON là bắt buộc |
| Thiếu nối và ghép bảng | Thêm thao tác riêng, không nối ngầm khi nhập tệp |
| HTML và chuyển kiểu xuất hiện ở nhiều nơi | Một mã thao tác và bộ xử lý dùng chung; báo cáo phát hiện chỉ mở đúng cấu hình |
| Lọc bảng chưa phân biệt áp dụng | Lọc để xem không tạo phiên bản; “Áp dụng bộ lọc vào dữ liệu” tạo phiên bản |
| Tiền xử lý chỉ có vài cách cơ bản | Bổ sung đầy đủ các phương pháp đã chốt, không tự bỏ khi chia đợt |
| Danh mục nhiều thuật toán chưa phân mức | Bản đầu: Linear Regression, Logistic Regression, KNN phân lớp, K-Means, PCA |
| PCA bị gộp vào phân cụm hoặc 3D | Tách giảm chiều và biểu diễn tọa độ, có phương sai giải thích |
| Thiếu AI | Thêm gợi ý, giải thích, xem dữ liệu gửi, chấp nhận cấu hình và bỏ qua |
| Thiếu điều khiển offline | Thêm chuẩn bị offline, đồng bộ chủ động sau mất mạng, quyền tab, đăng xuất |
| “Lưu” có ý nghĩa chưa rõ | Tách commit dữ liệu, lưu cấu hình, lưu trên máy và đồng bộ |
| Có nguy cơ thêm dự đoán mới | Bản đầu chỉ đánh giá/lưu/tải mô hình; không nhập dữ liệu mới để dự đoán |

## 3. Thành phần giao diện và điều kiện chung

### 3.1. Quy ước

Nhóm menu dùng để điều hướng; phương pháp dùng radio/dropdown; cột và tham số dùng trường cấu hình; chỉ hành động thực thi mới là nút. Ví dụ “Điền missing” mở một bảng, người dùng chọn mean/median/... trong cùng bảng. Không biến mỗi tham số thành nút cha.

Bố cục đề xuất: thanh trên chọn dự án/dataset/phiên bản và xem trạng thái; menu trái chọn nhóm; vùng giữa xem dữ liệu/kết quả; bảng bên phải cấu hình; khung lịch sử xem tiến độ, lỗi và cảnh báo.

### 3.2. Các điều kiện dùng trong bảng

- **R:** đúng tài khoản/quyền sở hữu; có quyền đọc và đủ tài nguyên nguồn tại nơi thực thi.
- **W:** thỏa R, tab giữ quyền chỉnh sửa, không có tác vụ ghi cạnh tranh, phiên bản đầu vào xác định; việc lưu cục bộ khả thi.
- **S:** máy chủ truy cập được và phiên xác thực hợp lệ. Có kết nối mạng đơn thuần chưa đủ.
- **D:** điều kiện dữ liệu/thuật toán/cấu hình cụ thể đã được kiểm tra.
- **A:** Internet và dịch vụ AI khả dụng, xác thực/hạn mức phù hợp; đã có đồng ý nếu gửi nội dung từng dòng.

R/W/D được đánh giá lại khi chạy, không chỉ lúc mở biểu mẫu. Backend kiểm tra lại quyền trên API; AI không được bỏ qua validator. Offline vẫn có thể dùng R/W theo phiên cục bộ được phép; việc xác thực lại trước đồng bộ theo thiết kế offline.

Nút đang bị chặn phải có lý do và cách khắc phục. Menu hướng dẫn có thể mở khi chưa đủ điều kiện; hành động áp dụng/chạy thì bị chặn. Phương pháp chưa triển khai phải có nhãn rõ hoặc nằm ở danh mục mở rộng, không hiển thị như đã chạy được.

### 3.3. Trạng thái và kết quả

Trạng thái tác vụ: chưa đủ điều kiện → sẵn sàng → xem trước → đang chạy → đang lưu → thành công; có nhánh thất bại/hủy/gián đoạn. Chỉ thành công sau commit hoàn chỉnh.

Phân biệt độc lập: kết nối mạng, truy cập máy chủ, xác thực, quyền tab, đã lưu trên máy, chưa đồng bộ, đã đồng bộ, mức sẵn sàng offline. Không dùng một biểu tượng mạng để đại diện mọi trạng thái.

Loại đầu ra: **view** (chỉ hiển thị), **version** (phiên bản dataset), **artifact** (biểu đồ, mô hình, báo cáo), **config** (cấu hình), **control** (điều khiển phiên/lưu/đồng bộ). Lịch sử tác vụ được lưu khi phù hợp; không phải đầu ra nào cũng tạo version.

## 4. Cây nút và điều kiện

Mỗi nhóm dưới đây là nút cha/menu; từng dòng là hành động con hoặc nhóm mở biểu mẫu. Mã ổn định dùng chung cho thao tác đơn, quy trình và đề xuất AI.

### 4.1. Tài khoản và dự án

| Mã | Nút/nhóm con | Điều kiện và hành vi | Đầu ra |
| --- | --- | --- | --- |
| AUTH.REGISTER | Đăng ký | S, kiểm tra biểu mẫu theo cơ chế xác thực được chọn | control |
| AUTH.LOGIN | Đăng nhập | S; kiểm tra chính sách một phiên trên một máy | control |
| AUTH.RESET | Quên mật khẩu | S; theo nhà cung cấp xác thực thực tế | control |
| AUTH.LOGOUT | Đăng xuất | Đi đúng các nhánh mục 8; áp dụng mọi tab | control |
| PROJECT.LIST | Danh sách dự án | R; offline dùng phần đã có trên máy | view |
| PROJECT.CREATE | Tạo dự án | S; tên hợp lệ; không tạo mới offline | config |
| PROJECT.OPEN | Mở dự án | R; offline kiểm tra mức đủ của tài nguyên cần mở | view |
| PROJECT.RENAME | Đổi tên dự án | W; lưu cục bộ và đồng bộ theo quy tắc | config |
| PROJECT.DELETE | Xóa vĩnh viễn dự án | W + S; xem phạm vi, xử lý tác vụ/chưa đồng bộ và xác nhận | control |
| TAB.ACQUIRE | Chuyển quyền chỉnh sửa sang tab này | Quy trình bàn giao an toàn; tab cũ ngừng ghi trước khi tab mới được ghi | control |

Tab chỉ xem được mở tài nguyên, xem kết quả và tải đầu ra có sẵn khi đủ điều kiện. Các thao tác tạo/sửa/lưu artifact hoặc thay phiên bản làm việc cần W. Việc tạo tệp xuất không lưu ngược vào dự án có thể thực hiện với R; lưu báo cáo vào dự án cần W.

### 4.2. Bộ dữ liệu → nhập và kết hợp

| Mã | Nút/nhóm con | Điều kiện, cấu hình và hành vi | Đầu ra |
| --- | --- | --- | --- |
| DATA.SELECT | Chọn dataset / phiên bản | R; ghi rõ nguồn ở tiêu đề màn hình | view |
| DATA.IMPORT | Nhập CSV/JSON | W + S; mỗi tệp tạo dataset mới, giữ byte gốc và cấu hình đọc | dataset + V0 |
| DATA.PREVIEW | Xem trước nhập | Chọn tệp; CSV: delimiter/encoding/header; JSON: danh sách bản ghi và làm phẳng object | view |
| DATA.JSON_FIELDS | Chọn trường JSON | Không tự bung mảng; chọn giữ JSON/không chọn trường; kiểm tra va chạm đường dẫn | config |
| DATA.RENAME | Đổi tên dataset | W; không đổi nguồn của artifact cũ | config |
| DATA.CONCAT | Kết hợp → Nối dòng | W + D; nguồn/phiên bản, ánh xạ cột, xử lý cột thiếu và khác kiểu; không tự xóa trùng | dataset dẫn xuất theo đề xuất |
| DATA.JOIN | Kết hợp → Ghép theo khóa | W + D; khóa hai phía, kiểu join, hậu tố cột; kiểm tra null/trùng/nhiều–nhiều và số dòng dự kiến | dataset dẫn xuất theo đề xuất |
| DATA.DELETE | Xóa vĩnh viễn dataset | W + S; hiện phụ thuộc, không cascade ngoài phạm vi thông báo | control |

Đề xuất nối/ghép chỉ online, tạo dataset dẫn xuất mới với V0 và tất cả nguồn tham chiếu. Bản đầu ưu tiên inner/left join. Agent phải đánh dấu đây là đề xuất cần được thống nhất trước triển khai; không tự mở rộng offline hoặc right/full join.

Mục tiêu kiểm thử đầu vào theo nguồn: 10.000–50.000 dòng, khoảng 50 cột, 20 MB/tệp. Đây không phải cam kết tốc độ mọi tác vụ. Kiểm tra riêng bộ nhớ sau parse/join/encoding/TF-IDF; không coi 50 cột là trần đã chốt của ma trận đặc trưng. Giá trị giới hạn kỹ thuật còn lại phải được đề xuất và kiểm thử.

### 4.3. Khám phá và kiểm tra chất lượng

| Mã | Nút/nhóm con | Điều kiện và hành vi | Đầu ra |
| --- | --- | --- | --- |
| EDA.TABLE | Xem bảng | R; tìm kiếm, lọc, sắp xếp, chọn cột hiển thị chỉ đổi cách xem | view |
| EDA.SCHEMA | Tổng quan / schema | R; số dòng/cột, kiểu, missing, unique | view |
| EDA.STATS | Thống kê mô tả / tần suất | R + D; bỏ qua giá trị không hợp lệ có thông báo; nêu mẫu số và lý do không tính được | view |
| QUALITY.SCAN | Kiểm tra chất lượng | R; HTML/ký tự/kiểu/missing/trùng/phạm vi được cấu hình; chỉ báo cáo | view |
| QUALITY.OUTLIER | Phát hiện ngoại lệ | R + D; IQR hoặc Z-score trên cột số, xử lý cột hằng/thiếu; ngoại lệ chưa chắc là lỗi | view |
| QUALITY.CONFIGURE_FIX | Cấu hình cách xử lý | Mở đúng thao tác CLEAN/PREP bên dưới; chưa áp dụng dữ liệu | config |
| CLEAN.FILTER | Áp dụng bộ lọc vào dữ liệu | W + D; xem số dòng giữ/bỏ và xác nhận | version |

Bộ lọc đang xem chỉ được chuyển sang dữ liệu mới bằng CLEAN.FILTER rõ ràng. Thống kê tính trên mẫu phải nêu mẫu; không giả vờ là thống kê toàn bộ.

### 4.4. Làm sạch

Tất cả thao tác áp dụng dưới đây yêu cầu W + D, hỗ trợ offline khi đủ nguồn và bộ xử lý. Có xem trước trước/sau, số ô/dòng/cột ảnh hưởng; thành công tạo version, không ghi đè nguồn.

| Mã | Nhóm → thao tác | Cấu hình/kiểm tra riêng |
| --- | --- | --- |
| CLEAN.HTML | Văn bản → Làm sạch HTML | Cột, bỏ thẻ, decode entities, bỏ nội dung script/style; bảo toàn ranh giới từ/đoạn phù hợp; không chạy HTML |
| CLEAN.TRIM | Văn bản → Xóa khoảng trắng thừa | Phạm vi đầu/cuối/bên trong, cột và ví dụ ảnh hưởng |
| CLEAN.NEWLINE | Văn bản → Chuẩn hóa xuống dòng | Quy tắc thay thế được chọn rõ |
| CLEAN.CASE | Văn bản → Đổi hoa/thường | Cách đổi, cột; không tự áp dụng lên mã định danh |
| CLEAN.CHARS | Văn bản → Ký tự đặc biệt | Quy tắc cụ thể; không xóa hàng loạt ký tự có ý nghĩa |
| CLEAN.NULLS | Giá trị thiếu → Chuẩn hóa ký hiệu thiếu | Người dùng xác nhận danh sách token; 0, '-', 'null' không mặc định luôn thiếu |
| CLEAN.TYPE | Cột → Chuyển kiểu | Kiểu đích, locale/ngày/dấu số/boolean; liệt kê lỗi, không âm thầm đổi lỗi thành null |
| CLEAN.UNIT | Cột → Chuyển đơn vị | Đơn vị nguồn/đích và quy tắc rõ; không tự suy luận tỷ giá hoặc đơn vị mơ hồ |
| CLEAN.DROP_COL | Cột → Xóa cột | Chọn cột, xem phụ thuộc; xử lý trường hợp xóa toàn bộ cột |
| CLEAN.RENAME_COL | Cột → Đổi tên | Tên không rỗng/không va chạm, cập nhật ánh xạ trong cấu hình mới; lịch sử cũ giữ snapshot |
| CLEAN.SPLIT_COL | Cột → Tách cột | Dấu tách/quy tắc, số cột, tên đích và dữ liệu không khớp |
| CLEAN.MERGE_COL | Cột → Gộp văn bản | Thứ tự, dấu nối, missing, tên cột đầu ra |
| CLEAN.DROP_ROWS | Dòng → Xóa theo điều kiện | Điều kiện hợp lệ, số dòng dự kiến; không áp dụng bộ lọc xem ngầm |
| CLEAN.DEDUP | Dòng → Xóa trùng | Cột khóa, giữ bản đầu/cuối hoặc bỏ tất cả theo lựa chọn; xem số dòng |
| CLEAN.OUTLIER_APPLY | Ngoại lệ → Đánh dấu / loại / giới hạn | Phương pháp/ngưỡng, cột cờ mới hoặc dòng bị loại; ghi rõ mất thông tin |

### 4.5. Tiền xử lý → giá trị thiếu

Nút cha “Điền/xử lý giá trị thiếu” mở biểu mẫu chọn một phương pháp mỗi thao tác. Tất cả phương pháp đã chốt dưới đây đều nằm trong phạm vi thiết kế; không tự bỏ khi chia giai đoạn.

| Mã | Phương pháp | Điều kiện/cấu hình |
| --- | --- | --- |
| PREP.MISS_DROP | Xóa dòng có missing | Chọn cột, điều kiện any/all hoặc ngưỡng được chọn rõ |
| PREP.MISS_CONST | Điền giá trị cố định | Giá trị tương thích kiểu cột |
| PREP.MISS_MEAN | Điền trung bình | Cột số có đủ giá trị hợp lệ |
| PREP.MISS_MEDIAN | Điền trung vị | Cột số có đủ giá trị hợp lệ |
| PREP.MISS_MODE | Điền phổ biến nhất | Có giá trị hợp lệ; quy tắc khi nhiều mode |
| PREP.MISS_GROUP | Điền theo nhóm | Cột nhóm, phép điền, tối thiểu mẫu, nhóm không đủ dữ liệu; không tự fallback toàn cục |
| PREP.FFILL | Forward Fill | Cột thứ tự, chiều, nhóm tùy chọn và giới hạn khoảng; không lan qua nhóm |
| PREP.BFILL | Backward Fill | Điều kiện như ffill; cảnh báo dùng thông tin tương lai trong dự đoán |
| PREP.INTERPOLATE | Nội suy tuyến tính | Cột số, trục, mốc trùng, khoảng và biên; không tự ngoại suy |
| PREP.MISS_FLAG | Tạo cột đánh dấu missing | Xác định trạng thái trước điền; tên cột không trùng, mã cờ nhất quán |

W + D cho áp dụng, kết quả version. Nếu muốn vừa tạo cờ vừa điền, cấu hình thành hai bước có thứ tự rõ để cờ phản ánh missing ban đầu. Điền văn bản bằng AI thuộc mục 4.10, có bước duyệt riêng.

### 4.6. Tiền xử lý → mã hóa, biến đổi, tạo đặc trưng

| Mã | Nhóm → phương pháp | Điều kiện/cấu hình |
| --- | --- | --- |
| PREP.LABEL | Mã hóa → Label Encoding | Vai trò cột và mapping rõ; ưu tiên nhãn mục tiêu, cảnh báo mã số tạo thứ tự giả nếu dùng làm đặc trưng |
| PREP.ORDINAL | Mã hóa → Ordinal Encoding | Người dùng xác nhận thứ tự; cách xử lý missing/nhóm chưa biết |
| PREP.ONEHOT | Mã hóa → One-Hot Encoding | Nhóm, missing/unknown, số đặc trưng và bộ nhớ sau biến đổi |
| PREP.MINMAX | Scaling → Min-Max | Khoảng đích, cột số, cột hằng và giá trị mới ngoài khoảng |
| PREP.STANDARD | Scaling → Standard | Cột số, định nghĩa độ lệch chuẩn dùng nhất quán, trường hợp bằng 0 |
| PREP.ROBUST | Scaling → Robust | Khoảng phân vị, trung vị, trường hợp khoảng phân vị bằng 0 |
| PREP.LOG | Biến đổi số → Log | Cơ số hoặc log1p nếu hỗ trợ; miền xác định; không tự cộng hằng số |
| PREP.BIN | Biến đổi số → Binning | Cách chia/ngưỡng, nhãn, biên, ngoài khoảng, missing |
| FEATURE.FORMULA | Tạo đặc trưng → Công thức | Danh sách phép cho phép, cột, chia 0/overflow/missing, tên đích; parser giới hạn, không eval |
| FEATURE.DATE | Tạo đặc trưng → Ngày/tháng/năm | Cột ngày hợp lệ, múi giờ/cách hiểu ngày khi ảnh hưởng |
| PREP.TFIDF | Văn bản → TF-IDF | Tokenization, hoa/thường, stopwords/ngôn ngữ, n-gram, ngưỡng tần suất, vocabulary, văn bản rỗng; giới hạn kích thước |
| FEATURE.DROP_CONSTANT | Chọn đặc trưng → Loại cột hằng | Quy tắc missing, danh sách phát hiện; xác nhận trước loại |
| FEATURE.SELECT | Chọn cột đầu vào / mục tiêu | Vai trò dữ liệu; chỉ lưu cấu hình cho mô hình, không tự xóa cột khỏi dataset |

Các biến đổi áp dụng yêu cầu W + D và tạo version; FEATURE.SELECT là config. Ghép văn bản dùng lại CLEAN.MERGE_COL, không thêm bộ xử lý trùng.

Robust, log, binning, ordinal, TF-IDF và loại cột hằng là bắt buộc theo nguồn. KNN imputation, iterative imputation, target/frequency encoding, power/quantile transform, RFE, mutual information, lag/rolling hoặc phương pháp khác chưa chốt không được tự thêm thành yêu cầu bắt buộc.

### 4.7. Quy trình

| Mã | Nút con | Điều kiện/hành vi | Đầu ra |
| --- | --- | --- | --- |
| PIPE.CREATE | Tạo quy trình | W; chọn danh sách bước hoặc lấy từ thao tác đã làm | config |
| PIPE.EDIT | Thêm / xóa / lên / xuống / sửa bước | W; thứ tự rõ, lưu mã thao tác và tham số | config |
| PIPE.SAVE | Lưu / đổi tên / mở | Lưu/đổi W; mở R; giữ lịch sử cấu hình đã chạy | config/view |
| PIPE.MAP | Ánh xạ cột nguồn mới | W + D; kiểm tra kiểu/vai trò, không chỉ tên cột | config |
| PIPE.VALIDATE | Kiểm tra quy trình | R + D; tĩnh trước chạy, kiểm tra động lại trước từng bước | view |
| PIPE.RUN | Chạy quy trình | W + D; snapshot cấu hình/đầu vào, tuần tự, chỉ hỏi thêm nếu ngoài quyết định đã duyệt | version/artifact |
| RUN.CANCEL | Hủy lần chạy | Tác vụ đang chạy; bỏ phần dở, giữ bước đã commit | control |
| PIPE.CONTINUE | Chạy tiếp sau sửa lỗi | W + D; chủ động chọn điểm/đầu vào, lượt mới liên kết lượt trước, không sửa lịch sử | version/artifact |

Một bước biến đổi thành công tạo một version. Thống kê/biểu đồ/huấn luyện có đầu ra riêng. Lỗi bước 3 giữ đầu ra bước 1–2, dừng các bước sau. Không tự chạy tiếp sau refresh hoặc khi có mạng.

### 4.8. Khai phá → huấn luyện, phân cụm và giảm chiều

| Mã | Nút/phương pháp bản đầu | Điều kiện và đầu ra riêng |
| --- | --- | --- |
| MODEL.LINEAR | Hồi quy → Linear Regression | Mục tiêu số, đặc trưng hợp lệ; kết quả hồi quy và mô hình |
| MODEL.LOGISTIC | Phân lớp → Logistic Regression | Nhãn, đủ lớp/mẫu; công bố hỗ trợ nhị phân/đa lớp theo thư viện thực tế |
| MODEL.KNN | Phân lớp → KNN | k không vượt mẫu train, khoảng cách, scaling, lớp/mẫu hợp lệ |
| MODEL.KMEANS | Phân cụm → K-Means | Cột số, k hợp lệ, đủ điểm khác nhau, seed nếu hỗ trợ; nhãn và tâm cụm |
| MODEL.PCA | Giảm chiều → PCA | Số thành phần trong miền khả thi của mẫu/đặc trưng; phương sai giải thích và tọa độ theo dòng gốc |
| MODEL.CONFIG | Chọn đặc trưng / tham số / split | W; train/test và seed cho supervised, stratify khi phù hợp; không ép mục tiêu/split supervised lên PCA/K-Means |
| MODEL.PREPROCESS | Cấu hình tiền xử lý trong đánh giá | W; split trước fit, fit train rồi transform test; lưu tham số đã học |
| MODEL.CHECK | Kiểm tra trước chạy | Dữ liệu thiếu/NaN/vô hạn, nhãn, cột hằng, kích thước, chi phí, rò rỉ dữ liệu |
| MODEL.RUN | Chạy | W + D; trong worker browser; có RUN.CANCEL |
| MODEL.SAVE | Lưu mô hình/kết quả | W; đúng snapshot nguồn, cấu hình và artifact hoàn chỉnh |
| MODEL.DOWNLOAD | Tải mô hình | R; serializer JS/TS thực tế hỗ trợ; kèm tiền xử lý và mapping cần thiết |

Trước MODEL.RUN: tóm tắt cấu hình và điều kiện, không giả lập accuracy trước khi huấn luyện. Nếu nguồn đã scaling/điền bằng thống kê toàn dữ liệu, cảnh báo và đề xuất dựng lại pipeline từ nguồn phù hợp; split sau không tự sửa rò rỉ. Artifact fit train/test không tự thành version toàn dataset.

Khi cần tạo version từ tọa độ PCA, dùng thao tác áp dụng biến đổi riêng có xem trước, nguồn và xác nhận; mặc định chạy PCA lưu artifact giảm chiều, không tạo version ngầm. KNN hồi quy, Decision Tree, Random Forest, DBSCAN, phân cấp, Apriori/FP-Growth, K-fold và tìm siêu tham số là mở rộng. Không có nhập mẫu/tệp mới để dự đoán trong bản đầu.

### 4.9. Kết quả và đánh giá

- RESULT.CLASS: Accuracy/Precision/Recall/F1/ma trận nhầm lẫn; chọn cách tổng hợp đa lớp hợp lệ, nêu trường hợp không xác định.
- RESULT.REGRESS: MAE/MSE/RMSE/R²; nêu thiếu điều kiện hoặc chỉ số không có ý nghĩa.
- RESULT.CLUSTER: kích thước cụm, Silhouette khi đủ điều kiện; chi phí/lấy mẫu phải được thông báo và chấp nhận trước.
- RESULT.PCA: phương sai giải thích/tích lũy, tọa độ và liên kết dòng gốc; không dùng accuracy để đánh giá PCA.
- RESULT.COMPARE: chọn các lần chạy; hiển thị phiên bản, split, đặc trưng, tham số và cảnh báo điều kiện khác nhau.
- RESULT.EXPORT: xuất kết quả thực; định dạng theo khả năng đã xác minh.

Yêu cầu R + D cho đọc/tải; tính lại chỉ số là tác vụ riêng kiểm tra tài nguyên. Không dùng AI hoặc số mẫu để lấp chỗ chỉ số thiếu.

### 4.10. AI hỗ trợ

| Mã | Nút con | Điều kiện/hành vi |
| --- | --- | --- |
| AI.SUGGEST | Gợi ý làm sạch / phương pháp / biểu đồ / thuật toán | A + R; ưu tiên schema và thống kê tổng hợp, hiện lý do và cột liên quan |
| AI.EXPLAIN | Giải thích chất lượng / kết quả | A + R; dựa trên kết quả thực và giới hạn |
| AI.REVIEW_PAYLOAD | Xem dữ liệu sẽ gửi | Hiển thị chính xác mẫu/ngữ cảnh từng dòng trước khi xin đồng ý gửi |
| AI.SEND | Đồng ý và gửi | A; chỉ nội dung đã duyệt, không toàn bộ dataset ngầm |
| AI.ACCEPT | Dùng cấu hình được gợi ý | W; điền vào biểu mẫu, chạy validator; chưa chạy/chưa đổi dữ liệu |
| AI.DISMISS | Bỏ qua đề xuất | Đóng đề xuất, không tạo version |
| AI.TEXT_IMPUTE | Đề xuất điền văn bản thiếu | A; ưu tiên quy tắc/thông tin sẵn có trước; không ép mean/median cho văn bản |
| AI.APPLY_TEXT | Áp dụng giá trị AI đã duyệt | W + D; xem từng giá trị, nguồn AI, xác nhận rồi version; cho phép giữ missing |

AI offline bị chặn với lý do, chức năng thường vẫn hoạt động. “Không đủ thông tin” là kết quả hợp lệ. Dữ liệu và phản hồi AI không phải lệnh gọi API. Không gửi dữ liệu tài khoản khác/bí mật; log tối thiểu đủ truy vết.

### 4.11. Biểu đồ và dashboard

Nút cha “Tạo biểu đồ” gồm Gợi ý theo quy tắc và Chọn thủ công. Gợi ý theo quy tắc có thể chạy offline, khác AI.SUGGEST. Chọn loại rồi hiển thị cấu hình tương ứng.

| Mã | Loại | Điều kiện dữ liệu/cấu hình |
| --- | --- | --- |
| CHART.HIST | Histogram | Một cột số; bins hợp lệ |
| CHART.BOX | Box plot | Cột số; nhóm tùy chọn |
| CHART.BAR | Cột dọc/ngang | Cột nhóm; đếm không đòi thêm cột số, tổng/trung bình cần cột số |
| CHART.LINE | Đường | X có thứ tự, Y số; sắp xếp và cách xử lý X trùng |
| CHART.SCATTER | Phân tán 2D | Hai cột số |
| CHART.CORR | Heatmap tương quan | Ít nhất hai cột số phù hợp, đủ mẫu từng cặp; cột hằng không có tương quan hợp lệ |
| CHART.PIE | Tròn / Donut | Phép gộp thích hợp, tỷ trọng không âm, tổng dương |
| CHART.SCATTER3D | Phân tán 3D | Ba cột số hoặc ba thành phần PCA khả dụng; ghi rõ loại tọa độ |

Điều khiển con dùng chung:

- CHART.CONFIG: X/Y/Z, nhóm, màu, kích thước nếu hỗ trợ, phép gộp, thứ tự, Top N/Khác, missing.
- CHART.PREVIEW: R + D, ghi số dòng loại khỏi phép vẽ và phạm vi mẫu; không sửa dataset.
- CHART.SAVE / EDIT / DELETE: W; lưu config và tham chiếu nguồn; không tạo version dữ liệu.
- CHART.SOURCE: W + D; người dùng chủ động chọn phiên bản mới, kiểm tra cột/kiểu/phép gộp; lỗi thì giữ nguồn cũ.
- CHART.EXPORT: R, đủ dữ liệu/tài nguyên ảnh; công bố định dạng thực tế.
- DASH.CREATE / RENAME / OPEN: tạo/đổi cần W, mở R; nhiều dashboard trong dự án.
- DASH.ADD / REMOVE / ORDER: W; thêm/gỡ biểu đồ và lên/xuống/đổi vị trí theo bố cục đơn giản. Gỡ khỏi dashboard không xóa biểu đồ nguồn. Bố cục là đề xuất, không bắt buộc kéo thả.
- VIEW3D.ROTATE / ZOOM / PICK / RESET: R; điều khiển góc nhìn và xem chi tiết điểm, không đổi dữ liệu; lưu góc nhìn chỉ khi chọn lưu cấu hình.

Chặn dữ liệu rỗng/toàn missing/không hữu hạn; nêu lý do. Cột ID không mặc định là số đo. Nếu lấy mẫu, hiển thị số lượng/cách chọn, không tự dùng mẫu hiển thị làm mẫu huấn luyện. Phiên bản mới không tự đổi nguồn biểu đồ. Với PCA phải ghi phương sai giải thích; không khẳng định 3D giữ toàn bộ thông tin dữ liệu nhiều chiều.

### 4.12. Phiên bản và lịch sử

- VERSION.LIST / COMPARE: R; xem V0, quan hệ cha/nhánh, nguồn nối/ghép và khác biệt có ý nghĩa.
- VERSION.UNDO / SELECT: W; chuyển phiên bản đang làm việc; không xóa version mới hơn. Xử lý tiếp từ bản cũ tạo nhánh.
- RUN.HISTORY / DETAILS: R; trạng thái từng bước, thời gian, input/output, lỗi/cảnh báo và cấu hình snapshot.
- PROJECT.REOPEN: khôi phục bản commit gần nhất đã lưu, màn hình/dashboard phù hợp, kể cả kết quả chưa đồng bộ; không tự chạy lại phần dở, không bắt buộc khôi phục form chưa áp dụng.

### 4.13. Xuất và báo cáo

- EXPORT.DATA: chọn dataset/phiên bản → CSV/JSON → kiểm tra → tải; R + D.
- EXPORT.RESULT: chọn chart/model/run → định dạng thực tế → tải; R + D.
- REPORT.CONFIG: chọn phần chất lượng, bước xử lý, biểu đồ, tham số, chỉ số và kết luận; chọn nguồn/phiên bản/lượt chạy rõ ràng.
- REPORT.PREVIEW / GENERATE / DOWNLOAD: R + D để tạo/tải, W nếu lưu artifact trong dự án; PDF/font tiếng Việt/tài nguyên dùng được offline. Kết luận do người dùng nhập hoặc AI đã duyệt, không bắt buộc gọi AI.

Không ghép chỉ số từ nguồn khác mà thiếu chú thích. Xuất 3D có thể dùng ảnh khung nhìn có chú thích nếu thư viện hỗ trợ; không cam kết vector hoặc định dạng chưa kiểm chứng. Xuất/nhập gói dự án đầy đủ không là yêu cầu bắt buộc.

## 5. Thanh điều khiển của một thao tác

1. **Chọn nguồn:** project/dataset/version, cột và vai trò rõ.
2. **Cấu hình:** phương pháp, tham số, chính sách lỗi/missing và tên đầu ra.
3. **Kiểm tra:** lỗi phải sửa; cảnh báo có ảnh hưởng cần được người dùng hiểu và xác nhận.
4. **Xem trước:** trước/sau, phạm vi mẫu, số ô/dòng/cột ảnh hưởng. Không học kết quả giả cho huấn luyện.
5. **Áp dụng/Chạy:** khóa input snapshot, chống bấm lặp, tiến độ thật hoặc trạng thái chưa xác định phần trăm.
6. **Hủy:** giữ đầu ra đã commit; không công bố dữ liệu dở.
7. **Xem kết quả:** nguồn/phiên bản, thời gian, cảnh báo, đã lưu trên máy/chưa đồng bộ.
8. **Thao tác tiếp theo:** chọn phương pháp khác, hoàn tác, tạo biểu đồ, lưu thành quy trình.

Đổi form sau xem trước làm mất hiệu lực bản xem trước cũ. Đổi nguồn trong khi chạy không được làm đầu ra muộn ghi sang phiên bản mới. Tác vụ hoàn tất chỉ commit vào nhánh/nguồn đã duyệt và khi quyền vẫn hợp lệ; nếu điều kiện thay đổi phải xử lý theo chính sách tác vụ, không áp dụng ngầm.

## 6. Lưu cục bộ, offline và đồng bộ

| Mã/nút | Khi được dùng | Hành vi |
| --- | --- | --- |
| OFFLINE.PREPARE — Lưu để dùng offline | W + S, đủ dung lượng | Tải toàn bộ tài nguyên dự án tại thời điểm chuẩn bị; tiến độ và kiểm tra đầy đủ |
| OFFLINE.STATUS — Kiểm tra sẵn sàng | R | Phân biệt đủ cho màn hình/tác vụ hiện tại và đủ toàn bộ dự án |
| SYNC.NOW — Đồng bộ ngay | S, đúng tài khoản; có thay đổi chờ | Chủ động đồng bộ snapshot đầu ra hoàn chỉnh, giữ phát sinh mới cho lượt sau |
| SYNC.RETRY — Thử đồng bộ lại | S; lượt trước lỗi | Giữ dữ liệu/hàng đợi, không gửi trùng |
| SYNC.CONFLICT — Xem nhánh xung đột | R | Giữ cả hai phía, chọn nhánh làm việc; không ghi đè/tự gộp |
| OFFLINE.REMOVE — Gỡ bản lưu trên máy | Đề xuất; chỉ khi không còn thay đổi chưa đồng bộ hoặc tác vụ ghi | Giải phóng bản offline theo phạm vi rõ; không xóa tài nguyên máy chủ |

Tự lưu gốc và version hiện tại cùng tài nguyên cần thiết, giữ mọi version mới trên máy. Mở dự án không tự tải toàn bộ lịch sử máy chủ. OFFLINE.PREPARE khác tự lưu: tải mọi version hoàn thành, pipeline/lịch sử, chart/dashboard, model/chỉ số và tài nguyên thực thi tại snapshot.

Online liên tục: lưu cục bộ trước rồi tự đồng bộ đầu ra hoàn chỉnh. Sau mất mạng: chờ SYNC.NOW, dùng chung trạng thái giữa tab; thành công mới bật lại tự đồng bộ, đến lần mất mạng tiếp theo. Tải dở không báo offline-ready. Không giả định dữ liệu browser tồn tại vĩnh viễn.

Offline chặn: đăng ký/đăng nhập mới/quên mật khẩu, tạo dự án, nhập tệp mới, AI, xóa vĩnh viễn. Nối/ghép online theo đề xuất ở mục 4.2. Các thao tác xử lý, năm thuật toán, biểu đồ, pipeline, lịch sử, xuất/PDF được dùng nếu đủ tài nguyên cục bộ và điều kiện quyền/tác vụ.

## 7. Xóa và phụ thuộc

Xóa project/dataset cần W + S, máy chủ thực sự truy cập được, hiển thị phạm vi và xác nhận vĩnh viễn. Không có thùng rác.

- Hiển thị gốc, version, artifact và phụ thuộc bị ảnh hưởng.
- Đề xuất chặn xóa dataset khi còn phụ thuộc bên ngoài phạm vi; cung cấp liên kết để giải quyết trước.
- Tác vụ đang chạy/thay đổi chưa đồng bộ: yêu cầu hủy, đồng bộ hoặc xác nhận bỏ phần thuộc phạm vi xóa rõ ràng.
- Không xóa nguồn/dẫn xuất khác bằng cascade ngầm. Xóa biểu đồ hoặc gỡ khỏi dashboard là hành động riêng.
- Thiết bị cũ không được đồng bộ làm sống lại đối tượng đã xóa; yêu cầu hợp đồng revision/dấu vết xóa của backend/offline.

## 8. Các nút trong hộp thoại đăng xuất

| Tình huống | Nút và kết quả |
| --- | --- |
| Offline còn thay đổi chưa đồng bộ | Giải thích chặn; Hủy; hướng dẫn kết nối để đồng bộ |
| Offline không còn thay đổi chưa đồng bộ | Đăng xuất / Hủy; xóa dữ liệu tài khoản trên máy, thu hồi đúng phiên cũ khi có kết nối |
| Online còn thay đổi chưa đồng bộ | Đồng bộ rồi đăng xuất / Vẫn đăng xuất / Hủy |
| Chọn Đồng bộ rồi đăng xuất | Chỉ đăng xuất sau thành công; lỗi giữ dữ liệu và phiên làm việc |
| Chọn Vẫn đăng xuất | Xác nhận mất thay đổi chưa đồng bộ rồi xóa dữ liệu cục bộ, đăng xuất |
| Online không còn thay đổi chưa đồng bộ | Đăng xuất / Hủy |

Đăng xuất áp dụng mọi tab, hủy worker/tác vụ, chặn kết quả muộn ghi trở lại. Xóa dữ liệu cục bộ không xóa dữ liệu đã đồng bộ máy chủ. Nếu máy chủ không truy cập được, không được coi “đồng bộ rồi đăng xuất” đã thành công.

## 9. Các điều kiện xuyên suốt bắt buộc

- Đóng tab/refresh hủy phần chưa hoàn tất; chuyển tab hoặc mất mạng không tự hủy worker browser. Mở lại giữ bản đã commit, đánh dấu phần dở gián đoạn.
- Tuần tự biến đổi cùng dataset theo đề xuất chống ghi cạnh tranh; một writer mỗi dự án theo yêu cầu đã chốt.
- Hết dung lượng: không báo thành công, giữ version trước, dọn phần dở; không tự xóa dữ liệu chưa đồng bộ.
- Những bước học thống kê trong đánh giá mô hình fit train, transform test: imputation, scaling, vocabulary/encoding, PCA và bước tương tự. Lưu mapping/đối sách unknown để tải mô hình có thể tái hiện.
- Kiểm tra cả đầu vào và kích thước đầu ra dự kiến, tránh densify TF-IDF/one-hot làm tràn bộ nhớ.
- Lỗi cần nói việc gì xảy ra, dữ liệu nào còn được giữ và bước khắc phục. Không che lỗi bằng kết quả mẫu.
- Mã thao tác và schema cấu hình dùng chung cho form, pipeline và gợi ý AI. Đặc tả này không chọn thư viện hay cam kết giấy phép/tốc độ chưa kiểm chứng.

## 10. Hợp đồng tối thiểu cho danh mục thao tác

Agent thiết kế OperationDefinition với: id, nhãn tiếng Việt, nhóm/loại UI, loại đầu vào/đầu ra, schema cấu hình, điều kiện enable/disable và lý do, validator, preview, executor, hỗ trợ hủy, yêu cầu tài nguyên, offline-capable, có học tham số hay không, có tạo version hay không, phụ thuộc và chính sách lưu/lịch sử.

Khi chạy tạo ExecutionSnapshot gồm account/project, các dataset/version nguồn, mapping cột, cấu hình đã duyệt, seed/split nếu có, chế độ thực thi, quyền writer và revision cần kiểm tra. Lưu lịch sử bất biến; form thay đổi sau đó không sửa lượt cũ.

Đây là hợp đồng nghiệp vụ để agent thiết kế chi tiết TypeScript/API, không bắt buộc một collection MongoDB cho mỗi nút. Một phương pháp có thể xuất hiện tại nhiều vị trí nhưng chỉ có một định nghĩa và bộ xử lý chuẩn.

## 11. Sản phẩm bàn giao và nghiệm thu

Agent bàn giao: cây menu + sơ đồ màn hình, ma trận enable/disable online/offline/quyền tab, schema thao tác/biểu mẫu, đặc tả đầu vào/đầu ra/version, luồng lỗi/hủy và mapping sang module frontend/worker/backend/offline. Phân biệt yêu cầu đã chốt với đề xuất và khả năng thư viện chưa kiểm chứng.

Các tình huống phải được mô tả và kiểm tra khi triển khai:

1. Hai tệp tạo hai dataset; JSON flatten object không tự bung mảng.
2. Nối/ghép kiểm tra nhiều–nhiều, giữ đủ tham chiếu nguồn và giới hạn đầu ra.
3. Phát hiện HTML chưa đổi dữ liệu; áp dụng rồi điền thiếu tạo hai version.
4. Lọc bảng không tạo version; áp dụng bộ lọc mới tạo version.
5. Chuyển kiểu lỗi không tự thành null; ffill không truyền qua nhóm; log sai miền bị chặn.
6. One-hot/TF-IDF quá lớn bị chặn; toàn bộ phương pháp bổ sung mục 8 nguồn có chỗ trong menu.
7. Pipeline lỗi bước 3 giữ bước 1–2; tiếp tục chủ động với mapping/validation lại.
8. Năm thuật toán hoạt động trong browser khi đủ tài nguyên; split/fit không rò rỉ; PCA có đầu ra đúng loại.
9. Biểu đồ thiếu cột/sai kiểu bị chặn; bản mới không thay nguồn cũ; chuyển nguồn lỗi giữ config cũ.
10. AI chỉ điền cấu hình hoặc gợi ý; nội dung từng dòng chỉ gửi sau đồng ý; giữ missing khi không đủ căn cứ.
11. PDF đúng phần/nguồn, tiếng Việt, offline khi đủ tài nguyên; không cần AI.
12. Mất mạng không hủy worker; có mạng lại chờ Đồng bộ ngay; xung đột giữ hai nhánh.
13. Hai tab không cùng ghi; refresh không chạy lại phần dở; hoàn tác tạo nhánh khi làm tiếp.
14. Đăng xuất đúng từng trường hợp; worker cũ không ghi sau đăng xuất.
15. Xóa chỉ online với phạm vi rõ; không cascade ngầm và không tái sinh từ đồng bộ cũ.
16. Lưu hết dung lượng không thành công giả; tài khoản khác không đọc được dữ liệu.

Đối chiếu thêm toàn bộ AC01–AC30 trong tài liệu chức năng nguồn khi lập kế hoạch nghiệm thu. Chia giai đoạn triển khai không được làm mất phương pháp hoặc quy tắc đã chốt. Không tuyên bố đã triển khai/kiểm thử chỉ vì đã tạo bản thiết kế.
