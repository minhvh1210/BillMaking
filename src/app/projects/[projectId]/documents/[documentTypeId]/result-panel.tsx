"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { FormMessage, Spinner } from "@/components/forms";
import { Icon } from "@/components/icons";
import { formatDateTime } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { restoreVersionAction, saveManualHtmlAction } from "./actions";
import type { BillView } from "./workspace";

const VERSION_SOURCE: Record<string, string> = {
  MAKING: "Making",
  CHAT: "Chat AI",
  MANUAL: "Sửa tay",
  RESTORE: "Khôi phục",
};

type Tab = "result" | "fields" | "warnings" | "versions" | "source";

/** Khung kết quả với các tab: Kết quả, Dữ liệu trích xuất, Cảnh báo, Phiên bản, Chứng từ cần làm */
export function ResultPanel(props: { bill: BillView; making: boolean; setupHint: string }) {
  const { bill } = props;
  const [tab, setTab] = useState<Tab>("result");

  // Có phiên bản kết quả mới (Making / Chat / Khôi phục) hoặc bắt đầu Making: tự chuyển về tab Kết quả
  const latestVersionId = bill.versions[0]?.id ?? null;
  const [seenVersionId, setSeenVersionId] = useState(latestVersionId);
  const [seenMaking, setSeenMaking] = useState(props.making);
  if (latestVersionId !== seenVersionId || props.making !== seenMaking) {
    if (latestVersionId !== seenVersionId || props.making) setTab("result");
    setSeenVersionId(latestVersionId);
    setSeenMaking(props.making);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "result", label: "Kết quả" },
    { key: "fields", label: `Dữ liệu trích xuất (${bill.fields.length})` },
    { key: "warnings", label: `Cảnh báo (${bill.warnings.length})` },
    { key: "versions", label: `Phiên bản (${bill.versions.length})` },
    { key: "source", label: "Chứng từ cần làm" },
  ];

  return (
    <section className="flex min-h-[calc(100vh-48px)] min-w-0 flex-1 flex-col rounded-lg border border-border bg-surface">
      <div role="tablist" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`focus-ring -mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${
              tab === t.key ? "border-primary-ink text-primary-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {tab === "result" && <ResultView bill={bill} making={props.making} setupHint={props.setupHint} />}
        {tab === "fields" && <FieldsTab fields={bill.fields} />}
        {tab === "warnings" && <WarningsTab warnings={bill.warnings} />}
        {tab === "versions" && <VersionsTab bill={bill} />}
        {tab === "source" &&
          (bill.source ? (
            <iframe
              title="Chứng từ cần làm"
              src={`/api/bills/${bill.id}/source`}
              className="h-[calc(100vh-160px)] min-h-[480px] w-full rounded border border-border bg-white"
            />
          ) : (
            <Empty text="Chưa có chứng từ cần làm" />
          ))}
      </div>
    </section>
  );
}

/** Tab Kết quả: chuyển giữa kết quả chứng từ và kết quả query */
function ResultView(props: { bill: BillView; making: boolean; setupHint: string }) {
  const [view, setView] = useState<"document" | "query">("document");
  const options = [
    { key: "document", label: "Chứng từ" },
    { key: "query", label: "Query" },
  ] as const;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div role="radiogroup" aria-label="Xem kết quả" className="flex gap-0.5 self-start rounded bg-surface-sunken p-0.5">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={view === o.key}
            onClick={() => setView(o.key)}
            className={`focus-ring rounded px-3 py-1 text-sm font-medium transition ${
              view === o.key ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {view === "document" ? <ResultTab {...props} /> : <QueryResult bill={props.bill} />}
    </div>
  );
}

/**
 * Kết quả query: query chứng từ đã được AI sửa cho khớp với chứng từ (đổi / thêm / bỏ field).
 * Chưa sửa lần nào thì hiện query chứng từ người dùng nhập.
 */
