import { db } from "@/lib/db";
import { kindFromMime } from "@/lib/file-convert";
import { ensureHtmlDocument } from "@/lib/html";
import { SANDBOXED_HTML_HEADERS, fileResponse, notFoundResponse } from "@/lib/http";
import { readUpload } from "@/lib/storage";
import { excelPdfPreview, wordPdfPreview } from "@/lib/word-preview";

/**
 * Xem chứng từ cần làm: PDF/ảnh trả file gốc, Word / Excel trả PDF do Word / Excel xuất (nếu máy có),
 * HTML (hoặc Word / Excel khi máy không có Office) trả bản chuyển đổi trong sandbox.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/bills/[billId]/source">) {
  const { billId } = await ctx.params;
  const bill = await db.bill.findUnique({ where: { id: billId } });
  if (!bill?.sourceStoragePath || !bill.sourceMimeType || !bill.sourceFileName) {
    return notFoundResponse("Chưa có chứng từ cần làm.");
  }

  const kind = kindFromMime(bill.sourceMimeType);
  if (kind === "pdf" || kind === "image") {
    const buffer = await readUpload(bill.sourceStoragePath);
    return fileResponse(buffer, bill.sourceMimeType, bill.sourceFileName, true);
  }
  // File Word: xem bằng PDF do Word render để giữ đúng bố cục (form có nhãn là ảnh, text box)
  if (kind === "docx") {
    const pdf = await wordPdfPreview(bill.sourceStoragePath);
    if (pdf) return fileResponse(pdf, "application/pdf", `${bill.sourceFileName}.pdf`, true);
  }
  if (kind === "spreadsheet") {
    const pdf = await excelPdfPreview(bill.sourceStoragePath);
    if (pdf) return fileResponse(pdf, "application/pdf", `${bill.sourceFileName}.pdf`, true);
  }
  if (bill.sourceConverted != null) {
    const css = "<style>body{font-family:sans-serif;font-size:13px;padding:12px}table{border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:2px 6px}</style>";
    return new Response(ensureHtmlDocument(css + bill.sourceConverted, bill.sourceFileName), {
      headers: SANDBOXED_HTML_HEADERS,
    });
  }
  return notFoundResponse();
}
