import "server-only";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";

export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 — chính xác nhất, tốn nhất" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — cân bằng độ chính xác / chi phí" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 — nhanh, tiết kiệm nhất" },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

/** Mỗi tác vụ dùng model riêng: Making cần đọc chính xác, Chat chủ yếu sửa nhỏ */
export type AiTask = "making" | "chat";

export const DEFAULT_MODELS: Record<AiTask, AiModelId> = {
  making: "claude-sonnet-5-5",
  chat: "claude-haiku-5-5",
};

export const AI_PROVIDERS = [
  {
    id: "claude-code",
    label: "Claude Code trên máy này",
    description: "Dùng tài khoản claude.ai (Pro / Max) đã đăng nhập trong Claude Code. Không cần API key.",
  },
  {
    id: "api-key",
    label: "API key Anthropic",
    description: "Gọi Claude API bằng API key riêng, tính phí theo token trên console.anthropic.com.",
  },
] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number]["id"];

export const DEFAULT_PROVIDER: AiProviderId = "claude-code";

const KEY_API = "anthropic_api_key";
const KEY_MODEL: Record<AiTask, string> = { making: "ai_model_making", chat: "ai_model_chat" };
const KEY_PROVIDER = "ai_provider";

export function isAiProviderId(value: string): value is AiProviderId {
  return AI_PROVIDERS.some((p) => p.id === value);
}

export async function getProvider(): Promise<AiProviderId> {
  const row = await db.setting.findUnique({ where: { key: KEY_PROVIDER } });
  return row && isAiProviderId(row.value) ? row.value : DEFAULT_PROVIDER;
}

export async function saveProvider(provider: AiProviderId): Promise<void> {
  await db.setting.upsert({
    where: { key: KEY_PROVIDER },
    create: { key: KEY_PROVIDER, value: provider },
    update: { value: provider },
  });
}

export function isAiModelId(value: string): value is AiModelId {
  return AI_MODELS.some((m) => m.id === value);
}

export async function getApiKey(): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: KEY_API } });
  if (!row) return null;
  try {
    return decrypt(row.value);
  } catch {
    // APP_SECRET đã đổi -> không giải mã được, coi như chưa cấu hình
    return null;
  }
}

export async function saveApiKey(apiKey: string): Promise<void> {
  const value = encrypt(apiKey);
  await db.setting.upsert({
    where: { key: KEY_API },
    create: { key: KEY_API, value },
    update: { value },
  });
}

export async function deleteApiKey(): Promise<void> {
  await db.setting.deleteMany({ where: { key: KEY_API } });
}

export async function getModel(task: AiTask): Promise<AiModelId> {
  const row = await db.setting.findUnique({ where: { key: KEY_MODEL[task] } });
  return row && isAiModelId(row.value) ? row.value : DEFAULT_MODELS[task];
}

export async function saveModel(task: AiTask, model: AiModelId): Promise<void> {
  const key = KEY_MODEL[task];
  await db.setting.upsert({ where: { key }, create: { key, value: model }, update: { value: model } });
}

/** Hiển thị dạng sk-ant-...abcd, không bao giờ trả key đầy đủ ra client */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) return "••••";
  return `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}`;
}
