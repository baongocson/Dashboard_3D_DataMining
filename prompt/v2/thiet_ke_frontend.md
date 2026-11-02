# Prompt giao nhiệm vụ cho Agent — Thiết kế frontend

> **Bản hợp nhất v2 — 02/11/2026.** Giữ yêu cầu và ma trận chuyên ngành của bản gốc; cập nhật các quyết định đã chốt và dùng [hợp đồng C01–C22](hop_dong_tich_hop.md). Đọc [README](README.md) để phân biệt yêu cầu sản phẩm P, thiết kế kỹ thuật T, điểm kiểm chứng V và quyết định mới Q. Tài liệu gốc nằm ở thư mục cha, không bị sửa. Đây chưa phải mã nguồn hoặc bằng chứng đã kiểm thử.

**Đề tài:** Xây dựng hệ thống dashboard tương tác 3D quản lý và trực quan hóa toàn bộ quy trình khai phá dữ liệu.

**Ngày tổng hợp:** 02/11/2026. **Ngôn ngữ giao diện:** Tiếng Việt.

**Trạng thái:** Đặc tả yêu cầu và prompt giao agent; chưa phải mã nguồn, sản phẩm đã triển khai hoặc báo cáo kiểm thử.

## 1. Vai trò, nhiệm vụ và tài liệu căn cứ

Bạn là agent phụ trách thiết kế frontend cho website chuyên ngành khai phá dữ liệu. Thiết kế giao diện, luồng tương tác, trạng thái, hợp đồng tích hợp và kế hoạch nghiệm thu đủ rõ để triển khai bằng JS/TS. Người dùng thao tác bằng menu, nút, danh sách và biểu mẫu; không phải viết code trong IDE.

Tài liệu căn cứ đã được đối chiếu trong quá trình trao đổi:

| Tài liệu | Trách nhiệm chính |
| --- | --- |
| `thiet_ke_chuc_nang_he_thong_.md` | Nghiệp vụ, phương pháp, thuật toán, kết quả và phạm vi |
| `thiet_ke_caynut_dieukien.md` | Danh mục thao tác, mã ổn định, điều kiện và loại đầu ra |
| `thiet_ke_offline.md` | Lưu cục bộ, đồng bộ, chuẩn bị offline, nhiều tab và đăng xuất |
| `thiet_ke_mongodb.md` | Định danh, phiên bản, nguồn gốc, metadata và artifact |
| `thiet_ke_backend.md` | Email/mật khẩu/OTP, API, phiên, AI, nhập/kết hợp dữ liệu và xóa |
| `thiet_ke_3d.md` | Bản đồ quy trình chính, cây phiên bản riêng, điều khiển 3D và suy giảm sang 2D |

Đọc các tài liệu thực tế được cung cấp khi triển khai; không tuyên bố đã đọc file vắng mặt. Nhiệm vụ hiện tại là thiết kế, chỉ triển khai repository khi được giao riêng. Không tự sửa các tài liệu nguồn trong nhiệm vụ này.

Các quyết định mới đã chốt dưới đây cập nhật những chỗ còn ghi “chưa chốt/đề xuất” trong nguồn cũ: xác thực email–mật khẩu và OTP; nối/ghép online trong browser, tạo dataset dẫn xuất mới, inner/left join; chặn xóa dataset còn phụ thuộc ngoài phạm vi; API key AI riêng chỉ phiên. Đây không phải quy tắc lấy file mới nhất để ghi đè mọi nghiệp vụ khác. Xung đột chưa được giải quyết phải được nêu rõ.

## 2. Quyết định frontend đã chốt

| Nội dung | Yêu cầu |
| --- | --- |
| Giao diện chính trong dự án | Bản đồ quy trình 3D thực sự; cây phiên bản ở mục riêng |
| Màu sắc | Tối mặc định, có chuyển sáng |
| Mở thao tác | Bảng cấu hình bên phải; vùng kết quả mở rộng khi cần |
| Đối tượng sử dụng | Có kiến thức chuyên ngành; hiện đầy đủ tham số ngay từ đầu |
| AI | Ngăn đề xuất theo ngữ cảnh, mở theo yêu cầu, dùng chung vị trí bảng bên phải |
| Hình thức AI | Không chatbot, không hộp nhập hội thoại tự do, không RAG |
| Thiết bị | Ưu tiên laptop/PC; điện thoại chủ yếu xem dự án và kết quả |
| Bố cục dashboard | Mẫu 1/2/3 cột; đổi thứ tự bằng nút; không yêu cầu kéo thả tự do |
| Thực thi | Người dùng xác nhận và chủ động chạy; AI chỉ đưa đề xuất vào cấu hình |
| Ngôn ngữ | Tiếng Việt; giữ thuật ngữ chuyên ngành hoặc tên thuật toán khi phù hợp |

“Hiện đầy đủ tham số” nghĩa là mọi tham số người dùng có thể chỉnh của phương pháp đang chọn được trình bày ngay, có nhóm rõ ràng, có thể cuộn. Không đặt tham số chuyên môn trong phần Nâng cao bị ẩn mặc định; không bắt chọn phương pháp rồi mới đi qua hướng dẫn nhập môn. Vẫn có nhãn, đơn vị, miền hợp lệ, giá trị mặc định và giải thích ngắn khi cần. Không phải hiển thị tham số của mọi phương pháp cùng lúc.

Những chi tiết chưa được chọn riêng như kích thước panel, khoảng cách, màu cụ thể, đường dẫn route và framework là đề xuất kỹ thuật, không gọi là yêu cầu người dùng đã duyệt.

## 3. Ranh giới kiến trúc và phạm vi

- Website truy cập qua link. Người dùng không cài Node.js, MongoDB, Docker hay Nginx để sử dụng.
- Frontend, backend và bộ xử lý ứng dụng dùng JS/TS; không dùng Python trong ứng dụng khai phá dữ liệu.
- Browser thực hiện parse CSV/JSON, thống kê, làm sạch, tiền xử lý, nối/ghép và năm thuật toán bản đầu, kể cả khi online. Tác vụ nặng qua worker hoặc bộ xử lý tương đương để giao diện còn phản hồi.
- Backend phụ trách xác thực, quyền sở hữu, lưu trữ, đồng bộ, trung gian AI và API quản lý. Browser không kết nối MongoDB trực tiếp hoặc chứa secret máy chủ.
- Mỗi tài khoản sở hữu tài nguyên riêng; không có chia sẻ/cộng tác/phân vai trong bản đầu.
- Một dự án có nhiều dataset, quy trình và dashboard. Mỗi dataset có V0 và lịch sử riêng. Không dùng tên “V1” làm định danh toàn hệ thống.
- Bản đầu nhập CSV/JSON, chưa nhập Excel/kết nối database nguồn. JSON chọn danh sách bản ghi và làm phẳng object; chưa bung mảng.
- Năm thuật toán: Linear Regression, Logistic Regression, KNN phân lớp, K-Means, PCA. Không đưa thuật toán mở rộng thành chức năng đã chạy được.
- Bản đầu đánh giá, lưu và tải mô hình; chưa nhận dữ liệu mới để dự đoán. Train/test là bắt buộc cho supervised; không ép split supervised lên PCA/K-Means; K-fold/tìm siêu tham số tự động là mở rộng.

