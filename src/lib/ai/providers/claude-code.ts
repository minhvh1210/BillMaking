import "server-only";
import { spawn } from "node:child_process";
import { access, copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AiUserError, type AiRunResult, type PromptPart, type StructuredRequest } from "@/lib/ai/types";
import { resolveUpload } from "@/lib/storage";

/** Đường dẫn CLI: mặc định tìm "claude" trong PATH, có thể chỉ định qua CLAUDE_CODE_PATH */
const CLAUDE_BIN = process.env.CLAUDE_CODE_PATH || "claude";

const RUN_TIMEOUT_MS = 15 * 60 * 1000;

const NOT_FOUND_MESSAGE =
  "Không tìm thấy Claude Code trên máy chủ. Cài Claude Code rồi đăng nhập (chạy `claude` trong terminal), " +
  "hoặc đặt biến môi trường CLAUDE_CODE_PATH trỏ tới file claude.";

type CliCommand = { file: string; prefixArgs: string[] };

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}

/** Tìm file thực thi trong PATH theo thứ tự PATHEXT, giống cách cmd.exe tìm lệnh */
async function findOnWindowsPath(name: string): Promise<string | null> {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exts = path.extname(name)
    ? [""]
    : (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  const hasDir = name.includes("/") || name.includes("\\");
  for (const dir of hasDir ? [""] : dirs) {
    for (const ext of exts) {
      const candidate = path.resolve(dir, name + ext);
      if (await exists(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Bản cài qua npm trên Windows là file claude.cmd, Node không chạy trực tiếp được (lỗi EINVAL)
 * và chạy qua cmd.exe thì không truyền được prompt nhiều dòng. Vì vậy đọc file .cmd để lấy
 * chương trình thật nó gọi: bin\claude.exe (bản mới) hoặc cli.js chạy bằng Node (bản cũ).
 */
async function resolveCmdShim(shimPath: string): Promise<CliCommand> {
  const content = await readFile(shimPath, "utf8");
  const targets = [...content.matchAll(/"%~?dp0%?\\([^"]+)"/gi)]
    .map((match) => path.join(path.dirname(shimPath), match[1]))
    .filter((target) => !/node(\.exe)?$/i.test(target));
  const target = targets.at(-1);
  if (!target || !(await exists(target))) {
    throw new AiUserError(
      `Không đọc được file ${shimPath}. Đặt biến môi trường CLAUDE_CODE_PATH trỏ tới file claude.exe hoặc cli.js.`,
    );
  }
  return /\.(c|m)?js$/i.test(target)
    ? { file: process.execPath, prefixArgs: [target] }
    : { file: target, prefixArgs: [] };
}

async function resolveCliCommand(): Promise<CliCommand> {
  if (/\.(c|m)?js$/i.test(CLAUDE_BIN)) return { file: process.execPath, prefixArgs: [CLAUDE_BIN] };
  if (process.platform !== "win32") return { file: CLAUDE_BIN, prefixArgs: [] };

  const found = await findOnWindowsPath(CLAUDE_BIN);
  // Không tìm thấy thì cứ để spawn báo ENOENT
  if (!found) return { file: CLAUDE_BIN, prefixArgs: [] };
  return /\.(cmd|bat)$/i.test(found) ? resolveCmdShim(found) : { file: found, prefixArgs: [] };
}

let cliCommand: Promise<CliCommand> | null = null;

/** Tìm một lần rồi dùng lại; nếu lỗi thì lần sau tìm lại (người dùng có thể vừa cài Claude Code) */
function getCliCommand(): Promise<CliCommand> {
  cliCommand ??= resolveCliCommand().catch((error) => {
    cliCommand = null;
    throw error;
  });
  return cliCommand;
}

type CliResult = { stdout: string; stderr: string; code: number | null };

async function runCli(args: string[], options: { cwd?: string; input?: string; timeoutMs: number }): Promise<CliResult> {
  const command = await getCliCommand();
  return new Promise((resolve, reject) => {
    const child = spawn(command.file, [...command.prefixArgs, ...args], {
      cwd: options.cwd,
      env: {
        ...process.env,
        // Kết quả HTML của một chứng từ có thể dài
        CLAUDE_CODE_MAX_OUTPUT_TOKENS: "64000",
      },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new AiUserError("Claude Code xử lý quá lâu (hơn 15 phút) nên đã dừng. Vui lòng thử lại."));
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === "ENOENT") cliCommand = null;
      reject(error.code === "ENOENT" ? new AiUserError(NOT_FOUND_MESSAGE) : error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    child.stdin.end(options.input ?? "");
  });
}

export type ClaudeCodeStatus =
  | { ok: true; version: string; email: string | null; subscription: string | null; authMethod: string | null }
  | { ok: false; error: string };

/** Kiểm tra CLI có sẵn và đã đăng nhập chưa (không tốn lượt dùng) */
export async function getClaudeCodeStatus(): Promise<ClaudeCodeStatus> {
  try {
    const version = await runCli(["--version"], { timeoutMs: 30_000 });
    const auth = await runCli(["auth", "status", "--json"], { timeoutMs: 30_000 });
    const info = JSON.parse(auth.stdout) as {
      loggedIn?: boolean;
      email?: string;
      subscriptionType?: string;
      authMethod?: string;
    };
    if (!info.loggedIn) {
      return { ok: false, error: "Claude Code chưa đăng nhập. Mở terminal, chạy `claude` rồi gõ /login." };
    }
    return {
      ok: true,
      version: version.stdout.trim(),
      email: info.email ?? null,
      subscription: info.subscriptionType ?? null,
      authMethod: info.authMethod ?? null,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không kiểm tra được Claude Code." };
  }
}

/**
 * Hội thoại được gửi thành MỘT lượt cho Claude Code: các file PDF/ảnh được chép vào
 * thư mục tạm để Claude tự đọc bằng công cụ Read, phần còn lại là văn bản.
 */
async function buildPrompt(request: StructuredRequest<unknown>, workDir: string): Promise<string> {
  let fileIndex = 0;
  const renderPart = async (part: PromptPart): Promise<string> => {
    if (part.type === "text") return part.text;
    fileIndex += 1;
    const ext = path.extname(part.storagePath) || (part.mimeType === "application/pdf" ? ".pdf" : "");
    const localName = `file-${fileIndex}${ext}`;
    await copyFile(resolveUpload(part.storagePath), path.join(workDir, localName));
    return `[Tệp đính kèm "${part.title}" nằm tại ./${localName} — dùng công cụ Read để đọc toàn bộ nội dung]`;
  };

  const sections: string[] = [];
  for (const [index, message] of request.messages.entries()) {
    const body = (await Promise.all(message.parts.map(renderPart))).join("\n");
    if (request.messages.length === 1) {
      sections.push(body);
    } else {
      const speaker = message.role === "user" ? "Người dùng" : "Trợ lý (bạn)";
      sections.push(`### Lượt ${index + 1} — ${speaker}\n${body}`);
    }
  }
  if (request.messages.length > 1) {
    sections.push("Hãy trả lời lượt cuối cùng của Người dùng, dựa trên toàn bộ các lượt phía trên.");
  }
  return sections.join("\n\n");
}

export async function runWithClaudeCode<T>(request: StructuredRequest<T>): Promise<AiRunResult<T>> {
  const model = request.model;
  const workDir = await mkdtemp(path.join(tmpdir(), "billmaking-"));
  try {
    const prompt = await buildPrompt(request, workDir);
    const args = [
      "-p",
      "--output-format", "json",
      "--json-schema", JSON.stringify(request.jsonSchema),
      "--system-prompt", request.system,
      "--model", model,
      "--effort", request.effort,
      // Chỉ cho phép đọc file trong thư mục tạm; tắt cấu hình cá nhân, MCP và lưu phiên
      "--tools", "Read",
      "--allowed-tools", "Read",
      "--permission-mode", "dontAsk",
      "--restricted",
      "--safe-mode",
      "--strict-mcp-config",
      "--no-session-persistence",
    ];
    const { stdout, stderr, code } = await runCli(args, { cwd: workDir, input: prompt, timeoutMs: RUN_TIMEOUT_MS });

    let output: {
      is_error?: boolean;
      subtype?: string;
      result?: string;
      structured_output?: unknown;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      modelUsage?: Record<string, unknown>;
    };
    try {
      output = JSON.parse(stdout);
    } catch {
      const detail = (stderr || stdout).trim().slice(0, 500);
      throw new AiUserError(`Claude Code không trả kết quả hợp lệ (mã thoát ${code}). ${detail}`);
    }

    if (output.is_error || output.subtype !== "success") {
      const detail = output.result?.trim() || output.subtype || "lỗi không xác định";
      throw new AiUserError(`Claude Code báo lỗi: ${detail}`);
    }

    const parsed = request.schema.safeParse(output.structured_output);
    if (!parsed.success) {
      throw new AiUserError("AI trả về dữ liệu thiếu trường bắt buộc. Vui lòng thử lại.");
    }

    const usage = output.usage ?? {};
    return {
      data: parsed.data,
      model: Object.keys(output.modelUsage ?? {})[0] ?? model,
      inputTokens:
        (usage.input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0),
      outputTokens: usage.output_tokens ?? 0,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
