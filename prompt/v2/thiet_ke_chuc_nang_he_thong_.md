# Prompt giao nhiệm vụ cho Agent — Thiết kế chức năng hệ thống

> **Bản hợp nhất v2 — 02/11/2026.** Giữ yêu cầu và ma trận chuyên ngành của bản gốc; cập nhật các quyết định đã chốt và dùng [hợp đồng C01–C22](hop_dong_tich_hop.md). Đọc [README](README.md) để phân biệt yêu cầu sản phẩm P, thiết kế kỹ thuật T, điểm kiểm chứng V và quyết định mới Q. Tài liệu gốc nằm ở thư mục cha, không bị sửa. Đây chưa phải mã nguồn hoặc bằng chứng đã kiểm thử.

**Đề tài:** Xây dựng hệ thống dashboard tương tác 3D quản lý và trực quan hóa toàn bộ quy trình khai phá dữ liệu.

**Ngôn ngữ tài liệu và giao diện:** Tiếng Việt.

**Trạng thái:** Tổng hợp yêu cầu đã trao đổi và chốt với người dùng ngày 02/11/2026. Đây là đặc tả yêu cầu và prompt thiết kế, không phải báo cáo đã triển khai.

## 1. Vai trò, nhiệm vụ và phạm vi

Bạn là chuyên viên phân tích nghiệp vụ và kiến trúc sư phần mềm JS/TS. Hãy dùng các yêu cầu dưới đây để thiết kế chức năng hệ thống đủ cụ thể cho agent lập trình triển khai.

Tài liệu này là đặc tả nghiệp vụ chung: hệ thống phục vụ ai, gồm những đối tượng nào, người dùng làm gì, đầu vào/đầu ra, điều kiện thực hiện, kết quả được lưu ra sao và các module phối hợp thế nào.

Đọc và đối chiếu các tài liệu được cung cấp:

- `thiet_ke_caynut_dieukien.md`: danh mục thao tác, cây chức năng và điều kiện từng nút.
- `thiet_ke_mongodb.md`: lưu trữ máy chủ, phiên bản, lịch sử và quyền sở hữu.
- `thiet_ke_offline.md`: thực hiện trong browser, lưu cục bộ, đồng bộ, phiên đăng nhập và nhiều tab.
- Các tài liệu 3D, frontend, backend và Nginx nếu thực tế được cung cấp. Không tuyên bố đã đọc tài liệu chưa có.

Các quyết định được chốt trong tài liệu này bổ sung yêu cầu cũ. Chi tiết cơ chế offline giữ theo file offline; không lặp lại một quy tắc khác làm thay đổi hành vi. Nếu phát hiện xung đột chưa giải quyết, nêu rõ nguồn, ảnh hưởng và phương án; không âm thầm bỏ yêu cầu.

Nhiệm vụ hiện tại là thiết kế. Chỉ triển khai hoặc sửa repository khi được giao riêng. Không tự triển khai dịch vụ công khai, tạo tài nguyên trả phí hoặc sửa ba file nguồn trong nhiệm vụ này.

## 2. Nguyên tắc chung

1. Website truy cập bằng đường link. Người dùng không phải cài Node.js, MongoDB, Docker hoặc Nginx trên máy.
2. Frontend, backend và xử lý khai phá dữ liệu sử dụng JavaScript/TypeScript. Không dùng Python cho xử lý hoặc huấn luyện.
3. Backend và MongoDB chạy trên máy chủ; dữ liệu offline nằm trong browser theo thiết kế offline. Browser không kết nối trực tiếp MongoDB bằng thông tin đăng nhập database.
4. Người dùng thao tác qua menu, nút, biểu mẫu và danh sách lựa chọn; không cần viết code trong IDE.
5. Hỗ trợ nhiều bộ dữ liệu khác nhau trong phạm vi định dạng, dung lượng và điều kiện thuật toán; không hardcode tên cột hoặc lĩnh vực.
6. Không tự thay dữ liệu, chọn phương pháp rồi chạy, giảm mẫu, bỏ dòng lỗi hoặc gộp nhánh mà không cho người dùng biết và xác nhận phù hợp.
7. Phân biệt xem trước, chạy thực tế, lưu trên máy và đồng bộ lên máy chủ.
8. Không công bố kết quả dở dang hoặc kết quả giả là thành công. Dữ liệu gốc bất biến.
9. Tính toán nặng chạy trong worker để giữ giao diện có thể tương tác. Có tiến độ/trạng thái, hủy và thông báo lỗi.
10. Bản đầu ưu tiên laptop/PC, Chrome và Edge. Mục tiêu kiểm thử: khoảng 10.000–50.000 dòng, khoảng tối đa 50 cột đầu vào, 20 MB/tệp; không phải cam kết mọi thuật toán đều xử lý nhanh ở mức này.
11. Giới hạn sau parse, sau ghép bảng, encoding và TF-IDF phải được kiểm tra riêng. Không coi 50 cột đầu vào là giới hạn đã chốt cho ma trận đặc trưng sau biến đổi; agent phải đề xuất giới hạn có thể cấu hình và kiểm thử.

## 3. Người dùng, tài khoản và quyền sở hữu

- Ai có link cũng mở được website, nhưng phải đăng nhập để làm việc với dữ liệu.
- Mỗi tài khoản làm việc với tài nguyên riêng; không chia sẻ, cộng tác hoặc phân vai admin/editor/viewer.
- Vẫn bắt buộc kiểm tra quyền sở hữu ở mọi API và mọi tham chiếu dữ liệu. Không có phân vai không có nghĩa là không có kiểm soát truy cập.
- Đăng ký, đăng nhập mới và quên mật khẩu cần Internet. Hình thức đã chốt là email và mật khẩu riêng hệ thống, xác minh đăng ký bằng OTP email; không phải mật khẩu hộp thư. OTP 6 số, 5 phút, một lần, gửi lại sau 60 giây, tối đa 5 lần sai/mã. Mail provider chưa chọn; auth/session theo C07.
- Một tài khoản chỉ có một phiên trực tuyến hợp lệ trên một máy tại một thời điểm. Các tab cùng browser profile dùng chung phiên.
- Máy offline không thể nhận thu hồi phiên tức thời. Khi kết nối lại phải xác thực trước đồng bộ; không xóa dữ liệu chưa đồng bộ vì hết hạn hoặc thu hồi phiên.
- Một dự án chỉ có một tab giữ quyền chỉnh sửa; tab khác chỉ xem và có chức năng chuyển quyền an toàn. Các dự án khác nhau có thể được sửa ở các tab khác nhau.
- Chi tiết đăng xuất, thu hồi phiên và dữ liệu cục bộ theo mục 15 của tài liệu này và file offline.

