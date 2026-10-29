# BRD: BillMaking

**Business Requirements Document: Hệ thống chuẩn hóa chứng từ xuất nhập khẩu bằng AI**

| Mục | Nội dung |
|---|---|
| Tên dự án | BillMaking |
| Lĩnh vực | Logistics, xuất nhập khẩu |
| Phiên bản tài liệu | 1.0 |
| Ngày | 27/10/2026 |
| Trạng thái | Bản nháp, chờ duyệt |

---

## 1. Tóm tắt

Doanh nghiệp logistics nhận mỗi ngày hàng trăm chứng từ (B/L, AWB, Invoice, Packing List, Arrival Notice, D/O...) từ hãng tàu, hãng bay, đại lý và khách hàng. Mỗi bên dùng một định dạng khác nhau. Nhân viên chứng từ phải chép tay dữ liệu sang **mẫu chuẩn** của công ty hoặc của từng khách hàng. Việc này tốn thời gian và dễ sai các thông tin quan trọng như số container, trọng lượng, tên consignee.

BillMaking cho phép người dùng khai báo **chứng từ mẫu** (có các field dạng `{example}`) và **query** mô tả cách lấy dữ liệu cho từng field. Người dùng upload **chứng từ** thực tế rồi bấm **Making**: AI đọc chứng từ, trích xuất dữ liệu theo query và dựng lại chứng từ theo đúng cấu trúc mẫu. Khi có yêu cầu phát sinh, người dùng **chat với AI** để chỉnh sửa tiếp.

## 2. Mục tiêu kinh doanh

| # | Mục tiêu | Chỉ số đo lường (KPI) |
|---|---|---|
| G1 | Giảm thời gian làm một bộ chứng từ | Thời gian trung bình mỗi chứng từ giảm ít nhất 70% so với làm tay |
| G2 | Giảm sai sót nhập liệu | Tỷ lệ field phải sửa sau khi Making dưới 5% |
| G3 | Chuẩn hóa chứng từ theo từng khách hàng / dự án | 100% chứng từ đầu ra theo mẫu đã khai báo của Project |
| G4 | Cho phép nhân viên tự cấu hình mẫu mới mà không cần lập trình | Nhân viên nghiệp vụ tạo được mẫu mới trong dưới 15 phút |
| G5 | Kiểm soát chi phí AI | Doanh nghiệp dùng API key riêng và chọn được model theo chi phí |

## 3. Phạm vi

### 3.1. Trong phạm vi (giai đoạn 1, MVP)

- Thêm, xem, sửa, xóa Project (dự án hoặc công ty).
- Chọn loại hàng cho Project và khai báo loại chứng từ cho từng loại hàng.
- Quản lý chứng từ mẫu: upload file hoặc mã HTML, kèm query.
- Upload chứng từ và chạy Bill Making bằng AI.
- Chat with AI để chỉnh sửa kết quả.
- Lưu phiên bản kết quả, khôi phục phiên bản cũ.
- Xuất kết quả dạng HTML, Word, in / lưu PDF.
- Kết nối AI bằng API key của người dùng.

### 3.2. Ngoài phạm vi (giai đoạn 1)

- Đăng nhập, phân quyền, nhiều người dùng (xem giai đoạn 2).
- Tích hợp trực tiếp với hệ thống hãng tàu, hãng bay, hải quan (VNACCS / e-Manifest), ERP hoặc TMS.
- Xuất kết quả ra file Excel hoặc PDF trên server (giai đoạn 1 dùng chức năng in của trình duyệt để lưu PDF).
- Xử lý hàng loạt nhiều chứng từ cùng lúc (batch).
- Ký số chứng từ.

## 4. Các bên liên quan & người dùng

| Vai trò | Mô tả | Nhu cầu chính |
|---|---|---|
| Nhân viên chứng từ (Docs staff) | Người dùng chính, xử lý chứng từ hằng ngày | Making nhanh, chính xác, sửa phát sinh dễ |
| Trưởng bộ phận chứng từ / OPS | Thiết lập Project, loại chứng từ, mẫu chuẩn | Cấu hình mẫu và query, kiểm soát chất lượng |
| Sales / CS | Gửi chứng từ đúng mẫu khách hàng yêu cầu | Lấy chứng từ đầu ra đúng định dạng |
| Quản trị hệ thống (IT) | Cài đặt, cấu hình API key, sao lưu | Bảo mật key, vận hành ổn định |
| Ban giám đốc | Chủ đầu tư | Năng suất, chi phí, chất lượng |

