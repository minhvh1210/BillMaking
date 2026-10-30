"use server";

import { refresh } from "next/cache";
import { describeAiError } from "@/lib/ai/client";
import { runDocxEditChat, runFormMaking, type FormPlacement } from "@/lib/ai/form-making";
import { applyDocxEdits, readDocxBoxes } from "@/lib/docx-edit";
import { fillForm } from "@/lib/docx-form";
import { runChat, runMaking } from "@/lib/ai/making";
import { actionError, fileField, textField, type ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import {
  assertSourceFile,
  assertTemplateFile,
  convertToHtml,
  escapeHtml,
  extractPlaceholders,
} from "@/lib/file-convert";
import {
  buildFormResult,
  currentDocxPath,
  isFormSource,
  placementFields,
  prepareFormContext,
  renderPageImage,
  replaceFormResult,
  saveDocxResult,
} from "@/lib/form-result";
import { keepTemplateStyles, sanitizeResultHtml } from "@/lib/html";
import { deleteUpload, readUpload, saveUpload } from "@/lib/storage";
import { previewPdfPath } from "@/lib/word-preview";

/**
 * Nội dung người dùng dán vào (HTML hoặc văn bản) được lưu thành file .html để đi chung luồng upload.
 * Văn bản thường (không có thẻ HTML) được bọc trong <pre> để giữ nguyên xuống dòng và khoảng trắng.
 */
function pastedFile(formData: FormData, defaultName: string): FormData {
  const content = textField(formData, "content");
  if (!content) throw new Error("Vui lòng dán nội dung.");
  const looksLikeHtml = /<\/?[a-z][\s\S]*?>/i.test(content);
  const html = looksLikeHtml ? content : `<pre>${escapeHtml(content)}</pre>`;
  const data = new FormData();
  data.set("file", new File([html], `${defaultName}.html`, { type: "text/html" }));
  return data;
}

/** Dán nội dung chứng từ mẫu thay cho upload file */
export async function pasteTemplateAction(documentTypeId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    return await uploadTemplateAction(documentTypeId, pastedFile(formData, "chung-tu-mau"));
  } catch (error) {
    return actionError(error);
  }
}

/** Dán nội dung chứng từ cần làm thay cho upload file */
export async function pasteSourceAction(billId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    return await uploadSourceAction(billId, pastedFile(formData, "chung-tu"));
  } catch (error) {
    return actionError(error);
  }
}

