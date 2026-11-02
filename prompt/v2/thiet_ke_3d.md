# Prompt giao nhiệm vụ cho Agent — Thiết kế không gian tương tác 3D

> **Bản hợp nhất v2 — 02/11/2026.** Giữ yêu cầu và ma trận chuyên ngành của bản gốc; cập nhật các quyết định đã chốt và dùng [hợp đồng C01–C22](hop_dong_tich_hop.md). Đọc [README](README.md) để phân biệt yêu cầu sản phẩm P, thiết kế kỹ thuật T, điểm kiểm chứng V và quyết định mới Q. Tài liệu gốc nằm ở thư mục cha, không bị sửa. Đây chưa phải mã nguồn hoặc bằng chứng đã kiểm thử.

**Đề tài:** Xây dựng hệ thống dashboard tương tác 3D quản lý và trực quan hóa toàn bộ quy trình khai phá dữ liệu.

**Ngày tổng hợp:** 02/11/2026. **Ngôn ngữ giao diện:** Tiếng Việt.

**Trạng thái:** Đặc tả thiết kế để giao agent; chưa phải sản phẩm đã triển khai hoặc kết quả kiểm thử.

## 1. Vai trò và nhiệm vụ

Bạn là chuyên viên thiết kế UX/UI và kiến trúc sư frontend JavaScript/TypeScript, phụ trách phần 3D của hệ thống. Thiết kế và khi được giao riêng thì triển khai một không gian 3D có chức năng thực tế, liên kết trực tiếp với quy trình khai phá dữ liệu, phiên bản dữ liệu và kết quả xử lý.

Nhiệm vụ hiện tại chỉ là thiết kế. Không tự triển khai website, thay đổi repository, tạo dịch vụ hoặc sửa tài liệu khác.

Đọc các tài liệu thực tế được cung cấp, đối chiếu theo vai trò:

| Tài liệu | Nội dung cần kế thừa |
| --- | --- |
| Thiết kế chức năng hệ thống | Nghiệp vụ, nhiều dataset, thao tác đơn/quy trình, biểu đồ, mô hình và báo cáo |
| Thiết kế cây nút và điều kiện | Danh mục thao tác, mã thao tác, tham số và điều kiện bật/tắt |
| Thiết kế offline | Lưu trên máy, chuẩn bị tài nguyên, nhiều tab, đồng bộ và khôi phục |
| Thiết kế backend | Phiên, quyền sở hữu, trạng thái artifact, API và receipt đồng bộ |
| Thiết kế MongoDB | Định danh, phiên bản, nhánh, nguồn và quan hệ phụ thuộc |
| Thiết kế frontend, webserver nếu có | Bố cục chung, điều hướng, đóng gói và phục vụ tài nguyên |

Tên tệp có thể kèm hậu tố phiên bản. Xác định đúng bản hiện hành, không giả định đã đọc tài liệu chưa được cung cấp. Tài liệu này phụ trách biểu diễn và tương tác 3D, không tự thay nghiệp vụ, schema database hoặc chính sách offline. Nếu các tài liệu xung đột, ghi đúng nguồn và ảnh hưởng; không tự ghi đè quyết định đã chốt.

## 2. Các quyết định sản phẩm đã chốt

1. Website phải có yếu tố 3D; ngoài biểu đồ, 3D được dùng để quản lý và theo dõi quy trình.
2. **Giao diện làm việc chính trong dự án là bản đồ quy trình 3D.** Trang danh sách dự án và màn hình tài khoản không bắt buộc 3D.
3. **Cây phiên bản dữ liệu là một mục riêng**, không đặt toàn bộ lịch sử phiên bản vào bản đồ quy trình chính.
4. Chọn khối trên bản đồ để mở bảng chức năng bên cạnh; thao tác bằng nút, danh sách và biểu mẫu tiếng Việt.
5. Có thể xoay, phóng to, thu nhỏ và chọn đối tượng trong không gian 3D.
6. Bản đồ và cây phiên bản liên kết hai chiều: “Xem trong cây phiên bản” và “Tiếp tục xử lý”.
7. Người dùng giữ quyền chọn phương pháp và quyết định chạy. AI chỉ đề xuất, không tự thực thi.

Các chi tiết bố cục, màu, giới hạn hiển thị và điều khiển phía dưới là **phương án thiết kế mặc định đề xuất** để agent triển khai nhất quán. Không diễn giải thành những lựa chọn đã được người dùng xác nhận riêng. Các thông số hiệu năng phải đo trước khi cam kết.

## 3. Mục tiêu và nguyên tắc UX

- Người dùng nhận biết đang làm ở dự án nào, dùng dataset/phiên bản nào, đang thực hiện bước nào và kết quả đã lưu ở đâu.
- 3D hỗ trợ định hướng, trạng thái và truy vết; biểu mẫu, bảng dữ liệu, lỗi và chỉ số trình bày ở vùng 2D dễ đọc.
- Dùng đối tượng có tọa độ không gian, phối cảnh và điều khiển camera thực sự cho bản đồ chính. Hiệu ứng bóng hoặc nghiêng thẻ đơn thuần không đủ cho phương án này.
- Mọi chức năng cốt lõi có đường truy cập bằng menu/danh sách 2D tương đương. Có nút chuyển “3D / 2D”; mặc định 3D khi thiết bị hỗ trợ và chưa có lựa chọn khác của người dùng.
- Không bắt kéo thả, đi bộ trong không gian, điều khiển nhân vật hoặc đeo kính VR để làm việc.
- Không biến chuyển động trang trí thành tín hiệu xử lý dữ liệu. Trạng thái phải lấy từ tầng nghiệp vụ.
- Chuyển màn hình, xoay camera hoặc chọn khối không được tự chạy thao tác, đổi nguồn hay tạo phiên bản dữ liệu.