function QueryResult({ bill }: { bill: BillView }) {
  const query = bill.resultQuery ?? bill.sourceQuery;
  if (!query?.trim()) return <Empty text="Chưa có query. Thêm ở ô Query của Chứng từ cần làm" />;

  const changed = bill.resultQuery !== null && bill.resultQuery !== bill.sourceQuery;
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={query} label="Sao chép" />
        <a href={`/api/bills/${bill.id}/download?format=sql&v=${bill.resultVersion}`} className="btn-secondary btn-sm">
          Tải .sql
        </a>
        <span className={`text-caption ml-auto ${changed ? "text-success-ink" : "text-ink-muted"}`}>
          {changed ? "Đã sửa cho khớp chứng từ" : "Chưa thay đổi so với query chứng từ"}
        </span>
      </div>
      <pre className="min-h-[480px] overflow-auto rounded border border-border bg-bg-subtle p-4 font-mono text-[13px] leading-5 whitespace-pre text-ink">
        {query}
      </pre>
    </div>
  );
}

/** Nút sao chép nội dung (code HTML, query) vào clipboard */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Đã sao chép" : label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <p className="text-sm font-semibold text-ink">{text}</p>
    </div>
  );
}

function ResultTab({ bill, making, setupHint }: { bill: BillView; making: boolean; setupHint: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bill.resultHtml ?? "");
  const [state, setState] = useState<ActionState>(null);
  const [saving, startSaving] = useTransition();
  const [fullscreen, setFullscreen] = useState(false);

  if (making) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-3 rounded bg-info-subtle px-4 py-3 text-sm text-info-ink">
          <Spinner />
          AI đang đọc chứng từ cần làm và thay dữ liệu bằng field của chứng từ mẫu. Chứng từ dài có thể mất vài phút.
        </p>
        <div className="flex animate-pulse flex-col gap-3" aria-hidden>
          {[60, 80, 45, 70, 55].map((w, i) => (
            <span key={i} className="h-2.5 rounded bg-surface-sunken" style={{ width: `${w * 3}px` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!bill.hasResult) return <Empty text={setupHint} />;
  if (bill.resultKind === "DOCX" || !bill.resultHtml) return <DocxResult bill={bill} />;

  const download = `/api/bills/${bill.id}/download`;
  const missingCount = bill.fields.filter((f) => !f.found).length;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={editing ? draft : bill.resultHtml} label="Sao chép HTML" />
        <a href={`${download}?format=html`} className="btn-secondary btn-sm">
          Tải HTML
        </a>
        <a href={`${download}?format=doc`} className="btn-secondary btn-sm">
          Tải Word
        </a>
        <a href={`${download}?format=print`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
          In / Lưu PDF
        </a>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            setDraft(bill.resultHtml ?? "");
            setEditing(!editing);
            setState(null);
          }}
        >
          {editing ? "Đóng sửa HTML" : "Sửa HTML"}
        </button>
        <button
          type="button"
          aria-label="Xem toàn màn hình"
          title="Xem toàn màn hình"
          className="icon-btn ml-auto"
          onClick={() => setFullscreen(true)}
        >
          <Icon name="maximize" />
        </button>
      </div>
      {fullscreen && <FullscreenDocument html={editing ? draft : bill.resultHtml} onClose={() => setFullscreen(false)} />}

      {bill.summary && (
        <div className="flex gap-2 rounded bg-info-subtle px-3 py-2">
          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info-ink" />
          <div>
            <p className="text-sm font-medium text-info-ink">Tóm tắt</p>
            <p className="text-caption text-ink-muted">
              {bill.summary}
              {missingCount > 0 && ` · ${missingCount} field mẫu chưa có chỗ trên chứng từ`}
            </p>
          </div>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            spellCheck={false}
            className="input font-mono text-xs"
            aria-label="Mã HTML kết quả"
          />
          <div>
            <button
              type="button"
              disabled={saving}
              className="btn-primary btn-sm"
              onClick={() =>
                startSaving(async () => {
                  const result = await saveManualHtmlAction(bill.id, draft);
                  setState(result);
                  if (result?.ok) setEditing(false);
                })
              }
            >
              {saving && <Spinner />} Lưu phiên bản mới
            </button>
          </div>
          <FormMessage state={state} />
        </div>
      )}

      {/* Chứng từ luôn hiện trên nền giấy trắng, kể cả ở theme tối */}
      <div className="flex justify-center rounded bg-surface-sunken p-4">
        <DocumentFrame html={editing ? draft : bill.resultHtml} />
      </div>
    </div>
  );
}

/**
 * Kết quả dạng form Word: chính file chứng từ cần làm (giữ nguyên logo, khung, chữ in sẵn)
 * đã chèn các field của chứng từ mẫu. Xem trước bằng bản PDF do Word xuất.
 */
function DocxResult({ bill }: { bill: BillView }) {
  const [fullscreen, setFullscreen] = useState(false);
  const download = `/api/bills/${bill.id}/download`;
  // Thêm phiên bản vào URL để trình duyệt tải lại bản PDF mới sau mỗi lần Making / Chat
  const pdfUrl = `${download}?format=pdf&v=${bill.resultVersion}#toolbar=0&navpanes=0`;
  const unmapped = bill.fields.filter((f) => !f.found).length;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`${download}?format=docx`} className="btn-secondary btn-sm">
          Tải Word
        </a>
        {bill.hasPdf && (
          <a href={`${download}?format=pdf&v=${bill.resultVersion}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
            In / Lưu PDF
          </a>
        )}
        {bill.hasPdf && (
          <button
            type="button"
            aria-label="Xem toàn màn hình"
            title="Xem toàn màn hình"
            className="icon-btn ml-auto"
            onClick={() => setFullscreen(true)}
          >
            <Icon name="maximize" />
          </button>
        )}
      </div>
      {fullscreen && <FullscreenDocument src={pdfUrl} onClose={() => setFullscreen(false)} />}

      {bill.summary && (
        <div className="flex gap-2 rounded bg-info-subtle px-3 py-2">
          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info-ink" />
          <div>
            <p className="text-sm font-medium text-info-ink">Tóm tắt</p>
            <p className="text-caption text-ink-muted">
              {bill.summary}
              {unmapped > 0 && ` · ${unmapped} field chưa có ô trên form`}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-center rounded bg-surface-sunken p-4">
        {bill.hasPdf ? (
          <iframe title="Kết quả Bill Making" src={pdfUrl} className="aspect-[1/1.414] w-full max-w-[860px] bg-white shadow-sm" />
        ) : (
          <p className="py-16 text-center text-sm text-ink-muted">
            Không tạo được bản xem trước vì máy chạy app không có Microsoft Word. Bấm Tải Word để mở file kết quả.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Khung hiển thị chứng từ, cao đúng bằng nội dung để không có thanh cuộn riêng (trang cuộn chung).
 * sandbox không có allow-scripts nên script trong chứng từ không chạy; allow-same-origin chỉ để
 * trang cha đo được chiều cao nội dung.
 */
function DocumentFrame({ html, maxWidth = 860 }: { html: string; maxWidth?: number }) {
  // Mặc định cao bằng một trang A4 cho tới khi đo được
  const [height, setHeight] = useState(1123);
  return (
    <iframe
      title="Kết quả Bill Making"
      sandbox="allow-same-origin"
      srcDoc={highlightFields(html)}
      scrolling="no"
      onLoad={(e) => {
        const doc = e.currentTarget.contentDocument;
        if (doc) setHeight(Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0));
      }}
      style={{ height, maxWidth }}
      className="w-full bg-white shadow-sm"
    />
  );
}

/**
 * Tô màu các field ${X} / {X} khi XEM TRƯỚC để dễ soát. Chỉ đổi phần chữ giữa các thẻ,
 * không đụng thuộc tính; code lưu lại và code người dùng sao chép vẫn giữ nguyên như mẫu.
 */
function highlightFields(html: string): string {
  return html.replace(/>([^<]+)</g, (_, text: string) =>
    `>${text.replace(
      /\$?\{[\p{L}\p{N}_.-]{1,80}\}/gu,
      (field) => `<span style="background:#eaf9f8;color:#0e7c7b;padding:0 2px">${field}</span>`,
    )}<`,
  );
}

/** Xem chứng từ toàn màn hình: phủ cả cửa sổ, cuộn bên trong, đóng bằng nút X hoặc Esc */
function FullscreenDocument({ html, src, onClose }: { html?: string; src?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Khóa cuộn trang phía sau trong lúc xem
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Xem chứng từ toàn màn hình" className="fixed inset-0 z-50 flex flex-col bg-black/70">
      <div className="flex shrink-0 justify-end p-3">
        <button
          type="button"
          aria-label="Đóng"
          title="Đóng (Esc)"
          autoFocus
          onClick={onClose}
          className="focus-ring inline-flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow hover:bg-surface-sunken"
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <div className="flex flex-1 justify-center overflow-auto px-6 pb-6">
        {src ? (
          <iframe title="Kết quả Bill Making" src={src} className="aspect-[1/1.414] w-full max-w-[1100px] bg-white shadow-sm" />
        ) : (
          <DocumentFrame html={html ?? ""} maxWidth={1100} />
        )}
      </div>
    </div>,
    document.body,
  );
}

function FieldsTab({ fields }: { fields: BillView["fields"] }) {
  if (fields.length === 0) return <Empty text="Chưa có dữ liệu trích xuất" />;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-caption border-b border-border text-ink-muted">
        <tr>
          <th className="px-2 py-2 font-medium">Field</th>
          <th className="px-2 py-2 font-medium">Dữ liệu gốc</th>
          <th className="px-2 py-2 font-medium">Trạng thái</th>
          <th className="px-2 py-2 font-medium">Ghi chú</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {fields.map((f, i) => (
          <tr key={`${f.key}-${i}`} className="align-top">
            <td className="px-2 py-2 font-mono text-xs text-ink">{/[{}]/.test(f.key) ? f.key : `{${f.key}}`}</td>
            <td className="px-2 py-2 whitespace-pre-wrap text-ink">{f.value || <span className="text-ink-subtle">—</span>}</td>
            <td className="px-2 py-2">
              <span className={`text-caption font-medium ${f.found ? "text-success-ink" : "text-warning-ink"}`}>
                {f.found ? "Đã đặt" : "Không có chỗ"}
              </span>
            </td>
            <td className="text-caption px-2 py-2 text-ink-muted">{f.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WarningsTab({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return <Empty text="Không có cảnh báo" />;
  return (
    <ul className="flex flex-col gap-2">
      {warnings.map((w, i) => (
        <li key={i} className="rounded bg-warning-subtle px-3 py-2 text-sm text-warning-ink">
          {w}
        </li>
      ))}
    </ul>
  );
}

function VersionsTab({ bill }: { bill: BillView }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  if (bill.versions.length === 0) return <Empty text="Chưa có phiên bản nào" />;
  return (
    <div className="flex flex-col gap-2">
      <FormMessage state={state} />
      <ul className="divide-y divide-border">
        {bill.versions.map((v, i) => (
          <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {VERSION_SOURCE[v.source] ?? v.source}
                {i === 0 && <span className="text-caption ml-2 font-normal text-success-ink">Đang dùng</span>}
              </p>
              <p className="text-caption truncate text-ink-muted">
                {formatDateTime(v.createdAt)}
                {v.note ? ` · ${v.note}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={`/api/bills/${bill.id}/download?format=view&version=${v.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary btn-sm"
              >
                Xem
              </a>
              {i > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  className="btn-secondary btn-sm"
                  onClick={() => startTransition(async () => setState(await restoreVersionAction(bill.id, v.id)))}
                >
                  Khôi phục
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