## 4. Các đối tượng nghiệp vụ

| Đối tượng | Ý nghĩa và quan hệ |
| --- | --- |
| Tài khoản | Chủ sở hữu các dự án và tài nguyên liên quan |
| Dự án | Không gian chứa nhiều bộ dữ liệu, quy trình, biểu đồ, dashboard, lần chạy và mô hình |
| Bộ dữ liệu | Một nguồn dữ liệu logic, có dữ liệu gốc và lịch sử phiên bản riêng |
| Phiên bản dữ liệu | Kết quả hoàn chỉnh, bất biến, có nguồn gốc và thao tác tạo ra nó |
| Nhánh phiên bản | Các hướng xử lý khác nhau phát sinh sau hoàn tác hoặc xung đột đồng bộ |
| Quy trình | Danh sách có thứ tự các bước và tham số, có thể lưu và chạy lại |
| Lần chạy | Một lần thực thi thao tác hoặc quy trình, gắn với đầu vào và cấu hình tại thời điểm chạy |
| Biểu đồ | Cấu hình và tham chiếu tới đúng phiên bản/kết quả dùng để hiển thị |
| Dashboard | Một trang tổng hợp biểu đồ trong dự án; một dự án có nhiều dashboard |
| Mô hình | Thuật toán đã huấn luyện cùng cấu hình, đặc trưng, tiền xử lý và chỉ số |
| Báo cáo | PDF được tạo từ nội dung người dùng chọn và các phiên bản/lần chạy xác định |

Không dùng lẫn “dự án”, “bộ dữ liệu” và “phiên bản”. Nếu database dùng `workspace`, phải chỉ rõ ánh xạ với tài khoản/dự án; không mặc định workspace là bộ dữ liệu. Bảng này là mô hình nghiệp vụ, không bắt buộc một collection cho mỗi đối tượng hoặc mỗi nút.

## 5. Hai chế độ làm việc

### 5.1. Thực hiện từng thao tác — luồng chính

Người dùng không phải cấu hình toàn bộ quy trình từ đầu.

**Chọn dữ liệu/phiên bản → chọn thao tác → cấu hình → kiểm tra → xem trước → xác nhận áp dụng → chạy → lưu kết quả hoàn chỉnh → hiển thị kết quả → chọn bước tiếp theo.**

Ví dụ: nhập dữ liệu tạo V0 → xóa HTML tạo V1 → xem V1 → điền missing tạo V2 → xem V2 → tạo biểu đồ hoặc huấn luyện.

- Mỗi biến đổi thành công tạo phiên bản riêng, được lưu trước khi báo hoàn tất.
- Người dùng có thể dừng, đổi phương pháp, hoàn tác hoặc chuyển sang khám phá dữ liệu.
- Hệ thống ghi lại thao tác và cấu hình để người dùng lưu thành quy trình.
- Xem trước, thống kê, tìm kiếm và thay đổi cách hiển thị không tạo phiên bản dữ liệu.
- Với huấn luyện/đánh giá, xem trước là tóm tắt cấu hình, dữ liệu và điều kiện; không giả lập chỉ số đánh giá trước khi chạy.

### 5.2. Chạy một quy trình đã cấu hình

- Người dùng thêm/sắp xếp/cấu hình các bước trước, hoặc mở quy trình đã lưu.
- Kiểm tra cấu trúc và điều kiện biết được trước khi chạy. Kiểm tra lại dữ liệu thực tế trước từng bước vì đầu ra bước trước có thể thay đổi điều kiện.
- Bấm chạy một lần, hệ thống thực hiện tuần tự. Đầu ra dữ liệu của bước trước là đầu vào bước tiếp theo.
- Không bắt xác nhận lại sau mỗi bước bình thường; nếu cần quyết định ngoài cấu hình đã duyệt thì tạm dừng để người dùng quyết định.
- Mỗi bước biến đổi thành công vẫn tạo phiên bản riêng. Các bước chỉ đọc hoặc tạo artifact không tạo phiên bản dữ liệu không cần thiết.
- Nếu bước 3 lỗi, giữ kết quả hoàn chỉnh của bước 1–2, dừng bước 3 và không chạy bước 4. Lần chạy được ghi là thất bại sau khi đã hoàn thành một số bước.
- Nếu hủy, giữ các bước đã commit; bỏ đầu ra dở của bước đang chạy.
- Chạy tiếp sau sửa lỗi phải là hành động chủ động; kiểm tra lại đầu vào/cấu hình. Không tự chạy tiếp sau refresh hoặc khi có mạng trở lại.
- Đề xuất cách liên kết lượt chạy tiếp với lượt trước để giữ lịch sử chính xác, không sửa cấu hình lịch sử đã chạy.

## 6. Quản lý dự án và nạp dữ liệu

### 6.1. Dự án

- Tạo, liệt kê, mở và đổi tên dự án.
- Mỗi dự án chứa nhiều bộ dữ liệu, mỗi bộ có phiên bản riêng.
- Hiển thị số bộ dữ liệu, lần mở/cập nhật gần nhất, trạng thái lưu/đồng bộ và mức sẵn sàng offline.
- Chỉ tạo dự án mới khi online. Có thể mở offline nếu đã có đủ tài nguyên cần thiết.
- Xóa dự án chỉ khi online, xác nhận rõ trước khi xóa vĩnh viễn; không có thùng rác trong phạm vi đã chốt.

### 6.2. Nhập CSV/JSON

- Mỗi lần nhập tệp mới tạo một bộ dữ liệu mới trong dự án. Không thay thế ngầm nguồn của bộ hiện có hoặc tự nối vào bộ cũ.
- Chỉ nhập tệp mới khi online. Excel và kết nối database nguồn nằm ngoài phạm vi bản đầu.
- CSV: chọn dấu phân cách, encoding, dòng tiêu đề; xem trước và phát hiện dòng/cột lệch, tên cột trùng, dữ liệu không đọc được.
- JSON: xem cấu trúc, chọn danh sách bản ghi, cấu hình làm phẳng object thành cột.
- Bản đầu chưa bung mảng thành nhiều dòng. Nếu có mảng, yêu cầu chọn cách giữ nguyên/biểu diễn dạng JSON hoặc không chọn trường đó; không tự nhân dòng hay loại thông tin.
- Đường dẫn cột làm phẳng phải tránh va chạm tên. Nếu cấu trúc không chuyển được thành bảng trong phạm vi hỗ trợ, báo rõ trước khi áp dụng.
- Giữ nguyên tệp nguồn và cấu hình đọc. V0 là bảng đã parse được chấp nhận; phân biệt V0 với byte của tệp gốc.
- Hiển thị tên tệp, định dạng, dung lượng, số dòng/cột, kiểu dữ liệu suy luận và cảnh báo.
- Tệp rỗng, cấu trúc sai, vượt giới hạn hoặc không đọc được phải có lỗi cụ thể; không tạo bộ dữ liệu thành công trỏ tới nội dung chưa lưu đầy đủ.