## 4. Kiến trúc thông tin và bố cục

### 4.1. Điều hướng trong dự án

Các mục cần truy cập rõ ràng:

- **Bản đồ quy trình:** không gian làm việc chính.
- **Bộ dữ liệu:** danh sách nguồn, metadata và chọn dataset.
- **Cây phiên bản dữ liệu:** đồ thị nguồn gốc và nhánh phiên bản.
- **Quy trình đã lưu:** tạo/mở/cấu hình/chạy lại quy trình.
- **Biểu đồ và dashboard:** quản lý cấu hình và xem kết quả.
- **Mô hình và kết quả:** cấu hình huấn luyện, lịch sử thí nghiệm và chỉ số.
- **Lịch sử chạy; Báo cáo:** truy vết thao tác và xuất nội dung.

Các mục có thể gom theo thiết kế frontend, nhưng bản đồ quy trình và cây phiên bản phải là hai màn hình phân biệt. Dashboard tổng hợp biểu đồ cũng là khái niệm khác với bản đồ quy trình 3D.

### 4.2. Bố cục đề xuất

| Vùng | Nội dung |
| --- | --- |
| Thanh trên | Tên dự án; dataset, nhánh, phiên bản đang chọn; lưu/đồng bộ; truy cập tài khoản |
| Điều hướng trái | Các mục của dự án; có thể thu gọn |
| Không gian giữa | Bản đồ quy trình hoặc đồ thị phiên bản; tiêu đề ngữ cảnh, chú giải |
| Bảng bên phải | Chức năng, cấu hình, validation, xem trước, tiến độ và thông tin đối tượng |
| Vùng kết quả có thể mở rộng | Bảng dữ liệu, biểu đồ, chỉ số hoặc chi tiết lỗi |
| Thanh điều khiển khung nhìn | Về mặc định, vừa màn hình, zoom, khóa xoay, 3D/2D, giảm chuyển động |

Bảng bên phải có nút thu gọn/mở rộng. Với bảng nhiều cột, cho mở vùng kết quả rộng hơn và thu nhỏ hoặc ẩn canvas tạm thời; vẫn giữ ngữ cảnh. Không ép dữ liệu dạng bảng lên bề mặt khối 3D.

## 5. Bản đồ quy trình 3D — giao diện chính

### 5.1. Các khối giai đoạn

| Khối | Chức năng mở ra | Kết quả điển hình |
| --- | --- | --- |
| Nạp dữ liệu | Nhập CSV/JSON, chọn dataset đã có, xem cấu hình đọc | Dataset mới và V0 khi nhập thành công |
| Kiểm tra dữ liệu thô | Schema, HTML, missing, trùng, kiểu và chất lượng | Báo cáo kiểm tra; không tự sửa dữ liệu |
| Làm sạch dữ liệu | Xử lý HTML, chuỗi, cột, dòng, kiểu dữ liệu, trùng và outlier | Phiên bản mới khi có biến đổi thành công |
| Xử lý missing | Chọn cột, phương pháp, tham số, xem trước | Phiên bản mới sau áp dụng |
| Biến đổi và chọn đặc trưng | Encoding, scaling, log, binning, TF-IDF và lựa chọn đặc trưng trong phạm vi hỗ trợ | Phiên bản hoặc artifact theo nghiệp vụ |
| Khám phá và trực quan hóa | Thống kê, biểu đồ 2D/3D, cấu hình dashboard | Thống kê hoặc biểu đồ đúng nguồn |
| Chọn thuật toán | Loại bài toán, đầu vào, nhãn, thuật toán và tham số | Cấu hình được kiểm tra |
| Huấn luyện và đánh giá | Chia tập, chạy, tiến độ, metric và kết quả | Lần chạy, mô hình, chỉ số và artifact |
| Xuất kết quả và báo cáo | Chọn nguồn và nội dung xuất | CSV/JSON, biểu đồ, mô hình hoặc PDF theo khả năng |

Nhóm chức năng trên là cách tổ chức giao diện. Mã thao tác, danh mục phương pháp và validator lấy từ registry chung; không tạo bộ tên/mã hoặc thuật toán riêng trong module 3D. Nối dòng/ghép bảng được truy cập từ khu vực dữ liệu phù hợp và kiểm tra đầy đủ nhiều nguồn.

### 5.2. Bố trí không gian

- Đề xuất bố trí các khối theo đường cong nhẹ, chia thành các cụm dễ nhìn, tránh một hàng dài buộc người dùng kéo camera liên tục.
- Góc nhìn mặc định nghiêng vừa phải; các nhãn hướng về camera hoặc dùng lớp giao diện phủ để luôn đọc được.
- Chiều sâu biểu diễn nhóm/giai đoạn, không ngụ ý giá trị chất lượng, thời gian hay độ chính xác nếu không có chú giải.
- Tên khối ngắn; chi tiết nằm trong bảng bên cạnh. Nhãn không bị vật thể khác che khuất không thể khắc phục.
- Đường nối thể hiện thứ tự gợi ý; có chú giải “Luồng gợi ý”. Chỉ đường nối thuộc một quy trình/lần chạy cụ thể mới thể hiện phụ thuộc hoặc tiến trình thực tế.
- Chọn khối làm nổi khối và hiển thị bảng chức năng; hiệu ứng camera nhẹ, có thể tắt. Không tự quay liên tục khi đang nhập biểu mẫu.

### 5.3. Không bắt buộc chạy tuần tự mọi giai đoạn

