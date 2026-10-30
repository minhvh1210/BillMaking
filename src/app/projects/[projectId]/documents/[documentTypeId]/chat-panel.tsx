"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { FormDialog } from "@/components/dialog";
import { FormMessage, Spinner } from "@/components/forms";
import { MoreMenu } from "@/components/more-menu";
import type { ActionState } from "@/lib/action-state";
import { clearChatAction, sendChatAction } from "./actions";

export type ChatMessageView = {
  id: string;
  role: string;
  content: string;
  isError: boolean;
  versionId: string | null;
};

/** editsWord: chat sửa thẳng file Word (chứng từ cần làm dạng Word hoặc kết quả Word) */
type ChatContext = { editsWord: boolean };

/** Chat với AI: không phụ thuộc Making, dùng được ngay cả khi chưa có kết quả */
export function ChatPanel(props: { billId: string; messages: ChatMessageView[]; enabled: boolean; context: ChatContext }) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<ActionState>(null);
  const [pending, startTransition] = useTransition();
  const [messages, addOptimistic] = useOptimistic(props.messages, (current, text: string) => [
    ...current,
    { id: `pending-${current.length}`, role: "user", content: text, isError: false, versionId: null },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Chỉ cuộn khung tin nhắn xuống cuối; scrollIntoView sẽ cuộn cả trang làm đầu trang trôi mất
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending]);

  function send() {
    const request = input.trim();
    if (!request || pending || !props.enabled) return;
    setInput("");
    setState(null);
    startTransition(async () => {
      addOptimistic(request);
      const result = await sendChatAction(props.billId, request);
      if (result?.error) {
        setState(result);
        setInput(request);
      }
    });
  }

  return (
    <aside className="sticky top-6 flex h-[calc(100vh-48px)] min-h-[480px] w-90 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border py-3 pr-3 pl-4">
        <h2 className="text-sm font-medium text-ink">Chat với AI</h2>
        {props.messages.length > 0 && (
          <MoreMenu
            label="Thao tác với phiên chat"
            items={[{ label: "Xóa lịch sử chat", icon: "trash", danger: true, onSelect: () => setConfirmClear(true) }]}
          />
        )}
      </div>
      {confirmClear && (
        <FormDialog
          open
          onClose={() => setConfirmClear(false)}
          title="Xóa lịch sử chat?"
          description="Xóa toàn bộ tin nhắn với AI. Chứng từ, query và các phiên bản kết quả vẫn được giữ."
          action={clearChatAction.bind(null, props.billId)}
          submitLabel="Xóa lịch sử"
          pendingText="Đang xóa..."
          width={480}
          danger
        />
      )}

      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && !pending && (
          <p className="m-auto text-center text-sm text-ink-muted">
            {props.context.editsWord
              ? "Nhắn để sửa thẳng file Word: đổi field, dời, xóa, thêm ô, đổi cỡ chữ."
              : "Hỏi AI về chứng từ cần làm, mẫu hoặc query, hoặc nhờ AI dựng chứng từ mà không cần Making."}
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-on-primary"
                  : m.isError
                    ? "bg-error-subtle text-error-ink"
                    : "bg-surface-sunken text-ink"
              }`}
            >
              {m.content}
              {m.versionId && <p className="text-caption mt-1 font-medium text-success-ink">Đã tạo phiên bản mới</p>}
            </div>
          </div>
        ))}
        {pending && (
          <p className="text-caption flex items-center gap-2 text-ink-muted">
            <Spinner /> AI đang trả lời...
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex flex-col gap-2 border-t border-border p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={4}
          disabled={!props.enabled || pending}
          className="input resize-none"
          aria-label="Tin nhắn cho AI"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption text-ink-subtle">Enter để gửi · Shift+Enter xuống dòng</span>
          <button type="submit" disabled={!props.enabled || pending || !input.trim()} className="btn-primary btn-sm">
            Gửi
          </button>
        </div>
        <FormMessage state={state} />
      </form>
    </aside>
  );
}
