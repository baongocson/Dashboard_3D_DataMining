# Operation registry

catalog.json giữ 145 ID từ B004, version1. Mọi capability hiện unavailable, config schema version1 khóa false; không có executor mẫu. Không render như chức năng đã hỗ trợ.

C04 OperationDefinition dùng handler reference theo tên, không function/code truyền qua API. Nhãn hiện là technical ID ở mục chưa triển khai. Task B030/B040/B050–B064 và owning tasks phải thêm nhãn Việt/schema cụ thể/defaults/validator/preview/estimator/executor/evidence rồi tăng version trước bật. Control/view có command schema phù hợp theo G00, không ép mọi mã thành biến đổi bảng.

Không copy schema vào FE/API/AI; contracts là nguồn validation chung. Registry không tự chạy task/commit hoặc đổi source. Thay ID/output/fit policy cần đối chiếu P/operation coverage; không đổi yêu cầu bằng cấu hình.