- Sau khi chọn nguồn hợp lệ, người dùng có thể mở khám phá, xử lý missing, biến đổi hoặc huấn luyện nếu điều kiện thao tác đáp ứng.
- Không khóa bước chỉ vì giai đoạn đứng trước chưa có dấu hoàn thành. Validation dựa trên dữ liệu, cấu hình, tài nguyên và quyền hiện tại.
- Có thể lặp lại nhiều thao tác trong cùng một nhóm. Ví dụ xóa HTML rồi trim tạo hai phiên bản; bản đồ vẫn chỉ có một khối Làm sạch.
- Không tự động sửa missing, chuẩn hóa hoặc chọn thuật toán khi người dùng chuyển khối.
- Giai đoạn không áp dụng có nhãn phù hợp; không bắt người dùng chạy thao tác vô ích để hoàn thành bản đồ.

### 5.4. Hai cách sử dụng bản đồ

**Thao tác từng bước — luồng mặc định:**

Chọn nguồn → chọn khối → chọn thao tác/phương pháp → cấu hình → kiểm tra → xem trước → xác nhận áp dụng → chạy → lưu kết quả hoàn chỉnh → xem kết quả → chọn bước tiếp theo.

Người dùng không phải dựng toàn bộ workflow trước. Với huấn luyện, xem trước là tóm tắt cấu hình và điều kiện, không có metric giả.

**Chạy quy trình đã cấu hình:**

- Mở quy trình, xem các bước và tham số, kiểm tra rồi bấm chạy.
- Bản đồ hiển thị các bước của lần chạy đang được chọn; nhiều bước cùng nhóm phải có danh sách thứ tự trong bảng chi tiết.
- Không yêu cầu xác nhận lại mỗi bước bình thường đã được duyệt. Khi phát sinh quyết định ngoài cấu hình thì tạm dừng.
- Bước lỗi dừng các bước phụ thuộc phía sau, giữ các kết quả đã commit. Hủy bỏ phần dở của bước hiện tại.
- Chạy tiếp sau sửa lỗi do người dùng chủ động; không tự chạy sau refresh hoặc khi kết nối lại.

### 5.5. Ngữ cảnh và trạng thái khối

Luôn ghi rõ bản đồ đang ở chế độ “Khám phá chức năng” hay “Theo dõi lần chạy …”.

- Ở chế độ khám phá: trạng thái chính là khả dụng, cần cấu hình hoặc bị chặn, dựa trên nguồn hiện tại. Có thể có nhãn phụ “Đã thực hiện”, gắn nguồn và lần chạy cụ thể.
- Ở chế độ theo dõi: trạng thái lấy từ từng bước của lần chạy, không lấy kết quả gần nhất bất kỳ của dataset.
- Khối có nhiều bước hiển thị tóm tắt như “2/3 bước hoàn tất; 1 bước lỗi”, không gộp thành thành công.
- Khi đổi dataset/phiên bản, tính lại khả dụng; không giữ màu thành công từ nguồn cũ. Kết quả cũ vẫn có thể mở qua lịch sử với nhãn nguồn cũ.

| Trạng thái | Biểu diễn đề xuất | Ý nghĩa |
| --- | --- | --- |
| Chưa đủ điều kiện | Xám, biểu tượng khóa/cảnh báo, có lý do | Thiếu nguồn, tài nguyên, quyền hoặc cấu hình |
| Sẵn sàng | Màu trung tính rõ, nhãn Sẵn sàng | Đủ điều kiện hiện tại để cấu hình/thực hiện |
| Xem trước | Viền nổi, nhãn Xem trước | Chưa áp dụng thay đổi |
| Đang chạy | Xanh lam, biểu tượng tiến trình | Có tác vụ thực tế; phần trăm chỉ khi đo được |
| Đang lưu | Nhãn Đang lưu trên máy | Tính toán xong nhưng chưa commit hoàn chỉnh |
| Hoàn thành | Xanh lá, dấu kiểm | Kết quả cần thiết đã lưu hoàn chỉnh |
| Lỗi | Đỏ, biểu tượng lỗi | Có chi tiết và hướng xử lý |
| Đã hủy/gián đoạn | Cam, nhãn tương ứng | Không có đầu ra thành công cho phần dở |
| Bỏ qua/không áp dụng | Nét nhạt và nhãn rõ | Theo cấu hình/quyết định được ghi nhận |

Không chỉ dùng màu để truyền đạt trạng thái. Tiến độ không xác định dùng chỉ báo hoạt động; không tạo phần trăm tăng giả. “Hoàn thành” không đồng nghĩa “Đã đồng bộ”.

## 6. Cây phiên bản dữ liệu — mục riêng

### 6.1. Mô hình biểu diễn

Tên giao diện là **Cây phiên bản dữ liệu**. Về dữ liệu, đây là đồ thị có hướng không chu trình của quan hệ nguồn gốc: một phiên bản có thể liên quan nhiều nguồn khi nối/ghép. Không ép mọi nút có đúng một cha.

- Một nút là một phiên bản dữ liệu hoàn chỉnh. Mỗi dataset có V0 và lịch sử riêng; dùng datasetId + versionId làm định danh, không dùng nhãn V1 làm ID toàn dự án.
- Một cạnh hướng từ phiên bản nguồn tới phiên bản kết quả. Với nối/ghép, hiện mọi nguồn và loại thao tác; giữ tên dataset để phân biệt.
- Nhánh thể hiện hướng xử lý khác nhau hoặc xung đột đồng bộ. Chú thích nguyên nhân; không tự gộp hoặc chọn nhánh thay người dùng.
- Thao tác xem trước, đọc thống kê, đổi camera hoặc tạo biểu đồ không tạo nút phiên bản dữ liệu.
- Lần chạy lỗi/hủy nằm trong lịch sử hoặc lớp thông tin riêng; không dùng nút thành công giả để biểu diễn kết quả dở.

