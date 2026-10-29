"use client";

import { useActionState, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FormMessage, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/action-state";

const noopSubscribe = () => () => {};

/** Modal: nền tối phủ màn hình, hộp ở giữa. Esc hoặc bấm ra ngoài để đóng. */
export function Dialog(props: {
  open: boolean;
  onClose: () => void;
  label: string;
  width?: number;
  children: ReactNode;
}) {
  const { open, onClose } = props;
  // Portal chỉ tạo được sau khi có document (không render trên server)
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        style={{ width: props.width ?? 520 }}
        className="max-h-full max-w-full overflow-y-auto rounded-lg bg-surface shadow-xl"
      >
        {props.children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Modal chứa form gọi server action. Đóng khi action trả về ok.
 * Chỉ mount khi mở nên mỗi lần mở là một form mới (không giữ lỗi cũ).
 */
export function FormDialog(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingText?: string;
  danger?: boolean;
  width?: number;
  children?: ReactNode;
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} label={props.title} width={props.width}>
      <DialogForm {...props} />
    </Dialog>
  );
}

function DialogForm(props: Parameters<typeof FormDialog>[0]) {
  const [state, formAction] = useActionState(props.action, null);
  const { onClose } = props;

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <form action={formAction} className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-ink">{props.title}</h2>
        {props.description && <p className="text-sm text-ink-muted">{props.description}</p>}
      </div>
      {props.children}
      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Hủy
        </button>
        <SubmitButton className={props.danger ? "btn-danger" : "btn-primary"} pendingText={props.pendingText}>
          {props.submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Ô nhập có nhãn trong modal; lỗi hiển thị dưới ô */
export function Field(props: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={props.htmlFor}>
        {props.label}
      </label>
      {props.children}
    </div>
  );
}
