import "server-only";
import path from "node:path";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type FileKind = "pdf" | "docx" | "spreadsheet" | "html" | "image";

const EXTENSIONS: Record<string, { kind: FileKind; mime: string }> = {
  ".pdf": { kind: "pdf", mime: "application/pdf" },
  ".docx": {
    kind: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  ".xlsx": {
    kind: "spreadsheet",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  ".xls": { kind: "spreadsheet", mime: "application/vnd.ms-excel" },
  ".csv": { kind: "spreadsheet", mime: "text/csv" },
  ".html": { kind: "html", mime: "text/html" },
  ".htm": { kind: "html", mime: "text/html" },
  ".png": { kind: "image", mime: "image/png" },
  ".jpg": { kind: "image", mime: "image/jpeg" },
  ".jpeg": { kind: "image", mime: "image/jpeg" },
  ".webp": { kind: "image", mime: "image/webp" },
  ".gif": { kind: "image", mime: "image/gif" },
};

export const TEMPLATE_ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.html,.htm,.png,.jpg,.jpeg,.webp,.gif";
export const SOURCE_ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.html,.htm,.png,.jpg,.jpeg,.webp,.gif";

const TEMPLATE_KINDS: FileKind[] = ["pdf", "docx", "spreadsheet", "html", "image"];

export function detectFile(fileName: string): { kind: FileKind; mime: string } | null {
  return EXTENSIONS[path.extname(fileName).toLowerCase()] ?? null;
}

export function kindFromMime(mime: string): FileKind | null {
  return Object.values(EXTENSIONS).find((e) => e.mime === mime)?.kind ?? null;
}

export function assertTemplateFile(fileName: string) {
  const info = detectFile(fileName);
  if (!info || !TEMPLATE_KINDS.includes(info.kind)) {
    throw new Error(
      "Chứng từ mẫu chỉ hỗ trợ PDF, Word (.docx), Excel (.xlsx, .xls, .csv), HTML hoặc ảnh (PNG, JPG, WEBP, GIF).",
    );
  }
  return info;
}

export function assertSourceFile(fileName: string) {
  const info = detectFile(fileName);
  if (!info) {
    throw new Error(
      "Chứng từ chỉ hỗ trợ PDF, Word (.docx), Excel (.xlsx, .xls, .csv), HTML hoặc ảnh (PNG, JPG, WEBP, GIF).",
    );
  }
  return info;
}

/**
 * Chuyển Word/Excel/HTML sang HTML để xem trước và gửi cho AI dưới dạng văn bản.
 * PDF và ảnh được gửi trực tiếp cho AI nên trả về null.
 */
export async function convertToHtml(buffer: Buffer, kind: FileKind): Promise<string | null> {
  switch (kind) {
    case "docx": {
      const result = await mammoth.convertToHtml({ buffer });
      return result.value;
    }
    case "spreadsheet": {
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      return workbook.SheetNames.map((name) => {
        const table = XLSX.utils.sheet_to_html(workbook.Sheets[name], { header: "", footer: "" });
        return `<section data-sheet="${escapeHtml(name)}"><h3>Sheet: ${escapeHtml(name)}</h3>${table}</section>`;
      }).join("\n");
    }
    case "html":
      return buffer.toString("utf8");
    default:
      return null;
  }
}

/** Tìm các field dạng {example} trong nội dung mẫu (bỏ qua CSS/JS và thẻ HTML chen giữa) */
export function extractPlaceholders(html: string | null | undefined): string[] {
  if (!html) return [];
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ");
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\s*([\p{L}\p{N}_.\- ]{1,80}?)\s*\}/gu)) {
    found.add(match[1].trim());
  }
  return [...found];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
