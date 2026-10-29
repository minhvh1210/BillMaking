import "server-only";
import type { Bill } from "@prisma/client";
import type { FormPlacement } from "@/lib/ai/form-making";
import { db } from "@/lib/db";
import { fillForm, readFormImages, readFormLayout, type FormLayout } from "@/lib/docx-form";
import { kindFromMime } from "@/lib/file-convert";
import { deleteUpload, readUpload, saveGenerated } from "@/lib/storage";
import { renderWithWord } from "@/lib/word";

/** Chứng từ cần làm là file Word: kết quả giữ nguyên file gốc và chỉ chèn field vào */
export function isFormSource(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType) && kindFromMime(mimeType!) === "docx";
}

export type FormContext = {
  source: Buffer;
  layout: FormLayout;
  pageImagePath: string | null;
  labelImages: { id: string; storagePath: string }[];
  sourceName: string;
  /** Xóa các file tạm (ảnh nhãn) sau khi gọi AI */
  cleanup: () => Promise<void>;
};

/**
 * Đọc layout form và chuẩn bị ảnh cho AI: ảnh trang 1 do Word render (lưu lại để dùng cho Chat),
 * hoặc ảnh từng nhãn nếu máy không có Word.
 */
export async function prepareFormContext(bill: Bill): Promise<FormContext> {
  if (!bill.sourceStoragePath) throw new Error("Chưa có chứng từ cần làm.");
  const source = await readUpload(bill.sourceStoragePath);
  const layout = await readFormLayout(source);

  let pageImagePath = bill.sourcePagePath;
  if (!pageImagePath) {
    const rendered = await renderWithWord(source, { png: true });
    if (rendered?.png) {
      pageImagePath = await saveGenerated(rendered.png, ".png");
      await db.bill.update({ where: { id: bill.id }, data: { sourcePagePath: pageImagePath } });
    }
  }

  const labelImages: { id: string; storagePath: string }[] = [];
  if (!pageImagePath) {
    const images = await readFormImages(source, layout.items);
    for (const item of layout.items) {
      const image = images.get(item.id);
      if (image && /\.png$/i.test(item.media)) {
        labelImages.push({ id: item.id, storagePath: await saveGenerated(image, ".png") });
      }
    }
  }

  return {
    source,
    layout,
    pageImagePath,
    labelImages,
    sourceName: bill.sourceFileName ?? "chung-tu-goc.docx",
    cleanup: async () => {
      await Promise.all(labelImages.map((l) => deleteUpload(l.storagePath)));
    },
  };
}

/** Lưu file Word kết quả và bản PDF xem trước (nếu có Word) */
export async function saveDocxResult(docx: Buffer): Promise<{ docxPath: string; pdfPath: string | null }> {
  const docxPath = await saveGenerated(docx, ".docx");
  const rendered = await renderWithWord(docx, { pdf: true });
  const pdfPath = rendered?.pdf ? await saveGenerated(rendered.pdf, ".pdf") : null;
  return { docxPath, pdfPath };
}

/** Tạo file Word kết quả (file gốc + field) và bản PDF xem trước */
export async function buildFormResult(source: Buffer, placements: FormPlacement[]) {
  return saveDocxResult(await fillForm(source, placements));
}

/**
 * Đặt file kết quả mới cho workspace. File Word cũ thuộc về phiên bản trước nên được giữ lại
 * (để khôi phục); chỉ bản PDF xem trước cũ bị xóa.
 */
export async function replaceFormResult(
  bill: Pick<Bill, "id" | "resultPdfPath">,
  data: { docxPath: string; pdfPath: string | null },
) {
  await db.bill.update({
    where: { id: bill.id },
    data: { resultKind: "DOCX", resultHtml: null, resultDocxPath: data.docxPath, resultPdfPath: data.pdfPath, status: "DONE" },
  });
  if (bill.resultPdfPath !== data.pdfPath) await deleteUpload(bill.resultPdfPath);
}

/** Ảnh trang 1 của một file Word (để AI nhìn khi chat). Trả null nếu máy không có Word. */
export async function renderPageImage(docx: Buffer): Promise<string | null> {
  const rendered = await renderWithWord(docx, { png: true });
  return rendered?.png ? saveGenerated(rendered.png, ".png") : null;
}

/** File Word đang được chỉnh: kết quả gần nhất nếu có, không thì chính chứng từ cần làm */
export function currentDocxPath(bill: Pick<Bill, "resultKind" | "resultDocxPath" | "sourceStoragePath" | "sourceMimeType">) {
  if (bill.resultKind === "DOCX" && bill.resultDocxPath) return bill.resultDocxPath;
  return isFormSource(bill.sourceMimeType) ? bill.sourceStoragePath : null;
}

/** Danh sách field hiển thị ở tab "Dữ liệu trích xuất": field nào đã đặt vào ô nào */
export function placementFields(
  placements: FormPlacement[],
  unmapped: { field: string; reason: string }[],
): { key: string; value: string; found: boolean; note: string }[] {
  return [
    ...placements.map((p) => ({ key: p.text.trim(), value: p.area, found: true, note: p.note })),
    ...unmapped.map((u) => ({ key: u.field, value: "", found: false, note: u.reason })),
  ];
}