/** Upload chứng từ mẫu. Mỗi loại chứng từ chỉ có một mẫu: muốn đổi phải Gỡ mẫu cũ trước. */
export async function uploadTemplateAction(documentTypeId: string, formData: FormData): Promise<ActionState> {
  let storedPath: string | null = null;
  try {
    const file = fileField(formData, "file");
    if (!file) throw new Error("Vui lòng chọn file chứng từ mẫu.");
    if (await db.template.findUnique({ where: { documentTypeId } })) {
      throw new Error("Loại chứng từ này đã có chứng từ mẫu. Gỡ mẫu hiện tại trước khi upload mẫu mới.");
    }
    const info = assertTemplateFile(file.name);
    const stored = await saveUpload(file, info.mime);
    storedPath = stored.storagePath;
    const convertedHtml = await convertToHtml(stored.buffer, info.kind);
    await db.template.create({
      data: {
        documentTypeId,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        storagePath: stored.storagePath,
        fileSize: stored.fileSize,
        convertedHtml,
        placeholders: JSON.stringify(extractPlaceholders(convertedHtml)),
      },
    });
  } catch (error) {
    await deleteUpload(storedPath);
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

export async function removeTemplateAction(documentTypeId: string): Promise<ActionState> {
  try {
    const template = await db.template.delete({ where: { documentTypeId } });
    await Promise.all([deleteUpload(template.storagePath), deleteUpload(previewPdfPath(template.storagePath))]);
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

export async function saveQueryAction(documentTypeId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await db.documentType.update({ where: { id: documentTypeId }, data: { query: textField(formData, "query") } });
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

/** Query của chứng từ cần làm: cho AI biết bảng dữ liệu / ý nghĩa các field khi Chat */
export async function saveSourceQueryAction(billId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await db.bill.update({ where: { id: billId }, data: { sourceQuery: textField(formData, "query") } });
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

/** Upload chứng từ cần làm vào workspace. Muốn đổi file phải Gỡ file cũ trước. */
export async function uploadSourceAction(billId: string, formData: FormData): Promise<ActionState> {
  let storedPath: string | null = null;
  try {
    const file = fileField(formData, "file");
    if (!file) throw new Error("Vui lòng chọn file chứng từ cần làm.");
    const bill = await db.bill.findUniqueOrThrow({ where: { id: billId } });
    if (bill.sourceStoragePath) throw new Error("Đã có chứng từ cần làm. Gỡ file hiện tại trước khi upload file mới.");
    const info = assertSourceFile(file.name);
    const stored = await saveUpload(file, info.mime);
    storedPath = stored.storagePath;
    // Chứng từ cần làm mới: kết quả hiện tại thuộc về file cũ nên được bỏ (phiên bản cũ vẫn giữ để khôi phục)
    await db.bill.update({
      where: { id: billId },
      data: {
        sourceFileName: stored.fileName,
        sourceMimeType: stored.mimeType,
        sourceStoragePath: stored.storagePath,
        sourceFileSize: stored.fileSize,
        sourceConverted: await convertToHtml(stored.buffer, info.kind),
        status: "DRAFT",
        resultKind: "HTML",
        resultHtml: null,
        resultPlacements: null,
        resultDocxPath: null,
        resultPdfPath: null,
        resultQuery: null,
        extractedFields: null,
        warnings: null,
        summary: null,
        errorMessage: null,
        model: null,
        inputTokens: null,
        outputTokens: null,
      },
    });
    await deleteUpload(bill.resultPdfPath);
  } catch (error) {
    await deleteUpload(storedPath);
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

/** Gỡ chứng từ cần làm. Kết quả và phiên bản cũ vẫn được giữ. */
export async function removeSourceAction(billId: string): Promise<ActionState> {
  try {
    const bill = await db.bill.findUniqueOrThrow({ where: { id: billId } });
    await db.bill.update({
      where: { id: billId },
      data: {
        sourceFileName: null,
        sourceMimeType: null,
        sourceStoragePath: null,
        sourceFileSize: null,
        sourceConverted: null,
        sourcePagePath: null,
      },
    });
    await Promise.all([
      deleteUpload(bill.sourceStoragePath),
      deleteUpload(bill.sourcePagePath),
      bill.sourceStoragePath && deleteUpload(previewPdfPath(bill.sourceStoragePath)),
    ]);
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

export async function runMakingAction(billId: string): Promise<ActionState> {
  const bill = await db.bill.findUnique({
    where: { id: billId },
    include: { documentType: { include: { template: true } } },
  });
  if (!bill) return { error: "Không tìm thấy chứng từ." };
  const { template, query } = bill.documentType;
  if (!template) return { error: "Vui lòng upload chứng từ mẫu trước khi Making." };
  if (!bill.sourceStoragePath) return { error: "Vui lòng upload chứng từ cần làm trước khi Making." };
  // Cho phép chạy lại nếu lần trước bị treo (VD: server khởi động lại giữa chừng)
  const stuck = Date.now() - bill.updatedAt.getTime() > 20 * 60 * 1000;
  if (bill.status === "PROCESSING" && !stuck) {
    return { error: "Chứng từ đang được xử lý, vui lòng đợi." };
  }

  await db.bill.update({ where: { id: billId }, data: { status: "PROCESSING", errorMessage: null } });

  try {
    if (isFormSource(bill.sourceMimeType)) {
      await runFormMakingFor(bill, template, query);
      refresh();
      return { ok: true };
    }

    const result = await runMaking(template, query, bill);
    // Kết quả là code chứng từ mẫu đã sửa nội dung: giữ nguyên định dạng (head / style) của mẫu
    const html = sanitizeResultHtml(keepTemplateStyles(result.data.html, template.convertedHtml));
    await db.$transaction([
      db.bill.update({
        where: { id: billId },
        data: {
          status: "DONE",
          resultKind: "HTML",
          resultHtml: html,
          extractedFields: JSON.stringify(result.data.fields),
          warnings: JSON.stringify(result.data.warnings),
          summary: result.data.summary,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      }),
      db.billVersion.create({
        data: { billId, html, source: "MAKING", note: `Making với mẫu "${template.fileName}"` },
      }),
    ]);
  } catch (error) {
    const message = describeAiError(error);
    await db.bill.update({ where: { id: billId }, data: { status: "FAILED", errorMessage: message } });
    refresh();
    return { error: message };
  }

  refresh();
  return { ok: true };
}

type BillRecord = NonNullable<Awaited<ReturnType<typeof db.bill.findUnique>>>;
type TemplateRecord = NonNullable<Awaited<ReturnType<typeof db.template.findUnique>>>;

/**
 * Making khi chứng từ cần làm là form Word: AI chọn vị trí các field của chứng từ mẫu trên form,
 * app chèn field vào chính file gốc (giữ nguyên logo, khung, chữ in sẵn).
 */
async function runFormMakingFor(bill: BillRecord, template: TemplateRecord, query: string | null) {
  const context = await prepareFormContext(bill);
  try {
    const result = await runFormMaking({ ...context, template, query });
    if (result.placements.length === 0) throw new Error("AI không tìm được ô nào trên form để đặt field.");
    const files = await buildFormResult(context.source, result.placements);
    const placements = JSON.stringify(result.placements);
    await db.$transaction([
      db.bill.update({
        where: { id: bill.id },
        data: {
          status: "DONE",
          resultKind: "DOCX",
          resultHtml: null,
          resultPlacements: placements,
          extractedFields: JSON.stringify(placementFields(result.placements, result.data.unmapped)),
          warnings: JSON.stringify(result.data.warnings),
          summary: result.data.summary,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      }),
      db.billVersion.create({
        data: {
          billId: bill.id,
          kind: "DOCX",
          html: "",
          placements,
          filePath: files.docxPath,
          source: "MAKING",
          note: `Ghép field từ mẫu "${template.fileName}"`,
        },
      }),
    ]);
    await replaceFormResult(bill, files);
  } finally {
    await context.cleanup();
  }
}

/**
 * Chat sửa trực tiếp file Word: chứng từ cần làm đã có sẵn field (không cần Making),
 * hoặc kết quả Making gần nhất. AI trả về thao tác (đổi chữ / field, dời, xóa, thêm ô, đổi cỡ chữ),
 * app áp lên file và lưu thành phiên bản mới.
 */
async function sendDocxEditChat(
  bill: BillRecord & { messages: Awaited<ReturnType<typeof db.chatMessage.findMany>> },
  docxPath: string,
  template: TemplateRecord | null,
  query: string | null,
  request: string,
) {
  const current = await readUpload(docxPath);
  const { boxes, fields } = await readDocxBoxes(current);
  const pageImagePath = await renderPageImage(current);
  // Query đang dùng: bản kết quả gần nhất nếu đã có, không thì query chứng từ người dùng nhập
  const currentQuery = bill.resultQuery ?? bill.sourceQuery;
  try {
    const result = await runDocxEditChat({
      template,
      query,
      sourceQuery: currentQuery,
      boxes,
      fields,
      pageImagePath,
      history: bill.messages,
      request,
    });
    let reply = result.data.reply;
    let versionId: string | null = null;
    let document: Buffer | null = null;
    if (result.edits.length > 0) {
      const edited = await applyDocxEdits(current, result.edits);
      if (edited.skipped.length > 0) reply += `\n\nKhông áp dụng được: ${edited.skipped.join("; ")}.`;
      if (edited.skipped.length < result.edits.length) document = edited.buffer;
    }
    // Có đổi chứng từ hoặc đổi query: lưu phiên bản mới gồm cả file Word và query kết quả
    if (document || result.query) {
      const finalDocument = document ?? current;
      const files = await saveDocxResult(finalDocument);
      const resultQuery = result.query ?? currentQuery;
      const version = await db.billVersion.create({
        data: {
          billId: bill.id,
          kind: "DOCX",
          html: "",
          filePath: files.docxPath,
          query: resultQuery,
          source: "CHAT",
          note: request.slice(0, 200),
        },
      });
      versionId = version.id;
      const after = await readDocxBoxes(finalDocument);
      await db.bill.update({
        where: { id: bill.id },
        data: {
          resultQuery,
          extractedFields: JSON.stringify(
            after.boxes.map((b) => ({
              key: b.text,
              value: b.x == null ? "" : `x=${b.x} y=${b.y}`,
              found: true,
              note: b.fontSize ? `cỡ ${b.fontSize}` : "",
            })),
          ),
        },
      });
      await replaceFormResult(bill, files);
    }
    await db.chatMessage.create({ data: { billId: bill.id, role: "assistant", content: reply, versionId } });
  } finally {
    await deleteUpload(pageImagePath);
  }
}

/** Chat không phụ thuộc Making: AI dùng phần ngữ cảnh đang có (mẫu, query, chứng từ cần làm, kết quả) */
export async function sendChatAction(billId: string, text: string): Promise<ActionState> {
  const request = text.trim();
  if (!request) return { error: "Vui lòng nhập yêu cầu." };

  const bill = await db.bill.findUnique({
    where: { id: billId },
    include: {
      documentType: { include: { template: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!bill) return { error: "Không tìm thấy chứng từ." };

  await db.chatMessage.create({ data: { billId, role: "user", content: request } });

  try {
    // Chứng từ cần làm / kết quả là file Word: chat sửa thẳng file
    const docxPath = currentDocxPath(bill);
    if (docxPath) {
      await sendDocxEditChat(bill, docxPath, bill.documentType.template, bill.documentType.query, request);
      refresh();
      return { ok: true };
    }

    const result = await runChat({
      template: bill.documentType.template,
      query: bill.documentType.query,
      bill,
      history: bill.messages,
      currentHtml: bill.resultHtml,
      request,
    });

    let versionId: string | null = null;
    // Chưa Making vẫn được: chat dựng chứng từ lần đầu thì lưu thành kết quả và phiên bản đầu tiên
    if (result.data.html_changed && result.data.html.trim()) {
      const html = sanitizeResultHtml(keepTemplateStyles(result.data.html, bill.documentType.template?.convertedHtml));
      const version = await db.billVersion.create({
        data: { billId, html, source: "CHAT", note: request.slice(0, 200) },
      });
      versionId = version.id;
      await db.bill.update({
        where: { id: billId },
        data: { resultKind: "HTML", resultHtml: html, status: "DONE", errorMessage: null },
      });
    }
    await db.chatMessage.create({
      data: { billId, role: "assistant", content: result.data.reply, versionId },
    });
  } catch (error) {
    await db.chatMessage.create({
      data: { billId, role: "assistant", content: describeAiError(error), isError: true },
    });
  }

  refresh();
  return { ok: true };
}

export async function restoreVersionAction(billId: string, versionId: string): Promise<ActionState> {
  try {
    const version = await db.billVersion.findUniqueOrThrow({ where: { id: versionId } });
    if (version.billId !== billId) throw new Error("Phiên bản không thuộc chứng từ này.");

    if (version.kind === "DOCX") {
      const bill = await db.bill.findUniqueOrThrow({ where: { id: billId } });
      let docx: Buffer;
      if (version.filePath) {
        docx = await readUpload(version.filePath);
      } else {
        // Phiên bản Making cũ chỉ lưu vị trí field: dựng lại từ chứng từ cần làm
        if (!bill.sourceStoragePath || !isFormSource(bill.sourceMimeType)) {
          throw new Error("Cần upload lại đúng file chứng từ cần làm dạng Word để khôi phục phiên bản này.");
        }
        docx = await fillForm(await readUpload(bill.sourceStoragePath), JSON.parse(version.placements ?? "[]") as FormPlacement[]);
      }
      const files = await saveDocxResult(docx);
      await db.billVersion.create({
        data: {
          billId,
          kind: "DOCX",
          html: "",
          filePath: files.docxPath,
          query: version.query,
          source: "RESTORE",
          note: "Khôi phục phiên bản cũ",
        },
      });
      await db.bill.update({ where: { id: billId }, data: { resultQuery: version.query } });
      await replaceFormResult(bill, files);
      refresh();
      return { ok: true, message: "Đã khôi phục phiên bản." };
    }

    await db.$transaction([
      db.bill.update({ where: { id: billId }, data: { resultKind: "HTML", resultHtml: version.html, status: "DONE" } }),
      db.billVersion.create({
        data: { billId, html: version.html, source: "RESTORE", note: "Khôi phục phiên bản cũ" },
      }),
    ]);
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true, message: "Đã khôi phục phiên bản." };
}

export async function saveManualHtmlAction(billId: string, html: string): Promise<ActionState> {
  if (!html.trim()) return { error: "Nội dung HTML không được để trống." };
  const clean = sanitizeResultHtml(html);
  try {
    await db.$transaction([
      db.bill.update({ where: { id: billId }, data: { resultHtml: clean, status: "DONE" } }),
      db.billVersion.create({ data: { billId, html: clean, source: "MANUAL", note: "Sửa tay HTML" } }),
    ]);
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true, message: "Đã lưu bản chỉnh sửa." };
}

/** Xóa lịch sử chat của workspace. Chứng từ, query và các phiên bản kết quả vẫn được giữ. */
export async function clearChatAction(billId: string): Promise<ActionState> {
  try {
    await db.chatMessage.deleteMany({ where: { billId } });
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true };
}
