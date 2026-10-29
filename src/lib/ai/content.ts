import "server-only";
import type { Bill, Template } from "@prisma/client";
import type { PromptPart } from "@/lib/ai/types";
import { kindFromMime } from "@/lib/file-convert";

function fileParts(params: {
  tag: string;
  title: string;
  mimeType: string;
  storagePath: string;
  converted: string | null;
}): PromptPart[] {
  const { tag, title, mimeType, storagePath, converted } = params;
  const kind = kindFromMime(mimeType);

  // PDF và ảnh: để AI tự đọc file gốc (giữ được bố cục, chữ scan)
  if (kind === "pdf" || kind === "image") {
    return [
      { type: "text", text: `<${tag}> (file đính kèm: ${title})` },
      { type: "file", title, mimeType, storagePath },
      { type: "text", text: `</${tag}>` },
    ];
  }
  if (converted == null) {
    throw new Error(`Không đọc được nội dung file "${title}".`);
  }
  return [
    {
      type: "text",
      text: `<${tag} file="${title}" dinh_dang="HTML chuyển đổi từ file gốc">\n${converted}\n</${tag}>`,
    },
  ];
}

export function templateParts(template: Template): PromptPart[] {
  return fileParts({
    tag: "chung_tu_mau",
    title: template.fileName,
    mimeType: template.mimeType,
    storagePath: template.storagePath,
    converted: template.convertedHtml,
  });
}

function sourceParts(bill: Bill): PromptPart[] {
  if (!bill.sourceStoragePath || !bill.sourceMimeType || !bill.sourceFileName) return [];
  return fileParts({
    tag: "chung_tu_goc",
    title: bill.sourceFileName,
    mimeType: bill.sourceMimeType,
    storagePath: bill.sourceStoragePath,
    converted: bill.sourceConverted,
  });
}

/** Query của chứng từ gốc: bảng dữ liệu và ý nghĩa các field của chứng từ đang xử lý */
export function sourceQueryPart(sourceQuery: string | null): PromptPart[] {
  const text = sourceQuery?.trim();
  return text ? [{ type: "text", text: `<query_chung_tu>\n${text}\n</query_chung_tu>` }] : [];
}

/**
 * Ngữ cảnh chung cho Making và Chat: chứng từ mẫu + query mẫu + chứng từ gốc + query chứng từ.
 * Chat chạy được khi còn thiếu phần nào đó, nên phần thiếu được ghi rõ là "chưa có".
 */
export function contextParts(params: { template: Template | null; query: string | null; bill: Bill }): PromptPart[] {
  const { template, query, bill } = params;
  const source = sourceParts(bill);
  return [
    ...(template ? templateParts(template) : [{ type: "text" as const, text: "<chung_tu_mau>(chưa có)</chung_tu_mau>" }]),
    { type: "text", text: `<query>\n${query?.trim() || "(chưa có)"}\n</query>` },
    ...(source.length > 0 ? source : [{ type: "text" as const, text: "<chung_tu_goc>(chưa có)</chung_tu_goc>" }]),
    ...sourceQueryPart(bill.sourceQuery),
  ];
}