### 6.2. Phạm vi xem và tải dữ liệu

- Mặc định tập trung dataset đang chọn và vùng lịch sử liên quan. Có bộ lọc dataset, nhánh, thao tác, thời gian và tìm theo nhãn/ID.
- Có cách mở rộng quan hệ nguồn liên dataset và xem tổng quan dự án. Các nguồn ngoài bộ lọc phải có dấu liên kết hoặc thông báo, không làm người dùng hiểu sai rằng phiên bản chỉ có một nguồn.
- Chỉ tải metadata cần thiết theo trang/vùng; chọn xem bảng hoặc tiếp tục xử lý mới yêu cầu artifact đầy đủ.
- Nút metadata có thể hiện dù nội dung chỉ nằm trên máy chủ. Gắn nhãn “Chưa có trên máy”; offline thì chặn mở nội dung và giải thích.
- Khi dữ liệu lịch sử chưa tải hết, báo phạm vi đang xem và nút tải thêm; không ngụ ý đồ thị đang hiển thị là toàn bộ lịch sử.
- Có chế độ danh sách 2D tương đương và khả năng đi tới phiên bản bằng tìm kiếm, không bắt tìm bằng camera.

### 6.3. Chi tiết và hành động trên phiên bản

Bảng chi tiết hiển thị: dataset, nhãn/ID phiên bản, nhánh, thời điểm, nguồn cha, thao tác và cấu hình tạo ra, lần chạy, số dòng/cột, thay đổi so với nguồn nếu đã tính, tình trạng có trên máy và đồng bộ.

Các hành động:

1. **Xem dữ liệu:** mở bảng của đúng phiên bản.
2. **Xem bước xử lý:** mở cấu hình lịch sử chỉ đọc và lần chạy liên quan.
3. **So sánh:** chọn hai phiên bản; hiển thị nguồn và khả năng so sánh. Không khẳng định hai dòng cùng vị trí là cùng bản ghi nếu chưa có quy tắc định danh/ánh xạ.
4. **Chọn làm phiên bản hiện tại:** chuyển con trỏ làm việc, không sửa hoặc xóa phiên bản khác.
5. **Tiếp tục xử lý:** xác nhận thay đổi ngữ cảnh nếu cần, mở bản đồ với phiên bản đã chọn. Chỉ khi áp dụng biến đổi mới từ phiên bản cũ mới tạo nhánh theo quy tắc nghiệp vụ.
6. **Tải nội dung về máy:** chỉ khi online, đúng quyền và đủ dung lượng; chỉ báo sẵn sàng khi tài nguyên đầy đủ.

Không bổ sung quyền xóa tùy ý từng nút phiên bản. Xóa dataset/dự án phải theo chính sách phụ thuộc và xóa online của hệ thống. Chọn nhiều nút để so sánh không đổi nguồn làm việc.

## 7. Liên kết giữa hai màn hình

| Điểm bắt đầu | Hành động | Kết quả |
| --- | --- | --- |
| Bản đồ quy trình | Xem trong cây phiên bản | Mở cây, chọn/focus đúng datasetId và versionId |
| Kết quả biến đổi đã lưu | Xem phiên bản vừa tạo | Mở đúng nút, nguồn và nhánh |
| Cây phiên bản | Xem bước xử lý | Mở thông tin lần chạy lịch sử; không chạy lại |
| Cây phiên bản | Tiếp tục xử lý | Đổi ngữ cảnh rõ ràng và mở bản đồ; chưa tạo phiên bản |
| Lịch sử chạy | Xem đầu vào/đầu ra | Chuyển đến đúng phiên bản và nhãn nguồn |

Chuyển màn hình không hủy tác vụ đang chạy. Tác vụ giữ snapshot đầu vào lúc khởi chạy; đổi nguồn không chuyển đầu ra muộn sang nguồn mới. Khi tác vụ hoàn thành sau khi người dùng đã đổi ngữ cảnh, thông báo kết quả thuộc nguồn cũ và cho mở; không tự kéo người dùng về nguồn đó.

Với biểu mẫu chưa áp dụng, có thể cảnh báo trước khi bỏ nội dung. Không yêu cầu khôi phục biểu mẫu dở sau đóng trang.

## 8. Biểu đồ 3D và quan hệ với bản đồ

- Biểu đồ 3D là một chức năng của Khám phá và trực quan hóa, có thể lưu vào dashboard; không thay thế bản đồ quy trình chính.
- Scatter 3D dùng ba cột số hợp lệ, hoặc tọa độ từ kết quả giảm chiều hợp lệ. Ghi rõ ba cột gốc hay các thành phần PCA; khi PCA hiển thị phương sai giải thích tương ứng.
- Hỗ trợ xoay/zoom, chọn điểm xem chi tiết, chú giải màu/nhãn/cụm và cấu hình trục theo khả năng.
- Trục, đơn vị, nguồn phiên bản, missing bị loại khỏi hiển thị và phạm vi mẫu phải được công bố rõ. Không đồng nhất khoảng cách 3D với mọi quan hệ trong dữ liệu nhiều chiều.
- Giảm số điểm để render chỉ tác động lớp hiển thị và phải thông báo kích thước/cách lấy mẫu; không tự giảm dữ liệu tính toán hoặc huấn luyện.
- Có phiên bản dữ liệu mới không tự đổi nguồn biểu đồ đã lưu. Đổi nguồn chủ động phải kiểm tra lại schema và cấu hình.
- Khi xuất ảnh khung nhìn, kèm nguồn và chú thích cần thiết; nếu chưa hỗ trợ định dạng phải báo rõ, không xuất ảnh trống rồi báo thành công.

## 9. Điều khiển và khả năng tiếp cận

