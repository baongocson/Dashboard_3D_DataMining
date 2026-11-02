# Prompt giao nhiệm vụ cho Agent — Thiết kế tính năng offline

> **Bản hợp nhất v2 — 02/11/2026.** Giữ yêu cầu và ma trận chuyên ngành của bản gốc; cập nhật các quyết định đã chốt và dùng [hợp đồng C01–C22](hop_dong_tich_hop.md). Đọc [README](README.md) để phân biệt yêu cầu sản phẩm P, thiết kế kỹ thuật T, điểm kiểm chứng V và quyết định mới Q. Tài liệu gốc nằm ở thư mục cha, không bị sửa. Đây chưa phải mã nguồn hoặc bằng chứng đã kiểm thử.

## 1. Vai trò và nhiệm vụ

Bạn là kiến trúc sư phần mềm và lập trình viên JS/TS phụ trách thiết kế tính năng offline cho đề tài **“Xây dựng hệ thống dashboard tương tác 3D quản lý và trực quan hóa toàn bộ quy trình khai phá dữ liệu”**.

Hãy tạo đặc tả kỹ thuật có thể triển khai, dựa trên toàn bộ yêu cầu bắt buộc dưới đây. Đây là nhiệm vụ thiết kế; không tự triển khai, sửa repository hoặc thay đổi những quyết định sản phẩm đã chốt nếu chưa được giao thêm nhiệm vụ đó.

Nếu được cung cấp mã nguồn hoặc các tài liệu thiết kế liên quan, hãy đọc và đối chiếu trước. Phân biệt rõ: yêu cầu đã chốt, giải pháp kỹ thuật đề xuất và vấn đề cần kiểm chứng. Nếu có mâu thuẫn ảnh hưởng trực tiếp đến tính đúng đắn, nêu đúng điểm mâu thuẫn; không tự đổi yêu cầu hoặc giả định đã đọc những tệp chưa được cung cấp.

## 2. Bối cảnh và nguyên tắc kiến trúc

- Sản phẩm là **website truy cập bằng đường link**. Không yêu cầu người dùng cài Node.js, MongoDB, Nginx, Docker hoặc phần mềm riêng trên máy.
- Frontend, backend và phần khai phá dữ liệu sử dụng **JavaScript/TypeScript**; không sử dụng Python để xử lý hoặc huấn luyện.
- MongoDB và backend chạy trên máy chủ. Nginx phục vụ website/reverse proxy theo thiết kế web server; chúng không trở thành dịch vụ chạy trong trình duyệt khi mất mạng.
- Người dùng thao tác qua nút, biểu mẫu và lựa chọn; không cần viết code trong IDE.
- Có thể dùng Service Worker, Cache Storage, IndexedDB và Web Workers để thực hiện kiến trúc offline. Việc cài website thành PWA là tùy chọn, không phải điều kiện bắt buộc để sử dụng.
- Website cần được tải và chuẩn bị thành công khi có mạng trước khi dùng offline. Không hứa truy cập lần đầu trên một trình duyệt hoàn toàn mới khi không có Internet.
- Phân biệt lưu tài nguyên ứng dụng với lưu dữ liệu tài khoản. Giao diện 3D, font, thư viện, worker, mô hình/tài nguyên tính toán cần thiết phải có bản dùng offline; không phụ thuộc CDN hoặc API ngoài ở thời điểm sử dụng offline.
- Chỉ sử dụng thư viện có khả năng chạy trong trình duyệt cho các chức năng được công bố hỗ trợ offline. Kiểm tra khả năng thực tế, định dạng mô hình, giấy phép và giới hạn; không suy luận rằng thư viện Node.js đương nhiên chạy được trên browser.

## 3. Ma trận chức năng bắt buộc