## 5. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| Project | Một dự án hoặc một công ty (khách hàng) sử dụng hệ thống, có bộ cấu hình riêng |
| Loại hàng | Phương thức / loại dịch vụ vận chuyển: FCL Import, FCL Export, LCL Import, LCL Export, Consol Import, Consol Export, Air Import, Air Export, FTL, LTL, Logistics |
| Loại chứng từ | Một loại giấy tờ trong loại hàng, ví dụ HBL, MBL, AWB, Commercial Invoice, Packing List, Arrival Notice, D/O |
| Chứng từ mẫu | File (PDF, Word, Excel) hoặc mã HTML thể hiện cấu trúc chuẩn, chứa các field dữ liệu dạng `{ten_field}` |
| Field `{example}` | Vị trí dữ liệu trong chứng từ mẫu, được thay bằng giá trị thật khi Making |
| Query | Đoạn mô tả (dạng SQL, ánh xạ hoặc ngôn ngữ tự nhiên) cho hệ thống biết cách lấy dữ liệu của từng field từ chứng từ gốc |
| Chứng từ (chứng từ gốc) | File thực tế người dùng upload (PDF, Word, Excel, HTML, ảnh chụp hoặc scan) |
| Making | Thao tác bấm nút để AI chuyển chứng từ gốc thành chứng từ theo cấu trúc mẫu |
| Phiên bản | Một bản lưu của kết quả sau mỗi lần Making, Chat, sửa tay hoặc khôi phục |
| FCL / LCL | Full Container Load / Less than Container Load |
| Consol | Hàng gom (consolidation) |
| FTL / LTL | Full Truck Load / Less than Truck Load |

## 6. Quy trình nghiệp vụ

### 6.1. Hiện trạng (AS-IS)

1. Nhận chứng từ từ hãng tàu, đại lý hoặc khách hàng qua email (PDF, Excel, ảnh scan).
2. Mở mẫu chứng từ của công ty / khách hàng (Word, Excel).
3. Chép tay từng thông tin: shipper, consignee, notify, cảng, tàu / chuyến, container, seal, hàng hóa, trọng lượng...
4. Tự kiểm tra lại, sửa khi khách yêu cầu thay đổi.
5. Xuất PDF và gửi đi.

Vấn đề: tốn thời gian, dễ sai số liệu, phụ thuộc kinh nghiệm cá nhân, khó chuẩn hóa giữa các nhân viên.

### 6.2. Quy trình mong muốn (TO-BE)

```
[Thiết lập — một lần]
Tạo Project ─► Tick loại hàng ─► Thêm loại chứng từ ─► Upload chứng từ mẫu + Query

[Hằng ngày]
Chọn loại chứng từ ─► Upload chứng từ ─► Bấm "Making"
      ─► Xem kết quả / dữ liệu trích xuất / cảnh báo
      ─► (Nếu cần) Chat với AI để chỉnh sửa ─► Tải Word / HTML / In PDF
```

## 7. Yêu cầu chức năng

Mức ưu tiên: **M** = Must (bắt buộc), **S** = Should (nên có), **C** = Could (có thì tốt).

### 7.1. Menu: Quản lý Project

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| BR-01 | Người dùng thêm, xem, sửa, xóa Project. Thông tin gồm: mã Project (duy nhất), tên Project, tên công ty, mã số thuế, địa chỉ, người liên hệ, điện thoại, email, mô tả. | M |
| BR-02 | Danh sách Project hiển thị tên, mã, công ty, các loại hàng đang dùng và số loại chứng từ. | M |
| BR-03 | Xóa Project phải có xác nhận và xóa kèm toàn bộ loại chứng từ, chứng từ mẫu, chứng từ và file đính kèm. | M |

**Tiêu chí chấp nhận**

- Không tạo được hai Project trùng mã. Hệ thống báo lỗi rõ ràng.
- Mã Project tự động chuyển thành chữ in hoa.

### 7.2. Menu: Chọn loại hàng

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| BR-04 | Sau khi tạo Project, người dùng tick chọn các loại hàng công ty dùng: FCL Import, FCL Export, LCL Import, LCL Export, Consol Import, Consol Export, Air Import, Air Export, FTL, LTL, Logistics. | M |
| BR-05 | Bỏ tick một loại hàng chỉ ẩn loại hàng đó. Các loại chứng từ đã khai báo được giữ lại và hiện lại khi tick lại. | S |

