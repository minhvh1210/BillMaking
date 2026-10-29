import "server-only";
import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaTextBlockParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { getAiClient } from "@/lib/ai/client";
import { AiUserError, type AiRunResult, type PromptPart, type StructuredRequest } from "@/lib/ai/types";
import { readUpload } from "@/lib/storage";

/** Các model hỗ trợ fallback phía server khi bị từ chối bởi bộ lọc an toàn */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

async function toBlock(part: PromptPart): Promise<BetaContentBlockParam> {
  if (part.type === "text") return { type: "text", text: part.text };
  const data = (await readUpload(part.storagePath)).toString("base64");
  if (part.mimeType === "application/pdf") {
    return { type: "document", title: part.title, source: { type: "base64", media_type: "application/pdf", data } };
  }
  return { type: "image", source: { type: "base64", media_type: part.mimeType as ImageMediaType, data } };
}

/** Ghép các tin nhắn liên tiếp cùng vai trò để luôn có dạng user / assistant xen kẽ */
async function toMessages(request: StructuredRequest<unknown>): Promise<BetaMessageParam[]> {
  const merged: { role: "user" | "assistant"; content: BetaContentBlockParam[] }[] = [];
  for (const message of request.messages) {
    const blocks = await Promise.all(message.parts.map(toBlock));
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role) previous.content.push(...blocks);
    else merged.push({ role: message.role, content: blocks });
  }

  // Cache breakpoint ở cuối tin nhắn đầu tiên (ngữ cảnh mẫu + query + chứng từ gốc)
  // để các lượt chat sau đọc lại từ cache, rẻ và nhanh hơn.
  const first = merged[0]?.content;
  const last = first?.[first.length - 1];
  if (last && last.type === "text") {
    first[first.length - 1] = { ...last, cache_control: { type: "ephemeral" } };
  }
  return merged;
}

/**
 * Gọi Claude API với structured output (JSON schema) và streaming để tránh timeout
 * khi chứng từ dài.
 */
export async function runWithApiKey<T>(request: StructuredRequest<T>): Promise<AiRunResult<T>> {
  const client = await getAiClient();
  const model = request.model;
  const useFallback = FALLBACK_MODELS.has(model);

  const system: BetaTextBlockParam[] = [
    { type: "text", text: request.system, cache_control: { type: "ephemeral" } },
  ];

  const stream = client.beta.messages.stream({
    model,
    max_tokens: 64000,
    system,
    messages: await toMessages(request),
    output_config: {
      effort: request.effort,
      format: { type: "json_schema", schema: request.jsonSchema },
    },
    ...(useFallback
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {}),
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new AiUserError(
      "AI từ chối xử lý yêu cầu này. Kiểm tra lại nội dung chứng từ hoặc diễn đạt yêu cầu khác.",
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new AiUserError(
      "Kết quả vượt quá độ dài tối đa AI có thể trả về. Hãy tách chứng từ thành nhiều phần nhỏ hơn.",
    );
  }

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiUserError("AI trả về dữ liệu không đúng định dạng JSON. Vui lòng thử lại.");
  }
  const parsed = request.schema.safeParse(json);
  if (!parsed.success) {
    throw new AiUserError("AI trả về dữ liệu thiếu trường bắt buộc. Vui lòng thử lại.");
  }

  const usage = message.usage;
  return {
    data: parsed.data,
    model: message.model,
    inputTokens:
      usage.input_tokens +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
  };
}