| Thao tác | Điều khiển đề xuất |
| --- | --- |
| Chọn đối tượng | Nhấp chuột hoặc chọn trong danh sách 2D |
| Xoay góc nhìn | Kéo ở nền trống theo hướng dẫn |
| Di chuyển khung nhìn | Điều khiển riêng có hướng dẫn; không xung đột chọn đối tượng |
| Zoom | Con lăn trong vùng canvas hoặc nút +/− |
| Về góc mặc định | Nút Đặt lại góc nhìn |
| Bao quát phần đang xem | Nút Vừa màn hình |
| Tập trung đối tượng | Chọn từ danh sách/tìm kiếm rồi bấm Tập trung |
| Giảm chuyển động | Công tắc và tôn trọng thiết lập hệ điều hành |
| Dùng không gian phẳng | Nút 3D/2D |

- Có hướng dẫn ngắn lần đầu và nút mở lại. Chuyển động kéo không bị nhận nhầm là nhấp chạy chức năng.
- Không chiếm con lăn làm người dùng không thể cuộn trang/bảng; giới hạn sự kiện vào vùng tương tác phù hợp.
- Phím Tab đi tới điều khiển DOM, có focus rõ; Enter/Space kích hoạt nút. Escape đóng tooltip/panel phụ khi phù hợp, không tự hủy tác vụ.
- Nhãn đối tượng và trạng thái có biểu diễn đọc được ngoài canvas; tooltip không phải nơi duy nhất chứa thông tin quan trọng.
- Chữ tiếng Việt rõ, tương phản đủ, nhãn dài không chồng lên nhau. Không dùng nhấp nháy nhanh hoặc chuyển cảnh dài.
- Bản đầu ưu tiên laptop/PC. Ở màn hình hẹp dùng bố cục panel hoặc chế độ 2D để tránh che nội dung; hỗ trợ cảm ứng đầy đủ là phạm vi cần kiểm thử thêm.

## 10. Phương án thẩm mỹ đề xuất

- Phong cách không gian dữ liệu hiện đại, bố cục gọn; nền trung tính, khối đơn giản và đường nối rõ.
- Đề xuất nền tối xanh than, điểm nhấn xanh lam/xanh ngọc; màu trạng thái dùng nhất quán toàn hệ thống. Thiết kế token màu để frontend có thể đổi theme sau.
- Khối có hình học 3D thật, ánh sáng và bóng vừa phải. Không dùng hiệu ứng phát sáng dày làm mờ chữ, không dùng texture/mô hình nặng chỉ để trang trí.
- Đối tượng được chọn có viền hoặc ký hiệu riêng. Phiên bản đang làm việc, phiên bản đang xem chi tiết và phiên bản được chọn để so sánh phải phân biệt được.
- Không đưa toàn bộ dự án vào một “vũ trụ” quá rộng. Ưu tiên góc nhìn đọc được và điều hướng nhanh.
- Không bắt buộc âm thanh, avatar, VR/AR, phòng ảo, bàn thí nghiệm hoặc mô phỏng thuật toán trong bản đầu.

## 11. Kiến trúc kỹ thuật và hợp đồng tích hợp

### 11.1. Tách lớp

1. **Tầng nghiệp vụ dùng chung:** nguồn dữ liệu, registry thao tác, validator, tác vụ, lưu và đồng bộ.
2. **Mô hình hiển thị:** ánh xạ ID, quan hệ, trạng thái và nhãn từ nghiệp vụ sang dữ liệu cho bản đồ/cây.
3. **Bộ dựng cảnh 3D:** mesh, camera, ánh sáng, đường nối, chọn đối tượng và tối ưu render.
4. **Giao diện DOM/2D:** menu, biểu mẫu, bảng, lỗi, chú giải, trạng thái truy cập được và chế độ thay thế.

Canvas không tự gọi API xử lý hoặc ghi trực tiếp database. Sự kiện chọn đối tượng mở chức năng; hành động thực thi đi qua cùng bộ điều phối như giao diện 2D và workflow. Tính toán nặng chạy worker; render không chiếm đường xử lý nghiệp vụ.

### 11.2. Dữ liệu tối thiểu phục vụ hiển thị

| Nhóm | Thông tin cần có |
| --- | --- |
| Ngữ cảnh | projectId, datasetId, versionId, branchId khi có, chế độ bản đồ, runId khi theo dõi |
| Khối giai đoạn | stageId, operationIds ánh xạ, trạng thái khả dụng, lý do chặn, bước/lần chạy liên quan |
| Phiên bản | ID ổn định, datasetId, nhãn, các nguồn, thao tác/lần chạy tạo ra, metadata thống kê |
| Cạnh nguồn gốc | ID nguồn và đích, loại quan hệ, thứ tự/vai trò nguồn nếu thao tác cần |
| Trạng thái | Lưu, đồng bộ, có trên máy, quyền chỉnh sửa và tình trạng tác vụ độc lập |
| Khung nhìn | Màn hình đang mở, ID đang xem, bộ lọc, camera và bố cục trong phạm vi hỗ trợ |

Đây là yêu cầu dữ liệu giao diện, không phải schema collection mới. Ánh xạ vào hợp đồng hiện có; nếu thiếu trường thì đề xuất thay đổi cụ thể để đối chiếu. Không truyền toàn bảng hoặc bí mật tài khoản vào scene graph chỉ để vẽ metadata.

### 11.3. Nhất quán và lưu trạng thái giao diện

