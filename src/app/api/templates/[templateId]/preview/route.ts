import { db } from "@/lib/db";
import { kindFromMime } from "@/lib/file-convert";
import { ensureHtmlDocument } from "@/lib/html";
import { SANDBOXED_HTML_HEADERS, fileResponse, notFoundResponse } from "@/lib/http";
import { readUpload } from "@/lib/storage";
import { wordPdfPreview } from "@/lib/word-preview";

/**
 * Xem trước chứng từ mẫu: PDF trả file gốc, Word trả PDF do Word render (giữ bố cục),
 * Excel/HTML (hoặc Word khi máy không có Word) trả HTML trong sandbox.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/templates/[templateId]/preview">) {
  const { templateId } = await ctx.params;
  const template = await db.template.findUnique({ where: { id: templateId } });
  if (!template) return notFoundResponse();

  const kind = kindFromMime(template.mimeType);
  if (kind === "pdf") {
    return fileResponse(await readUpload(template.storagePath), template.mimeType, template.fileName, true);
  }
  if (kind === "docx") {
    const pdf = await wordPdfPreview(template.storagePath);
    if (pdf) return fileResponse(pdf, "application/pdf", `${template.fileName}.pdf`, true);
  }
  if (template.convertedHtml != null) {
    return new Response(ensureHtmlDocument(template.convertedHtml, template.fileName), {
      headers: SANDBOXED_HTML_HEADERS,
    });
  }
  return notFoundResponse("Không có bản xem trước cho chứng từ mẫu này.");
}