### 7.3. Menu: Loại chứng từ theo loại hàng

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| BR-06 | Mỗi loại hàng đã chọn cho phép thêm, sửa, xóa các loại chứng từ (tên, mã, mô tả). | M |
| BR-07 | Mỗi loại chứng từ hiển thị số chứng từ mẫu và số chứng từ đã xử lý. | S |

### 7.4. Tính năng cốt lõi 1: Bill Making

#### a) Chứng từ mẫu

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| BR-08 | Người dùng upload chứng từ mẫu dạng file (PDF, Word .docx, Excel .xlsx / .xls / .csv, HTML) **hoặc** dán source code HTML. | M |
| BR-09 | Chứng từ mẫu chứa các field dữ liệu dạng `{example}`. Với mẫu Word, Excel và HTML, hệ thống tự phát hiện và liệt kê các field này. Với mẫu PDF, AI tự nhận diện khi Making. | M |
| BR-10 | Mỗi chứng từ mẫu bắt buộc đi kèm một **query** mô tả cách truy vấn dữ liệu cho các field `{example}`. Query có thể viết dạng SQL, dạng ánh xạ field ↔ vị trí trong chứng từ, hoặc ngôn ngữ tự nhiên. | M |
| BR-11 | Một loại chứng từ có thể có nhiều chứng từ mẫu. Một mẫu được đặt làm **mặc định** và được chọn sẵn khi Making. | S |
| BR-12 | Người dùng xem trước, sửa tên, sửa query (và sửa mã HTML với mẫu HTML), xóa chứng từ mẫu. | M |

#### b) Chứng từ & Making

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| BR-13 | Người dùng upload chứng từ dạng PDF, Word, Excel, HTML hoặc ảnh (PNG, JPG, WEBP, GIF), tối đa 100MB mỗi file. | M |
| BR-14 | Người dùng chọn chứng từ mẫu và bấm nút **"Making"**. AI đã được cài sẵn lệnh và rule (prompt) để điều chỉnh chứng từ theo đúng cấu trúc chứng từ mẫu, dùng query để lấy dữ liệu cho các field. | M |
| BR-15 | Kết quả hiển thị gồm: (1) chứng từ đã dựng theo mẫu, (2) bảng dữ liệu trích xuất (field, giá trị, tìm thấy hay không, ghi chú nguồn dữ liệu), (3) danh sách cảnh báo, (4) tóm tắt chứng từ. | M |
| BR-16 | Rule bắt buộc cho AI: không bịa dữ liệu; giữ nguyên giá trị gốc (số B/L, container, seal, HS code, trọng lượng, đơn vị, ngày...); field không tìm thấy được đánh dấu nổi bật; dữ liệu không chắc chắn được đánh dấu riêng; dữ liệu lặp (nhiều container, nhiều dòng hàng) được nhân bản đúng dòng; tổng cộng phải khớp với chứng từ gốc. | M |
| BR-17 | Mỗi lần Making tạo một phiên bản kết quả mới. Người dùng xem lại và khôi phục được mọi phiên bản cũ. | S |
| BR-18 | Người dùng tải kết quả dạng HTML, Word (.doc), hoặc mở trang in để lưu PDF. | M |
| BR-19 | Người dùng sửa tay mã HTML kết quả. Bản sửa được lưu thành phiên bản mới. | C |
| BR-20 | Khi Making lỗi (chưa có API key, key sai, hết hạn mức, AI từ chối...), hệ thống báo lỗi bằng tiếng Việt kèm hướng xử lý. | M |

**Tiêu chí chấp nhận**

- Với một chứng từ mẫu HTML có N field và một chứng từ gốc chứa đủ dữ liệu, kết quả điền đủ N field, đúng giá trị, đúng bố cục mẫu.
- Field không có trong chứng từ gốc hiển thị dạng `{ten_field}` được tô màu và xuất hiện trong danh sách cảnh báo.
- Chứng từ gốc có 3 container thì bảng container trong kết quả có đủ 3 dòng, đúng thứ tự.

