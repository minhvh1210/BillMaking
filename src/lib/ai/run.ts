import "server-only";
import { runWithApiKey } from "@/lib/ai/providers/anthropic-api";
import { runWithClaudeCode } from "@/lib/ai/providers/claude-code";
import type { AiRunResult, StructuredRequest } from "@/lib/ai/types";
import { getProvider } from "@/lib/settings";

/** Gọi AI theo cách kết nối đang chọn trong mục Kết nối AI */
export async function runStructured<T>(request: StructuredRequest<T>): Promise<AiRunResult<T>> {
  const provider = await getProvider();
  return provider === "api-key" ? runWithApiKey(request) : runWithClaudeCode(request);
}
