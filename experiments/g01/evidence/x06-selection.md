# X06/B015 — Chọn công cụ và kế hoạch trước cài

Nguồn: kế hoạch §4 X06; B015 phụ thuộc B005; C03/C12/C13/C14/C20; S20/S21/S23; F22/F23/F31; AC18/FE28/I27. Phạm vi experiments/g01 và PROGRESS. Không schema/app implementation, không font/API/CDN khi chạy export. Không dùng Python trong browser/product; Poppler có sẵn chỉ làm verifier độc lập artifact.

| Hai ứng viên | Nguồn chính thức | Lựa chọn T |
| --- | --- | --- |
| pdf-lib1.17.1 + @pdf-lib/fontkit1.1.1, MIT | [JS browser/worker và font embedding](https://pdf-lib.js.org/), [API](https://pdf-lib.js.org/docs/api/classes/pdfdocument), [MIT](https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md) | Chọn thử, pure JS; explicit sections/layout và embedded localfont, bundle worker local |
| jspdf4.2.1, MIT | [API/repo](https://github.com/parallax/jsPDF), [MIT](https://github.com/parallax/jsPDF/blob/master/LICENSE) | Không cài/benchmark: hai ứng viên đều có thể làm; pdf-lib phù hợp probe embed/reload và explicit drawing, chưa so tốc độ |

Phiên bản tra npm trước cài. Font NotoSans-Regular TTF từ [Noto upstream](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans), [SIL OFL1.1](https://raw.githubusercontent.com/notofonts/noto-fonts/main/LICENSE); lưu nguyên font/license/provenance/hash, không sao font hệ thống. Hash khóa byte dù upstream main có thể đổi; fixture không tải lại font khi chạy offline.

Expected trước chạy: PDF nhiều trang tiếng Việt (NFC/NFD nếu hỗ trợ và normalization được khai báo), bảng dài phân trang, PNG thật X05 + caption nguồn/PC variance/sample/camera, metric undefined có reason, userConclusion rõ không AI. Chọn phần subset không lẫn phần bỏ. Xuất bằng dedicated worker rồi verify PDF độc lập Poppler text/font/pages/render, xem PNG mọi trang. Không dùng text extraction thay visual QA.

CSV/JSON typedbigint/decimal/date/null/empty/string-null phải giữ nguyên theo policy tường minh; CSV quoting/comma/newline phải oracle chính xác, không quảng bá tự import CSV vào spreadsheet sẽ giữ type. AppManifest exactbytes/hash/assetdependency gồm bundle/font/PNG/model fixture; SW cache local, offline reload, export lại không fetch font từ ngoài. Xóa dependency test khỏi cache chỉ trong profile probe, báo lỗi trước export và không fallback network. Model dùng artifact X04 tổng hợp đã có, không tạo tính năng import/prediction UI.

Đo build/exportms và bundle/PDFbytes; peak heap không có phương pháp đáng tin ghi inconclusive. Không Docker/Mongo/Nginx/cloud/mail/AI. SkillPDF dùng visual/extraction QA; user scope ưu tiên: mọi artifact/temp nằm experiments/g01, không tạo output/pdf ở root, không cài toàn hệ thống.