### 7.5. Tính năng cốt lõi 2: Chat with AI

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| BR-21 | Sau khi có kết quả Making, người dùng chat với AI để yêu cầu chỉnh sửa phát sinh: sửa giá trị, thêm / bớt dòng, đổi định dạng, dịch nhãn, kiểm tra lại số liệu, hỏi đáp về chứng từ. | M |
| BR-22 | AI dùng toàn bộ thông tin đã nhập (chứng từ mẫu, query, chứng từ gốc, kết quả hiện tại và lịch sử chat) để thực hiện yêu cầu. | M |
| BR-23 | Nếu yêu cầu làm thay đổi chứng từ, hệ thống cập nhật kết quả, tạo phiên bản mới và báo rõ những gì đã thay đổi. Nếu chỉ là câu hỏi, AI trả lời mà không đổi chứng từ. | M |
| BR-24 | Giá trị người dùng cung cấp trong chat được ưu tiên hơn dữ liệu trong chứng từ gốc. | S |
| BR-25 | Lịch sử chat được lưu theo từng chứng từ và có thể xóa. | S |

### 7.6. Tính năng cốt lõi 3: Kết nối AI

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| BR-26 | Người dùng chọn cách kết nối AI: **Claude Code** (mặc định, dùng tài khoản claude.ai Pro / Max đã đăng nhập trên máy chạy app, không cần API key) hoặc **API key Anthropic**. | M |
| BR-27 | Với Claude Code: hệ thống hiển thị trạng thái đăng nhập và gói tài khoản. Báo rõ khi máy chưa cài hoặc chưa đăng nhập Claude Code. | M |
| BR-28 | Với API key: hệ thống kiểm tra key trước khi lưu. Key được mã hóa, không bao giờ hiển thị đầy đủ hay gửi về trình duyệt (chỉ hiện dạng `sk-ant-…abcd`). Có nút xóa key. | M |
| BR-29 | Người dùng chọn model riêng cho từng tác vụ: Making mặc định Sonnet 5.5 (đọc chính xác PDF scan, ảnh, bảng nhiều dòng), Chat mặc định Haiku 5.5 (chỉnh sửa nhỏ, tiết kiệm nhất). Có thể đổi sang Opus 5.5 khi cần độ chính xác cao nhất. Có nút kiểm tra kết nối. | S |
| BR-30 | Bill Making và Chat bị khóa, kèm hướng dẫn, khi chưa cấu hình được kết nối AI. | M |

## 8. Yêu cầu phi chức năng

| ID | Nhóm | Yêu cầu |
|---|---|---|
| NFR-01 | Hiệu năng | Thao tác quản lý (thêm, sửa, xóa) phản hồi dưới 1 giây. Making một chứng từ 1–3 trang hoàn tất trong khoảng 2 phút; chứng từ dài được phép lâu hơn và có hiển thị tiến trình (thời gian đã chạy). |
| NFR-02 | Bảo mật | API key mã hóa AES-256-GCM. HTML từ người dùng và từ AI được hiển thị trong sandbox, chặn script. Nội dung trong chứng từ chỉ được coi là dữ liệu, không phải lệnh cho AI (chống prompt injection). |
| NFR-03 | Toàn vẹn dữ liệu | Không mất kết quả cũ khi Making lại hoặc chat: mọi thay đổi đều có phiên bản. |
| NFR-04 | Khả dụng | Giao diện tiếng Việt, dùng được trên màn hình laptop và máy tính bảng. |
| NFR-05 | Chi phí | Dùng API key của doanh nghiệp. Tái sử dụng ngữ cảnh giữa các lượt chat (prompt caching) để giảm chi phí. Hiển thị số token đã dùng cho mỗi lần Making. |
| NFR-06 | Mở rộng | Cấu trúc dữ liệu cho phép chuyển từ SQLite sang PostgreSQL; prompt / rule AI tách riêng để nghiệp vụ dễ điều chỉnh. |
| NFR-07 | Lưu trữ | File upload lưu trên server, được xóa kèm khi xóa chứng từ / mẫu / Project. |

## 9. Mô hình dữ liệu (mức nghiệp vụ)

```
Project 1───n ProjectCargoType (loại hàng) 1───n DocumentType (loại chứng từ)
DocumentType 1───n Template (chứng từ mẫu + query)
DocumentType 1───n Bill (chứng từ) n───1 Template
Bill 1───n BillVersion (phiên bản kết quả)
Bill 1───n ChatMessage (lịch sử chat)
Setting (API key mã hóa, model AI)
```