| Chức năng | Có Internet | Offline |
| --- | --- | --- |
| Đăng ký, đăng nhập mới, quên mật khẩu | Có | Không |
| Tạo dự án mới | Có | Không |
| Nhập CSV/JSON mới (mỗi tệp tạo dataset mới); nối/ghép các nguồn đã có | Có | Không |
| Mở dự án đã có đủ tài nguyên trên thiết bị | Có | Có |
| Làm sạch, xử lý missing, tiền xử lý, biến đổi và chọn đặc trưng đã hỗ trợ | Có | Có, trên dữ liệu đã lưu |
| Thống kê, tạo biểu đồ và tương tác 3D | Có | Có, nếu đã có tài nguyên cần thiết |
| Huấn luyện và đánh giá thuật toán thuộc phạm vi offline | Chạy trong trình duyệt | Chạy trong trình duyệt |
| Xem lịch sử, mở phiên bản đã lưu trên máy | Có | Có |
| Mở phiên bản chỉ có trên máy chủ | Có | Không |
| Xuất dữ liệu, biểu đồ, mô hình đã có trên máy | Có | Có |
| AI/LLM đề xuất | Có | Không |
| Thuật toán bổ sung chỉ chạy trên máy chủ | Có, ghi rõ cần Internet | Không |
| Đồng bộ với máy chủ | Có, theo quy tắc bên dưới | Không |

Offline vẫn cho làm sạch HTML, sửa kiểu dữ liệu, xử lý missing và biến đổi dữ liệu đã lưu. Tắt chức năng tạo mới/nhập tệp phải được kiểm tra ở tầng điều phối nghiệp vụ, không chỉ làm mờ nút. Thông báo lý do và điều kiện sử dụng lại, giữ nguyên dữ liệu hiện tại.

## 4. Phạm vi ban đầu và hiệu năng

- Thiết bị chính: laptop/PC, ưu tiên Chrome và Edge.
- Định dạng dữ liệu: CSV và JSON có thể chuyển thành bảng trong phạm vi hỗ trợ. Không có chức năng thay byte nguồn hoặc nối tệp ngầm vào dataset cũ; nối/ghép là thao tác riêng online tạo dataset dẫn xuất mới.
- Mục tiêu thử nghiệm: khoảng 10.000–50.000 dòng, khoảng tối đa 50 cột, tối đa 20 MB/tệp. Xét đồng thời các giới hạn; kiểm tra kích thước sau parse và sau biến đổi, không chỉ kích thước tệp gốc.
- Thuật toán offline đợt đầu: hồi quy tuyến tính, Logistic Regression, KNN, K-Means và PCA.
- Đây là mục tiêu kiểm thử, không phải bảo đảm mọi thuật toán chạy nhanh trên mọi dữ liệu. Nêu rõ điều kiện đầu vào, chi phí tính toán, giới hạn bộ nhớ và giới hạn theo từng thuật toán.
- Tính toán nặng chạy trong worker; có tiến độ, hủy và xử lý lỗi. Không làm treo giao diện hoặc tạo ma trận quá lớn không kiểm soát.
- Kiểm tra schema, kiểu cột, số mẫu, số đặc trưng, missing, giá trị hữu hạn, nhãn, tham số thuật toán và nguy cơ dữ liệu phình lớn khi mã hóa. Không tự giảm mẫu hoặc đổi thuật toán mà không cho người dùng biết.
- Ghi cấu hình, seed nếu hỗ trợ, phiên bản thư viện và nguồn phiên bản dữ liệu để truy vết kết quả.

## 5. Tài khoản và phiên đăng nhập

