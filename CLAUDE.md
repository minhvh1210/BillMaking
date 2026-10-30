# Project Instructions for Claude

@AGENTS.md

## Project Overview
BillMaking là web app nội bộ cho nhân viên chứng từ xuất nhập khẩu (logistics). Mỗi Project là một công ty,
mỗi loại chứng từ (HBL, D/O, Invoice…) có một chứng từ mẫu chứa field `${X}` / `{X}` và một query.
Người dùng upload chứng từ cần làm, bấm **Making** để AI (Claude) dựng lại theo mẫu, thay dữ liệu bằng field;
**Chat with AI** sửa tiếp kết quả. Nghiệp vụ chi tiết: [docs/BRD.md](docs/BRD.md).

## Tech Stack
- Next.js 16.4 (App Router, Server Actions, Cache Components, Turbopack), React 19.3, TypeScript 5.
  API khác bản cũ: đọc `node_modules/next/dist/docs/` trước khi dùng API Next (xem AGENTS.md).
- Tailwind CSS 4 (`@tailwindcss/turbopack`); design token định nghĩa trong `src/app/globals.css`, lấy từ Figma.
- Prisma 6 + SQLite (`prisma/dev.db`).
- AI: Claude Code CLI (`claude -p --json-schema`, mặc định) hoặc `@anthropic-ai/sdk`; output kiểm tra bằng zod 4.
- Đọc file: `mammoth` (Word), `xlsx` SheetJS 0.20 (Excel/CSV); PDF và ảnh gửi thẳng cho Claude.
- Microsoft Word / Excel trên máy chạy app (COM qua PowerShell) để render PDF xem trước. Hỗ trợ từ Office 2007.

## Project Structure
- `src/app/projects/` — danh sách Project, chi tiết Project (loại chứng từ), `actions.ts` cho Project.
- `src/app/projects/[projectId]/documents/[documentTypeId]/` — màn Bill Making:
  `workspace.tsx` (thanh Mẫu / Chứng từ cần làm, dialog thêm file), `result-panel.tsx`, `chat-panel.tsx`, `actions.ts`.
- `src/app/api/` — route xem file và tải kết quả (`bills/[billId]/source`, `templates/[templateId]/preview`…).
- `src/app/settings/` — Kết nối AI.
- `src/components/` — UI dùng chung: `dialog.tsx` (Dialog, FormDialog, Field), `forms.tsx`, `icons.tsx`, `more-menu.tsx`, `ui.tsx`.
- `src/lib/ai/` — `prompts.ts` (mọi rule nghiệp vụ cho Making / Chat), `content.ts` (ngữ cảnh gửi AI),
  `making.ts`, `form-making.ts`, `providers/` (Claude Code, Anthropic API).
- `src/lib/` — `file-convert.ts` (loại file cho phép, chuyển HTML), `storage.ts` (file upload),
  `word.ts` / `excel.ts` / `word-preview.ts` (render PDF bằng Office, có cache), `docx-*.ts` (form Word), `html.ts`.
- `storage/uploads/` — file đã upload và PDF xem trước (`preview-<file>.pdf`).

## Coding Conventions
- Comment, text giao diện và thông báo lỗi bằng tiếng Việt; comment ngắn, giải thích lý do.
- Module server bắt đầu bằng `import "server-only"`.
- Server action: bọc `try/catch`, trả `ActionState` (`{ ok: true }` hoặc `actionError(error)`), gọi `refresh()` khi dữ liệu đổi.
  Lỗi cho người dùng: `throw new Error("<câu tiếng Việt>")`.
- Upload: kiểm tra bằng `assertTemplateFile` / `assertSourceFile`, lưu bằng `saveUpload`, lỗi thì `deleteUpload` file vừa lưu.
- Dùng class token của dự án (`text-ink`, `text-ink-muted`, `bg-surface`, `bg-surface-sunken`, `border-border`,
  `btn-primary`, `btn-secondary`, `btn-ghost`, `input`, `label`…), không dùng màu hex.
- Đổi tên và Xóa luôn nằm trong menu "…" (`MoreMenu`), không đặt nút riêng.
- Trạng thái trống: chỉ một nút tạo, không thêm ô "+" hay đoạn mô tả.
- Figma: file **BillMaking**, trang **UI**, kết nối qua Reqwise. Frame đặt tên `Bill Making / Workspace / 1440 / <Trạng thái>`.
  Sửa giao diện: sửa Figma trước, chờ duyệt, rồi sửa code cho khớp.

## Rules (Do Not Break)
- API key không bao giờ gửi về trình duyệt; lưu mã hóa bằng `APP_SECRET`. Không đổi `APP_SECRET` (mất key đã lưu).
- HTML do người dùng upload hoặc AI sinh ra chỉ hiển thị trong sandbox (`SANDBOXED_HTML_HEADERS`) và qua `sanitizeResultHtml`.
- Claude Code chạy ở chế độ giới hạn (chỉ Read, chỉ thư mục tạm của lần xử lý, tắt MCP / hook). Không nới quyền.
- Kết quả Making giữ nguyên định dạng của chứng từ mẫu, chỉ chứa chữ in sẵn và field, không chứa dữ liệu thật của lô hàng.
- Mỗi loại chứng từ chỉ có một mẫu; mỗi Bill một chứng từ cần làm. Đổi file phải Gỡ trước.
- Mọi thay đổi kết quả (Making, Chat, Khôi phục) tạo phiên bản mới, không ghi đè lịch sử.
- Đổi schema bằng `npm run db:migrate`, không sửa `dev.db` hay file migration đã có.
- Tính năng dùng Word / Excel phải chạy với Office 2007 và có đường dự phòng khi máy không có Office.

## Common Commands
- Dev: `npm run dev` (http://localhost:3000)
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`, chạy production: `npm start`
- Database: `npm run db:migrate` (tạo / áp migration), `npm run db:studio`
- Chưa có test tự động: kiểm tra bằng typecheck, lint và chạy thử trên app.

## Current Focus
Màn Bill Making (cập nhật 30/10/2026), chưa commit:
- Chứng từ mẫu nhận ảnh; tab "Dán nội dung" dán được ảnh (xem trước rồi Lưu), bỏ ô tên file.
- Xem trước Excel bằng PDF do Excel xuất (tab Chứng từ cần làm và xem chứng từ mẫu).

## Known Issues / Gotchas
- Sửa class Tailwind mà giao diện không đổi: cache `.next` cũ không sinh CSS cho class mới. Dừng dev server, xóa `.next`, chạy lại.
- Log dev báo `NEXT_REDIRECT` ở trang `/`: chỉ là redirect sang `/projects`, không phải lỗi.
- Office 2007 có thể tự thoát sau khi đóng file, `Close` / `Quit` báo lỗi RPC `0x800706BE` dù đã xuất xong: luôn bọc trong `try {} catch {}`.
  Xuất PDF trên Office 2007 cần SP2 hoặc add-in "Save as PDF or XPS".
- Word / Excel chạy tuần tự (hàng đợi trong `word.ts` / `excel.ts`); lần xem đầu mất vài giây, sau đó dùng PDF đã cache.
  Gỡ file phải xóa cả `previewPdfPath(...)`.
- Copy từ Word / Excel đưa cả chữ lẫn ảnh vào clipboard: khi dán, có chữ thì ưu tiên chữ.
- Đường dẫn có `[projectId]`, `[documentTypeId]`: đặt trong ngoặc kép khi dùng trong shell.