- Chỉ có một nguồn trạng thái nghiệp vụ cho cả 2D và 3D. Không duy trì một lịch sử phiên bản giả trong canvas.
- Chọn khối, camera, vị trí bố cục không tạo phiên bản dữ liệu hoặc thay hash của artifact.
- Camera chỉ lưu local khi người dùng bấm Lưu góc nhìn; xoay không tự lưu, không sync. Tab chỉ xem có thể lưu tùy chọn khung nhìn cá nhân local. Màn hình/bộ lọc/con trỏ khôi phục theo C05/C14; lưu camera vào chart là CHART.SAVE cần W.
- Khi mở lại, khôi phục màn hình và phiên bản hoàn chỉnh gần nhất phù hợp. Nếu ID đã xóa hoặc thiếu tài nguyên, thông báo và mở vùng khả dụng; không tự chạy lại tác vụ.
- Listener/worker/request trả kết quả muộn phải kiểm tra ngữ cảnh, quyền và generation hiện hành trước khi cập nhật. Đăng xuất dọn cả nhãn, tooltip, cache scene và dữ liệu tài khoản trong RAM.

### 11.4. Lựa chọn công nghệ

Toàn bộ mã ứng dụng và xử lý sử dụng JS/TS. Chọn giải pháp render 3D chạy trong browser và tích hợp được frontend hiện có; không chốt framework/thư viện mới chỉ để viết đặc tả này.

Trước khi chọn thư viện cụ thể, agent phải kiểm tra tài liệu chính thức hiện hành về khả năng browser/offline, giấy phép, tương thích, vòng đời tài nguyên GPU, picking, nhãn, xuất ảnh và fallback. Ghi phiên bản đã kiểm thử. Không cam kết khả năng hoặc hiệu năng chỉ dựa trên tên thư viện.

## 12. Offline, đồng bộ và nhiều tab

- Bundle hoặc chuẩn bị cục bộ mã render, font tiếng Việt, icon, shader, worker và tài nguyên cần thiết. Không gọi CDN, font server hoặc texture ngoài làm điều kiện mở bản đồ offline.
- Truy cập lần đầu vẫn cần online và chuẩn bị thành công. Mở dự án offline dựa trên phần đã lưu; không hứa dữ liệu browser tồn tại vĩnh viễn.
- Bản đồ và cây phiên bản hoạt động offline với metadata/tài nguyên đã có. Phiên bản mới commit trên máy xuất hiện ngay với nhãn Chưa đồng bộ.
- Khối Nạp dữ liệu vẫn có thể mở để xem/chọn dataset đã lưu; nhập tệp mới và tạo dự án bị chặn offline. AI bị chặn offline; thao tác xử lý browser được hỗ trợ vẫn hoạt động khi đủ đầu vào.
- Nối/ghép tuân theo chính sách online hiện hành của backend; bản thiết kế 3D không tự cho phép tạo dataset dẫn xuất offline.
- Phân biệt có mạng, truy cập được server, xác thực, lưu cục bộ, đồng bộ, sẵn sàng offline và quyền chỉnh sửa. Trạng thái này hiển thị ngoài khối để không trộn với tiến trình thuật toán.
- Sau mất mạng, kết nối lại hiển thị Đồng bộ ngay và chờ người dùng bấm. Không dùng hiệu ứng đường nối sáng làm người dùng hiểu rằng dữ liệu đã đồng bộ khi chưa có ACK.
- Xung đột thể hiện nhánh/bản sao theo hợp đồng backend, giữ cả hai phía; không tự chọn hoặc gộp bằng kéo nối nút.
- Tab chỉ xem vẫn được xoay camera, tìm kiếm và xem nội dung có sẵn; thao tác sửa hoặc tạo đầu ra bền/lịch sử run bị chặn ở tầng nghiệp vụ. Thống kê/preview tạm chỉ đọc theo R + D vẫn được phép; không ghi outbox. C01 phân biệt rõ hai loại. Có nút chuyển quyền theo cơ chế nhiều tab hiện có.
- Mất mạng không hủy thuật toán browser đang chạy. Refresh/đóng tab làm gián đoạn phần chưa hoàn tất; khôi phục bản hoàn chỉnh và lịch sử đúng trạng thái.
- Lỗi context GPU chỉ ảnh hưởng renderer; không tự hủy tác vụ worker đang chạy hoặc xóa dữ liệu. Cho chuyển 2D và phục hồi renderer khi an toàn.

## 13. Hiệu năng và suy giảm an toàn

### 13.1. Nguyên tắc

- Không dựng một khối 3D cho từng dòng của bảng trên bản đồ quy trình hoặc cây phiên bản.
- Không tải toàn bộ artifact/lịch sử lên RAM/GPU chỉ để vẽ các nút metadata. Phân trang, lọc, mở rộng vùng liên quan và gom nhánh hiển thị khi cần; gom chỉ là cách xem, không thay đổi lịch sử.
- Lưu mọi phiên bản theo chính sách chung; giới hạn số nút vẽ cùng lúc không phải giới hạn số phiên bản hoặc quyền tự xóa lịch sử.
- Chỉ render liên tục khi có tương tác/animation cần thiết; giảm hoạt động khi tab ẩn, tránh nhiều canvas nặng cùng chạy.
- Giới hạn độ phân giải render theo thiết bị, giảm bóng/hiệu ứng trước khi giảm thông tin cần thiết. Không tự lấy mẫu dữ liệu nghiệp vụ để cứu FPS.
- Thu hồi mesh, texture, buffer, listener và tài nguyên GPU khi đổi màn hình/đóng dự án; kiểm tra rò rỉ sau nhiều lần chuyển cảnh.
- Khi không hỗ trợ GPU, khởi tạo renderer thất bại hoặc mất context, thông báo ngắn và chuyển 2D giữ nguyên nguồn, lựa chọn và tác vụ.

### 13.2. Mốc đo đề xuất, chưa phải cam kết