## 4. Kiến trúc thông tin và màn hình

### 4.1. Ngoài dự án

| Màn hình | Nội dung chính |
| --- | --- |
| Đăng nhập | Email, mật khẩu hệ thống, hiện/ẩn mật khẩu, quên mật khẩu, đăng ký |
| Đăng ký | Email, tên hiển thị, mật khẩu và xác nhận; chuyển xác minh OTP |
| Xác minh OTP | Nhập/dán mã, hết hạn, gửi lại, lỗi theo phản hồi máy chủ |
| Quên/đặt lại mật khẩu | Email → OTP → mật khẩu mới → đăng nhập |
| Danh sách dự án | Tìm kiếm, tạo online, mở, đổi tên, trạng thái cục bộ/offline và xóa đúng điều kiện |
| Tài khoản | Xem email/tên, đổi tên hiển thị, đăng xuất; không có đổi email/xóa tài khoản bản đầu |

Không cần trang giới thiệu quảng cáo hoặc không gian 3D trước khi làm việc. Khi mở lại website, phục hồi ngữ cảnh dự án nếu hợp lệ; không luôn đẩy về đăng nhập khi đang có quyền làm việc offline.

### 4.2. Trong dự án

1. Bản đồ quy trình — màn hình làm việc chính.
2. Bộ dữ liệu — nguồn, cấu hình đọc, metadata, nhập và nối/ghép.
3. Cây phiên bản dữ liệu — nguồn gốc, nhánh, so sánh và tiếp tục xử lý.
4. Quy trình đã lưu — danh sách bước, cấu hình, kiểm tra và chạy.
5. Biểu đồ và dashboard — tạo/quản lý biểu đồ và bố cục tổng hợp.
6. Mô hình và kết quả — cấu hình, thí nghiệm, đánh giá và mô hình đã lưu.
7. Lịch sử chạy — từng lần chạy/bước, cảnh báo, lỗi và đầu vào/đầu ra.
8. Báo cáo — chọn phần, xem trước và xuất PDF.

Trung tâm tác vụ và trung tâm lưu/đồng bộ mở được từ thanh trên trên mọi màn hình dự án. Không gom bản đồ quy trình, cây phiên bản và dashboard biểu đồ thành một khái niệm.

## 5. Khung giao diện và hệ thống thẩm mỹ

| Vùng | Nội dung/hành vi |
| --- | --- |
| Thanh trên | Tên dự án; dataset, nhánh, phiên bản; trạng thái lưu/đồng bộ; tác vụ; tài khoản |
| Điều hướng trái | Các mục trong dự án; thu gọn được; tên và biểu tượng rõ |
| Vùng giữa | Canvas 3D/2D, bảng dữ liệu hoặc nội dung màn hình |
| Bảng phải | Chi tiết đối tượng, cấu hình thao tác hoặc đề xuất AI theo chế độ đang chọn |
| Vùng kết quả | Preview, bảng, biểu đồ, metric và lỗi; mở rộng được |
| Điều khiển khung nhìn | 3D/2D, zoom, vừa màn hình, đặt lại góc nhìn và giảm chuyển động |

Đề xuất ba cách xem: Bản đồ, Kết hợp, Dữ liệu. Đây là cách phân bổ diện tích trong cùng không gian làm việc, không tạo bản sao dataset hoặc tác vụ. Đổi cách xem không làm mất cấu hình đang nhập. Với bảng nhiều cột, cho bảng/kết quả chiếm phần lớn màn hình và thu nhỏ/ẩn canvas tạm thời.

Theme tối dùng nền xanh than/trung tính, điểm nhấn lam/ngọc; theme sáng dùng nền sáng và tương phản rõ. Màu là token dùng chung; tránh glow dày, nền kính làm chữ khó đọc và texture/mô hình nặng chỉ để trang trí. Lựa chọn theme không tự đổi màu có ý nghĩa của biểu đồ hoặc nhãn lớp/cụm.

Có trạng thái hover, focus, selected, disabled, loading, error và empty thống nhất. Màu trạng thái đi kèm chữ/biểu tượng. Phông hỗ trợ tiếng Việt và tài nguyên cần thiết phải sẵn sàng cục bộ cho offline. Cỡ panel/breakpoint đo bằng nội dung thực; không cam kết mọi biểu mẫu vừa một màn hình.

## 6. Ngữ cảnh dữ liệu và điều hướng an toàn

- Luôn thấy dự án, dataset, nhánh và phiên bản đang làm việc; với nhiều nguồn hiện từng nguồn tương ứng.
- Phân biệt phiên bản đang làm việc, đối tượng đang xem chi tiết và phiên bản chọn so sánh. Xem lịch sử không tự đổi nguồn.
- Mỗi tác vụ giữ snapshot đầu vào lúc chạy. Đổi màn hình/dataset không chuyển kết quả muộn sang nguồn mới và không tự hủy tác vụ.
- Nếu kết quả hoàn thành thuộc nguồn cũ, thông báo rõ nguồn và cho bấm mở; không tự kéo người dùng về màn hình cũ.
- Đổi nguồn khi có biểu mẫu chưa áp dụng: cảnh báo bỏ cấu hình hoặc cho ở lại. Không bắt buộc khôi phục biểu mẫu dở sau refresh/đóng tab.
- Chọn phiên bản cũ làm hiện tại không xóa bản mới hơn. Chỉ khi áp dụng biến đổi tiếp từ bản cũ mới tạo nhánh theo nghiệp vụ.
- Route/deep link dùng ID ổn định; kiểm tra quyền, tài nguyên và trạng thái đã xóa trước khi hiển thị. Không dựa tên dataset làm khóa.

## 7. Bản đồ quy trình 3D và cây phiên bản

### 7.1. Bản đồ chính

Các khối: Nạp dữ liệu; Kiểm tra dữ liệu thô; Làm sạch; Xử lý missing; Biến đổi và chọn đặc trưng; Khám phá và trực quan hóa; Chọn thuật toán; Huấn luyện và đánh giá; Xuất kết quả và báo cáo.