1. Người dùng phải đăng nhập thành công ít nhất một lần khi online trên trình duyệt đó để có quyền làm việc offline với dữ liệu đã lưu của tài khoản.
2. Hết hạn phiên khi offline: vẫn cho làm việc và lưu trên máy. Khi có mạng, phải đăng nhập lại đúng tài khoản trước khi đồng bộ nếu xác thực không còn hợp lệ.
3. Một tài khoản chỉ có một phiên đăng nhập trực tuyến hợp lệ trên một máy tại một thời điểm. Đăng nhập trên máy B thu hồi phiên máy A. Nhiều tab trên cùng browser profile phải dùng chung phiên, không được tự thu hồi lẫn nhau.
4. Máy A đang offline vẫn tiếp tục làm việc vì chưa nhận được thông tin thu hồi. Không tuyên bố có thể thu hồi tức thời một thiết bị đang mất mạng.
5. Khi A kết nối lại, xác thực lại trước khi gửi dữ liệu. Nếu phiên bị thu hồi: giữ dữ liệu cục bộ, yêu cầu đăng nhập lại đúng tài khoản. Đăng nhập lại trên A cũng tuân thủ quy tắc thu hồi phiên còn lại.
6. Không xóa dữ liệu chưa đồng bộ chỉ vì hết hạn/thu hồi phiên. Không cho tài khoản khác đọc, sửa hoặc nhận đồng bộ dữ liệu đó.
7. Tách quyền truy cập offline đã ghi nhận trên thiết bị khỏi xác thực API máy chủ. Không lưu mật khẩu hoặc bí mật xác thực trong dữ liệu dự án. Mọi API máy chủ kiểm tra chủ sở hữu và phiên hợp lệ.

## 6. Lưu dự án và chuẩn bị offline

### 6.1. Lưu tự động

- Với dự án đang làm việc, tự giữ dữ liệu gốc và phiên bản hiện tại trên thiết bị, cùng các metadata/tài nguyên cần để mở và dùng phiên bản đó.
- Không đòi tải toàn bộ phiên bản lịch sử từ máy chủ khi chỉ mở dự án.
- Mỗi thao tác thay đổi dữ liệu thành công tạo phiên bản hoàn chỉnh mới; lưu trước khi báo hoàn tất.
- Giữ mọi phiên bản mới phát sinh trên máy, đặc biệt khi offline. Ví dụ V5 → V6 → V7 → V8 phải giữ V6, V7, V8 để quay lại và đồng bộ sau.
- Dữ liệu gốc bất biến. Hoàn tác hoặc mở phiên bản cũ không âm thầm xóa các phiên bản mới; phải xác định rõ phiên bản hiện tại và quan hệ cha–con.
- Lỗi, cảnh báo và thao tác bị hủy được ghi thành lịch sử phù hợp, nhưng không tạo phiên bản dữ liệu thành công giả.

### 6.2. Nút “Lưu để dùng offline”

Tải và lưu đầy đủ:

- Dữ liệu gốc và toàn bộ phiên bản đã hoàn thành tại thời điểm chuẩn bị.
- Quy trình, cấu hình xử lý và lịch sử chạy.
- Cấu hình biểu đồ cùng dữ liệu/kết quả cần để dựng lại.
- Cấu hình huấn luyện, chỉ số đánh giá và mô hình đã lưu.
- Thư viện, worker và tài nguyên cần cho các chức năng offline được hỗ trợ.

Phải có danh mục tài nguyên, tiến độ, kiểm tra đầy đủ/toàn vẹn và dung lượng. Chỉ báo **“Sẵn sàng dùng offline”** sau khi hoàn thành; bản tải dở không được nhận là đầy đủ. Theo dõi mức đầy đủ theo phiên bản dự án; khi tài nguyên thay đổi phải xác định lại trạng thái.

Đóng tab hoặc tắt máy rồi mở lại trên cùng trình duyệt vẫn mở được website và dữ liệu đã chuẩn bị, với điều kiện dữ liệu/tài nguyên chưa bị người dùng hoặc trình duyệt xóa. Không cam kết bản lưu trình duyệt tồn tại vĩnh viễn.

## 7. Vòng đời thao tác và phiên bản

- Mất mạng trong lúc thuật toán offline đang chạy: tiếp tục trong browser.
- Đóng tab hoặc tải lại trang: hủy thao tác chưa hoàn tất, không tiếp tục chạy nền để tạo kết quả. Mở lại khôi phục bản hoàn chỉnh gần nhất đã lưu trên máy, kể cả bản đó chưa đồng bộ.
- Không phụ thuộc duy nhất vào sự kiện đóng trang để bảo đảm đúng đắn. Thiết kế trạng thái chạy, staging và commit nguyên tử; khi mở lại nhận diện thao tác bị gián đoạn và loại kết quả dở.
- Nếu thao tác chỉ chạy trên máy chủ: thiết kế tín hiệu hủy và lease/timeout để máy chủ không công nhận kết quả sau khi client đóng/mất phiên làm việc; nêu độ trễ phát hiện thực tế. Không tuyên bố browser luôn gửi được sự kiện đóng tab.
- Lưu phiên bản, lịch sử thành công và mục chờ đồng bộ nhất quán. Tránh trường hợp đã thay phiên bản hiện tại nhưng dữ liệu chưa lưu đủ.
- Không tiếp tục thao tác đã bị hủy chỉ vì sau đó có mạng trở lại.

