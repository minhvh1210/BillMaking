"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Dialog, Field, FormDialog } from "@/components/dialog";
import { FormMessage, Spinner, SubmitButton } from "@/components/forms";
import { Icon, type IconName } from "@/components/icons";
import { MoreMenu } from "@/components/more-menu";
import { formatBytes } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { deleteDocumentType, updateDocumentType } from "../../../actions";
import { DocumentTypeFields } from "../../project-detail";
import {
  removeSourceAction,
  removeTemplateAction,
  runMakingAction,
  saveQueryAction,
  saveSourceQueryAction,
  pasteSourceAction,
  pasteTemplateAction,
  uploadSourceAction,
  uploadTemplateAction,
} from "./actions";
import { ChatPanel, type ChatMessageView } from "./chat-panel";
import { ResultPanel } from "./result-panel";

export type WorkspaceView = {
  projectId: string;
  documentType: { id: string; name: string; code: string | null };
  template: { id: string; fileName: string; fileSize: number } | null;
  query: string | null;
  aiReady: boolean;
  bill: BillView;
};

export type BillView = {
  id: string;
  status: string;
  /** isWord: chứng từ cần làm là file Word, Chat sửa thẳng được file (không cần Making) */
  source: { fileName: string; fileSize: number; isWord: boolean } | null;
  /** Query của chứng từ cần làm (bảng dữ liệu, ý nghĩa field) để AI hiểu ngữ cảnh khi Chat */
  sourceQuery: string | null;
  /** Query kết quả: query chứng từ đã được AI sửa cho khớp chứng từ (null nếu chưa sửa) */
  resultQuery: string | null;
  /** HTML: AI dựng lại chứng từ | DOCX: file Word gốc đã chèn field */
  resultKind: "HTML" | "DOCX";
  resultHtml: string | null;
  hasResult: boolean;
  /** DOCX: có bản PDF xem trước (cần Microsoft Word trên máy chạy app) */
  hasPdf: boolean;
  /** Đổi mỗi khi kết quả thay đổi, dùng để tải lại bản xem trước */
  resultVersion: number;
  fields: { key: string; value: string; found: boolean; note: string }[];
  warnings: string[];
  summary: string | null;
  errorMessage: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  versions: { id: string; source: string; note: string | null; createdAt: string }[];
  messages: ChatMessageView[];
};

const TEMPLATE_ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.html,.htm,.png,.jpg,.jpeg,.webp,.gif";
const SOURCE_ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.html,.htm,.png,.jpg,.jpeg,.webp,.gif";

