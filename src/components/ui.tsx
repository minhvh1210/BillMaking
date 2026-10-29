import type { ReactNode } from "react";

/** Chữ viết tắt từ tên: "Bình Dương Furniture" -> "BD" */
export function initials(name: string): string {
  const letters = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0]);
  return letters.join("").toUpperCase() || "?";
}

/** Atom/Avatar size md: tròn 40px, chữ viết tắt */
export function Avatar({ name }: { name: string }) {
  return (
    <span className="text-caption flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-subtle font-medium text-secondary-ink">
      {initials(name)}
    </span>
  );
}

/** Atom/Status/Badge neutral: nhãn đếm bo tròn */
export function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="text-caption inline-flex items-center rounded-full bg-surface-sunken px-1.5 py-0.5 text-ink-muted">
      {children}
    </span>
  );
}

/** Atom/Status/Tag neutral: mã ngắn cạnh tên (HBL, INV) */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="text-caption inline-flex items-center rounded-sm bg-surface-sunken px-1 py-0.5 font-medium text-ink-muted">
      {children}
    </span>
  );
}

/** Empty state: chỉ một dòng tiêu đề và một nút hành động */
export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {action}
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(date));
}