- Dùng hình học có tọa độ không gian, phối cảnh và camera thật; bóng/hiệu ứng nghiêng thẻ đơn thuần không thay thế yêu cầu 3D.
- Chọn khối mở chức năng ở panel; không chạy thao tác ngay khi nhấp đối tượng.
- Menu/danh sách 2D tương đương truy cập được mọi chức năng cốt lõi.
- Đường nối mặc định là luồng gợi ý, có chú giải; không giả vờ là phụ thuộc thực tế. Không khóa giai đoạn chỉ vì chưa chạy khối trước.
- Phân biệt chế độ Khám phá chức năng và Theo dõi lần chạy. Trạng thái theo dõi lấy đúng run/step, có tổng hợp khi nhiều bước cùng nhóm.
- Đổi nguồn phải tính lại khả dụng, không giữ dấu hoàn thành từ nguồn trước.
- Xoay/zoom/chọn/đổi camera không tạo version. Có danh sách chọn, đặt lại góc, vừa màn hình, giảm chuyển động và fallback 2D khi render lỗi/không hỗ trợ.

### 7.2. Cây phiên bản riêng

- Đồ thị nguồn gốc có thể có nhiều cha khi nối/ghép, không ép thành cây một cha.
- Có lọc dataset/nhánh/thao tác/thời gian, tìm theo nhãn/ID, tải thêm metadata và chế độ danh sách 2D.
- Mặc định tập trung nguồn đang chọn, cho mở rộng quan hệ liên dataset. Báo rõ nếu lịch sử chưa tải đầy đủ.
- Node có thể hiển thị metadata khi nội dung chưa có trên máy; nhãn “Chưa có trên máy”. Offline không mở nội dung thiếu.
- Chi tiết: nguồn, thao tác/cấu hình lịch sử, run, số dòng/cột, nhánh, tình trạng local/server.
- Hành động: Xem dữ liệu, Xem bước xử lý, So sánh, Chọn làm phiên bản hiện tại, Tiếp tục xử lý, Tải nội dung về máy khi đủ điều kiện.
- Không thêm xóa tùy ý từng phiên bản. So sánh không mặc định dòng cùng vị trí là cùng bản ghi.

## 8. Bộ dữ liệu, nhập và kết hợp

### 8.1. Nhập CSV/JSON online

Chọn tệp → kiểm tra định dạng/kích thước → cấu hình đọc → xem trước và lỗi → xác nhận nhập → xử lý/lưu theo hợp đồng backend → dataset mới và V0.

CSV: delimiter, encoding, header và dữ liệu không đọc được. JSON: chọn mảng bản ghi, flatten object, xử lý trường mảng bằng lựa chọn giữ JSON/không chọn; báo va chạm tên đường dẫn, không tự nhân dòng.

Mỗi tệp nhập tạo dataset mới, giữ byte gốc và cấu hình đọc. Giới hạn đầu vào đã chốt 20 MB = 20.000.000 byte theo webserver §2. Khoảng 10.000–50.000 dòng và khoảng 50 cột là mục tiêu kiểm thử, không tự áp thành trần cứng. Kiểm tra riêng bộ nhớ sau parse/biến đổi.

Mất mạng giữa nhập: giữ trạng thái trung thực, phân biệt parse xong, lưu tạm, upload, commit và chưa xác nhận. Đối chiếu receipt/import intent theo API trước retry; không báo dataset đã nhập hoàn chỉnh chỉ vì preview đọc được. Không khởi chạy import mới offline. Import đã START hợp lệ khi online được hoàn tất local theo C08, hiển thị chưa được server xác nhận; không tự sync khi mạng trở lại. Refresh trước local commit là interrupted, không tự chạy tiếp.

### 8.2. Nối dòng và ghép bảng

Chỉ online; tính trong browser; đầu ra là dataset dẫn xuất mới với V0, tham chiếu mọi nguồn.

- Nối dòng: chọn nguồn/phiên bản, ánh xạ cột, cột thiếu, khác kiểu và số dòng dự kiến; không tự loại trùng.
- Ghép bảng: khóa hai phía, inner/left, hậu tố cột trùng, null/trùng khóa, số dòng khớp/không khớp, nguy cơ nhiều–nhiều và bộ nhớ đầu ra.
- Có preview và kiểm tra lại khi chạy; chặn cấu hình không hợp lệ hoặc chi phí vượt giới hạn. Không tự giảm mẫu/đổi kiểu join.

## 9. Biểu mẫu thao tác và vòng đời thực thi

### 9.1. Mẫu chung

Nguồn → cột → phương pháp → đầy đủ tham số → kiểm tra/cảnh báo → xem trước → áp dụng/chạy → lưu hoàn chỉnh → kết quả.

| Thành phần | Quy tắc |
| --- | --- |
| Bộ chọn cột | Tìm kiếm; tên, kiểu, tỷ lệ thiếu; chọn nhiều khi thao tác hỗ trợ |
| Phương pháp | Radio/dropdown trong một nhóm; không tạo nút cha cho từng tham số |
| Tham số | Nhãn, kiểu, đơn vị, miền hợp lệ, mặc định có giải thích; hiển thị đầy đủ của phương pháp đang chọn |
| Lỗi | Gắn đúng trường/cột; thông báo cụ thể và cách khắc phục |
| Preview | Trước/sau, phạm vi, số ô/dòng/cột ảnh hưởng; nêu rõ nếu lấy mẫu |
| Thực thi | Xem trước, Áp dụng/Chạy, Hủy khi hỗ trợ; phân biệt đóng panel với hủy tác vụ |
| Kết quả | Nguồn, run, đầu ra và trạng thái lưu/đồng bộ; đường tới phiên bản/artifact |

Không báo số ảnh hưởng toàn bộ nếu mới tính trên mẫu. Đổi nguồn, cột hoặc tham số làm preview cũ hết hiệu lực; kiểm tra snapshot trước áp dụng. Huấn luyện chỉ preview cấu hình/điều kiện, không có metric giả.

### 9.2. Điều kiện và trạng thái

Dùng chung registry với cây nút: R (đọc/nguồn), W (ghi/quyền tab), S (máy chủ và phiên hợp lệ), D (dữ liệu/cấu hình), A (AI khả dụng/đồng ý cần thiết). Kiểm tra lại lúc chạy; backend kiểm tra quyền độc lập.

Vòng đời: chưa đủ điều kiện → sẵn sàng → xem trước → đang chạy → đang lưu → thành công; nhánh lỗi/hủy/gián đoạn. Chỉ thành công sau commit hoàn chỉnh. Chỉ hiển thị phần trăm khi đo được; nếu không dùng trạng thái hoạt động và bước hiện tại.

Menu vẫn có thể mở để xem điều kiện; hành động thực thi bị chặn phải có lý do đọc được, không chỉ tooltip của nút disabled. Đang có tác vụ ghi cạnh tranh trên cùng nguồn thì chặn tác vụ không tương thích theo bộ điều phối; không chặn mọi tác vụ đọc một cách tùy tiện.

Đầu ra phân biệt view, version, artifact, config và control. Preview, lọc để xem, đổi camera và chọn cột hiển thị không tạo version. “Áp dụng bộ lọc vào dữ liệu” là hành động riêng tạo version.

## 10. Khám phá, làm sạch và tiền xử lý