export function Workspace({ view }: { view: WorkspaceView }) {
  const { bill, documentType } = view;
  const [dialog, setDialog] = useState<"rename" | "delete" | "query" | "sourceQuery" | null>(null);
  const [makingState, setMakingState] = useState<ActionState>(null);
  const [making, startMaking] = useTransition();
  const elapsed = useElapsedSeconds(making);
  const close = () => setDialog(null);

  const processing = making || bill.status === "PROCESSING";
  // Query mẫu không bắt buộc: AI vẫn hiểu field từ chứng từ mẫu
  const canMake = view.aiReady && view.template !== null && bill.source !== null && !processing;
  const failedMessage =
    makingState?.error ?? (!making && bill.status === "FAILED" ? bill.errorMessage : null);

  function handleMaking() {
    if (bill.hasResult && !window.confirm("Making lại sẽ tạo phiên bản kết quả mới. Tiếp tục?")) return;
    setMakingState(null);
    startMaking(async () => setMakingState(await runMakingAction(bill.id)));
  }

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="min-w-0 truncate text-xl font-semibold text-ink">{documentType.name}</h1>
        <MoreMenu
          label={`Thao tác với ${documentType.name}`}
          items={[
            { label: "Đổi tên", icon: "pencil", onSelect: () => setDialog("rename") },
            { label: "Xóa", icon: "trash", danger: true, onSelect: () => setDialog("delete") },
          ]}
        />
      </div>

      {!view.aiReady && (
        <p className="rounded bg-warning-subtle px-3 py-2 text-sm text-warning-ink">
          Chưa cấu hình kết nối AI. Mở menu tài khoản ở góc phải, chọn Kết nối AI để dùng Making và Chat.
        </p>
      )}

      <section className="flex items-end gap-4 rounded-lg border border-border bg-surface p-4">
        {/* Section 1 · Mẫu: dùng chung cho mọi lần Making của loại chứng từ này */}
        <SlotSection title="Mẫu">
          <Slot label="Chứng từ mẫu">
            {view.template ? (
              <FileCard
                icon="file-text"
                href={`/api/templates/${view.template.id}/preview`}
                name={view.template.fileName}
                meta={formatBytes(view.template.fileSize)}
                removeLabel="Gỡ"
                onRemove={() => removeTemplateAction(documentType.id)}
                raised
              />
            ) : (
              <UploadDrop
                title="Thêm chứng từ mẫu"
                accept={TEMPLATE_ACCEPT}
                upload={(data) => uploadTemplateAction(documentType.id, data)}
                paste={pasteTemplateAction.bind(null, documentType.id)}
              />
            )}
          </Slot>
          <Slot label="Query mẫu">
            <QueryCard query={view.query} onEdit={() => setDialog("query")} />
          </Slot>
        </SlotSection>

        {/* Section 2 · Chứng từ cần làm: file đang xử lý và query của nó (để AI hiểu field, bảng dữ liệu) */}
        <SlotSection title="Chứng từ cần làm">
          <Slot label="Chứng từ">
            {bill.source ? (
              <FileCard
                icon="file-text"
                href={`/api/bills/${bill.id}/source`}
                name={bill.source.fileName}
                meta={formatBytes(bill.source.fileSize)}
                removeLabel="Gỡ"
                onRemove={() => removeSourceAction(bill.id)}
                raised
              />
            ) : (
              <UploadDrop
                title="Thêm chứng từ cần làm"
                accept={SOURCE_ACCEPT}
                upload={(data) => uploadSourceAction(bill.id, data)}
                paste={pasteSourceAction.bind(null, bill.id)}
              />
            )}
          </Slot>
          <Slot label="Query">
            <QueryCard query={bill.sourceQuery} onEdit={() => setDialog("sourceQuery")} />
          </Slot>
        </SlotSection>

        <button type="button" onClick={handleMaking} disabled={!canMake} className="btn-primary btn-lg min-w-24">
          {processing && <Spinner />}
          {processing
            ? `Đang Making...${making ? ` ${elapsed}s` : ""}`
            : bill.status === "FAILED"
              ? "Making lại"
              : "Making"}
        </button>
      </section>

      {failedMessage && (
        <div role="alert" className="flex flex-col gap-0.5 rounded bg-error-subtle px-4 py-3">
          <p className="text-sm font-medium text-error-ink">Making thất bại</p>
          <p className="text-caption text-ink-muted">{failedMessage}</p>
        </div>
      )}

      {/* Cả trang cuộn bằng thanh cuộn của trình duyệt; khung Chat dính lại khi cuộn */}
      <div className="flex items-start gap-4">
        <ResultPanel
          bill={bill}
          making={processing}
          setupHint={
            bill.source?.isWord
              ? "Chat với AI để sửa thẳng file Word, hoặc bấm Making để ghép field từ chứng từ mẫu"
              : !view.template
                ? "Thêm chứng từ mẫu, hoặc Chat với AI để bắt đầu"
                : !bill.source
                  ? "Upload chứng từ cần làm, hoặc Chat với AI để bắt đầu"
                  : "Bấm Making hoặc Chat với AI để tạo kết quả"
          }
        />
        <ChatPanel
          billId={bill.id}
          messages={bill.messages}
          enabled={view.aiReady}
          context={{
            editsWord: bill.source?.isWord === true || bill.resultKind === "DOCX",
          }}
        />
      </div>

      {dialog === "query" && (
        <FormDialog
          open
          onClose={close}
          title={`Query mẫu · ${documentType.name}`}
          action={saveQueryAction.bind(null, documentType.id)}
          submitLabel="Lưu"
          width={720}
        >
          <QueryEditor label="Query mẫu" defaultValue={view.query} />
        </FormDialog>
      )}

      {dialog === "sourceQuery" && (
        <FormDialog
          open
          onClose={close}
          title="Query chứng từ cần làm"
          action={saveSourceQueryAction.bind(null, bill.id)}
          submitLabel="Lưu"
          width={720}
        >
          <QueryEditor label="Query chứng từ cần làm" defaultValue={bill.sourceQuery} />
        </FormDialog>
      )}

      {dialog === "rename" && (
        <FormDialog
          open
          onClose={close}
          title="Đổi tên loại chứng từ"
          action={updateDocumentType.bind(null, documentType.id)}
          submitLabel="Lưu"
        >
          <DocumentTypeFields defaults={documentType} />
        </FormDialog>
      )}

      {dialog === "delete" && (
        <FormDialog
          open
          onClose={close}
          title="Xóa loại chứng từ?"
          description={`Xóa "${documentType.name}" cùng chứng từ mẫu, query, kết quả và lịch sử chat. Không thể hoàn tác.`}
          action={deleteDocumentType.bind(null, documentType.id, `/projects/${view.projectId}`)}
          submitLabel="Xóa"
          pendingText="Đang xóa..."
          width={480}
          danger
        />
      )}
    </main>
  );
}