### 6.3. Kết hợp bộ dữ liệu

Đã chốt hỗ trợ cả nối dòng và ghép bảng theo khóa. Người dùng chọn các bộ dữ liệu/phiên bản đã có; đây là thao tác riêng, không thay đổi quy tắc nhập tệp.

**Nối dòng:** chọn nguồn, ánh xạ cột, kiểm tra tên/kiểu cột, quy định cột thiếu và xem trước số dòng/cột đầu ra. Không tự loại dòng trùng nếu chưa cấu hình.

**Ghép bảng:** chọn hai nguồn, cột khóa tương ứng, kiểm tra kiểu khóa, khóa thiếu/trùng, xung đột tên cột và nguy cơ quan hệ nhiều–nhiều làm tăng số dòng. Hiển thị dự kiến số dòng khớp/không khớp trước khi áp dụng.

Các chi tiết đã được chốt bổ sung tại backend §2.1 và frontend §8.2:

- Nối/ghép chạy trong browser, chỉ được khởi chạy online; đầu ra là dataset dẫn xuất mới với V0, giữ mọi phiên bản nguồn.
- Bản đầu hỗ trợ inner join và left join. Right/full join là mở rộng chưa hỗ trợ.
- Mất mạng sau khi khởi chạy hợp lệ xử lý theo C08; không cho bắt đầu import/nối/ghép mới offline.

Không giả định bộ dữ liệu dẫn xuất chỉ có một nguồn cha; phải truy vết được cả hai hoặc nhiều nguồn.

## 7. Kiểm tra, khám phá và làm sạch

### 7.1. Kiểm tra dữ liệu thô

- Phát hiện HTML, ký tự lỗi, khoảng trắng, xuống dòng không nhất quán, kiểu dữ liệu có khả năng sai, missing, trùng lặp và giá trị ngoài phạm vi cấu hình.
- Xử lý HTML: bỏ thẻ, giải mã entities, loại nội dung script/style khi trích văn bản, so sánh trước/sau.
- Hiển thị dữ liệu đầu vào an toàn, không thực thi HTML/script. Không dùng `eval` để xử lý biểu thức người dùng.
- Không tự coi 0, dấu gạch ngang hoặc chuỗi `null` là missing trong mọi trường hợp.
- Chuyển kiểu phải cấu hình cách hiểu ngày tháng, dấu thập phân và hàng nghìn; liệt kê giá trị không chuyển được. Không âm thầm chuyển lỗi thành null.
- Phát hiện vấn đề chỉ tạo báo cáo/gợi ý; áp dụng sửa mới tạo phiên bản.

### 7.2. Khám phá dữ liệu

- Tổng số dòng/cột, schema, tỷ lệ missing, số giá trị duy nhất, thống kê mô tả và tần suất.
- Tìm kiếm, lọc, sắp xếp, chọn cột hiển thị trên bảng chỉ thay đổi cách xem.
- Nếu muốn giữ tập dòng đã lọc, dùng thao tác áp dụng bộ lọc tạo phiên bản riêng.
- Phát hiện IQR/Z-score chỉ đánh giá theo điều kiện phù hợp; không đồng nhất mọi điểm ngoài ngưỡng với lỗi dữ liệu.
- Chỉ tính thống kê khi dữ liệu đáp ứng điều kiện; giải thích khi không thể tính.

### 7.3. Các thao tác làm sạch nền tảng

- Xóa/đổi tên/chuyển kiểu/tách/gộp cột.
- Lọc/xóa dòng theo điều kiện, xóa dòng trùng lặp.
- Trim, chuẩn hóa xuống dòng, hoa/thường và ký tự theo tùy chọn.
- Missing: xóa dòng, điền hằng số, mean, median, mode.
- Outlier: IQR/Z-score, đánh dấu, loại bỏ hoặc giới hạn giá trị theo ngưỡng.
- Chuẩn hóa đơn vị chỉ khi có quy tắc chuyển đổi rõ ràng.
- Phát hiện và cảnh báo phụ thuộc nếu cột đang được quy trình/biểu đồ/mô hình sử dụng.

## 8. Toàn bộ các phương pháp tiền xử lý bổ sung đã chốt

Người dùng chọn một phương pháp cho mỗi thao tác, chọn cột/nhóm và tham số, xem trước rồi xác nhận. Có thể chạy nhiều thao tác kế tiếp hoặc ghép thành quy trình. AI có thể gợi ý nhưng không thay người dùng quyết định.

| Phương pháp | Cấu hình và kiểm tra bắt buộc |
| --- | --- |
| Điền missing theo nhóm | Cột nhóm, cột cần điền, phép tính phù hợp, số mẫu hợp lệ tối thiểu và cách xử lý nhóm không đủ dữ liệu; không tự điền bằng thống kê toàn cục |
| Forward Fill | Cột thứ tự, chiều sắp xếp, cột nhóm tùy chọn, giới hạn khoảng thiếu; không lan giá trị sang đối tượng/nhóm khác |
| Backward Fill | Điều kiện tương tự Forward Fill; cảnh báo nếu dùng giá trị tương lai trong bài toán dự đoán |
| Nội suy tuyến tính | Cột số cần điền, trục thứ tự phù hợp, xử lý mốc trùng, giới hạn khoảng thiếu và biên; không tự ngoại suy |
| Cột đánh dấu missing | Ghi nhận ô thiếu trước khi điền, tên cột mới không trùng, giá trị cờ nhất quán |
| Ordinal Encoding | Danh sách thứ tự do người dùng xác nhận, xử lý nhóm chưa biết/thiếu; không tự gán thứ tự cho dữ liệu không có thứ bậc |
| Robust Scaling | Trung vị, khoảng tứ phân vị hoặc khoảng phân vị cấu hình; xử lý khoảng phân vị bằng 0 |
| Biến đổi log | Chọn cơ số hoặc log1p nếu hỗ trợ, kiểm tra miền xác định; không tự cộng hằng số để ép dữ liệu hợp lệ |
| Binning | Ngưỡng hoặc cách chia khoảng, nhãn, biên đóng/mở, giá trị ngoài khoảng và missing |
| Phát hiện/loại cột hằng | Danh sách cột và số giá trị khác nhau, quy tắc tính missing; người dùng xác nhận trước khi loại |
| TF-IDF | Cột văn bản, tokenization, hoa/thường, stopwords, n-gram, giới hạn từ vựng/tần suất và cách xử lý văn bản rỗng; xem số đặc trưng/dung lượng dự kiến |