- Bảng dữ liệu hỗ trợ tìm kiếm/lọc/sắp xếp/chọn cột hiển thị; ghi rõ phạm vi đang xem và nguồn. Dùng phân trang/ảo hóa phù hợp, không render hàng chục nghìn dòng vào DOM cùng lúc.
- Tổng quan: số dòng/cột, schema, missing, unique, thống kê/tần suất; nêu lý do khi không tính được và mẫu số khi cần.
- Kiểm tra chất lượng chỉ báo cáo; nút xử lý mở đúng operation với đúng cột, chưa sửa dữ liệu.
- Phân biệt ngoại lệ thống kê với lỗi dữ liệu; chỉ đánh dấu/loại/giới hạn sau cấu hình và xác nhận.

Danh mục giao diện phải bao phủ các phương pháp đã chốt, không tự bỏ khi chia đợt:

| Nhóm | Phạm vi |
| --- | --- |
| Văn bản | Làm sạch HTML, trim, xuống dòng, hoa/thường, ký tự đặc biệt |
| Cấu trúc/kiểu | Chuẩn hóa ký hiệu thiếu; chuyển kiểu/đơn vị; xóa/đổi tên/tách/gộp cột; lọc/xóa dòng; xóa trùng; xử lý outlier |
| Missing | Xóa theo điều kiện, hằng số, mean, median, mode, theo nhóm, ffill, bfill, nội suy tuyến tính, cờ missing |
| Mã hóa | Label, Ordinal, One-Hot |
| Scaling/biến đổi số | Min-Max, Standard, Robust, Log, Binning |
| Đặc trưng | Công thức giới hạn phép, ngày/tháng/năm, TF-IDF, loại cột hằng, chọn đầu vào/mục tiêu |

Validator và tham số chi tiết theo tài liệu chức năng/cây nút; UI không tự tạo một bộ quy tắc khác. Công thức không dùng eval; dữ liệu HTML không được thực thi. Không mặc định 0, dấu “-” hoặc chuỗi “null” luôn là missing. Cảnh báo phình số chiều/bộ nhớ cho One-Hot/TF-IDF và trường hợp miền xác định không hợp lệ cho log.

Chọn đầu vào/mục tiêu là cấu hình mô hình, không tự xóa cột dataset. Cờ missing và điền thiếu nếu chạy cùng quy trình phải có thứ tự rõ để cờ phản ánh dữ liệu ban đầu.

## 11. Quy trình đã lưu và lịch sử tác vụ

- Tạo quy trình bằng danh sách bước và nút Thêm, Sửa, Di chuyển lên/xuống, Bỏ bước; không bắt kéo thả.
- Mỗi bước dùng operationId, schema tham số và validator chung với thao tác đơn/AI. Cho thấy đầu vào và đầu ra dự kiến.
- Kiểm tra toàn quy trình trước chạy. Chạy tuần tự theo cấu hình; không yêu cầu duyệt lại từng bước bình thường đã được xác nhận.
- Nếu cần quyết định ngoài cấu hình, tạm dừng để người dùng xử lý; không tự chọn thay.
- Mỗi bước biến đổi thành công commit riêng. Bước lỗi/hủy giữ kết quả hoàn chỉnh trước đó, không tạo version dở; dừng các bước phụ thuộc.
- Cho mở lỗi, chỉnh cấu hình và chủ động chạy tiếp theo quy tắc nguồn. Không tự tiếp tục sau refresh hoặc khi mạng trở lại.
- Trung tâm tác vụ hiển thị project/dataset/version, operation/run, trạng thái, tiến độ thực, thời gian và Hủy khi hỗ trợ.
- Lịch sử phân trang; có đầu vào/đầu ra, cấu hình chỉ đọc, lỗi/cảnh báo và nguồn thực thi. Chọn mục lịch sử không chạy lại.

## 12. Huấn luyện, đánh giá và mô hình

Biểu mẫu chọn loại bài toán, thuật toán trong phạm vi, đặc trưng/mục tiêu phù hợp, tham số, seed khi hỗ trợ, cấu hình train/test và tiền xử lý của luồng huấn luyện. Tham số của thuật toán đã chọn hiện đầy đủ.

- Kiểm tra số mẫu/đặc trưng/lớp, missing, NaN/vô hạn, cột hằng, giá trị tham số và tài nguyên.
- Không khẳng định loại bài toán chỉ từ dtype nhãn. KNN bản đầu là phân lớp; PCA là giảm chiều, K-Means là phân cụm.
- Split trước khi fit các bước học tham số; chỉ fit train và áp dụng sang test. Nếu phiên bản đầu vào đã được fit tiền xử lý trên toàn dữ liệu, cảnh báo rò rỉ và hỗ trợ cấu hình dựng lại từ nguồn phù hợp.
- Không biểu diễn bản fit train/test trung gian thành phiên bản dataset đầy đủ.
- Khả năng nhị phân/đa lớp và định dạng xuất mô hình theo implementation được xác minh, không hứa trước mọi thư viện đều hỗ trợ.

| Bài toán | Kết quả cần trình bày |
| --- | --- |
| Phân lớp | Accuracy, Precision, Recall, F1, ma trận nhầm lẫn; cách tổng hợp đa lớp và trường hợp không xác định |
| Hồi quy | MAE, MSE, RMSE, R²; lý do không tính được/không có ý nghĩa |
| K-Means | Kích thước cụm, tọa độ/nhãn khi phù hợp, Silhouette khi đủ điều kiện; công bố lấy mẫu nếu có |
| PCA | Phương sai giải thích/tích lũy, tọa độ, số thành phần và tham chiếu dòng gốc |

So sánh lần chạy luôn kèm nguồn, split, đặc trưng và cấu hình; cảnh báo khác điều kiện đánh giá. Cho lưu/tải mô hình kèm cấu hình và tiền xử lý cần thiết. Không có biểu mẫu nhập dữ liệu mới để dự đoán trong bản đầu.

## 13. AI đề xuất theo ngữ cảnh

### 13.1. Giao diện và quyền quyết định

Người dùng bấm “Đề xuất bằng AI” trong ngữ cảnh hiện tại; panel phải chuyển sang đề xuất, giữ nguyên draft cấu hình thao tác. Có nút trở lại cấu hình. Không tạo chatbot, lịch sử hội thoại hoặc luồng hỏi đáp tự do/RAG.

Một thẻ đề xuất gồm: vấn đề/mục tiêu, nguồn phiên bản, cột liên quan, phương pháp, tham số gợi ý, lý do, điều kiện và ảnh hưởng dự kiến; hành động “Đưa vào cấu hình” và “Bỏ qua”. Có thể chỉnh mục tiêu/ràng buộc bằng trường cấu hình có cấu trúc khi cần.

