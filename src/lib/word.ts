import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Dùng Microsoft Word trên máy chạy app (Windows) để render file .docx:
 * ảnh trang 1 (cho AI nhìn form) và PDF (xem trước / tải về).
 * Form chuyển từ PDF thường có nhãn neo theo dòng chữ, chỉ Word mới dàn trang chính xác.
 * Máy không có Word thì trả null, app vẫn chạy với dữ liệu toạ độ đọc từ file.
 */

const SCRIPT = `
param([string]$In, [string]$Png, [string]$Pdf)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($In, $false, $true)
  if ($Png) {
    $bits = $doc.ActiveWindow.Panes(1).Pages(1).EnhMetaFileBits
    $ms = New-Object System.IO.MemoryStream(,[byte[]]$bits)
    $img = [System.Drawing.Image]::FromStream($ms)
    $w = [int]($doc.PageSetup.PageWidth * 2)
    $h = [int]($doc.PageSetup.PageHeight * 2)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $w, $h)
    $bmp.Save($Png, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  if ($Pdf) { $doc.SaveAs([ref]$Pdf, [ref]17) }
  $doc.Close([ref]0)
} finally {
  $word.Quit()
}
`;

/** Ảnh trang render ở 2 pixel cho mỗi point */
export const PAGE_IMAGE_SCALE = 2;

// Word chỉ nên chạy một phiên mỗi lúc
let queue: Promise<unknown> = Promise.resolve();

function runPowerShell(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...args], {
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Word xử lý quá lâu."));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().slice(0, 300) || `PowerShell thoát với mã ${code}`));
    });
  });
}

/** Render .docx bằng Word. Trả null nếu máy không có Word hoặc Word lỗi. */
export async function renderWithWord(
  docx: Buffer,
  outputs: { png?: boolean; pdf?: boolean },
): Promise<{ png: Buffer | null; pdf: Buffer | null } | null> {
  if (process.platform !== "win32") return null;
  const job = queue.then(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "billmaking-word-"));
    try {
      const input = path.join(dir, "input.docx");
      const png = path.join(dir, "page.png");
      const pdf = path.join(dir, "output.pdf");
      const script = path.join(dir, "render.ps1");
      await writeFile(input, docx);
      await writeFile(script, SCRIPT, "utf8");
      await runPowerShell(
        ["-File", script, "-In", input, "-Png", outputs.png ? png : "", "-Pdf", outputs.pdf ? pdf : ""],
        120_000,
      );
      return {
        png: outputs.png ? await readFile(png) : null,
        pdf: outputs.pdf ? await readFile(pdf) : null,
      };
    } catch (error) {
      console.warn("[word] Không render được bằng Microsoft Word:", error instanceof Error ? error.message : error);
      return null;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
  queue = job.catch(() => undefined);
  return job;
}
