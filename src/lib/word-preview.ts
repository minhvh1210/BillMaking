import "server-only";
import { access, writeFile } from "node:fs/promises";
import { readUpload, resolveUpload } from "@/lib/storage";
import { renderWithWord } from "@/lib/word";

/** File PDF xem trước của một file Word đã upload, lưu cạnh file gốc */
export function previewPdfPath(storagePath: string): string {
  return `preview-${storagePath}.pdf`;
}

/**
 * Bản PDF của file Word do Word render (giữ đúng bố cục: ảnh, text box, khung kẻ).
 * Render lần đầu rồi lưu lại; trả null nếu máy không có Word.
 */
export async function wordPdfPreview(storagePath: string): Promise<Buffer | null> {
  const cached = previewPdfPath(storagePath);
  try {
    await access(resolveUpload(cached));
    return await readUpload(cached);
  } catch {
    // Chưa có bản cache: render bằng Word
  }
  const rendered = await renderWithWord(await readUpload(storagePath), { pdf: true });
  if (!rendered?.pdf) return null;
  await writeFile(resolveUpload(cached), rendered.pdf);
  return rendered.pdf;
}