/** Khung nhóm trên thanh Making: tiêu đề + các ô (file, query) nằm ngang */
function SlotSection(props: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded border border-border bg-bg-subtle p-3">
      <p className="text-sm font-medium text-ink">{props.title}</p>
      <div className="flex gap-4">{props.children}</div>
    </div>
  );
}

function Slot(props: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${props.className ?? "flex-1"}`}>
      <span className="text-sm font-medium text-ink-muted">{props.label}</span>
      {props.children}
    </div>
  );
}

/** Ô file đã upload: tên (mở xem), dung lượng, nút Gỡ */
function FileCard(props: {
  icon: IconName;
  href: string;
  name: string;
  meta: string;
  removeLabel: string;
  onRemove: () => Promise<ActionState>;
  raised?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex h-10 items-center gap-2 rounded border border-border pr-1 pl-3 ${
          props.raised ? "bg-surface" : "bg-bg-subtle"
        }`}
      >
        <Icon name={props.icon} className="shrink-0 text-ink-muted" />
        <a
          href={props.href}
          target="_blank"
          rel="noreferrer"
          title={props.name}
          className="min-w-0 flex-1 truncate text-sm text-primary-ink hover:underline"
        >
          {props.name}
        </a>
        <span className="text-caption shrink-0 text-ink-muted">{props.meta}</span>
        <button
          type="button"
          disabled={pending}
          className="btn-ghost btn-sm"
          onClick={() =>
            startTransition(async () => {
              const result = await props.onRemove();
              setError(result?.error ?? null);
            })
          }
        >
          {pending ? <Spinner /> : props.removeLabel}
        </button>
      </div>
      {error && <p className="text-caption text-error-ink">{error}</p>}
    </div>
  );
}

/** Ô trống: kéo thả file thẳng vào ô, hoặc bấm "Thêm" để chọn file / dán nội dung */
function UploadDrop(props: {
  title: string;
  accept: string;
  upload: (data: FormData) => Promise<ActionState>;
  paste: (state: ActionState, data: FormData) => Promise<ActionState>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);

  function send(file: File | undefined) {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    setError(null);
    startTransition(async () => {
      const result = await props.upload(data);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          send(e.dataTransfer.files[0]);
        }}
        className={`flex h-10 items-center gap-2 rounded border border-dashed pr-1 pl-3 ${
          dragging ? "border-primary bg-primary-subtle" : "border-border-input bg-surface"
        }`}
      >
        {pending ? <Spinner /> : <Icon name="upload" className="shrink-0 text-primary-ink" />}
        <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
          {pending ? "Đang upload..." : "Chưa có file"}
        </span>
        <button type="button" disabled={pending} className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
          Thêm
        </button>
      </div>
      {error && <p className="text-caption text-error-ink">{error}</p>}
      {open && (
        <AddFileDialog
          title={props.title}
          accept={props.accept}
          onClose={() => setOpen(false)}
          onFile={(file) => {
            setOpen(false);
            send(file);
          }}
          paste={props.paste}
        />
      )}
    </div>
  );
}

/**
 * Ảnh trong clipboard (ảnh chụp màn hình, ảnh copy), đặt lại tên vì trình duyệt luôn đặt là "image.png".
 * Copy từ Word / Excel có kèm ảnh của vùng chọn: khi clipboard có chữ thì ưu tiên dán chữ.
 */
function clipboardImage(data: DataTransfer | null): File | null {
  if (!data || data.getData("text/plain").trim()) return null;
  const file = Array.from(data.files).find((f) => f.type.startsWith("image/"));
  if (!file) return null;
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "");
  return new File([file], `anh-dan-${stamp}.${ext}`, { type: file.type });
}

/**
 * Modal "Thêm …": tab Upload file (kéo thả / chọn file, lưu ngay)
 * và tab Dán nội dung (HTML, văn bản hoặc ảnh, xem lại rồi bấm Lưu)
 */