## 8. Quy tắc đồng bộ

### 8.1. Khi online liên tục

- Lưu cục bộ sau mỗi thao tác thành công, sau đó tự đồng bộ kết quả hoàn chỉnh lên máy chủ.
- Nội dung gồm dữ liệu gốc, các phiên bản xử lý thành công, quy trình, cấu hình, lịch sử/lỗi/cảnh báo/thời gian chạy, cấu hình biểu đồ, cấu hình huấn luyện, chỉ số đánh giá và mô hình đã lưu.

### 8.2. Sau một lần mất mạng

- Khi có thể kết nối lại máy chủ, hiện **“Đồng bộ ngay”**; không tự đẩy những thay đổi tích lũy trước khi người dùng bấm.
- Kiểm tra xác thực trước khi đồng bộ. Cờ có mạng của browser chỉ là tín hiệu; phân biệt mất mạng, máy chủ lỗi và hết hạn phiên.
- Đồng bộ thành công bật lại tự đồng bộ cho thao tác tiếp theo, đến lần mất mạng tiếp theo.
- Nếu đồng bộ lỗi/gián đoạn: giữ dữ liệu và hàng đợi, báo chưa hoàn tất; cho thử lại, không âm thầm bật lại chế độ tự đồng bộ hậu mất mạng.
- Quyền cho phép đồng bộ thủ công phải được các tab dùng chung; không để tab khác tự gửi vượt qua trạng thái chờ.
- Không bắt buộc đồng bộ khi đóng tab; không phụ thuộc Background Sync để bảo đảm tính năng chính.

### 8.3. Đồng bộ khi còn thao tác chạy

- Chụp tập các phiên bản hoàn chỉnh ở thời điểm đồng bộ. Thao tác đang chạy tiếp tục; kết quả chỉ được đưa vào lượt tiếp theo sau khi commit thành công.
- Không đánh dấu “Đã đồng bộ” cho các thay đổi phát sinh sau điểm chụp chưa nhận xác nhận máy chủ.

### 8.4. Nhất quán và xung đột

- Dùng ID ổn định, khóa chống gửi trùng, hàng đợi bền vững và xác nhận từ máy chủ. Mất phản hồi sau khi máy chủ đã lưu rồi gửi lại không tạo thêm phiên bản.
- Xác định version cha, revision cơ sở, branch và chủ sở hữu. Kiểm tra đồng thời thay đổi trên máy chủ; không chỉ so thời gian máy người dùng.
- Nếu dự án máy chủ đã thay đổi so với cơ sở cục bộ, lưu thay đổi cục bộ thành **nhánh phiên bản riêng**, giữ cả hai phía; không ghi đè hoặc tự gộp dữ liệu âm thầm.
- Trình bày rõ upload tài nguyên, kiểm tra đủ tham chiếu và commit phiên bản phía máy chủ; không để người dùng thấy phiên bản thành công trỏ tới tệp thiếu.
- Đề xuất phân trang/chia khối và thử lại phù hợp; kiểm tra quyền trên mọi lượt gửi. Đăng xuất hoặc đổi phiên phải chặn request cũ tiếp tục commit dưới tài khoản khác.

## 9. Đăng xuất và xóa dữ liệu cục bộ