Giữ cả các phương pháp trong cây nút: Label Encoding, One-Hot Encoding, Min-Max Scaling, Standard Scaling, tạo đặc trưng bằng biểu thức giới hạn, tách ngày/tháng/năm, ghép văn bản và chọn cột đầu vào/mục tiêu.

Phân biệt Label Encoding với Ordinal Encoding; không để thuật toán hiểu sai mã số của nhóm không có thứ tự. Chặn ma trận đặc trưng quá lớn trước khi cấp phát, kể cả ma trận thưa bị chuyển thành ma trận đặc. Nêu giới hạn riêng của từng thuật toán với đầu vào TF-IDF/one-hot.

## 9. Quy trình lưu và chạy lại

- Hỗ trợ cả ghi lại thao tác đã làm và tự xây danh sách bước trước khi chạy.
- Tạo, lưu, đổi tên, mở, chỉnh cấu hình, chạy và hủy lượt chạy.
- Quy trình gồm mã thao tác ổn định, thứ tự, tham số, cột yêu cầu và điều kiện kiểu dữ liệu.
- Có thể chạy trên bộ dữ liệu khác phù hợp. Cho ánh xạ cột, ví dụ `salary → luong`, rồi kiểm tra lại kiểu, vai trò và các điều kiện.
- Không chỉ so tên cột rồi coi tương thích. Nếu không đủ điều kiện, chỉ rõ bước/cột cần sửa.
- Lưu snapshot cấu hình tại thời điểm chạy; chỉnh quy trình không sửa lịch sử cũ.
- Lịch sử từng bước gồm trạng thái, đầu vào, đầu ra, thời gian, lỗi/cảnh báo và lý do hủy.
- Các bước huấn luyện, thống kê hoặc tạo biểu đồ có đầu ra riêng; không ép tất cả bước thành biến đổi bảng.

## 10. Khai phá dữ liệu và đánh giá mô hình

### 10.1. Phạm vi bản đầu bắt buộc

| Thuật toán | Bài toán và điều kiện chính |
| --- | --- |
| Linear Regression | Hồi quy, mục tiêu dạng số, đặc trưng đầu vào hợp lệ |
| Logistic Regression | Phân lớp, cột nhãn hợp lệ, đủ lớp/mẫu cho cấu hình đánh giá |
| KNN | Phạm vi phân lớp được nêu rõ; số láng giềng không vượt mẫu train, cấu hình khoảng cách và scaling phù hợp |
| K-Means | Phân cụm, đặc trưng số, số cụm hợp lệ, xử lý trường hợp không đủ điểm khác nhau |
| PCA | Giảm chiều, số thành phần hợp lệ với số mẫu/đặc trưng, không mặc định là mô hình dự đoán |

KNN hồi quy là mở rộng nếu chưa được xác nhận riêng. Decision Tree, Random Forest, DBSCAN, phân cụm phân cấp, Apriori, FP-Growth và các thuật toán khác trong cây nút thuộc danh mục mở rộng, không phải bắt buộc đợt đầu.

- Hệ thống gợi ý loại bài toán/thuật toán dựa trên kiểu, vai trò cột và mục tiêu người dùng; nêu lý do, người dùng xác nhận. Không suy luận chắc chắn bài toán chỉ từ dtype của nhãn.
- Năm thuật toán bản đầu phải chạy trong browser cả online/offline khi đủ dữ liệu và tài nguyên.
- Nêu rõ hỗ trợ phân lớp nhị phân/đa lớp theo thư viện thực tế; không tự hứa khả năng chưa kiểm chứng.
- Chọn cột đầu vào, cột mục tiêu nếu cần, tham số và seed khi thuật toán hỗ trợ.
- Kiểm tra thiếu, vô hạn/NaN, số lớp, số mẫu, cột hằng, số đặc trưng, tham số và chi phí tính toán.
- Có chạy/hủy, tiến độ hoặc trạng thái trung thực; không dựng phần trăm giả.

### 10.2. Chia tập và tránh rò rỉ dữ liệu

- Bản đầu dùng train/test, người dùng chỉnh tỷ lệ và seed. K-fold và tìm siêu tham số tự động là mở rộng.
- Với phân lớp, đề xuất chia có bảo toàn tỷ lệ lớp khi phù hợp và kiểm tra đủ mẫu mỗi lớp.
- Split phải diễn ra trước khi fit các bước học tham số: mean/median, scaling, vocabulary TF-IDF, encoding có học nhóm, PCA và các bước tương tự.
- Chỉ fit trên train, áp dụng tham số đã học sang test. Lưu split và cấu hình để truy vết.
- Nếu người dùng đã tạo phiên bản bằng tiền xử lý học trên toàn bộ dữ liệu, phải cảnh báo nguy cơ rò rỉ. Đề xuất dựng lại chuỗi tiền xử lý từ phiên bản phù hợp trong luồng huấn luyện, không coi việc split sau đó là đã khắc phục.
- Phân biệt tiền xử lý khám phá toàn bộ dữ liệu với pipeline đánh giá mô hình. Bản fit trung gian của train/test không tự trở thành phiên bản đầy đủ của dataset.
- PCA/K-Means không tự dùng cột mục tiêu hoặc trình bày chỉ số như bài toán supervised.

### 10.3. Kết quả và lưu mô hình

- Phân lớp: Accuracy, Precision, Recall, F1, ma trận nhầm lẫn; nêu cách tính cho nhiều lớp và trường hợp không xác định.
- Hồi quy: MAE, MSE, RMSE, R²; giải thích chỉ số không tính được hoặc không có ý nghĩa.
- Phân cụm: kích thước cụm, Silhouette khi đủ điều kiện; tính toán phải có giới hạn chi phí, lấy mẫu cần thông báo.
- PCA: phương sai giải thích, phương sai tích lũy, tọa độ giảm chiều và tham chiếu dòng gốc.
- So sánh lần chạy phải hiển thị phiên bản dữ liệu, split, đặc trưng và chỉ số; cảnh báo khi điều kiện đánh giá khác nhau.
- Cho lưu và tải mô hình theo định dạng phù hợp với thư viện JS/TS thực tế; lưu kèm cấu hình và thông tin tiền xử lý cần thiết.
- Bản đầu chỉ xem đánh giá và tải mô hình. Không có chức năng nhập mẫu hoặc tệp mới để dự đoán bằng mô hình đã lưu.

