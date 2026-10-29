export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

export function actionError(error: unknown): ActionState {
  return { error: error instanceof Error ? error.message : "Đã có lỗi xảy ra." };
}

/** Đọc field text từ FormData, trả về null nếu rỗng */
export function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function requiredText(formData: FormData, name: string, label: string): string {
  const value = textField(formData, name);
  if (!value) throw new Error(`Vui lòng nhập ${label}.`);
  return value;
}

/** Lấy file từ FormData, trả về null nếu người dùng không chọn file */
export function fileField(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}
