"use server";

import { refresh, updateTag } from "next/cache";
import { createClient, describeAiError } from "@/lib/ai/client";
import { getClaudeCodeStatus } from "@/lib/ai/providers/claude-code";
import { AI_STATUS_TAG } from "@/lib/ai-status";
import { textField, type ActionState } from "@/lib/action-state";
import {
  deleteApiKey,
  getApiKey,
  getModel,
  isAiModelId,
  isAiProviderId,
  saveApiKey,
  saveModel,
  saveProvider,
} from "@/lib/settings";

export async function saveAiSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const provider = textField(formData, "provider") ?? "";
  const modelMaking = textField(formData, "modelMaking") ?? "";
  const modelChat = textField(formData, "modelChat") ?? "";
  const apiKey = textField(formData, "apiKey");
  if (!isAiProviderId(provider)) return { error: "Cách kết nối không hợp lệ." };
  if (!isAiModelId(modelMaking) || !isAiModelId(modelChat)) return { error: "Model không hợp lệ." };

  if (provider === "claude-code") {
    updateTag(AI_STATUS_TAG);
    const status = await getClaudeCodeStatus();
    if (!status.ok) return { error: status.error };
  } else {
    // Kiểm tra key mới trước khi lưu để người dùng biết ngay nếu nhập sai
    if (apiKey) {
      try {
        await createClient(apiKey).models.retrieve(modelMaking);
      } catch (error) {
        return { error: describeAiError(error) };
      }
      await saveApiKey(apiKey);
    } else if (!(await getApiKey())) {
      return { error: "Vui lòng nhập API key." };
    }
  }

  await saveProvider(provider);
  await saveModel("making", modelMaking);
  await saveModel("chat", modelChat);
  refresh();
  return {
    ok: true,
    message: provider === "claude-code" ? "Đã lưu. Đang kết nối qua Claude Code." : "Đã lưu. Đang kết nối bằng API key.",
  };
}

/** Kiểm tra kết nối theo cách đang chọn trên form (chưa cần lưu) */
export async function testConnection(provider: string): Promise<ActionState> {
  if (provider === "claude-code") {
    updateTag(AI_STATUS_TAG);
    const status = await getClaudeCodeStatus();
    refresh();
    if (!status.ok) return { error: status.error };
    const plan = status.subscription ? ` · gói ${status.subscription}` : "";
    return { ok: true, message: `Claude Code ${status.version} đã đăng nhập${plan}.` };
  }
  const apiKey = await getApiKey();
  if (!apiKey) return { error: "Chưa có API key. Nhập key rồi bấm Lưu." };
  try {
    const model = await createClient(apiKey).models.retrieve(await getModel("making"));
    return { ok: true, message: `Kết nối thành công. Model: ${model.display_name}.` };
  } catch (error) {
    return { error: describeAiError(error) };
  }
}

export async function removeApiKey(): Promise<ActionState> {
  await deleteApiKey();
  refresh();
  return { ok: true };
}