Đưa vào cấu hình không chạy, không tạo version và không đánh dấu dữ liệu đã sửa. Cấu hình vẫn qua validator và bước người dùng áp dụng. Khi nguồn đổi, đánh dấu đề xuất cũ và yêu cầu kiểm tra lại trước dùng.

### 13.2. Nội dung gửi và xử lý lỗi

- Mặc định gửi schema/thống kê tối thiểu. Nếu cần nội dung từng dòng, hiển thị chính xác payload/mẫu, nguồn, provider/model, cho đồng ý trước khi gửi.
- Đổi payload làm mất hiệu lực đồng ý cũ; không âm thầm bổ sung toàn bộ dataset.
- AI lỗi/offline không chặn thao tác thông thường. Nêu lỗi dịch vụ, hết hạn mức, key không hợp lệ hoặc trạng thái chưa rõ theo API.
- Timeout không biết provider đã xử lý chưa thì hiện trạng thái chưa rõ; không tự retry có thể phát sinh phí lặp.
- Không tự chuyển provider/model/key chung khi lỗi. Người dùng chủ động chọn nếu có adapter hỗ trợ.
- AI điền văn bản có preview, đánh dấu nguồn và duyệt; có thể trả “Không đủ thông tin để điền”. Không coi đề xuất là sự thật đã xác minh.
- Lưu truy vết đề xuất có cấu trúc/phần được chấp nhận, không lưu nguyên hội thoại hoặc row payload vào log.

### 13.3. API key riêng

Chọn dịch vụ chung hoặc dịch vụ/key riêng theo khả năng backend. Key nhập dạng mật khẩu, chỉ RAM theo phiên; không localStorage, IndexedDB, file, cache, log hay analytics. Các tab không broadcast key nguyên văn. Khi backend restart, reload hoặc key hết hiệu lực có thể cần nhập lại; chỉ báo trạng thái sẵn sàng theo phản hồi thực tế. Không gắn key vào URL hoặc cấu hình dự án xuất ra.

## 14. Biểu đồ và dashboard

### 14.1. Trình tạo biểu đồ

Chọn nguồn và loại → cấu hình trục/nhóm/phép gộp → kiểm tra → preview → lưu biểu đồ → thêm dashboard nếu muốn.

Hỗ trợ Histogram, Box plot, Bar dọc/ngang, Line, Scatter, Heatmap tương quan, Pie/Donut và Scatter 3D trong phạm vi cây nút. Trường cấu hình thay đổi theo loại biểu đồ, đầy đủ tham số đang hỗ trợ.

Kiểm tra: số cột/kiểu trục, thứ tự và gộp X trùng cho Line, cột hằng/không đủ cặp cho tương quan, tỷ trọng không âm/tổng dương cho Pie, missing/vô hạn và dữ liệu rỗng. Không tự coi ID là đại lượng liên tục.

Scatter 3D phân biệt ba cột gốc với ba thành phần PCA; hiện cách tạo tọa độ và phương sai giải thích khi dùng PCA. Chọn điểm có thông tin nguồn/dòng khi ánh xạ hợp lệ. Công bố cách/kích thước lấy mẫu; mẫu render không tự trở thành tập train.

### 14.2. Dashboard

- Một dự án có nhiều dashboard; tạo, đổi tên, mở và quản lý biểu đồ.
- Chọn bố cục 1/2/3 cột; thứ tự bằng nút lên/xuống hoặc vị trí có nhãn rõ. Không yêu cầu kéo thả/thay kích thước tự do.
- Số cột tự giảm khi màn hình hẹp, vẫn giữ lựa chọn bố cục và thứ tự đã lưu cho desktop.
- Thêm biểu đồ đã lưu; bỏ khỏi dashboard không tự xóa biểu đồ/dataset nguồn.
- Mỗi biểu đồ luôn gắn phiên bản cụ thể. Có phiên bản mới không tự đổi nguồn.
- Đổi nguồn là hành động chủ động; kiểm tra cột/kiểu/phép gộp. Nếu lỗi, giữ cấu hình cũ và yêu cầu chỉnh, không lưu biểu đồ hỏng thay thế.

## 15. Offline, lưu, đồng bộ và xung đột

### 15.1. Ma trận hiển thị khả dụng

| Chức năng | Offline |
| --- | --- |
| Đăng ký/đăng nhập mới/quên mật khẩu/tạo dự án | Không |
| Nhập CSV/JSON mới/nối dòng/ghép bảng | Không |
| Mở nội dung đã có đủ trên máy | Có theo quyền offline hợp lệ |
| Làm sạch/tiền xử lý/thống kê/biểu đồ/3D | Có khi đủ dữ liệu và bộ xử lý |
| Năm thuật toán bản đầu | Có khi đủ tài nguyên |
| Mở version chỉ có trên server | Không; hiện metadata đã có và lý do |
| AI/đồng bộ/xóa vĩnh viễn | Không |
| Xuất dữ liệu/biểu đồ/mô hình/PDF | Có khi đủ dữ liệu, bộ xuất và font |

### 15.2. Trạng thái độc lập

| Trục | Ví dụ trạng thái |
| --- | --- |
| Kết nối | Có mạng, offline, máy chủ không truy cập được |
| Xác thực | Hợp lệ, cần đăng nhập lại, phiên bị thu hồi |
| Lưu cục bộ | Đang lưu, đã lưu trên máy, lưu lỗi |
| Đồng bộ | Chưa đồng bộ, chờ người dùng, đang đồng bộ, đã đồng bộ, lỗi, có xung đột |
| Chuẩn bị offline | Chưa chuẩn bị, đang tải, sẵn sàng, thiếu tài nguyên |
| Quyền tab | Đang giữ quyền chỉnh sửa, chỉ xem, đang chuyển quyền |

Thanh trên dùng thông báo ngắn; mở trung tâm để xem đầy đủ các trục. Không dùng một biểu tượng mạng thay mọi trạng thái. “Hoàn thành” không đồng nghĩa “Đã đồng bộ”.

### 15.3. Lưu và chuẩn bị offline

Tự giữ nguồn gốc, phiên bản hiện tại và tài nguyên cần thiết; giữ mọi phiên bản mới đã commit trên máy. Không tải toàn bộ lịch sử chỉ vì mở dự án.

“Lưu để dùng offline” tải toàn bộ tài nguyên dự án tại snapshot: nguồn, mọi phiên bản hoàn chỉnh, quy trình/run, biểu đồ/dashboard, mô hình/metric và bộ xử lý/tài nguyên ứng dụng cần thiết. Có dung lượng, tiến độ, lỗi, tiếp tục tải theo hợp đồng; chỉ báo sẵn sàng sau kiểm tra đầy đủ. Khi snapshot thay đổi phải đánh giá lại.

Hết dung lượng: không công nhận đầu ra hoàn chỉnh, giữ version trước, không tự xóa bản chưa đồng bộ. Cho giải phóng bản offline đã đồng bộ theo module offline; phân biệt thao tác này với xóa dự án server.

