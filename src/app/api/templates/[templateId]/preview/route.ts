import { db } from "@/lib/db";
import { kindFromMime } from "@/lib/file-convert";
import { ensureHtmlDocument } from "@/lib/html";
import { SANDBOXED_HTML_HEADERS, fileResponse, notFoundResponse } from "@/lib/http";
import { readUpload } from "@/lib/storage";
import { excelPdfPreview, wordPdfPreview } from "@/lib/word-preview";

/**
 * Xem trước chứng từ mẫu: PDF/ảnh trả file gốc, Word / Excel trả PDF do Word / Excel xuất (giữ bố cục),
 * HTML (hoặc Word / Excel khi máy không có Office) trả HTML trong sandbox.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/templates/[templateId]/preview">) {
  const { templateId } = await ctx.params;
  const template = await db.template.findUnique({ where: { id: templateId } });
  if (!template) return notFoundResponse();

  const kind = kindFromMime(template.mimeType);
  if (kind === "pdf" || kind === "image") {
    return fileResponse(await readUpload(template.storagePath), template.mimeType, template.fileName, true);
  }
  if (kind === "docx") {
    const pdf = await wordPdfPreview(template.storagePath);
    if (pdf) return fileResponse(pdf, "application/pdf", `${template.fileName}.pdf`, true);
  }
  if (kind === "spreadsheet") {
    const pdf = await excelPdfPreview(template.storagePath);
    if (pdf) return fileResponse(pdf, "application/pdf", `${template.fileName}.pdf`, true);
  }
  if (template.convertedHtml != null) {
    return new Response(ensureHtmlDocument(template.convertedHtml, template.fileName), {
      headers: SANDBOXED_HTML_HEADERS,
    });
  }
  return notFoundResponse("Không có bản xem trước cho chứng từ mẫu này.");
}
