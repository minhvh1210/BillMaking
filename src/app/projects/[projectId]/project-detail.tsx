"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormDialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { MoreMenu } from "@/components/more-menu";
import { CountBadge, EmptyState, Tag } from "@/components/ui";
import { CARGO_TYPES, cargoTypeLabel } from "@/lib/cargo-types";
import { createDocumentType, deleteDocumentType, updateDocumentType } from "../actions";

type DocumentTypeItem = { id: string; name: string; code: string | null };
type CargoGroup = { id: string; cargoType: string; documentTypes: DocumentTypeItem[] };

type DialogState =
  | { kind: "create" }
  | { kind: "rename" | "delete"; documentType: DocumentTypeItem }
  | null;

export function ProjectDetail(props: { projectId: string; name: string; groups: CargoGroup[] }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  // Mặc định mọi nhóm đều mở; chỉ lưu những nhóm người dùng đã thu gọn
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const close = () => setDialog(null);

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createButton = (
    <button type="button" className="btn-primary" onClick={() => setDialog({ kind: "create" })}>
      Thêm loại chứng từ
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="min-w-0 truncate text-xl font-semibold text-ink">{props.name}</h1>
        {props.groups.length > 0 && createButton}
      </div>

      {props.groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <EmptyState title="Chưa có loại chứng từ nào" action={<div className="mt-2">{createButton}</div>} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {props.groups.map((group) => (
            <CargoGroupCard
              key={group.id}
              projectId={props.projectId}
              group={group}
              open={!collapsed.has(group.id)}
              onToggle={() => toggle(group.id)}
              onDialog={setDialog}
            />
          ))}
        </div>
      )}

      {dialog?.kind === "create" && (
        <CreateDocumentTypeDialog
          projectId={props.projectId}
          existing={props.groups.map((g) => g.cargoType)}
          onClose={close}
        />
      )}

      {dialog?.kind === "rename" && (
        <FormDialog
          open
          onClose={close}
          title="Đổi tên loại chứng từ"
          action={updateDocumentType.bind(null, dialog.documentType.id)}
          submitLabel="Lưu"
        >
          <DocumentTypeFields defaults={dialog.documentType} />
        </FormDialog>
      )}

      {dialog?.kind === "delete" && (
        <FormDialog
          open
          onClose={close}
          title="Xóa loại chứng từ?"
          description={`Xóa "${dialog.documentType.name}" cùng chứng từ mẫu, query, kết quả và lịch sử chat. Không thể hoàn tác.`}
          action={deleteDocumentType.bind(null, dialog.documentType.id, null)}
          submitLabel="Xóa"
          pendingText="Đang xóa..."
          width={480}
          danger
        />
      )}
    </>
  );
}

/** Nhóm loại hàng: bấm cả thanh để mở / thu gọn, icon nằm bên phải */
function CargoGroupCard(props: {
  projectId: string;
  group: CargoGroup;
  open: boolean;
  onToggle: () => void;
  onDialog: (dialog: DialogState) => void;
}) {
  const { group, open } = props;
  const router = useRouter();

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={props.onToggle}
        className="focus-ring flex w-full items-center gap-2 bg-bg-subtle py-3 pr-6 pl-4 text-left"
      >
        <span className="text-sm font-medium text-ink">{cargoTypeLabel(group.cargoType)}</span>
        <CountBadge>{group.documentTypes.length} loại chứng từ</CountBadge>
        <span className="flex-1" />
        <Icon name={open ? "chevron-down" : "chevron-right"} className="text-ink-muted" />
      </button>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {group.documentTypes.map((doc) => {
            const href = `/projects/${props.projectId}/documents/${doc.id}`;
            return (
              // Bấm vào dòng (hoặc Enter) để mở màn Bill Making; menu "…" tự chặn click lan ra dòng
              <li
                key={doc.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(href)}
                onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && router.push(href)}
                className="focus-ring flex h-14 cursor-pointer items-center gap-3 px-4 select-none hover:bg-surface-hover"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-primary-subtle text-primary-ink">
                  <Icon name="file-text" />
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{doc.name}</span>
                  {doc.code && <Tag>{doc.code}</Tag>}
                </span>
                <MoreMenu
                  label={`Thao tác với ${doc.name}`}
                  items={[
                    { label: "Đổi tên", icon: "pencil", onSelect: () => props.onDialog({ kind: "rename", documentType: doc }) },
                    {
                      label: "Xóa",
                      icon: "trash",
                      danger: true,
                      onSelect: () => props.onDialog({ kind: "delete", documentType: doc }),
                    },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function DocumentTypeFields({ defaults }: { defaults?: DocumentTypeItem }) {
  return (
    <>
      <Field label="Tên loại chứng từ" htmlFor="doc-name">
        <input id="doc-name" name="name" required autoFocus defaultValue={defaults?.name} className="input" />
        <p className="text-caption mt-1 text-ink-muted">VD: House Bill of Lading, Commercial Invoice, Debit Note</p>
      </Field>
      <Field label="Mã (tùy chọn)" htmlFor="doc-code">
        <input id="doc-code" name="code" defaultValue={defaults?.code ?? ""} maxLength={12} className="input w-80 uppercase" />
        <p className="text-caption mt-1 text-ink-muted">Mã ngắn hiển thị cạnh tên, VD: HBL, INV</p>
      </Field>
    </>
  );
}

function CreateDocumentTypeDialog(props: { projectId: string; existing: string[]; onClose: () => void }) {
  const [cargoType, setCargoType] = useState<string>(props.existing[0] ?? CARGO_TYPES[0].key);
  const isNew = !props.existing.includes(cargoType);

  return (
    <FormDialog
      open
      onClose={props.onClose}
      title="Thêm loại chứng từ"
      action={createDocumentType.bind(null, props.projectId)}
      submitLabel="Thêm"
      pendingText="Đang thêm..."
    >
      <Field label="Loại hàng" htmlFor="doc-cargo">
        <select
          id="doc-cargo"
          name="cargoType"
          value={cargoType}
          onChange={(e) => setCargoType(e.target.value)}
          className="input"
        >
          {CARGO_TYPES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        {isNew && (
          <p className="text-caption mt-1 text-info-ink">
            {cargoTypeLabel(cargoType)} chưa có trong Project, sẽ tự thêm cùng loại chứng từ này.
          </p>
        )}
      </Field>
      <DocumentTypeFields />
    </FormDialog>
  );
}