Kiểm thử trên máy đại diện, gồm thiết bị có GPU tích hợp nếu có thể. Dataset mục tiêu chung khoảng 10.000–50.000 dòng, tối đa khoảng 50 cột đầu vào và 20 MB/tệp; kích thước đồ thị phiên bản là biến độc lập cần đo riêng.

Đề xuất các kịch bản đồ thị 50, 200 và 1.000 nút metadata. Ở mức lớn, đo cơ chế hiển thị vùng/phân trang, không bắt vẽ mọi nút cùng lúc. Ghi cấu hình máy, browser, số nút/cạnh thực vẽ, thời gian vào cảnh, độ trễ chọn nút, FPS khi xoay, RAM/GPU nếu đo được và thời gian giải phóng.

Mục tiêu ban đầu là tương tác ổn định khoảng 30 FPS trở lên ở cấu hình hiển thị tiêu chuẩn trên máy kiểm thử được công bố. Nếu chưa đạt, điều chỉnh chất lượng và bố cục, báo giới hạn; không khẳng định bảo đảm trên mọi thiết bị.

## 14. Bảo mật và tính đúng đắn

- Tên dataset/cột/giá trị và kết quả AI là nội dung không tin cậy; hiển thị dạng văn bản an toàn. Không đưa HTML từ dữ liệu vào nhãn/tooltip để thực thi.
- Không dùng eval hoặc mã AI sinh ra để điều khiển scene hoặc chạy thao tác.
- Quyền chủ sở hữu phải kiểm tra ở API và truy cập dữ liệu; ẩn nút hoặc ẩn khối không thay thế kiểm soát quyền.
- Không lưu mật khẩu, OTP hoặc API key trong trạng thái scene, snapshot khung nhìn, ảnh xuất, log hay dữ liệu đồng bộ.
- AI gợi ý có thể làm nổi phương án phù hợp sau khi có phản hồi thực, kèm lý do và điều kiện. “Chấp nhận đề xuất” chỉ điền cấu hình; vẫn phải validation và xác nhận chạy.
- Khóa nút khi chạy/đang lưu và chống bấm lặp theo bộ điều phối. Không nhận thông báo hoạt ảnh kết thúc là tín hiệu commit thành công.

## 15. Luồng sử dụng mẫu để kiểm chứng thiết kế

### 15.1. Xử lý từng bước

1. Mở dự án và chọn dataset A/V0; bản đồ hiển thị đúng nguồn.
2. Chọn Làm sạch → Xóa HTML; cấu hình và xem trước trước/sau.
3. Áp dụng; hiện Đang chạy → Đang lưu → Hoàn thành sau commit V1.
4. Nguồn hiện tại chuyển V1 theo nghiệp vụ; chọn Xử lý missing và chạy median tạo V2.
5. Mở Cây phiên bản, focus V2 và thấy V0 → V1 → V2, đúng tên thao tác và nguồn.
6. Chọn V0 rồi Tiếp tục xử lý; chưa có nút mới. Áp dụng phương pháp khác tạo nhánh mới; V1/V2 cũ còn nguyên.

### 15.2. Nhiều dataset và nguồn ghép

1. Dự án có A/V2 và B/V1; người dùng cấu hình ghép bảng khi đủ điều kiện online.
2. Kiểm tra khóa, cảnh báo phình số dòng và xem trước trước khi chạy.
3. Thành công tạo đầu ra theo chính sách bộ dữ liệu dẫn xuất của backend.
4. Cây phiên bản thể hiện cả hai nguồn, không vẽ thành một chuỗi giả chỉ có A.
5. Tiếp tục xử lý đầu ra không thay đổi dữ liệu gốc A/B hoặc nguồn biểu đồ đã lưu.

### 15.3. Mất mạng và phục hồi

1. Dự án đã đủ tài nguyên offline; mất mạng vẫn xoay bản đồ, xem cây và xử lý dữ liệu đã lưu.
2. Thao tác thành công tạo phiên bản cục bộ; nhãn Đã lưu trên máy và Chưa đồng bộ độc lập với dấu hoàn thành.
3. Có mạng lại; chờ Đồng bộ ngay, không tự đẩy hàng đợi.
4. Nếu xung đột thì hiển thị nhánh riêng. Nếu đồng bộ lỗi giữ dữ liệu và trạng thái chờ phù hợp.
5. Mất GPU hoặc chuyển 2D trong lúc tính toán không làm mất tác vụ/kết quả đã lưu.

## 16. Ma trận nghiệm thu

