"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isCargoTypeKey } from "@/lib/cargo-types";
import { db } from "@/lib/db";
import { deleteUpload } from "@/lib/storage";
import { previewPdfPath } from "@/lib/word-preview";
import { actionError, requiredText, textField, type ActionState } from "@/lib/action-state";

/** File đã upload của các loại chứng từ (mẫu + chứng từ cần làm) để xóa kèm */
async function uploadsOf(where: { projectCargoType: { projectId: string } } | { id: string }) {
  const documentTypes = await db.documentType.findMany({
    where,
    select: {
      template: { select: { storagePath: true } },
      bill: {
        select: {
          sourceStoragePath: true,
          sourcePagePath: true,
          resultDocxPath: true,
          resultPdfPath: true,
          versions: { select: { filePath: true } },
        },
      },
    },
  });
  return documentTypes.flatMap((d) => [
    d.template?.storagePath,
    d.template && previewPdfPath(d.template.storagePath),
    d.bill?.sourceStoragePath,
    d.bill?.sourceStoragePath && previewPdfPath(d.bill.sourceStoragePath),
    d.bill?.sourcePagePath,
    d.bill?.resultDocxPath,
    d.bill?.resultPdfPath,
    ...(d.bill?.versions.map((v) => v.filePath) ?? []),
  ]);
}

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  let projectId: string;
  try {
    const project = await db.project.create({ data: { name: requiredText(formData, "name", "tên công ty") } });
    projectId = project.id;
  } catch (error) {
    return actionError(error);
  }
  redirect(`/projects/${projectId}`);
}

export async function renameProject(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await db.project.update({ where: { id: projectId }, data: { name: requiredText(formData, "name", "tên công ty") } });
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

export async function togglePinProject(projectId: string): Promise<void> {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { pinned: true } });
  await db.project.update({ where: { id: projectId }, data: { pinned: !project.pinned } });
  refresh();
}

/** Xóa Project cùng toàn bộ loại chứng từ, chứng từ mẫu, chứng từ và file đã upload */
export async function deleteProject(projectId: string): Promise<ActionState> {
  try {
    const files = await uploadsOf({ projectCargoType: { projectId } });
    await db.project.delete({ where: { id: projectId } });
    await Promise.all(files.map(deleteUpload));
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

function documentTypeData(formData: FormData) {
  return {
    name: requiredText(formData, "name", "tên loại chứng từ"),
    code: textField(formData, "code")?.toUpperCase() ?? null,
  };
}

/** Thêm loại chứng từ; loại hàng chưa có trong Project được tự thêm cùng */
export async function createDocumentType(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const cargoType = textField(formData, "cargoType") ?? "";
    if (!isCargoTypeKey(cargoType)) throw new Error("Vui lòng chọn loại hàng.");
    const data = documentTypeData(formData);
    const cargo = await db.projectCargoType.upsert({
      where: { projectId_cargoType: { projectId, cargoType } },
      create: { projectId, cargoType },
      update: {},
    });
    await db.documentType.create({ data: { projectCargoTypeId: cargo.id, ...data } });
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

export async function updateDocumentType(
  documentTypeId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await db.documentType.update({ where: { id: documentTypeId }, data: documentTypeData(formData) });
  } catch (error) {
    return actionError(error);
  }
  refresh();
  return { ok: true };
}

/**
 * Xóa loại chứng từ cùng chứng từ mẫu, query và workspace Bill Making.
 * Loại hàng không còn loại chứng từ nào cũng được xóa để không hiện nhóm rỗng.
 */
export async function deleteDocumentType(documentTypeId: string, redirectTo: string | null): Promise<ActionState> {
  try {
    const files = await uploadsOf({ id: documentTypeId });
    const documentType = await db.documentType.delete({ where: { id: documentTypeId } });
    await db.projectCargoType.deleteMany({
      where: { id: documentType.projectCargoTypeId, documentTypes: { none: {} } },
    });
    await Promise.all(files.map(deleteUpload));
  } catch (error) {
    return actionError(error);
  }
  if (redirectTo) redirect(redirectTo);
  refresh();
  return { ok: true };
}