## 11. AI/LLM hỗ trợ

### 11.1. Phạm vi

AI hỗ trợ giải thích chất lượng dữ liệu, đề xuất làm sạch/tiền xử lý, biểu đồ, thuật toán, giải thích kết quả và đề xuất điền văn bản thiếu khi thích hợp.

- AI chỉ gợi ý và giải thích lý do, điều kiện, cột liên quan và ảnh hưởng dự kiến.
- Người dùng chấp nhận, đổi cấu hình hoặc bỏ qua. Không tự chạy hoặc sửa dữ liệu.
- Đề xuất AI vẫn phải qua cùng validator của thao tác. AI không vượt qua điều kiện offline, giới hạn bộ nhớ hoặc quyền sở hữu.
- Không dùng AI để tự tính chỉ số thay module tính toán; giải thích phải dựa trên kết quả thực tế.
- Chỉ hoạt động khi có Internet và dịch vụ khả dụng. AI lỗi không chặn các thao tác thông thường.

### 11.2. Ưu tiên phương pháp thông thường trước khi điền bằng AI

1. Xác định loại dữ liệu, vai trò và ngữ cảnh của cột.
2. Đề xuất phương pháp phù hợp: mean/median cho số; mode/hằng số cho nhóm; theo nhóm hoặc quy tắc nghiệp vụ; ffill/nội suy khi có thứ tự phù hợp.
3. Với văn bản, cân nhắc giữ thiếu, giá trị cố định, tra cứu và quy tắc từ thông tin có sẵn.
4. Chỉ khi cách thông thường không phù hợp và có đủ ngữ cảnh mới đề xuất AI điền văn bản.
5. Cho xem trước, đánh dấu nguồn AI và người dùng xác nhận trước khi tạo phiên bản.

Không thử mean/median trên văn bản. Max chỉ dùng khi có ý nghĩa nghiệp vụ, không mặc định là cách điền. Không coi việc phương pháp thường không phù hợp là bằng chứng AI biết giá trị đúng. Cho phép kết quả “Không đủ thông tin để điền”; không suy diễn sự thật không có căn cứ.

### 11.3. Dữ liệu gửi tới AI

- Mặc định chỉ gửi thông tin tổng hợp và schema cần thiết, giảm tối đa nội dung nhạy cảm.
- Nếu cần mẫu hoặc ngữ cảnh từng dòng, hiển thị chính xác phần sẽ gửi và được người dùng đồng ý trước khi gửi.
- Không tự gửi toàn bộ dataset, bí mật đăng nhập hoặc dữ liệu của dự án khác.
- Lưu thông tin đủ truy vết thay đổi được chấp nhận, nhưng không ghi log dữ liệu nhạy cảm không cần thiết.
- Xem nội dung dataset và phản hồi AI là dữ liệu; không coi chúng là lệnh thực thi hoặc quyền gọi API.
- Nhà cung cấp AI, chi phí và hạn mức chưa chọn; có dịch vụ chung và key riêng theo adapter. Key riêng chỉ RAM theo phiên, không lưu bền. AI theo ngữ cảnh, không chatbot/RAG; consent và audit theo C16.

## 12. Biểu đồ, dashboard và tương tác 3D

### 12.1. Biểu đồ

Hỗ trợ Histogram, Box plot, Bar chart dọc/ngang, Line chart, Scatter plot, Heatmap tương quan, Pie/Donut và Scatter 3D theo cây nút.

- Cấu hình thay đổi theo loại biểu đồ: cột X/Y/Z, màu, kích thước, nhóm, phép gộp, sắp xếp, Top N, nhóm “Khác” và missing khi phù hợp.
- Histogram: một cột số và số khoảng chia hợp lệ.
- Box plot: cột số, tùy chọn nhóm.
- Bar: nhóm và phép tổng hợp; chỉ bắt buộc cột số khi phép tổng hợp cần.
- Line: X có thứ tự, Y số, quy định sắp xếp và gộp các X trùng.
- Scatter: hai cột số; Scatter 3D: ba cột số.
- Heatmap tương quan: ít nhất hai cột số phù hợp; xử lý cột hằng và cặp không đủ mẫu.
- Pie/Donut: tỷ trọng không âm, tổng lớn hơn 0.
- Chặn cấu hình rỗng/toàn missing/không hữu hạn và nêu lý do. Cột ID không tự được coi là đại lượng liên tục.
- Nếu dùng mẫu để hiển thị phải nêu kích thước mẫu và cách chọn; không âm thầm dùng mẫu đó làm dữ liệu huấn luyện.
- Lưu/sửa/xóa biểu đồ, thêm vào dashboard và xuất kết quả khi đủ điều kiện.

### 12.2. Dashboard

- Một dự án có nhiều dashboard, hỗ trợ tạo, đổi tên, mở và quản lý biểu đồ trong dashboard.
- Dashboard đã chốt bố cục 1/2/3 cột, đổi thứ tự bằng nút; không yêu cầu kéo thả tự do. Responsive và schema theo C14.
- Người dùng chủ động chuyển nguồn dữ liệu/phiên bản của biểu đồ. Có phiên bản mới không tự thay nguồn biểu đồ cũ.
- Khi chuyển nguồn, kiểm tra lại các cột, kiểu, phép gộp và điều kiện biểu đồ. Không hợp lệ thì giữ cấu hình cũ và yêu cầu chỉnh.
- Lưu dashboard, cấu hình biểu đồ và tham chiếu nguồn đủ để dựng lại.

### 12.3. Ý nghĩa 3D

- Kết hợp giao diện thao tác rõ ràng với không gian 3D để khám phá dữ liệu hoặc quy trình.
- Hỗ trợ xoay, zoom, chọn điểm xem chi tiết, chọn trục, tô màu theo cụm/nhãn.
- Phân biệt ba cột gốc với ba thành phần PCA; ghi rõ cách tạo tọa độ và phương sai giải thích khi dùng PCA.
- Không tuyên bố hình 3D phản ánh toàn bộ thông tin của dữ liệu nhiều chiều.
- Bản đồ quy trình 3D thật là màn hình làm việc chính trong dự án; cây phiên bản là màn hình riêng. Mọi chức năng cốt lõi có đường truy cập 2D tương đương, không bắt thao tác camera để thực hiện nghiệp vụ.
- Chi tiết thẩm mỹ, thư viện và bố cục không gian 3D do tài liệu thiết kế 3D xác định.