| Tình huống | Hành vi bắt buộc |
| --- | --- |
| Offline, còn thay đổi chưa đồng bộ | Chặn đăng xuất; giải thích cần kết nối để đồng bộ; có nút Hủy |
| Offline, không còn thay đổi chưa đồng bộ | Cho đăng xuất; xóa dữ liệu tài khoản trên máy; lưu yêu cầu thu hồi phiên để gửi khi kết nối lại |
| Online, còn thay đổi chưa đồng bộ | Hộp thoại có “Đồng bộ rồi đăng xuất”, “Vẫn đăng xuất”, “Hủy” |
| Chọn đồng bộ rồi đăng xuất, đồng bộ thành công | Đăng xuất, xóa dữ liệu tài khoản trên máy |
| Chọn đồng bộ rồi đăng xuất, đồng bộ thất bại | Giữ dữ liệu và phiên làm việc; báo lỗi |
| Chọn “Vẫn đăng xuất” khi online | Cảnh báo rõ mất thay đổi chưa đồng bộ; sau khi xác nhận, xóa dữ liệu tài khoản trên máy và đăng xuất |
| Không có thay đổi chưa đồng bộ khi online | Đăng xuất và xóa dữ liệu tài khoản trên máy |

- Xóa cục bộ không xóa dự án/phiên bản đã đồng bộ trên máy chủ.
- Phạm vi xóa gồm dữ liệu dự án, mô hình, bản dở, hàng đợi thay đổi và cache riêng tài khoản; có thể giữ tài nguyên ứng dụng công khai dùng chung.
- Yêu cầu thu hồi phiên còn chờ chỉ chứa dữ liệu tối thiểu cần thiết, không giữ lại dự án; phải nhắm đúng phiên cũ, không thu hồi phiên mới đăng nhập sau đó.
- Đăng xuất phải tác động tới toàn bộ tab của phiên; hủy worker, ngăn ghi lại dữ liệu sau khi đã xóa, xử lý đồng bộ đang gửi. Nếu có thao tác đang chạy, nêu rõ việc hủy trước khi chốt tập dữ liệu cần xử lý.
- Không bổ sung chức năng xuất/nhập toàn bộ gói dự án thành yêu cầu bắt buộc: người dùng mới chốt xuất dữ liệu, biểu đồ và mô hình.

## 10. Nhiều tab và quyền chỉnh sửa

- Cho mở nhiều tab, nhưng một dự án chỉ có một tab được chỉnh sửa; tab khác chỉ xem.
- Có nút chuyển quyền chỉnh sửa. Việc chuyển phải bảo đảm tab cũ ngừng ghi trước khi tab mới nhận quyền; xử lý thao tác đang chạy và không tạo hai writer.
- Dự án khác nhau có thể được chỉnh sửa ở các tab khác nhau.
- Thiết kế khóa dùng chung giữa tab, đồng bộ thông báo và khôi phục khi tab chết. Đề xuất Web Locks/BroadcastChannel hoặc giải pháp tương đương có cơ chế tránh ghi đồng thời thực sự.
- Khi tab giữ quyền bị đóng, thao tác dở bị hủy; tab khác có thể nhận quyền và mở bản hoàn chỉnh gần nhất.

## 11. Trạng thái giao diện và xử lý lỗi

Phân biệt các trục trạng thái, không gộp thành một cờ online/offline:

- Kết nối: có mạng, offline, máy chủ không truy cập được.
- Xác thực: hợp lệ, cần đăng nhập lại, phiên bị thu hồi.
- Lưu: đang lưu, đã lưu trên máy, lưu thất bại.
- Đồng bộ: chưa đồng bộ, chờ người dùng, đang đồng bộ, đã đồng bộ, lỗi, có nhánh khác.
- Sẵn sàng offline: chưa chuẩn bị, đang tải, sẵn sàng, thiếu tài nguyên.
- Quyền chỉnh sửa: đang giữ quyền hoặc chỉ xem.

Hiển thị rõ **“Đã lưu trên máy”**, **“Chưa đồng bộ”**, **“Đã đồng bộ”** theo dữ liệu thực tế. Không coi phản hồi lưu cục bộ là xác nhận máy chủ.