| Thực thể | Thông tin chính |
|---|---|
| Project | Mã, tên, công ty, MST, địa chỉ, liên hệ, mô tả |
| ProjectCargoType | Project, loại hàng, đang bật / tắt |
| DocumentType | Loại hàng, tên, mã, mô tả |
| Template | Tên, kiểu (file / HTML), file, mã HTML, field phát hiện được, query, mặc định |
| Bill | Tiêu đề, file gốc, mẫu đã dùng, trạng thái (Chưa Making / Đang xử lý / Hoàn thành / Lỗi), kết quả, dữ liệu trích xuất, cảnh báo, tóm tắt, model, token |
| BillVersion | Nội dung kết quả, nguồn (Making / Chat / Sửa tay / Khôi phục), ghi chú, thời gian |
| ChatMessage | Vai trò (người dùng / AI), nội dung, phiên bản tạo ra |

## 10. Giả định, ràng buộc, phụ thuộc

- **Giả định**: chứng từ gốc đủ rõ để đọc (ảnh scan đủ nét). Máy chạy app có Claude Code đăng nhập bằng tài khoản claude.ai còn hạn mức (hoặc có API key Anthropic còn hạn mức).
- **Ràng buộc**: file upload tối đa 100MB. Word phải ở dạng .docx (không hỗ trợ .doc cũ). Kết quả mỗi lần AI trả về có giới hạn độ dài, nên chứng từ rất dài cần tách nhỏ.
- **Phụ thuộc**: Claude Code đã cài và đăng nhập trên máy chạy app (hoặc Claude API nếu dùng API key). Ứng dụng cần kết nối Internet khi Making / Chat. claude.ai bản web không có cổng kết nối cho ứng dụng bên ngoài, nên không dùng làm kênh kết nối.
- **Hạn mức**: khi dùng Claude Code, mỗi lần Making / Chat tính vào hạn mức gói claude.ai của tài khoản đăng nhập trên máy chủ, dùng chung cho mọi người dùng app.

## 11. Rủi ro & biện pháp

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| AI đọc sai hoặc thiếu dữ liệu (đặc biệt với ảnh mờ) | Cao | Bảng dữ liệu trích xuất kèm trạng thái và ghi chú nguồn, tô màu field thiếu / không chắc chắn, danh sách cảnh báo, người dùng kiểm tra trước khi phát hành |
| Query viết mơ hồ dẫn đến điền sai field | Trung bình | Hướng dẫn và ví dụ viết query ngay trên form; AI cảnh báo khi query mơ hồ |
| Lộ API key | Cao | Mã hóa khi lưu, không trả về client; giai đoạn 2 bổ sung đăng nhập / phân quyền |
| Nội dung độc hại trong chứng từ (prompt injection, script) | Trung bình | Rule AI coi nội dung là dữ liệu; hiển thị HTML trong sandbox; lọc script |
| Chi phí AI tăng | Trung bình | Chọn model theo nhu cầu, prompt caching, hiển thị token |
| Dịch vụ AI gián đoạn | Thấp | Thông báo lỗi rõ ràng, cho phép Making lại; dữ liệu và phiên bản cũ không bị ảnh hưởng |

## 12. Lộ trình đề xuất

| Giai đoạn | Nội dung |
|---|---|
| 1 (MVP, đã xây dựng) | Toàn bộ yêu cầu mục 7 |
| 2 | Đăng nhập, phân quyền theo Project (Admin / Trưởng bộ phận / Nhân viên), nhật ký thao tác; xuất PDF và Excel trực tiếp từ server; hiển thị tiến trình Making theo thời gian thực |
| 3 | Making hàng loạt; thư viện mẫu dùng chung giữa các Project; đối chiếu chéo giữa các chứng từ trong cùng lô hàng (ví dụ HBL ↔ Invoice ↔ Packing List); API tích hợp với TMS / ERP |

## 13. Câu hỏi mở

1. Query sẽ do nhân viên nghiệp vụ hay IT viết? Có cần một dạng query chuẩn (ví dụ ánh xạ field ↔ nhãn) thay vì SQL tự do không?
2. Có cần giữ đúng định dạng file đầu ra giống mẫu (ví dụ mẫu Excel thì xuất Excel) ngay từ giai đoạn 1 không?
3. Mỗi Project dùng API key riêng hay toàn hệ thống dùng chung một key?
4. Thời gian lưu trữ chứng từ và file upload là bao lâu? Có yêu cầu tự động xóa không?
5. Có yêu cầu triển khai trên server nội bộ (on-premise) hay cloud?
