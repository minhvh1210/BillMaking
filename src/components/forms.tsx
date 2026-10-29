"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton(props: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={props.className ?? "btn-primary"}>
      {pending && <Spinner />}
      {pending ? (props.pendingText ?? "Đang lưu...") : props.children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="rounded bg-error-subtle px-3 py-2 text-sm text-error-ink">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return <p className="rounded bg-success-subtle px-3 py-2 text-sm text-success-ink">{state.message}</p>;
  }
  return null;
}