### 15.4. Đồng bộ và xác thực lại

- Online liên tục: lưu trên máy trước, tự đồng bộ đầu ra hoàn chỉnh.
- Sau mất mạng: có mạng/server trở lại thì hiện “Đồng bộ ngay”; không tự gửi phần tích lũy trước khi người dùng bấm, kể cả tab khác.
- Thành công mới bật lại tự đồng bộ đến lần mất mạng tiếp theo. Lỗi giữ dữ liệu và trạng thái chờ/thử lại.
- Lượt sync chụp snapshot đầu ra hoàn chỉnh; tác vụ còn chạy tiếp tục, kết quả mới thuộc lượt sau. ACK một phần phải hiển thị đúng phần còn chờ.
- Phiên hết hạn/thu hồi: giữ dữ liệu local, yêu cầu đăng nhập lại đúng tài khoản trước đồng bộ. Không để tài khoản khác nhận dữ liệu.
- Không dựa riêng navigator.onLine hoặc sự kiện đóng tab để bảo đảm sync.

### 15.5. Xung đột

Dữ liệu giữ hai phía bằng nhánh; cấu hình workflow/chart/dashboard giữ bản server và bản sao xung đột local. Hiển thị nguồn/revision và lựa chọn xem/chọn bản phù hợp; không tự gộp hoặc last-write-wins. Chọn cấu hình cần kiểm tra tham chiếu trước lưu.

Nếu server đã xóa tài nguyên, hiện trạng thái đã xóa và giữ dữ liệu local theo chính sách xử lý; không tự tái tạo dưới ID cũ/mới hoặc gửi lại liên tục. Không tự cung cấp nút hợp nhất dữ liệu nếu nghiệp vụ chưa hỗ trợ.

## 16. Tài khoản, OTP, nhiều tab và đăng xuất

### 16.1. Xác thực

- Ghi rõ đây là mật khẩu hệ thống, không phải mật khẩu hộp thư. Mật khẩu không trim/cắt âm thầm; validation đồng bộ hợp đồng backend. Chính sách độ dài do backend công bố, không hardcode khác nhau.
- OTP 6 chữ số, 5 phút, dùng một lần, gửi lại sau 60 giây, tối đa 5 lần sai/mã. Đồng hồ lấy mốc server; backend là nơi quyết định hiệu lực/rate limit.
- Hỗ trợ dán OTP và điều khiển bàn phím; gửi lại vô hiệu mã cũ theo API. Không báo email đã tới hộp thư chỉ vì provider nhận yêu cầu.
- Quên mật khẩu dùng thông báo chung không tiết lộ tài khoản. Sau reset thu hồi phiên cũ, không xóa dữ liệu local chưa đồng bộ; yêu cầu đăng nhập.
- Hệ thống tối đa 100 tài khoản kích hoạt; hiển thị lỗi hết suất khi backend từ chối, không tự đếm ở frontend.
- Đề xuất sau xác minh đăng ký chuyển đăng nhập; không tự tạo phiên nếu API không hỗ trợ.

### 16.2. Nhiều tab

Một project chỉ có một tab writer; các tab còn lại chỉ xem, có nút chuyển quyền. Chuyển phải dừng writer cũ an toàn trước writer mới; xử lý tác vụ đang chạy, khóa chết và kết quả muộn theo module offline. Các dự án khác nhau có thể chỉnh sửa ở các tab khác nhau. Khóa local không thay kiểm tra quyền/revision máy chủ.

### 16.3. Đăng xuất

| Tình huống | Hành vi |
| --- | --- |
| Offline còn thay đổi chưa đồng bộ | Chặn, giải thích và có Hủy |
| Offline không còn thay đổi chờ | Cho đăng xuất/xóa dữ liệu tài khoản local; thu hồi đúng phiên cũ khi có mạng |
| Online còn thay đổi chờ | Đồng bộ rồi đăng xuất / Vẫn đăng xuất / Hủy |
| Đồng bộ để đăng xuất thất bại | Giữ dữ liệu và trạng thái làm việc |
| Vẫn đăng xuất | Xác nhận mất phần chưa đồng bộ rồi xóa dữ liệu tài khoản local |
| Online không có thay đổi chờ | Đăng xuất/xóa dữ liệu tài khoản local |

Đăng xuất áp dụng mọi tab, dừng worker và ngăn request/kết quả cũ ghi lại dữ liệu. Nếu còn tác vụ đang chạy phải giải thích việc hủy và giải quyết trước khi chốt tập thay đổi. Không xóa dữ liệu đã đồng bộ trên server. Không tuyên bố hủy request có thể thu hồi nội dung provider đã nhận.

## 17. Xuất, báo cáo, xóa và trạng thái lỗi

- Xuất đúng nguồn CSV/JSON, biểu đồ, mô hình theo implementation; PDF chọn từng phần, xem trước, font tiếng Việt và chú thích nguồn/metric/lấy mẫu.
- Phân biệt tải tệp về máy với lưu report vào dự án. Tải đầu ra có sẵn có thể dùng quyền đọc; lưu artifact/config vào dự án cần quyền ghi.
- Không bắt buộc xuất/nhập gói toàn dự án, HTML report hoặc triển khai mô hình nếu chưa được giao.
- Xóa project/dataset chỉ online, vĩnh viễn; hiện phạm vi/nguồn/version/artifact, phụ thuộc và xác nhận. Chặn xóa dataset còn phụ thuộc ngoài phạm vi; không cascade ngầm.
- Tách đang yêu cầu xóa/đã đánh dấu xóa/đang dọn/xong theo API; không báo dọn vật lý xong sớm. Giải quyết tác vụ và thay đổi chờ trước xóa.
- Mỗi màn hình có loading, empty, no-result, partial-data, unavailable, forbidden/deleted và error phù hợp; không để canvas trắng hoặc spinner vô hạn.
- Lỗi có mã hỗ trợ/requestId an toàn, nội dung dễ hiểu, thử lại khi phù hợp; retry không tự tạo trùng tài nguyên. Toast cho thông báo ngắn; lỗi cần quyết định phải nằm trong panel/hộp thoại và còn xem được trong lịch sử.

## 18. Kiến trúc frontend và hợp đồng tích hợp đề xuất

### 18.1. Tách trách nhiệm

1. Lớp giao diện: layout, biểu mẫu, bảng, chart, canvas và thông báo.
2. Lớp điều phối nghiệp vụ: command, registry, validation, snapshot và lifecycle.
3. Lớp tính toán: worker/bộ xử lý, tiến độ/hủy/kết quả.
4. Lớp local/offline: kho bền vững, commit, outbox, manifest và quyền tab.
5. Lớp API: auth, project/artifact, sync, AI và lỗi có cấu trúc.