## 13. Phiên bản, hoàn tác và khôi phục phiên làm việc

- Mỗi bộ dữ liệu có V0 và lịch sử riêng. Các phiên bản đã hoàn thành là bất biến.
- Mỗi thao tác biến đổi dữ liệu thành công tạo một phiên bản mới; lưu quan hệ nguồn, thao tác và lần chạy.
- Hoàn tác là chuyển phiên bản đang dùng, không xóa phiên bản mới hơn. Làm tiếp từ phiên bản cũ tạo nhánh.
- Cho xem danh sách/quan hệ phiên bản, so sánh và khôi phục phiên bản được chọn.
- Kết quả mô hình/biểu đồ cũ vẫn gắn đúng nguồn cũ; không hiển thị như kết quả của phiên bản hiện tại.
- Mở lại dự án khôi phục phiên bản hoàn chỉnh gần nhất đã lưu, dashboard, biểu đồ và màn hình đang xem, kể cả kết quả chưa đồng bộ.
- Không yêu cầu khôi phục biểu mẫu chưa áp dụng. Không chạy lại tác vụ bị gián đoạn.
- Trạng thái màn hình được khôi phục chỉ khi tài nguyên/quyền vẫn hợp lệ; thiếu tài nguyên thì báo rõ và cho chuyển sang màn hình khả dụng.
- Hết dung lượng khi lưu: không báo thành công, giữ phiên bản trước và dọn phần dở an toàn. Không tự xóa bản chưa đồng bộ.

## 14. Lưu, xuất và báo cáo PDF

- Xuất dữ liệu CSV/JSON từ phiên bản được chọn.
- Xuất biểu đồ và kết quả mô hình; định dạng ảnh/mô hình cụ thể theo thư viện và khả năng thực tế, công bố rõ.
- Xuất báo cáo **PDF**, người dùng chọn các phần: chất lượng dữ liệu, bước xử lý, biểu đồ, tham số, chỉ số đánh giá và kết luận.
- Có xem trước nội dung, chọn nguồn/phiên bản/lần chạy, tạo và tải PDF.
- Ghi rõ tên dự án, dữ liệu/phiên bản, cấu hình và thời điểm tạo. Không ghép chỉ số từ nguồn khác mà không chú thích.
- Kết luận có thể do người dùng nhập hoặc từ AI đã được duyệt; không bắt buộc gọi AI để tạo PDF. Không giả tạo kết luận hoặc chỉ số.
- Font tiếng Việt và tài nguyên xuất phải có bản dùng offline; báo thiếu tài nguyên thay vì gọi dịch vụ ngoài ngầm.
- Nếu không xuất trực tiếp được khung 3D, đề xuất ảnh chụp khung nhìn hoặc biểu diễn tương đương có chú thích; kiểm chứng khả năng trước khi hứa định dạng.
- Không bổ sung xuất/nhập toàn bộ gói dự án thành yêu cầu bắt buộc.

## 15. Ma trận online/offline và đồng bộ

| Chức năng | Online | Offline |
| --- | --- | --- |
| Đăng ký/đăng nhập mới/quên mật khẩu | Có | Không |
| Tạo dự án, nhập CSV/JSON mới | Có | Không |
| Mở dự án đã đủ tài nguyên | Có | Có |
| Làm sạch, tiền xử lý và biến đổi được hỗ trợ | Có | Có trên dữ liệu đã lưu |
| Năm thuật toán bản đầu | Trong browser | Trong browser nếu đủ tài nguyên |
| Thống kê, biểu đồ, dashboard và 3D | Có | Có với nguồn/tài nguyên trên máy |
| Lịch sử, phiên bản và quy trình | Có | Dùng phần có trên máy, kiểm tra đầy đủ đầu vào |
| Xuất dữ liệu/biểu đồ/mô hình/PDF | Có | Khi đủ tài nguyên cục bộ |
| AI/LLM | Có nếu dịch vụ khả dụng | Không |
| Xóa vĩnh viễn dự án/bộ dữ liệu | Có, xác nhận | Không |
| Đồng bộ máy chủ | Có theo quy tắc dưới đây | Không |

Không dùng một cờ online/offline để thay tất cả trạng thái. Phân biệt có mạng, máy chủ truy cập được, xác thực, trạng thái lưu, đồng bộ, mức sẵn sàng offline và quyền chỉnh sửa.

### 15.1. Lưu cục bộ và chuẩn bị offline

- Tự lưu dữ liệu gốc và phiên bản hiện tại của dự án đang làm, cùng tài nguyên cần thiết; giữ mọi phiên bản mới phát sinh trên máy.
- Không tải toàn bộ lịch sử máy chủ chỉ vì mở dự án.
- Nút “Lưu để dùng offline” tải toàn bộ tài nguyên dự án tại thời điểm chuẩn bị: dữ liệu gốc, mọi phiên bản hoàn thành, quy trình/lịch sử, biểu đồ, mô hình/chỉ số và tài nguyên thực thi offline.
- Có tiến độ, dung lượng và kiểm tra đầy đủ; tải dở không được báo sẵn sàng. Khi tài nguyên đổi phải đánh giá lại mức đầy đủ.
- Cần tải website/chuẩn bị online trước; không hứa truy cập lần đầu khi mất mạng hoặc lưu browser tồn tại vĩnh viễn.

### 15.2. Đồng bộ

- Khi online liên tục: lưu cục bộ trước, tự đồng bộ đầu ra hoàn chỉnh sau.
- Sau mất mạng: khi kết nối lại máy chủ, hiện “Đồng bộ ngay”, chờ người dùng bấm; các tab dùng chung trạng thái chờ.
- Xác thực đúng tài khoản trước khi gửi. Đồng bộ thành công mới bật lại tự đồng bộ các thao tác tiếp theo, tới lần mất mạng kế tiếp.
- Đồng bộ lỗi giữ nguyên dữ liệu/hàng đợi, cho thử lại; không tự chuyển sang đã đồng bộ.
- Đồng bộ dùng tập phiên bản hoàn chỉnh chụp tại một thời điểm. Đầu ra phát sinh sau đó thuộc lượt tiếp theo.
- Gửi lại không tạo trùng. Xung đột lưu nhánh riêng, giữ cả phía máy chủ và cục bộ, không ghi đè hoặc tự gộp.
- Thể hiện đúng “Đã lưu trên máy”, “Chưa đồng bộ”, “Đã đồng bộ”.

### 15.3. Đăng xuất