| Mã | Tình huống | Kết quả quan sát được |
| --- | --- | --- |
| 3D-01 | Mở dự án trên máy hỗ trợ | Bản đồ 3D là màn hình làm việc chính, có đối tượng không gian và điều khiển camera thực |
| 3D-02 | Chọn một khối | Đúng bảng chức năng mở bên cạnh; chưa tự chạy |
| 3D-03 | Mở khám phá trước khi làm sạch | Cho phép nếu nguồn/điều kiện hợp lệ; không khóa theo thứ tự hình vẽ |
| 3D-04 | Chạy hai thao tác cùng nhóm | Hai lần chạy/phiên bản đúng; khối tóm tắt được, không sinh giai đoạn nghiệp vụ giả |
| 3D-05 | Đổi dataset/phiên bản | Khả dụng và nhãn cập nhật; kết quả cũ giữ đúng nguồn |
| 3D-06 | Tính toán xong nhưng lưu lỗi | Không hiện thành công; phiên bản trước còn dùng được |
| 3D-07 | Theo dõi workflow lỗi giữa chừng | Giữ bước commit, bước lỗi rõ, bước sau không tự chạy |
| 3D-08 | Mở cây phiên bản | Là màn hình riêng, xem được nhánh và chi tiết nguồn |
| 3D-09 | Nối/ghép nhiều đầu vào | Có mọi cạnh nguồn; không ép một cha |
| 3D-10 | Xem phiên bản cũ rồi xử lý | Chuyển nguồn rõ ràng; chỉ biến đổi mới tạo nhánh, không xóa hậu duệ cũ |
| 3D-11 | Đi qua liên kết hai màn hình | Focus đúng datasetId/versionId, kể cả nhãn V1 trùng giữa dataset |
| 3D-12 | Metadata có nhưng thiếu artifact offline | Hiện trạng thái thiếu và chặn nội dung; không giả có dữ liệu |
| 3D-13 | Offline đã chuẩn bị đủ | Render và chức năng được hỗ trợ hoạt động, không phụ thuộc CDN/API ngoài |
| 3D-14 | Có mạng lại | Chờ Đồng bộ ngay; chưa ACK không hiển thị Đã đồng bộ |
| 3D-15 | Tab chỉ xem | Xem/camera/preview chỉ đọc được; sửa hoặc chạy tạo output bền/lịch sử chuẩn bị chặn theo C01 |
| 3D-16 | Chuyển màn hình khi đang chạy | Tác vụ tiếp tục; đầu ra gắn nguồn snapshot ban đầu |
| 3D-17 | Đóng/refresh giữa tác vụ | Không chạy lại tự động; khôi phục bản hoàn chỉnh và báo gián đoạn |
| 3D-18 | GPU lỗi hoặc thiếu hỗ trợ | Chuyển 2D, giữ nguồn và dữ liệu; không tự hủy worker |
| 3D-19 | Dùng bàn phím/giảm chuyển động | Chức năng cốt lõi truy cập được, focus rõ, không bắt animation |
| 3D-20 | Đồ thị lớn | Hiển thị có giới hạn/phân trang rõ; tìm và mở đúng nút, không xóa lịch sử |
| 3D-21 | Biểu đồ dùng PCA/lấy mẫu | Nguồn tọa độ, phương sai hoặc kích thước mẫu có chú thích đúng |
| 3D-22 | AI đề xuất | Chỉ đề xuất/điền cấu hình; chưa tự chạy hoặc thay dữ liệu |
| 3D-23 | Tên dữ liệu chứa HTML/script | Nhãn an toàn, không thực thi mã |
| 3D-24 | Đăng xuất/đổi tài khoản | Không còn dữ liệu tài khoản cũ trong scene/panel; phản hồi muộn không khôi phục dữ liệu |
| 3D-25 | Đổi camera/chế độ 2D | Không tạo phiên bản, không đổi nguồn biểu đồ hoặc chỉ số |
| 3D-26 | Chuyển màn hình lặp nhiều lần | Không tăng listener/canvas/GPU vô hạn; đo và ghi giới hạn thực tế |

## 17. Sản phẩm agent cần bàn giao khi triển khai

1. Bảng ánh xạ giai đoạn 3D với registry thao tác và điều kiện hiện hành.
2. Wireframe/thiết kế hai màn hình: bản đồ quy trình và cây phiên bản riêng, cùng chế độ 2D.
3. Quy tắc bố cục, camera, chọn đối tượng, nhãn, màu và trạng thái.
4. Hợp đồng view model/sự kiện với frontend, worker, lưu cục bộ và backend; chỉ rõ trường cần bổ sung nếu có.
5. Phương án đóng gói offline, xử lý GPU lỗi, khôi phục màn hình và dọn tài nguyên.
6. Báo cáo đo hiệu năng với cấu hình và dữ liệu kiểm thử thực tế; không chỉ cung cấp ảnh đẹp.
7. Kiểm thử các luồng ở mục 15 và tiêu chí ở mục 16, gồm dữ liệu/phiên bản thật và trường hợp lỗi.
8. Danh sách giới hạn, điểm chưa kiểm chứng và khác biệt tài liệu cần giải quyết.

Ưu tiên triển khai: bản đồ 3D và bảng thao tác dùng chung → trạng thái thật và liên kết nguồn → cây phiên bản riêng → offline/fallback/hiệu năng → hoàn thiện hiệu ứng. Chia giai đoạn không được bỏ các yêu cầu bắt buộc hoặc dùng dữ liệu minh họa thay cho tích hợp cuối cùng.

**Kết quả cần đạt:** người dùng thao tác quy trình qua bản đồ 3D, theo dõi nguồn gốc dữ liệu qua cây phiên bản riêng, luôn thấy đúng nguồn và trạng thái, tiếp tục làm việc được bằng giao diện 2D khi cần.


## Phụ lục v2 — Hợp đồng tích hợp của 3D

- C05: generation và kết quả nguồn cũ.
- C13: app assets chuẩn bị offline.
- C14–C15: camera/view model/events.
- C20: render/engine capability đo thực.

Stage mapping cố định theo C15; đường nối gợi ý không là execution DAG. Graph edge relation là parent/source; version label không làm ID. Camera lưu thủ công local. Scene giữ metadata/ref, row detail lấy qua điều phối có quyền. Mất GPU chỉ hạ renderer, không dừng worker dữ liệu.

Agent phải dùng [hợp đồng chung](hop_dong_tich_hop.md), [quyết định/nghiệm thu](quyet_dinh_va_nghiem_thu.md) và tám prompt v2 cùng bộ. Bàn giao bảng field/schema chi tiết và fixtures đúng hợp đồng trước khi tích hợp; không tạo API/serializer/state machine riêng mâu thuẫn. Chỉ sinh mã khi có nhiệm vụ triển khai riêng. Tài liệu này không xác nhận đã kiểm thử nguồn kỹ thuật, package, nhà cung cấp hoặc hiệu năng.
