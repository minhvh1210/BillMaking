import "server-only";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runPowerShell } from "@/lib/word";

/**
 * Dùng Microsoft Excel trên máy chạy app (Windows) để xuất file Excel ra PDF xem trước:
 * giữ đúng gộp ô, độ rộng cột, font, khung kẻ, vùng in mà bản chuyển HTML làm mất.
 * Mỗi sheet được co vừa một trang ngang. Hỗ trợ từ Excel 2007 (cần SP2 hoặc add-in "Save as PDF or XPS").
 * Máy không có Excel hoặc Excel không xuất được PDF thì trả null.
 */

const SCRIPT = `
param([string]$In, [string]$Pdf)
$ErrorActionPreference = 'Stop'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  $book = $excel.Workbooks.Open($In, 0, $true)
  foreach ($sheet in $book.Worksheets) {
    # Máy không có máy in thì PageSetup báo lỗi: bỏ qua, vẫn xuất theo thiết lập sẵn của file
    try {
      $sheet.PageSetup.Zoom = $false
      $sheet.PageSetup.FitToPagesWide = 1
      $sheet.PageSetup.FitToPagesTall = $false
    } catch {}
  }
  $book.ExportAsFixedFormat(0, $Pdf)
  # Như Word 2007: Office 2007 có thể đã tự thoát, Close / Quit báo lỗi RPC dù PDF đã xuất xong
  try { $book.Close($false) } catch {}
} finally {
  try { $excel.Quit() } catch {}
}
`;

// Excel chỉ nên chạy một phiên mỗi lúc
let queue: Promise<unknown> = Promise.resolve();

/** Xuất file Excel (.xlsx, .xls, .csv) ra PDF. Trả null nếu máy không có Excel hoặc Excel lỗi. */
export async function renderExcelPdf(file: Buffer, ext: string): Promise<Buffer | null> {
  if (process.platform !== "win32") return null;
  const job = queue.then(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "billmaking-excel-"));
    try {
      // Excel nhận dạng định dạng theo phần mở rộng
      const input = path.join(dir, `input${ext}`);
      const pdf = path.join(dir, "output.pdf");
      const script = path.join(dir, "render.ps1");
      await writeFile(input, file);
      await writeFile(script, SCRIPT, "utf8");
      await runPowerShell(["-File", script, "-In", input, "-Pdf", pdf], 120_000, "Excel");
      return await readFile(pdf);
    } catch (error) {
      console.warn("[excel] Không xuất được PDF bằng Microsoft Excel:", error instanceof Error ? error.message : error);
      return null;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
  queue = job.catch(() => undefined);
  return job;
}
