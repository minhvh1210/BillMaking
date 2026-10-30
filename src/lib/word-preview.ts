import "server-only";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderExcelPdf } from "@/lib/excel";
import { readUpload, resolveUpload } from "@/lib/storage";
import { renderWithWord } from "@/lib/word";

/** File PDF xem trước của một file Word / Excel đã upload, lưu cạnh file gốc */
export function previewPdfPath(storagePath: string): string {
  return `preview-${storagePath}.pdf`;
}

/** Đọc bản PDF đã lưu, chưa có thì render rồi lưu lại; trả null nếu không render được */
async function cachedPdf(storagePath: string, render: (file: Buffer) => Promise<Buffer | null>): Promise<Buffer | null> {
  const cached = previewPdfPath(storagePath);
  try {
    await access(resolveUpload(cached));
    return await readUpload(cached);
  } catch {
    // Chưa có bản cache: render
  }
  const pdf = await render(await readUpload(storagePath));
  if (!pdf) return null;
  await writeFile(resolveUpload(cached), pdf);
  return pdf;
}

/**
 * Bản PDF của file Word do Word render (giữ đúng bố cục: ảnh, text box, khung kẻ).
 * Render lần đầu rồi lưu lại; trả null nếu máy không có Word.
 */
export function wordPdfPreview(storagePath: string): Promise<Buffer | null> {
  return cachedPdf(storagePath, async (file) => (await renderWithWord(file, { pdf: true }))?.pdf ?? null);
}

/** Bản PDF của file Excel do Excel xuất (giữ gộp ô, độ rộng cột, khung kẻ); trả null nếu máy không có Excel */
export function excelPdfPreview(storagePath: string): Promise<Buffer | null> {
  return cachedPdf(storagePath, (file) => renderExcelPdf(file, path.extname(storagePath)));
}