function AddFileDialog(props: {
  title: string;
  accept: string;
  onClose: () => void;
  onFile: (file: File) => void;
  paste: (state: ActionState, data: FormData) => Promise<ActionState>;
}) {
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [dragging, setDragging] = useState(false);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, pasteAction] = useActionState(props.paste, null);
  const { onClose, onFile } = props;

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  useEffect(() => {
    if (!image) return;
    return () => URL.revokeObjectURL(image.url);
  }, [image]);

  const modes = [
    { key: "file", label: "Upload file" },
    { key: "paste", label: "Dán nội dung" },
  ] as const;

  return (
    <Dialog open onClose={onClose} label={props.title} width={640}>
      <div className="flex flex-col gap-5 p-6">
        <h2 className="text-lg font-semibold text-ink">{props.title}</h2>
        <div role="radiogroup" aria-label="Cách thêm" className="flex gap-0.5 self-start rounded bg-surface-sunken p-1">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`focus-ring rounded px-3 py-1 text-sm font-medium transition ${
                mode === m.key ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "file" ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) props.onFile(file);
              }}
              className={`flex h-55 flex-col items-center justify-center gap-2 rounded border border-dashed p-6 ${
                dragging ? "border-primary bg-primary-subtle" : "border-border-input bg-bg-subtle"
              }`}
            >
              <Icon name="upload" size={24} className="text-primary-ink" />
              <p className="text-sm font-medium text-ink">Kéo thả file vào đây</p>
              <button type="button" className="btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
                Chọn file
              </button>
              <p className="text-caption text-ink-muted">PDF, Word, Excel, HTML, ảnh · tối đa 100 MB</p>
              <input
                ref={inputRef}
                type="file"
                accept={props.accept}
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) props.onFile(file);
                }}
              />
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Hủy
              </button>
            </div>
          </>
        ) : (
          <form
            action={pasteAction}
            onSubmit={(e) => {
              // Ảnh dán vào đi luồng upload file; code HTML / văn bản đi luồng dán
              if (!image) return;
              e.preventDefault();
              onFile(image.file);
            }}
            className="flex flex-col gap-5"
          >
            <Field label="Nội dung" htmlFor="paste-content">
              {image ? (
                <div className="flex flex-col gap-2 rounded border border-border bg-bg-subtle p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tạm từ clipboard (blob URL) */}
                  <img src={image.url} alt="Ảnh vừa dán" className="max-h-60 self-center rounded object-contain" />
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{image.file.name}</span>
                    <span className="text-caption shrink-0 text-ink-muted">{formatBytes(image.file.size)}</span>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setImage(null)}>
                      Gỡ
                    </button>
                  </div>
                </div>
              ) : (
                <textarea
                  id="paste-content"
                  name="content"
                  required
                  autoFocus
                  rows={12}
                  spellCheck={false}
                  placeholder="Dán HTML, văn bản hoặc ảnh vào đây"
                  onPaste={(e) => {
                    const file = clipboardImage(e.clipboardData);
                    if (!file) return;
                    e.preventDefault();
                    setImage({ file, url: URL.createObjectURL(file) });
                  }}
                  className="input resize-y font-mono text-[13px] leading-5"
                />
              )}
            </Field>
            <FormMessage state={state} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Hủy
              </button>
              <SubmitButton pendingText="Đang lưu...">Lưu</SubmitButton>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}

function QueryEditor({ label, defaultValue }: { label: string; defaultValue: string | null }) {
  return (
    <textarea
      name="query"
      aria-label={label}
      autoFocus
      rows={16}
      defaultValue={defaultValue ?? ""}
      spellCheck={false}
      className="input resize-y font-mono text-[13px] leading-5"
    />
  );
}

function QueryCard({ query, onEdit }: { query: string | null; onEdit: () => void }) {
  const text = query?.trim() ?? "";
  const lineCount = text ? text.split(/\r?\n/).length : 0;
  // Gộp query nhiều dòng thành một dòng để xem nhanh
  const preview = text.replace(/\s+/g, " ");

  return (
    <div className="flex h-10 items-center gap-2 rounded border border-border bg-surface pr-1 pl-3">
      <Icon name="code" className="shrink-0 text-ink-muted" />
      {text ? (
        <>
          <span title={text} className="min-w-0 flex-1 truncate text-sm text-ink">
            {preview}
          </span>
          <span className="text-caption shrink-0 text-ink-muted">{lineCount} dòng</span>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">Chưa có query</span>
      )}
      <button type="button" className="btn-ghost btn-sm" onClick={onEdit}>
        {text ? "Sửa" : "Thêm query"}
      </button>
    </div>
  );
}

function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [active]);
  return seconds;
}
