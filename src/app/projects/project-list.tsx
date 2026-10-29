"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Field, FormDialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { MoreMenu } from "@/components/more-menu";
import { Avatar, EmptyState } from "@/components/ui";
import { createProject, deleteProject, renameProject, togglePinProject } from "./actions";

type ProjectItem = { id: string; name: string; pinned: boolean };

type DialogState = { kind: "create" } | { kind: "rename" | "delete"; project: ProjectItem } | null;

/** So khớp không dấu, không phân biệt hoa thường */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

export function ProjectList({ projects }: { projects: ProjectItem[] }) {
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = () => setDialog(null);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? projects.filter((p) => normalize(p.name).includes(q)) : projects;
  }, [projects, query]);
  const pinned = filtered.filter((p) => p.pinned);
  const others = filtered.filter((p) => !p.pinned);

  const createButton = (
    <button type="button" className="btn-primary" onClick={() => setDialog({ kind: "create" })}>
      Tạo Project
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-ink">Projects</h1>
        {/* Trạng thái trống chỉ có một nút tạo mới, nằm trong empty state */}
        {projects.length > 0 && createButton}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <EmptyState title="Chưa có Project nào" action={<div className="mt-2">{createButton}</div>} />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <label className="flex min-h-11 w-80 items-center gap-2 rounded border border-border-input bg-surface px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
              <Icon name="search" className="shrink-0 text-ink-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm Project theo tên công ty"
                aria-label="Tìm Project theo tên công ty"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
            </label>
            <span className="text-caption text-ink-muted">{filtered.length} Project</span>
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">Không tìm thấy Project phù hợp</p>
          ) : (
            <div className="flex flex-col gap-6">
              {pinned.length > 0 && (
                <ProjectGroup label="ĐÃ GHIM" projects={pinned} onDialog={setDialog} />
              )}
              {others.length > 0 && (
                <ProjectGroup label="TẤT CẢ PROJECT" projects={others} onDialog={setDialog} />
              )}
            </div>
          )}
        </>
      )}

      <FormDialog
        open={dialog?.kind === "create"}
        onClose={close}
        title="Tạo Project"
        action={createProject}
        submitLabel="Tạo Project"
        pendingText="Đang tạo..."
      >
        <Field label="Tên công ty" htmlFor="project-name">
          <input id="project-name" name="name" required autoFocus className="input" placeholder="VD: Saigon Trading Co., Ltd" />
        </Field>
      </FormDialog>

      {dialog?.kind === "rename" && (
        <FormDialog
          open
          onClose={close}
          title="Đổi tên Project"
          action={renameProject.bind(null, dialog.project.id)}
          submitLabel="Lưu"
        >
          <Field label="Tên công ty" htmlFor="project-rename">
            <input
              id="project-rename"
              name="name"
              required
              autoFocus
              defaultValue={dialog.project.name}
              className="input"
            />
          </Field>
        </FormDialog>
      )}

      {dialog?.kind === "delete" && (
        <FormDialog
          open
          onClose={close}
          title="Xóa Project?"
          description={`Xóa "${dialog.project.name}" cùng toàn bộ loại chứng từ, chứng từ mẫu và chứng từ. Không thể hoàn tác.`}
          action={deleteProject.bind(null, dialog.project.id)}
          submitLabel="Xóa Project"
          pendingText="Đang xóa..."
          width={480}
          danger
        />
      )}
    </>
  );
}

function ProjectGroup(props: {
  label: string;
  projects: ProjectItem[];
  onDialog: (dialog: DialogState) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-caption font-medium text-ink-muted">{props.label}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {props.projects.map((project) => (
          <ProjectRow key={project.id} project={project} onDialog={props.onDialog} />
        ))}
      </ul>
    </section>
  );
}

/** App/ProjectRow: avatar, tên, ghim, menu "…". Bấm vào dòng để mở Project. */
function ProjectRow({ project, onDialog }: { project: ProjectItem; onDialog: (dialog: DialogState) => void }) {
  const [pinning, startPinning] = useTransition();

  return (
    <li className="relative flex h-14 items-center gap-3 px-4 hover:bg-surface-hover">
      <Avatar name={project.name} />
      <Link
        href={`/projects/${project.id}`}
        className="min-w-0 flex-1 truncate text-sm font-medium text-ink outline-none after:absolute after:inset-0 focus-visible:underline"
      >
        {project.name}
      </Link>
      <div className="relative z-10 flex items-center gap-3">
        <button
          type="button"
          aria-label={project.pinned ? "Bỏ ghim" : "Ghim"}
          aria-pressed={project.pinned}
          disabled={pinning}
          onClick={() => startPinning(() => togglePinProject(project.id))}
          className={`icon-btn ${project.pinned ? "text-pin" : "text-ink-subtle"}`}
        >
          <Icon name="star" filled={project.pinned} />
        </button>
        <MoreMenu
          label={`Thao tác với ${project.name}`}
          items={[
            { label: "Đổi tên", icon: "pencil", onSelect: () => onDialog({ kind: "rename", project }) },
            { label: "Xóa", icon: "trash", danger: true, onSelect: () => onDialog({ kind: "delete", project }) },
          ]}
        />
      </div>
    </li>
  );
}
