import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AiUserError } from "@/lib/ai/types";
import { getApiKey } from "@/lib/settings";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Chưa cấu hình API key. Vào mục Kết nối AI để nhập API key, hoặc chuyển sang kết nối qua Claude Code.");
  }
}

export function createClient(apiKey: string): Anthropic {
  // Một lần Making có thể chạy vài phút với chứng từ dài
  return new Anthropic({ apiKey, timeout: 15 * 60 * 1000, maxRetries: 2 });
}

export async function getAiClient(): Promise<Anthropic> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new AiNotConfiguredError();
  return createClient(apiKey);
}

/** Chuyển lỗi từ SDK thành thông báo tiếng Việt dễ hiểu cho người dùng */
export function describeAiError(error: unknown): string {
  if (error instanceof AiNotConfiguredError || error instanceof AiUserError) return error.message;
  if (error instanceof Anthropic.AuthenticationError) {
    return "API key không hợp lệ hoặc đã bị thu hồi. Kiểm tra lại trong mục Kết nối AI.";
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return "API key không có quyền dùng model này. Thử chọn model khác trong mục Kết nối AI.";
  }
  if (error instanceof Anthropic.NotFoundError) {
    return "Không tìm thấy model. Chọn lại model trong mục Kết nối AI.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Đã vượt giới hạn tốc độ hoặc hạn mức của API key. Vui lòng thử lại sau ít phút.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `Yêu cầu gửi tới AI không hợp lệ: ${error.message}`;
  }
  if (error instanceof Anthropic.InternalServerError) {
    return "Dịch vụ AI đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Không kết nối được tới dịch vụ AI. Kiểm tra kết nối mạng.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Lỗi từ dịch vụ AI (${error.status}): ${error.message}`;
  }
  return error instanceof Error ? error.message : "Lỗi không xác định khi gọi AI.";
}
