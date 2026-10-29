import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getClaudeCodeStatus } from "@/lib/ai/providers/claude-code";

export const AI_STATUS_TAG = "ai-status";

/**
 * Trạng thái đăng nhập Claude Code, hiện trên thanh trên cùng ở mọi trang.
 * Gọi CLI mất 1-2 giây nên được cache; lưu cài đặt hoặc bấm "Kiểm tra kết nối" sẽ làm mới.
 */
export async function getCachedClaudeCodeStatus() {
  "use cache";
  cacheLife("hours");
  cacheTag(AI_STATUS_TAG);
  return getClaudeCodeStatus();
}