| Tình huống | Hành vi |
| --- | --- |
| Offline, còn thay đổi chưa đồng bộ | Chặn đăng xuất, giải thích cần kết nối; có Hủy |
| Offline, không còn thay đổi chưa đồng bộ | Đăng xuất, xóa dữ liệu tài khoản cục bộ; thu hồi đúng phiên cũ khi kết nối lại |
| Online, còn thay đổi chưa đồng bộ | Có “Đồng bộ rồi đăng xuất”, “Vẫn đăng xuất”, “Hủy” |
| Đồng bộ rồi đăng xuất thành công | Đăng xuất và xóa dữ liệu tài khoản cục bộ |
| Đồng bộ thất bại | Giữ dữ liệu và trạng thái làm việc, báo lỗi |
| Vẫn đăng xuất | Cảnh báo mất thay đổi chưa đồng bộ; xác nhận rồi xóa cục bộ và đăng xuất |
| Online, không còn thay đổi chưa đồng bộ | Đăng xuất và xóa dữ liệu tài khoản cục bộ |

Đăng xuất áp dụng cho mọi tab, hủy thao tác đang chạy, ngăn worker/request cũ ghi dữ liệu trở lại. Xóa cục bộ khi đăng xuất không xóa dữ liệu đã đồng bộ trên máy chủ.

## 16. Xóa dự án/bộ dữ liệu và phụ thuộc

- Chỉ thực hiện khi online và xác thực hợp lệ. “Có mạng” nhưng máy chủ không truy cập được không đủ điều kiện xóa.
- Xóa vĩnh viễn sau xác nhận, không có thùng rác.
- Trước xóa hiển thị phạm vi: dữ liệu gốc, phiên bản, các artifact và phụ thuộc bị ảnh hưởng. Phân biệt xóa dự án với xóa một dataset.
- Không xóa dây chuyền các bộ nguồn hoặc bộ dẫn xuất khác ngoài phạm vi đã thông báo.
- Đã chốt: chặn xóa dataset nếu còn phụ thuộc ngoài phạm vi xóa; hiển thị hard references và ảnh hưởng lịch sử để xử lý trước. Deletion plan/fence theo C17.
- Nếu có thay đổi chưa đồng bộ hoặc tác vụ đang chạy, yêu cầu giải quyết rõ: đồng bộ, hủy thao tác hoặc xác nhận bỏ thay đổi trong phạm vi xóa. Không âm thầm làm mất thay đổi.
- Phải chống request cũ/thiết bị offline đồng bộ lại làm sống lại tài nguyên đã xóa; dùng dấu vết xóa tối thiểu và kiểm tra revision theo thiết kế kỹ thuật. Dấu vết đồng bộ không phải thùng rác và không cho khôi phục dữ liệu đã xóa.
- Gỡ bản offline để giải phóng dung lượng là chức năng khác với xóa dự án máy chủ; không tự gỡ dữ liệu chưa đồng bộ.

## 17. Vòng đời tác vụ, lỗi và thông báo

- Trạng thái: chưa đủ điều kiện, sẵn sàng, xem trước, đang chạy, đang lưu, thành công, thất bại, đã hủy/gián đoạn.
- Chỉ success sau commit hoàn chỉnh. Tác vụ lỗi/hủy vẫn có lịch sử nhưng không có phiên bản thành công giả.
- Đóng tab hoặc refresh hủy thao tác chưa hoàn tất; mở lại nhận diện phần dở và phục hồi bản đã commit. Chuyển sang tab khác không đồng nghĩa hủy.
- Mất mạng không hủy thuật toán đang chạy trong browser. Tác vụ chỉ chạy server nếu có phải dùng tín hiệu hủy và lease/timeout, không chỉ dựa sự kiện đóng trang.
- Đầu ra muộn chỉ được commit vào nguồn/nhánh snapshot khi writer và generation còn hợp lệ; không ghi sang nguồn mới, không tự đổi current pointer đã được người dùng đổi. Mất quyền chỉnh sửa/đăng xuất thì từ chối commit. Quy tắc chính xác theo C05–C06.
- Ngăn bấm lặp tạo nhiều tác vụ giống nhau. Đề xuất mặc định tuần tự các biến đổi trên cùng dataset; không phát sinh writer cạnh tranh.
- Lỗi phân loại được: đọc tệp, dữ liệu, cấu hình, tính toán, dung lượng, lưu cục bộ, máy chủ, xác thực, đồng bộ và AI.
- Thông báo gồm việc gì xảy ra, dữ liệu nào đã giữ và người dùng có thể làm gì tiếp theo.
- Không che lỗi bằng kết quả mẫu; không lưu bí mật đăng nhập vào log.

## 18. Mẫu đặc tả cho từng chức năng

Agent phải lập bảng chức năng, mỗi chức năng có:

1. Mã định danh ổn định và tên tiếng Việt.
2. Nhóm/giai đoạn, mục đích và đối tượng tác động.
3. Điều kiện quyền sở hữu, quyền chỉnh sửa, kết nối và tài nguyên.
4. Đầu vào: dự án, dataset/phiên bản, cột, tham số.
5. Validation dữ liệu/cấu hình và giới hạn tài nguyên.
6. Xem trước và phạm vi mẫu nếu có.
7. Hành vi khi xác nhận, trạng thái tiến độ và hủy.
8. Đầu ra: phiên bản mới, biểu đồ, mô hình, lịch sử hay báo cáo.
9. Quy tắc lưu cục bộ, đồng bộ và liên kết nguồn.
10. Lỗi/cảnh báo, phụ thuộc, hoàn tác và phục hồi.
11. Khả năng dùng offline.
12. Tiêu chí nghiệm thu quan sát được.

Danh mục thao tác dùng chung phải phục vụ cả thao tác đơn, quy trình và gợi ý AI; không viết ba bộ xử lý khác nhau cho cùng một phương pháp.

## 19. Ma trận nghiệm thu tối thiểu