3D là lớp hiển thị/điều hướng; không giữ dữ liệu nghiệp vụ chuẩn trong đối tượng scene. UI không tự ghi vào nhiều kho hoặc gọi API sync từ từng component.

### 18.2. Trạng thái và thông điệp tối thiểu

| Hợp đồng | Trường/ý nghĩa cần thống nhất |
| --- | --- |
| WorkingContext | account/project/dataset/version/branch ID, revision và quyền hiện tại |
| OperationDefinition | operationId, nhãn, nhóm, schema tham số, loại đầu ra, capability và validator |
| PreviewResult | nguồn/cấu hình fingerprint, phạm vi tính, mẫu, thay đổi/cảnh báo và thời điểm |
| TaskCommand/Event | task/run ID, operation, snapshot nguồn, generation, progress/phase, kết quả hoặc mã lỗi |
| LocalCommitResult | đối tượng đã commit, artifact hoàn chỉnh, trạng thái chưa sync; không giả ACK server |
| SyncStatus | batch/mutation, snapshot, phần ACK/còn chờ, lỗi/conflict và trạng thái xác thực |
| OfflineManifest | snapshot/revision, tài nguyên cần/có/thiếu, kích thước/hash và mức đầy đủ |
| AiProposal | task, nguồn/context hash, provider/model, thao tác/cột/tham số, lý do và trạng thái duyệt |

Định dạng cụ thể phải khớp shared contracts/backend/offline; bảng trên là yêu cầu thông tin, không thay schema API. Mã ổn định từ registry dùng chung cho thao tác đơn, workflow và AI.

Tách state giao diện, dữ liệu server, dữ liệu local đã commit, tác vụ và biểu mẫu dở. Giữ ID/tham chiếu thay vì nhân bản toàn bảng vào nhiều store. Loại bỏ phản hồi muộn sai request/context/generation; worker hoàn thành sau logout hoặc mất quyền không được commit.

### 18.3. API và tài nguyên ứng dụng

Theo REST `/api/v1` và hợp đồng backend khi thống nhất. Phân biệt chưa xác thực, phiên thu hồi, sai quyền, đã xóa, conflict, thiếu artifact, vượt tài nguyên và payload không tương thích. Không coi mọi lỗi là mất mạng.

Tích hợp cùng origin qua webserver/HTTPS; không cache nhầm API riêng tư vào cache ứng dụng công khai. Tách kho dữ liệu tài khoản được module offline kiểm soát với cache shell/static. Không dựa cache API chung để làm offline.

Framework UI, router, state, bảng, chart, engine 3D và kho local là lựa chọn triển khai. Agent đề xuất một bộ gọn, kiểm tra tài liệu chính thức hiện hành về tương thích, offline, giấy phép và khả năng xuất; khóa phiên bản sau xác minh. Không thêm CDN/font/texture ngoài làm điều kiện chạy offline, không hứa thư viện hỗ trợ mọi thuật toán/định dạng khi chưa kiểm chứng.

## 19. Hiệu năng, khả năng tiếp cận và điện thoại

- Lazy-load chức năng nặng khi online và đưa vào danh mục chuẩn bị offline; không đánh dấu offline sẵn sàng khi thiếu module thực thi.
- Không giữ nhiều bản sao bảng/ma trận trong RAM; quản lý transfer, bộ đệm, worker và hủy để giải phóng tài nguyên. Kiểm tra nguy cơ ma trận đặc/bùng số dòng trước tạo.
- Ảo hóa/phân trang bảng, lấy mẫu render có thông báo, tải metadata đồ thị theo vùng/trang. Không giảm dữ liệu phân tích âm thầm để đạt tốc độ.
- Hạn chế render canvas khi ẩn, giảm hiệu ứng và có 2D fallback; đo trước khi đặt mục tiêu FPS/thời gian.
- Bàn phím dùng được với nút, form, menu và danh sách tương đương canvas. Focus rõ, nhãn đầy đủ, tương phản đủ ở cả theme, thông báo trạng thái đọc được ngoài canvas.
- Xoay canvas không chiếm con lăn của bảng/trang; chọn và kéo không kích hoạt nhầm thao tác. Giảm chuyển động theo lựa chọn và thiết lập hệ điều hành.
- Laptop/PC là phạm vi thao tác đầy đủ. Điện thoại ưu tiên danh sách dự án, đọc bảng/kết quả, dashboard/lịch sử đã có; dùng panel toàn chiều rộng/danh sách 2D và giảm số cột dashboard.
- Những thao tác cấu hình/chạy đầy đủ chưa được nghiệm thu cho điện thoại phải có thông báo chuyển sang laptop/PC; không hiển thị một giao diện desktop tràn màn hình như đã hỗ trợ.
- Mốc thử đề xuất: desktop 1366×768 và 1920×1080, điện thoại khoảng 390 px chiều rộng. Đây là ca thử, không phải breakpoint đã chốt hoặc cam kết chỉ hỗ trợ các kích thước này.

## 20. Phục hồi phiên và bảo vệ dữ liệu

Mở lại dự án phục hồi dataset/version/branch, màn hình và dashboard hợp lệ gần nhất, kể cả kết quả đã commit chưa đồng bộ. Không tự chạy lại tác vụ bị gián đoạn hoặc nhận bản dở là thành công. Thiếu tài nguyên/quyền thì báo rõ, mở màn hình khả dụng và giữ tiến độ chưa đồng bộ.

Mọi dữ liệu nhập, HTML, tên cột, công thức và phản hồi AI là dữ liệu không tin cậy; escape/sanitize phù hợp. Không render HTML thô, eval hoặc cho AI tự gọi command. Không đưa password/OTP/key vào URL, log, local store hoặc export. Validation client hỗ trợ UX, không thay kiểm tra quyền/đầu vào ở server.

## 21. Ma trận nghiệm thu frontend tối thiểu

