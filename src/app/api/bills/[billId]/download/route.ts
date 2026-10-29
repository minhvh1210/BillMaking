import { randomBytes } from "node:crypto";
import type { Bill } from "@prisma/client";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fillForm, type Placement } from "@/lib/docx-form";
import { readUpload } from "@/lib/storage";
import { ensureHtmlDocument } from "@/lib/html";
import { SANDBOXED_HTML_HEADERS, fileResponse, notFoundResponse } from "@/lib/http";

/**
 * Tải kết quả Bill Making.
 * Kết quả HTML — format: html (tải file .html) | doc (file Word mở được bằng MS Word)
 *       | print (mở trang in, chọn "Lưu dưới dạng PDF") | view (xem trong trình duyệt)
 * Kết quả form Word — format: docx | pdf
 * Query kết quả — format: sql
 * version: id phiên bản (mặc định là kết quả hiện tại)
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/bills/[billId]/download">) {
  const { billId } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format") ?? "html";
  const versionId = request.nextUrl.searchParams.get("version");

  const bill = await db.bill.findUnique({ where: { id: billId }, include: { documentType: { select: { name: true } } } });
  if (!bill) return notFoundResponse();
  const title = bill.documentType.name;
  const baseName = title.replace(/[\\/:*?"<>|]+/g, "_");

  const version = versionId ? await db.billVersion.findUnique({ where: { id: versionId } }) : null;
  if (versionId && (!version || version.billId !== billId)) return notFoundResponse();

  // Kết quả dạng form Word: file gốc đã chèn field
  // Query kết quả (đã sửa cho khớp chứng từ), không có thì query chứng từ người dùng nhập
  if (format === "sql") {
    const query = (version ? version.query : bill.resultQuery) ?? bill.sourceQuery;
    if (!query) return notFoundResponse("Chưa có query.");
    return fileResponse(query, "text/plain; charset=utf-8", `${baseName}.sql`, false);
  }

  if (version ? version.kind === "DOCX" : bill.resultKind === "DOCX") {
    if (version?.filePath) {
      return fileResponse(await readUpload(version.filePath), DOCX_MIME, `${baseName}.docx`, false);
    }
    return formResponse(bill, version?.placements ?? null, format, baseName);
  }

  let html = bill.resultHtml;
  if (version) html = version.html;
  if (!html) return notFoundResponse("Chứng từ chưa có kết quả Making.");

  const document = ensureHtmlDocument(html, title);

  switch (format) {
    case "doc":
      return fileResponse(toWordDocument(document), "application/msword", `${baseName}.doc`, false);
    case "print":
      return printResponse(document);
    case "view":
      return new Response(document, { headers: SANDBOXED_HTML_HEADERS });
    default:
      return fileResponse(document, "text/html; charset=utf-8", `${baseName}.html`, false);
  }
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Kết quả dạng form Word. format: docx (tải file Word) | pdf (xem / tải bản PDF).
 * Phiên bản cũ được dựng lại từ file chứng từ cần làm + vị trí field của phiên bản đó.
 */
async function formResponse(bill: Bill, versionPlacements: string | null, format: string, baseName: string) {
  if (versionPlacements !== null) {
    if (!bill.sourceStoragePath) return notFoundResponse("Chứng từ cần làm đã bị gỡ, không dựng lại được phiên bản này.");
    const docx = await fillForm(await readUpload(bill.sourceStoragePath), JSON.parse(versionPlacements) as Placement[]);
    return fileResponse(docx, DOCX_MIME, `${baseName}.docx`, false);
  }
  if (format === "pdf") {
    if (!bill.resultPdfPath) return notFoundResponse("Chưa có bản PDF (cần Microsoft Word trên máy chạy app).");
    return fileResponse(await readUpload(bill.resultPdfPath), "application/pdf", `${baseName}.pdf`, true);
  }
  if (!bill.resultDocxPath) return notFoundResponse("Chứng từ chưa có kết quả Making.");
  return fileResponse(await readUpload(bill.resultDocxPath), DOCX_MIME, `${baseName}.docx`, false);
}

/** Word mở được HTML có khai báo namespace Office, giữ được bảng và CSS cơ bản */
function toWordDocument(html: string): string {
  return html.replace(
    /<html([^>]*)>/i,
    '<html$1 xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
  );
}

/** Trang in: chỉ cho phép đúng script gọi window.print() có nonce, mọi script khác bị chặn */
function printResponse(html: string): Response {
  const nonce = randomBytes(16).toString("base64");
  const script = `<script nonce="${nonce}">window.addEventListener("load",function(){window.print()})</script>`;
  const body = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${script}</body>`) : html + script;
  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'nonce-${nonce}'`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