Khi thiếu dung lượng: không công nhận thao tác hoàn tất, giữ phiên bản trước, dọn bản dở an toàn. Không tự xóa dữ liệu chưa đồng bộ. Cho gỡ bản offline của dự án đã đồng bộ để giải phóng dung lượng; không xóa dự án trên máy chủ. Kiểm tra cả bản gốc/kết quả lớn và tài nguyên dùng chung còn được tham chiếu.

Đề xuất kiểm tra quota và xin lưu bền vững nếu được hỗ trợ; xử lý trường hợp bị từ chối. Nêu giới hạn khi người dùng xóa site data, dùng chế độ riêng tư, đổi browser profile hoặc trình duyệt thu hồi dung lượng.

## 12. Các phần kỹ thuật agent phải đặc tả

1. Sơ đồ kiến trúc và luồng online → offline → kết nối lại → xác thực → đồng bộ.
2. Mô-đun frontend: quản lý offline, cache tài nguyên, kho dữ liệu cục bộ, bộ chạy worker, versioning, hàng đợi đồng bộ, phiên và khóa nhiều tab.
3. Cấu trúc dữ liệu đề xuất: account scope, project, dataset/version, branch, run, chart, model/artifact, offline manifest, sync queue và khóa chỉnh sửa. Mỗi trường phải có mục đích; không tự quyết schema MongoDB của toàn hệ thống ngoài phạm vi tích hợp.
4. API contract đề xuất với backend: kiểm tra phiên, tải manifest/tài nguyên, gửi thay đổi, commit/ack, xử lý revision conflict và thu hồi phiên. Nêu payload, quyền, tính chống gửi trùng và lỗi chính.
5. State machine hoặc bảng chuyển trạng thái cho kết nối/đồng bộ, thao tác xử lý, đăng xuất và quyền chỉnh sửa.
6. Cơ chế commit cục bộ nguyên tử và phục hồi sau refresh/crash; quản lý tệp lớn nếu lưu ngoài IndexedDB transaction.
7. Cập nhật Service Worker/cache và migration schema: không xóa hàng đợi hoặc dữ liệu chưa đồng bộ, không ép reload giữa thao tác, bảo đảm tương thích mã ứng dụng–worker–dữ liệu.
8. Tích hợp MongoDB/backend/Nginx: HTTPS, đường dẫn SPA offline, cache version tài nguyên, đường dẫn worker và cache policy cho API riêng tư. Không cache phản hồi xác thực/dữ liệu người dùng như tài nguyên công khai.
9. Lộ trình triển khai theo phần có thể kiểm thử; liệt kê tài liệu liên quan cần cập nhật, đặc biệt tài khoản, MongoDB, frontend, backend và web server.

Nếu được cung cấp các tệp `thiet_ke_3d`, `thiet_ke_caynut_dieukien.md`, `thiet_ke_chuc_nang_he_thong`, `thiet_ke_mongodb`, `thiet_ke_frontend`, `thiet_ke_backend`, `thiet_ke_webserver`, hãy chỉ ra hợp đồng tích hợp và chỗ cần điều chỉnh. Yêu cầu tài khoản trong prompt này thay thế giả định cũ rằng hệ thống không có tài khoản.

## 13. Tiêu chí nghiệm thu và kiểm thử bắt buộc

Thiết kế test có bước thực hiện, kết quả mong đợi và bằng chứng dữ liệu; ưu tiên kiểm thử tích hợp/E2E cho các rủi ro mất dữ liệu:

1. Chuẩn bị website/dự án online, ngắt mạng thật rồi tải lại đường dẫn dự án: mở được bản đã lưu; không dùng tài nguyên mạng ẩn.
2. Dự án chưa tải hoặc thiếu tài nguyên: thông báo đúng; không hiển thị sẵn sàng offline giả.
3. Offline: không tạo dự án/nhập tệp/AI; các thao tác được hỗ trợ vẫn chạy và xuất kết quả được.
4. Mất mạng giữa huấn luyện browser: tiếp tục; refresh giữa xử lý: không có phiên bản dở được công nhận.
5. Tạo V6–V8 offline: giữ đủ; quay lại được; mở lại vẫn giữ phiên bản hoàn chỉnh chưa đồng bộ.
6. Có mạng trở lại: chưa tự gửi cho tới khi bấm nút; đồng bộ thành công bật tự đồng bộ tiếp theo.
7. Đồng bộ trong lúc worker chạy: chỉ gửi bản hoàn chỉnh; kết quả mới không bị đánh dấu đã đồng bộ nhầm.
8. Máy chủ đã commit nhưng mất phản hồi: gửi lại không trùng phiên bản/tài nguyên logic.
9. Hết hạn/thu hồi phiên: giữ dữ liệu, không gửi trước xác thực đúng tài khoản. Đăng nhập B khi A offline rồi A trở lại đúng quy tắc.
10. Máy chủ có thay đổi: tạo nhánh riêng, không mất dữ liệu hai phía.
11. Kiểm thử mọi nhánh đăng xuất trong bảng; không mất dữ liệu do lỗi đồng bộ; “Vẫn đăng xuất” không xóa bản trên máy chủ.
12. Nhiều tab tranh quyền/chuyển quyền/tab chết: tối đa một writer cho dự án; không có worker ghi sau đăng xuất.
13. Giả lập hết quota, tải offline dở và lưu kết quả lỗi: giữ phiên bản cũ, không tự xóa thay đổi chưa đồng bộ.
14. Cập nhật ứng dụng/migration khi có hàng đợi chưa gửi: không mất dữ liệu, không dùng sai schema.
15. Đo thời gian, bộ nhớ, khả năng hủy và độ đáp ứng giao diện cho năm thuật toán, các mức dữ liệu mục tiêu và trường hợp đặc trưng phình lớn.

## 14. Định dạng đầu ra

Trả về một đặc tả Markdown bằng tiếng Việt, đủ cụ thể để agent lập trình triển khai. Bao gồm kiến trúc, bảng chức năng, mô hình trạng thái, cấu trúc dữ liệu, hợp đồng tích hợp, pseudocode các luồng quan trọng, kế hoạch triển khai và ma trận nghiệm thu.

Giải thích thuật ngữ ngắn gọn. Với thư viện/API cụ thể được lựa chọn, kiểm tra tài liệu chính thức hiện hành và ghi nguồn; đánh dấu các giả định chưa kiểm chứng. Không mở rộng sang ứng dụng desktop, máy chủ cài tại máy người dùng, chia sẻ dự án hoặc cộng tác thời gian thực. Không thêm cloud AI vào offline. Không hứa lưu trữ vô hạn hoặc hiệu năng chưa đo.

Ưu tiên cao nhất: **không mất dữ liệu đã lưu thành công, không đồng bộ sai tài khoản, không ghi đè phiên bản khi có xung đột, và phản ánh đúng trạng thái lưu/đồng bộ cho người dùng**.


## Phụ lục v2 — Hợp đồng tích hợp của OFF

- C02–C03: ID, serializer, lineage.
- C05–C07: task/local commit/writer/account gate.
- C08–C11: intent, sync gate, ACK, resync.
- C13: manifest/SW/migration.
- C19: serverGeneration sau restore.

Local generation và writer fence phải kiểm tra ngay trước transaction commit. Không dùng BroadcastChannel như khóa độc quyền. Pending revocation chứa handle tối thiểu, key AI không nằm trong kho local. Bản local của tài nguyên server đã xóa chuyển blockedDeleted; giữ byte, không tự phục hồi, xem/xuất/gỡ có xác nhận theo C11.

Agent phải dùng [hợp đồng chung](hop_dong_tich_hop.md), [quyết định/nghiệm thu](quyet_dinh_va_nghiem_thu.md) và tám prompt v2 cùng bộ. Bàn giao bảng field/schema chi tiết và fixtures đúng hợp đồng trước khi tích hợp; không tạo API/serializer/state machine riêng mâu thuẫn. Chỉ sinh mã khi có nhiệm vụ triển khai riêng. Tài liệu này không xác nhận đã kiểm thử nguồn kỹ thuật, package, nhà cung cấp hoặc hiệu năng.
