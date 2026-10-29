import type { z } from "zod";

/** Một phần nội dung gửi cho AI: văn bản, hoặc file gốc (PDF/ảnh) mà AI tự đọc */
export type PromptPart =
  | { type: "text"; text: string }
  | { type: "file"; title: string; mimeType: string; storagePath: string };

export type PromptMessage = { role: "user" | "assistant"; parts: PromptPart[] };

export type Effort = "low" | "medium" | "high";

export type StructuredRequest<T> = {
  model: string;
  system: string;
  messages: PromptMessage[];
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  effort: Effort;
};

export type AiRunResult<T> = {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/** Lỗi đã có thông báo tiếng Việt sẵn để hiển thị cho người dùng */
export class AiUserError extends Error {}
