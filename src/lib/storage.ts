import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Thư mục upload chỉ quyết định lúc chạy, không cần bundler theo dõi
const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./storage/uploads");

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export type StoredFile = {
  fileName: string;
  mimeType: string;
  storagePath: string;
  fileSize: number;
  buffer: Buffer;
};

/** Lưu file upload, trả về đường dẫn tương đối trong UPLOAD_DIR */
export async function saveUpload(file: File, mimeType: string): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File vượt quá ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase();
  const storagePath = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storagePath), buffer);
  return { fileName: file.name, mimeType, storagePath, fileSize: file.size, buffer };
}

/** Lưu file do app tạo ra (kết quả Word, PDF xem trước, ảnh trang) vào UPLOAD_DIR */
export async function saveGenerated(buffer: Buffer, ext: string): Promise<string> {
  const storagePath = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storagePath), buffer);
  return storagePath;
}

export function resolveUpload(storagePath: string): string {
  const full = path.resolve(UPLOAD_DIR, storagePath);
  if (!full.startsWith(UPLOAD_DIR + path.sep)) {
    throw new Error("Đường dẫn file không hợp lệ.");
  }
  return full;
}

export async function readUpload(storagePath: string): Promise<Buffer> {
  return readFile(resolveUpload(storagePath));
}

export async function deleteUpload(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;
  await unlink(resolveUpload(storagePath)).catch(() => undefined);
}
