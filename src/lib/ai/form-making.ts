import "server-only";
import type { ChatMessage, Template } from "@prisma/client";
import { z } from "zod";
import { sourceQueryPart, templateParts } from "@/lib/ai/content";
import {
  DOCX_EDIT_CHAT_OUTPUT_SCHEMA,
  DOCX_EDIT_CHAT_SYSTEM_PROMPT,
  FORM_MAKING_OUTPUT_SCHEMA,
  FORM_MAKING_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/run";
import type { PromptMessage, PromptPart } from "@/lib/ai/types";
import type { DocxBox, DocxEdit } from "@/lib/docx-edit";
import type { FormLayout, Placement } from "@/lib/docx-form";
import { getModel } from "@/lib/settings";

/**
 * Bill Making khi chứng từ gốc là form Word: AI không dựng lại chứng từ mà chỉ chọn
 * toạ độ đặt từng field của chứng từ mẫu lên form. App chèn field vào chính file gốc.
 */

const placementSchema = z.object({
  field: z.string(),
  text: z.string(),
  area: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  font_size: z.number(),
  note: z.string(),
});

export type FormPlacement = Placement & { area: string; note: string };

const formMakingSchema = z.object({
  summary: z.string(),
  placements: z.array(placementSchema),
  unmapped: z.array(z.object({ field: z.string(), reason: z.string() })),
  warnings: z.array(z.string()),
});

/** Kẹp toạ độ trong trang, cỡ chữ trong khoảng đọc được */
export function toPlacements(items: z.infer<typeof placementSchema>[], layout: FormLayout): FormPlacement[] {
  const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
  return items
    .filter((p) => p.text.trim() && p.width > 0 && p.height > 0)
    .map((p) => {
      const x = clamp(p.x, 0, layout.page.w - 4);
      const y = clamp(p.y, 0, layout.page.h - 4);
      return {
        field: p.field,
        text: p.text,
        area: p.area,
        note: p.note,
        x,
        y,
        w: clamp(p.width, 4, layout.page.w - x),
        h: clamp(p.height, 4, layout.page.h - y),
        fontSize: clamp(p.font_size, 6, 14),
      };
    });
}

/** Ngữ cảnh chung: chứng từ mẫu, query, kích thước trang, nhãn có toạ độ, ảnh trang (hoặc ảnh từng nhãn) */
function formContext(params: {
  template: Template;
  query: string | null;
  layout: FormLayout;
  pageImagePath: string | null;
  labelImages: { id: string; storagePath: string }[];
  sourceName: string;
}): PromptPart[] {
  const { layout } = params;
  const labels = layout.items.map((i) => `${i.id}: x=${i.x} y=${i.y} rộng=${i.w} cao=${i.h}`).join("\n");
  const parts: PromptPart[] = [
    ...templateParts(params.template),
    { type: "text", text: `<query>\n${params.query?.trim() || "(chưa có)"}\n</query>` },
    {
      type: "text",
      text:
        `<chung_tu_goc file="${params.sourceName}">\n<trang>rộng ${layout.page.w}pt × cao ${layout.page.h}pt</trang>\n` +
        `<nhan_co_toa_do>\n${labels || "(không đọc được)"}\n</nhan_co_toa_do>\n` +
        `<chu_in_san>${layout.flowText.slice(0, 3000)}</chu_in_san>`,
    },
  ];
  if (params.pageImagePath) {
    parts.push(
      { type: "text", text: "<anh_trang> (trang 1 của form, 1pt = 2px)" },
      { type: "file", title: "trang-1.png", mimeType: "image/png", storagePath: params.pageImagePath },
      { type: "text", text: "</anh_trang>" },
    );
  } else {
    // Không có Word để render trang: gửi ảnh từng nhãn để AI đọc chữ của nhãn
    for (const label of params.labelImages) {
      parts.push(
        { type: "text", text: `Ảnh nhãn ${label.id}:` },
        { type: "file", title: `${label.id}.png`, mimeType: "image/png", storagePath: label.storagePath },
      );
    }
  }
  parts.push({ type: "text", text: "</chung_tu_goc>" });
  return parts;
}

type FormContextParams = Parameters<typeof formContext>[0];

export async function runFormMaking(params: FormContextParams) {
  const messages: PromptMessage[] = [
    {
      role: "user",
      parts: [
        ...formContext(params),
        { type: "text", text: "Hãy ghép các field của chứng từ mẫu vào đúng ô trên form chứng từ gốc." },
      ],
    },
  ];
  const result = await runStructured({
    model: await getModel("making"),
    system: FORM_MAKING_SYSTEM_PROMPT,
    messages,
    jsonSchema: FORM_MAKING_OUTPUT_SCHEMA,
    schema: formMakingSchema,
    effort: "high",
  });
  return { ...result, placements: toPlacements(result.data.placements, params.layout) };
}

/** Số tin nhắn chat gần nhất gửi kèm làm ngữ cảnh */
const CHAT_HISTORY_LIMIT = 6;

const docxEditSchema = z.object({
  reply: z.string(),
  query_changed: z.boolean(),
  query: z.string(),
  edits: z.array(
    z.object({
      type: z.enum(["replace_text", "move_box", "delete_box", "set_font_size", "add_box"]),
      find: z.string(),
      replace: z.string(),
      box_id: z.string(),
      text: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      font_size: z.number(),
    }),
  ),
});

/** Đổi thao tác AI trả về sang thao tác của docx-edit (-1 / "" nghĩa là không dùng) */
function toDocxEdits(items: z.infer<typeof docxEditSchema>["edits"]): DocxEdit[] {
  const opt = (n: number) => (n >= 0 ? n : null);
  return items.flatMap((e): DocxEdit[] => {
    switch (e.type) {
      case "replace_text":
        return e.find ? [{ type: "replace_text", find: e.find, replace: e.replace }] : [];
      case "move_box":
        return [{ type: "move_box", boxId: e.box_id, x: opt(e.x), y: opt(e.y), w: opt(e.width), h: opt(e.height) }];
      case "delete_box":
        return [{ type: "delete_box", boxId: e.box_id }];
      case "set_font_size":
        return e.font_size > 0 ? [{ type: "set_font_size", boxId: e.box_id, fontSize: Math.min(Math.max(e.font_size, 5), 36) }] : [];
      case "add_box":
        return e.text.trim() && e.width > 0 && e.height > 0
          ? [
              {
                type: "add_box",
                placement: {
                  field: e.text.trim(),
                  text: e.text,
                  x: Math.max(0, e.x),
                  y: Math.max(0, e.y),
                  w: e.width,
                  h: e.height,
                  fontSize: e.font_size > 0 ? e.font_size : 9,
                },
              },
            ]
          : [];
    }
  });
}

/**
 * Chat sửa trực tiếp file Word (chứng từ gốc có sẵn field, hoặc kết quả Making):
 * AI nhìn ảnh trang + danh sách ô, trả về thao tác để app áp lên file.
 */
export async function runDocxEditChat(params: {
  template: Template | null;
  query: string | null;
  sourceQuery: string | null;
  boxes: DocxBox[];
  fields: string[];
  pageImagePath: string | null;
  history: ChatMessage[];
  request: string;
}) {
  const fmt = (n: number | null) => (n == null ? "?" : n);
  const boxes = params.boxes
    .map((b) => `${b.id}: ${JSON.stringify(b.text)} x=${fmt(b.x)} y=${fmt(b.y)} rộng=${fmt(b.w)} cao=${fmt(b.h)} cỡ=${fmt(b.fontSize)}`)
    .join("\n");
  const parts: PromptPart[] = [
    ...(params.template ? templateParts(params.template) : [{ type: "text" as const, text: "<chung_tu_mau>(chưa có)</chung_tu_mau>" }]),
    { type: "text", text: `<query>\n${params.query?.trim() || "(chưa có)"}\n</query>` },
    ...sourceQueryPart(params.sourceQuery),
  ];
  const messages: PromptMessage[] = [
    { role: "user", parts: [...parts, { type: "text", text: "Trên đây là ngữ cảnh tham khảo. Các yêu cầu sẽ được gửi tiếp theo." }] },
  ];
  for (const message of params.history.filter((m) => !m.isError).slice(-CHAT_HISTORY_LIMIT)) {
    messages.push({
      role: message.role === "assistant" ? "assistant" : "user",
      parts: [{ type: "text", text: message.content }],
    });
  }
  // Trạng thái file hiện tại luôn gửi ở lượt cuối (file đổi sau mỗi lần sửa)
  messages.push({
    role: "user",
    parts: [
      { type: "text", text: `<cac_o>\n${boxes || "(không có text box)"}\n</cac_o>\n<cac_field>${params.fields.join(" ") || "(không có)"}</cac_field>` },
      ...(params.pageImagePath
        ? [
            { type: "text" as const, text: "<anh_trang> (file hiện tại, 1pt = 2px)" },
            { type: "file" as const, title: "trang-1.png", mimeType: "image/png", storagePath: params.pageImagePath },
            { type: "text" as const, text: "</anh_trang>" },
          ]
        : []),
      { type: "text", text: `<yeu_cau>\n${params.request}\n</yeu_cau>` },
    ],
  });
  const result = await runStructured({
    model: await getModel("chat"),
    system: DOCX_EDIT_CHAT_SYSTEM_PROMPT,
    messages,
    jsonSchema: DOCX_EDIT_CHAT_OUTPUT_SCHEMA,
    schema: docxEditSchema,
    effort: "medium",
  });
  return {
    ...result,
    edits: toDocxEdits(result.data.edits),
    // Query sau khi AI sửa cho khớp chứng từ; null nếu không đổi
    query: result.data.query_changed && result.data.query.trim() ? result.data.query : null,
  };
}