| Mã | Tình huống | Kết quả cần quan sát |
| --- | --- | --- |
| FE01 | Đăng ký, OTP đúng/sai/hết hạn/gửi lại | Đúng mốc server và nhánh lỗi; không kích hoạt giả |
| FE02 | Quên mật khẩu/phiên bị thu hồi | Thông báo phù hợp, đăng nhập lại đúng tài khoản, không mất local chưa sync |
| FE03 | Mở project có nhiều dataset | Ngữ cảnh rõ; đổi nguồn không hiển thị nhầm kết quả |
| FE04 | Chọn khối 3D và thao tác bằng 2D | Cùng chức năng/validator, không chạy ngay khi chọn khối |
| FE05 | Mở phương pháp có nhiều tham số | Hiện đủ tham số ngay; cuộn được; không ẩn phần chuyên môn |
| FE06 | Đổi tham số sau preview | Preview cũ vô hiệu, không áp nhầm |
| FE07 | Xóa HTML/điền missing/biến đổi | Preview đúng, commit xong mới thành công, version bất biến |
| FE08 | Lọc bảng và áp bộ lọc | Lọc xem không tạo version; áp dụng mới tạo version |
| FE09 | Import CSV/JSON, flatten, lỗi/mất mạng | Dataset mới/V0 đúng hợp đồng, không bung mảng hoặc nhận nhập dở là xong |
| FE10 | Nối/ghép, khóa trùng/nhiều–nhiều/offline | Cảnh báo số dòng/bộ nhớ, đúng nguồn, dataset mới; chặn offline |
| FE11 | Quy trình lỗi/hủy bước 3 | Giữ commit bước 1–2, không đầu ra dở, không tự chạy tiếp |
| FE12 | Huấn luyện từng thuật toán bản đầu | Form/validation/metric đúng bài toán, split/fit đúng và không tiến độ giả |
| FE13 | Chọn AI, đưa đề xuất vào cấu hình | Không chat/RAG, không tự thực thi, giữ draft và nguồn đúng |
| FE14 | AI cần row payload, đổi payload/key lỗi | Duyệt đúng nội dung, đồng ý cũ mất hiệu lực, không fallback provider/key ngầm |
| FE15 | Lưu key riêng, reload/logout | Không key bền trong kho/log/export; nhập lại khi cần |
| FE16 | Tạo chart/PCA scatter và đổi nguồn | Trục/metric/lineage đúng; giữ chart cũ nếu nguồn mới không hợp lệ |
| FE17 | Dashboard 1/2/3 cột, đổi thứ tự | Lưu/phục hồi đúng, điện thoại giảm cột; bỏ chart khỏi dashboard không xóa nguồn |
| FE18 | Cây version, nhiều nguồn, quay lại bản cũ | Nguồn/nhánh đúng; tiếp tục biến đổi tạo nhánh, không xóa bản mới |
| FE19 | Đổi màn hình/nguồn khi task chạy | Task giữ snapshot; kết quả muộn không gắn nguồn mới hoặc tự chuyển màn hình |
| FE20 | Mất mạng, tạo version rồi có mạng | Lưu local; chờ Đồng bộ ngay; mọi tab tuân thủ trạng thái chờ |
| FE21 | Sync đang có task chạy/ACK một phần | Chỉ xác nhận đúng snapshot/đối tượng, phần mới còn chờ |
| FE22 | Tải offline dở/thiếu artifact/refresh | Không báo sẵn sàng giả; mở đúng commit gần nhất, không tự chạy lại |
| FE23 | Hai tab/chuyển quyền/tab chết | Một writer/project, không commit muộn bằng quyền cũ |
| FE24 | Conflict dữ liệu và cấu hình | Giữ nhánh/bản sao hai phía, không ghi đè hoặc gộp ngầm |
| FE25 | Logout theo mọi nhánh | Đúng lựa chọn, giữ dữ liệu khi sync lỗi, chặn worker/request ghi lại |
| FE26 | Hết dung lượng/lỗi lưu/worker crash | Không báo thành công, giữ version trước, có cách xử lý |
| FE27 | Xóa offline/còn phụ thuộc/server đã xóa | Chặn đúng, hiện phạm vi, không cascade hoặc tái sinh |
| FE28 | Xuất CSV/JSON/chart/model/PDF offline | Đúng nguồn, font/nội dung, không bắt lưu report vào project |
| FE29 | Theme, bàn phím, giảm chuyển động, 3D lỗi | Đọc/điều hướng được, fallback 2D còn đủ chức năng |
| FE30 | Laptop và điện thoại | Desktop thao tác đầy đủ; điện thoại xem rõ trong phạm vi đã chốt |
| FE31 | Tài khoản khác/deep link/HTML/AI output độc hại | Không rò dữ liệu, không thực thi nội dung, không vượt quyền |

Đối chiếu thêm AC01–AC30 của tài liệu chức năng, tiêu chí offline/backend/3D và điều kiện cây nút. Đây là kế hoạch nghiệm thu, không tuyên bố đã chạy test khi mới hoàn thành tài liệu. Khi triển khai, kiểm thử đơn vị cho validator/điều phối có rủi ro, tích hợp local–worker–API và E2E cho luồng cốt lõi; kiểm tra giao diện bằng ảnh chụp ở các kích thước/theme đã chọn.

## 22. Sản phẩm agent phải bàn giao

1. Bảng yêu cầu đã chốt/đề xuất/điểm chưa xác minh và ma trận đối chiếu nguồn.
2. Sitemap/route và wireframe các màn hình chính, thể hiện vị trí panel/AI/kết quả.
3. Bộ token/component và trạng thái sáng/tối, bàn phím, lỗi/loading/empty/disabled.
4. Đặc tả tương tác của từng màn hình: nguồn, quyền, tham số, validation, preview, thực thi, lưu, lỗi và offline.
5. Hợp đồng tích hợp registry, worker, local/offline, auth/API, AI, chart và 3D; tránh nhân đôi logic.
6. Luồng hoàn chỉnh: nhập → kiểm tra → xử lý → version → huấn luyện/chart → xuất; kèm nhánh offline/conflict/logout.
7. Quy tắc phục hồi phiên, nhiều tab, tác vụ muộn, thiếu tài nguyên và suy giảm 2D.
8. Đề xuất bộ công nghệ có nguồn chính thức khi chốt, kế hoạch triển khai và ca nghiệm thu với bằng chứng thực tế sau triển khai.

**Ưu tiên chất lượng:** người dùng luôn biết mình đang xử lý nguồn nào, được phép làm gì, tham số nào đang dùng, kết quả đã commit ở đâu và đã đồng bộ hay chưa. Bản đồ 3D giúp định hướng; biểu mẫu đầy đủ và trạng thái chính xác giúp thực hiện công việc chuyên ngành.


## Phụ lục v2 — Hợp đồng tích hợp của FE

- C01, C05: enable/disable/context/preview.
- C07–C11: OTP/import/sync/conflict.
- C13–C16: readiness/chart/scene/consent.
- C18, C20: lỗi/capability/limits.

UI lấy policy/limits/engine params từ hợp đồng capability cùng version, không hardcode khác backend. Kết quả task nguồn cũ không đổi context hiện hành. Nhãn local/server/import phải đúng C08; needsReauth không xóa outbox. Tạo/tải PDF không bắt lưu report. Mọi trạng thái chặn có lý do bằng chữ ngoài canvas.

Agent phải dùng [hợp đồng chung](hop_dong_tich_hop.md), [quyết định/nghiệm thu](quyet_dinh_va_nghiem_thu.md) và tám prompt v2 cùng bộ. Bàn giao bảng field/schema chi tiết và fixtures đúng hợp đồng trước khi tích hợp; không tạo API/serializer/state machine riêng mâu thuẫn. Chỉ sinh mã khi có nhiệm vụ triển khai riêng. Tài liệu này không xác nhận đã kiểm thử nguồn kỹ thuật, package, nhà cung cấp hoặc hiệu năng.
