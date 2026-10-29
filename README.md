# BillMaking

BillMaking là web app quản lý chứng từ xuất nhập khẩu (logistics). AI (Claude) đọc chứng từ người dùng upload rồi dựng lại theo đúng cấu trúc của **chứng từ mẫu**. Dữ liệu cho từng field được lấy theo **query** do người dùng định nghĩa.

Tài liệu nghiệp vụ: [docs/BRD.md](docs/BRD.md)

## Tính năng

- **Project**: mỗi Project là một công ty (chỉ cần tên công ty). Tìm kiếm, ghim, đổi tên, xóa (trong menu "…").
- **Loại chứng từ**: thêm loại chứng từ (HBL, Invoice, Packing List, D/O...) kèm loại hàng (FCL / LCL / Consol Import & Export, Air Import & Export, FTL, LTL, Logistics). Loại hàng tự hiện khi có ít nhất một loại chứng từ. Double-click một loại chứng từ để mở màn Bill Making.
- **Bill Making** (mỗi loại chứng từ có một màn):
  - Chứng từ mẫu (PDF / Word / Excel / HTML) có các field `{example}` và query để truy vấn dữ liệu, dùng chung cho loại chứng từ. Mỗi loại chỉ có một mẫu: muốn đổi phải bấm **Gỡ** rồi upload lại.
  - Upload chứng từ gốc (PDF / Word / Excel / HTML / ảnh) rồi bấm **Making** để AI chuẩn hóa theo mẫu.
  - Xem kết quả, bảng dữ liệu trích xuất và cảnh báo. Mỗi lần thay đổi được lưu thành một phiên bản và có thể khôi phục.
  - Tải kết quả dạng HTML hoặc Word, hoặc in / lưu PDF.
- **Chat with AI**: không phụ thuộc Making. AI dùng phần ngữ cảnh đang có (chứng từ mẫu, query, chứng từ gốc, kết quả) để trả lời hoặc chỉnh sửa kết quả.
- **Cài đặt** (menu tài khoản góc phải): Kết nối AI và Giao diện (Sáng / Tối / Theo hệ thống).
- **Kết nối AI**, có 2 cách:
  - **Claude Code** (mặc định): dùng tài khoản claude.ai (Pro / Max) đã đăng nhập trong Claude Code trên máy chạy app, không cần API key.
  - **API key Anthropic**: key được mã hóa AES-256-GCM khi lưu.

## Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| Web framework | Next.js 16 (App Router, Server Actions, Cache Components), React 19, TypeScript |
| Giao diện | Tailwind CSS 4 |
| Database | SQLite qua Prisma ORM (có thể đổi sang PostgreSQL bằng cách sửa `provider` trong `prisma/schema.prisma`) |
| AI | Claude Code CLI ở chế độ không tương tác (`claude -p --json-schema`), hoặc Claude API (`@anthropic-ai/sdk`) với structured output, streaming, prompt caching |
| Đọc file | PDF và ảnh gửi thẳng cho Claude; Word đọc bằng `mammoth`; Excel/CSV đọc bằng `xlsx` (SheetJS) |

## Cài đặt & chạy

Yêu cầu: Node.js 20 trở lên.

```bash
npm install                 # tự chạy prisma generate
cp .env.example .env        # rồi điền APP_SECRET (lệnh tạo có trong file)
npm run db:migrate          # tạo database SQLite
npm run dev                 # http://localhost:3000
```

Kết nối AI mặc định qua **Claude Code**: máy chạy app cần cài Claude Code và đăng nhập trước (chạy `claude` trong terminal rồi gõ `/login`). Nếu lệnh `claude` không nằm trong PATH, đặt biến `CLAUDE_CODE_PATH` trong `.env`. Muốn dùng API key thì chuyển cách kết nối trong mục **Kết nối AI**.

Chạy production:

```bash
npm run build && npm start
```

## Cấu trúc thư mục

```
BillMaking/
├── docs/BRD.md                    # Tài liệu yêu cầu nghiệp vụ
├── prisma/schema.prisma           # Mô hình dữ liệu
├── storage/uploads/               # File chứng từ mẫu & chứng từ đã upload
└── src/
    ├── app/
    │   ├── projects/              # Danh sách Project, chi tiết Project (loại chứng từ)
    │   │   └── [projectId]/documents/[documentTypeId]/
    │   │                          # Màn hình Bill Making: mẫu, query, chứng từ gốc, kết quả, Chat
    │   ├── settings/actions.ts    # Lưu / kiểm tra Kết nối AI (modal Cài đặt)
    │   └── api/                   # Xem file, tải kết quả (HTML / Word / In PDF)
    ├── components/                # UI dùng chung
    └── lib/
        ├── ai/                    # Prompt, rule, gọi Claude (Making & Chat)
        ├── file-convert.ts        # Nhận diện & chuyển đổi PDF/Word/Excel/HTML/ảnh
        ├── settings.ts            # Lưu API key (mã hóa) và model
        └── storage.ts             # Lưu file upload
```

## Tùy chỉnh prompt / rule AI

Toàn bộ lệnh và rule cho nút **Making** và **Chat** nằm trong [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts). Sửa file này để thêm quy tắc nghiệp vụ riêng, ví dụ định dạng ngày hay cách ghi số container.

## Bảo mật

- Claude Code được gọi ở chế độ giới hạn: chỉ có công cụ Read, chỉ đọc được thư mục tạm chứa file của lần xử lý đó, tắt MCP / hook / cấu hình cá nhân, không lưu phiên.
- API key được mã hóa bằng `APP_SECRET` và không bao giờ gửi về trình duyệt. Nếu đổi `APP_SECRET`, bạn phải nhập lại API key.
- HTML do người dùng upload hoặc do AI sinh ra được hiển thị trong sandbox (chặn script) và được lọc bỏ `<script>` / `on*=`.
- App chưa có đăng nhập / phân quyền (xem BRD, giai đoạn 2). Chỉ chạy trong mạng nội bộ cho tới khi có tính năng này.