| Mã | Tình huống | Kết quả bắt buộc |
| --- | --- | --- |
| AC01 | Nhập hai tệp vào một dự án | Hai dataset, V0/lịch sử riêng; không thay nguồn cũ |
| AC02 | JSON có object và mảng | Làm phẳng object theo cấu hình, không tự bung mảng |
| AC03 | CSV sai cấu trúc/tệp vượt giới hạn | Báo cụ thể, không tạo kết quả thành công dở |
| AC04 | Ghép khóa trùng nhiều–nhiều | Cảnh báo số dòng tăng, kiểm tra giới hạn trước chạy |
| AC05 | Xóa HTML rồi điền missing thủ công | Xem kết quả sau từng bước, lưu hai phiên bản |
| AC06 | Quy trình lỗi bước 3 | Giữ hai bước đã commit, bước sau không chạy |
| AC07 | Chạy quy trình trên cột tên khác | Cho ánh xạ, kiểm tra lại trước thực thi |
| AC08 | Chuyển kiểu có giá trị lỗi | Hiển thị giá trị lỗi, không tự đổi thành null |
| AC09 | Ffill qua nhiều nhóm | Không truyền giá trị giữa nhóm; có cấu hình thứ tự |
| AC10 | Log có giá trị ngoài miền | Chặn hoặc yêu cầu chính sách được chọn rõ |
| AC11 | One-hot/TF-IDF quá nhiều đặc trưng | Chặn trước cấp phát quá lớn, giữ phiên bản trước |
| AC12 | Huấn luyện sau tiền xử lý | Fit tham số trên train; phát hiện/cảnh báo tiền xử lý toàn dữ liệu |
| AC13 | Chỉ số không đủ điều kiện | Nêu lý do, không hiển thị số giả |
| AC14 | AI đề xuất phương pháp | Chưa đổi dữ liệu cho tới khi người dùng xác nhận |
| AC15 | AI cần nội dung từng dòng | Chỉ gửi sau khi hiển thị nội dung và được đồng ý |
| AC16 | AI không đủ căn cứ điền | Giữ missing, giải thích; không bịa giá trị |
| AC17 | Dataset có phiên bản mới | Biểu đồ giữ nguồn cũ, đổi nguồn do người dùng chủ động |
| AC18 | Báo cáo PDF chọn từng phần | Đúng phần được chọn, font tiếng Việt và nguồn/chỉ số chính xác |
| AC19 | Offline chạy tiền xử lý/năm thuật toán | Hoạt động khi đủ tài nguyên, lưu cục bộ, không gọi API bắt buộc |
| AC20 | Có mạng trở lại | Chờ “Đồng bộ ngay”, không tự đẩy thay đổi tích lũy |
| AC21 | Đóng tab trong bước đang chạy | Hủy phần dở, mở lại bản hoàn chỉnh gần nhất và màn hình phù hợp |
| AC22 | Hai tab mở cùng dự án | Một writer, chuyển quyền không gây ghi đồng thời |
| AC23 | Hoàn tác rồi xử lý tiếp | Tạo nhánh, không mất phiên bản mới hơn |
| AC24 | Đồng bộ gửi lặp/xung đột | Không tạo trùng, không ghi đè nhánh còn lại |
| AC25 | Xóa offline hoặc server không truy cập được | Chặn và giải thích |
| AC26 | Xóa online có phụ thuộc | Hiển thị phạm vi, không cascade ngoài xác nhận |
| AC27 | Thiết bị cũ gửi thay đổi sau khi xóa | Không làm sống lại tài nguyên đã xóa |
| AC28 | Đăng xuất với dữ liệu chưa đồng bộ | Đúng các nhánh ở mục 15.3; không mất dữ liệu ngầm |
| AC29 | Lưu cục bộ hết dung lượng | Không báo hoàn tất, bản trước còn mở được |
| AC30 | Tài khoản khác tham chiếu tài nguyên | Bị từ chối; không đọc/đồng bộ nhầm tài khoản |

## 20. Sản phẩm agent cần bàn giao

1. Bảng yêu cầu đã chốt, đề xuất kỹ thuật và điểm còn cần xác nhận, phân biệt rõ ba loại.
2. Sơ đồ đối tượng nghiệp vụ và luồng tổng thể; có thể dùng Mermaid ngắn gọn.
3. Danh mục chức năng có mã và đặc tả theo mục 18.
4. Luồng màn hình: dự án, nhập dữ liệu, thao tác đơn, quy trình, huấn luyện, dashboard, báo cáo và lịch sử.
5. Bảng chuyển trạng thái tác vụ, lưu/đồng bộ, mở lại và xóa.
6. Hợp đồng tích hợp ở mức nghiệp vụ giữa frontend, bộ xử lý browser, backend, MongoDB, offline và AI; không cần tự quyết lại schema chi tiết ngoài phạm vi.
7. Bảng đối chiếu ba file hiện có: phần đã đáp ứng, cần bổ sung và khác biệt cần xử lý. Nêu rõ PCA, phương pháp tiền xử lý bổ sung, nhiều dataset, ghép/nối, AI, PDF và xóa online.
8. Ma trận nghiệm thu đầy đủ và kế hoạch triển khai theo giai đoạn. Chia giai đoạn không được âm thầm bỏ phương pháp đã chốt.
9. Giới hạn thực tế, phương pháp/thư viện chưa kiểm chứng và các quyết định kỹ thuật cần tiếp tục xác minh.

Không bắt người dùng quyết định những chi tiết kỹ thuật thường lệ mà agent có thể đề xuất có căn cứ. Với lựa chọn thư viện, API hoặc nhà cung cấp cụ thể, kiểm tra tài liệu chính thức hiện hành trước khi cam kết khả năng, giấy phép hoặc chi phí. Không coi các tài liệu phương pháp dùng Python là quyền đưa Python vào hệ thống.

Ưu tiên: **thao tác rõ ràng, người dùng giữ quyền quyết định, không mất dữ liệu đã lưu, không rò rỉ dữ liệu giữa tài khoản, đúng phiên bản nguồn, đúng đánh giá mô hình và đúng trạng thái đồng bộ**.


## Phụ lục v2 — Hợp đồng tích hợp của CN

- C01–C03: đối tượng, quyền và kiểu dữ liệu.
- C04–C05: thao tác, snapshot và output muộn.
- C08–C12: import/sync/version/đánh giá.
- C14, C16–C17: chart/PDF/AI/xóa.

Bổ sung quyết định: tối đa 100 tài khoản kích hoạt; không trần nghiệp vụ số version/tổng dung lượng dự án. Nút auth/OTP và key riêng theo phiên đã là phạm vi hiện hành. Mọi nguyên tắc không bịa dữ liệu, không tự bỏ phương pháp và không thêm prediction giữ nguyên.

Agent phải dùng [hợp đồng chung](hop_dong_tich_hop.md), [quyết định/nghiệm thu](quyet_dinh_va_nghiem_thu.md) và tám prompt v2 cùng bộ. Bàn giao bảng field/schema chi tiết và fixtures đúng hợp đồng trước khi tích hợp; không tạo API/serializer/state machine riêng mâu thuẫn. Chỉ sinh mã khi có nhiệm vụ triển khai riêng. Tài liệu này không xác nhận đã kiểm thử nguồn kỹ thuật, package, nhà cung cấp hoặc hiệu năng.
