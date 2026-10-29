import "server-only";
import type { Bill, ChatMessage, Template } from "@prisma/client";
import { z } from "zod";
import { contextParts } from "@/lib/ai/content";
import {
  CHAT_OUTPUT_SCHEMA,
  CHAT_SYSTEM_PROMPT,
  MAKING_OUTPUT_SCHEMA,
  MAKING_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/run";
import { getModel } from "@/lib/settings";
import type { PromptMessage } from "@/lib/ai/types";

const makingSchema = z.object({
  summary: z.string(),
  fields: z.array(
    z.object({ key: z.string(), value: z.string(), found: z.boolean(), note: z.string() }),
  ),
  warnings: z.array(z.string()),
  html: z.string().min(1),
});

export type MakingOutput = z.infer<typeof makingSchema>;

const chatSchema = z.object({
  reply: z.string(),
  html_changed: z.boolean(),
  html: z.string(),
});

export type ChatOutput = z.infer<typeof chatSchema>;

/** Số tin nhắn chat gần nhất gửi kèm làm ngữ cảnh */
const CHAT_HISTORY_LIMIT = 6;

export async function runMaking(template: Template, query: string | null, bill: Bill) {
  const messages: PromptMessage[] = [
    {
      role: "user",
      parts: [
        ...contextParts({ template, query, bill }),
        {
          type: "text",
          text: "Hãy thực hiện Bill Making: sửa code chứng từ mẫu cho nội dung khớp chứng từ cần làm, giữ nguyên định dạng của mẫu, chỉ dùng field.",
        },
      ],
    },
  ];

  return runStructured({
    model: await getModel("making"),
    system: MAKING_SYSTEM_PROMPT,
    messages,
    jsonSchema: MAKING_OUTPUT_SCHEMA,
    schema: makingSchema,
    effort: "high",
  });
}

export async function runChat(params: {
  template: Template | null;
  query: string | null;
  bill: Bill;
  history: ChatMessage[];
  currentHtml: string | null;
  request: string;
}) {
  const { template, query, bill, history, currentHtml, request } = params;

  const messages: PromptMessage[] = [
    {
      role: "user",
      parts: [
        ...contextParts({ template, query, bill }),
        { type: "text", text: "Trên đây là ngữ cảnh. Các yêu cầu chỉnh sửa sẽ được gửi tiếp theo." },
      ],
    },
  ];

  // Lịch sử chat chỉ gồm lời nhắn, HTML hiện tại luôn được gửi ở lượt cuối.
  // Tin nhắn lỗi được bỏ qua để lịch sử luôn xen kẽ user / assistant.
  for (const message of history.filter((m) => !m.isError).slice(-CHAT_HISTORY_LIMIT)) {
    messages.push({
      role: message.role === "assistant" ? "assistant" : "user",
      parts: [{ type: "text", text: message.content }],
    });
  }

  messages.push({
    role: "user",
    parts: [
      {
        type: "text",
        text: `<html_hien_tai>\n${currentHtml ?? "(chưa có kết quả Making)"}\n</html_hien_tai>\n\n<yeu_cau>\n${request}\n</yeu_cau>`,
      },
    ],
  });

  return runStructured<ChatOutput>({
    model: await getModel("chat"),
    system: CHAT_SYSTEM_PROMPT,
    messages,
    jsonSchema: CHAT_OUTPUT_SCHEMA,
    schema: chatSchema,
    effort: "medium",
  });
}
