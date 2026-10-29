"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { removeApiKey, saveAiSettings, testConnection } from "@/app/settings/actions";
import { Dialog } from "@/components/dialog";
import { FormMessage, Spinner, SubmitButton } from "@/components/forms";
import { Icon, type IconName } from "@/components/icons";
import { THEME_OPTIONS, useTheme, type ThemeChoice } from "@/components/theme";
import type { ActionState } from "@/lib/action-state";

export type AiSettingsView = {
  provider: string;
  providers: { id: string; label: string; description: string }[];
  models: { id: string; label: string }[];
  modelMaking: string;
  modelChat: string;
  maskedKey: string | null;
  claudeCode:
    | { ok: true; version: string; email: string | null; subscription: string | null }
    | { ok: false; error: string };
};

type Section = "ai" | "theme";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function providerName(provider: string): string {
  return provider === "api-key" ? "API key" : "Claude Code";
}

/** Nút tài khoản trên thanh trên cùng: menu Kết nối AI / Giao diện, mở modal Cài đặt */
export function AccountMenu({ settings }: { settings: AiSettingsView }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [theme, setTheme] = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cc = settings.claudeCode;
  const email = cc.ok ? cc.email : null;
  const label =
    settings.provider === "api-key"
      ? "API key"
      : cc.ok && cc.subscription
        ? `Claude Code · ${capitalize(cc.subscription)}`
        : "Claude Code";
  const themeLabel = THEME_OPTIONS.find((t) => t.id === theme)?.label ?? "";

  const openSection = (next: Section) => {
    setOpen(false);
    setSection(next);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="focus-ring flex h-9 items-center gap-2 rounded px-2 hover:bg-white/10 aria-expanded:bg-white/10"
      >
        <span className="text-caption flex size-8 items-center justify-center rounded-full bg-topbar font-medium text-topbar-avatar-ink">
          {(email ?? label).charAt(0).toUpperCase()}
        </span>
        <span className="text-sm font-medium">{label}</span>
        <Icon name="chevron-down" className="text-topbar-subtle" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 w-75 rounded-lg border border-white/10 bg-topbar p-1 text-topbar-ink shadow-xl"
        >
          {email && <p className="text-caption px-3 pt-2 pb-1 text-topbar-muted">{email}</p>}
          <MenuItem icon="plug" label="Kết nối AI" meta={providerName(settings.provider)} onClick={() => openSection("ai")} />
          <MenuItem icon="sun" label="Giao diện" meta={themeLabel} chevron onClick={() => openSection("theme")} />
        </div>
      )}

      <Dialog open={section !== null} onClose={() => setSection(null)} label="Cài đặt" width={800}>
        <div className="grid min-h-[440px] grid-cols-[200px_1fr]">
          <nav className="flex flex-col gap-1 rounded-l-lg bg-bg-subtle p-4">
            <p className="mb-2 px-1 text-sm font-semibold text-ink">Cài đặt</p>
            <NavButton icon="plug" label="Kết nối AI" active={section === "ai"} onClick={() => setSection("ai")} />
            <NavButton icon="sun" label="Giao diện" active={section === "theme"} onClick={() => setSection("theme")} />
          </nav>
          <div className="flex min-w-0 flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">{section === "theme" ? "Giao diện" : "Kết nối AI"}</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSection(null)}>
                Đóng
              </button>
            </div>
            {section === "theme" ? (
              <ThemeSettings value={theme} onChange={setTheme} />
            ) : (
              <AiSettings settings={settings} />
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function MenuItem(props: { icon: IconName; label: string; meta: string; chevron?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={props.onClick}
      className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm hover:bg-white/10"
    >
      <Icon name={props.icon} className="text-topbar-subtle" />
      <span className="flex-1">{props.label}</span>
      <span className="text-caption text-topbar-subtle">{props.meta}</span>
      {props.chevron && <Icon name="chevron-right" className="text-topbar-subtle" />}
    </button>
  );
}

function NavButton(props: { icon: IconName; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-current={props.active ? "page" : undefined}
      className={`focus-ring flex items-center gap-2 rounded px-2 py-2 text-left text-sm ${
        props.active ? "bg-primary-subtle font-medium text-primary-ink" : "text-ink hover:bg-surface-sunken"
      }`}
    >
      <Icon name={props.icon} />
      {props.label}
    </button>
  );
}

/** Thẻ lựa chọn dạng radio (cách kết nối, theme) */
function OptionCard(props: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded border px-3 py-2.5 transition ${
        props.checked ? "border-primary bg-primary-subtle" : "border-border hover:bg-surface-hover"
      }`}
    >
      <input
        type="radio"
        name={props.name}
        value={props.value}
        checked={props.checked}
        onChange={props.onChange}
        className="mt-0.5 size-4 accent-[var(--primary)]"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{props.label}</span>
        <span className="text-caption block text-ink-muted">{props.description}</span>
      </span>
    </label>
  );
}

function AiSettings({ settings }: { settings: AiSettingsView }) {
  const [provider, setProvider] = useState(settings.provider);
  const [saveState, saveAction] = useActionState(saveAiSettings, null);
  const [testState, setTestState] = useState<ActionState>(null);
  const [testing, startTesting] = useTransition();
  const [removing, startRemoving] = useTransition();
  // Hiện thông báo của thao tác gần nhất (lưu hoặc kiểm tra)
  const [lastAction, setLastAction] = useState<"save" | "test">("save");
  const cc = settings.claudeCode;

  return (
    <form action={saveAction} onSubmit={() => setLastAction("save")} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Cách kết nối</legend>
        {settings.providers.map((p) => (
          <OptionCard
            key={p.id}
            name="provider"
            value={p.id}
            checked={provider === p.id}
            label={p.label}
            description={p.description}
            onChange={() => setProvider(p.id)}
          />
        ))}
      </fieldset>

      {provider === "claude-code" ? (
        cc.ok ? (
          <StatusBox tone="success" title="Claude Code đã đăng nhập">
            {[cc.subscription && `Gói ${capitalize(cc.subscription)}`, cc.email, "Claude Code"].filter(Boolean).join(" · ")}
            <br />
            {cc.version}
          </StatusBox>
        ) : (
          <StatusBox tone="error" title="Claude Code chưa sẵn sàng">
            {cc.error}
          </StatusBox>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <label className="label" htmlFor="apiKey">
            Anthropic API key
          </label>
          <input
            id="apiKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={settings.maskedKey ? `Đã lưu ${settings.maskedKey}. Để trống nếu giữ key này` : "sk-ant-..."}
            className="input font-mono"
          />
          {settings.maskedKey && (
            <button
              type="button"
              disabled={removing}
              className="btn-ghost btn-sm self-start text-error-ink"
              onClick={() => startRemoving(async () => void (await removeApiKey()))}
            >
              {removing && <Spinner />} Xóa key đã lưu
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <ModelSelect name="modelMaking" label="Model cho Making" value={settings.modelMaking} models={settings.models} />
        <ModelSelect name="modelChat" label="Model cho Chat" value={settings.modelChat} models={settings.models} />
      </div>

      <FormMessage state={lastAction === "save" ? saveState : testState} />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={testing}
          className="btn-secondary"
          onClick={() => {
            setLastAction("test");
            startTesting(async () => setTestState(await testConnection(provider)));
          }}
        >
          {testing && <Spinner />} Kiểm tra kết nối
        </button>
        <SubmitButton pendingText="Đang kiểm tra...">Lưu</SubmitButton>
      </div>
    </form>
  );
}

function StatusBox(props: { tone: "success" | "error"; title: string; children: React.ReactNode }) {
  const success = props.tone === "success";
  return (
    <div className={`flex gap-2 rounded px-3 py-2 ${success ? "bg-success-subtle" : "bg-error-subtle"}`}>
      <span
        aria-hidden
        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${success ? "bg-success-ink" : "bg-error-ink"}`}
      />
      <div>
        <p className={`text-sm font-medium ${success ? "text-success-ink" : "text-error-ink"}`}>{props.title}</p>
        <p className="text-caption text-ink-muted">{props.children}</p>
      </div>
    </div>
  );
}

function ModelSelect(props: { name: string; label: string; value: string; models: AiSettingsView["models"] }) {
  return (
    <div>
      <label className="label" htmlFor={props.name}>
        {props.label}
      </label>
      <select id={props.name} name={props.name} defaultValue={props.value} className="input">
        {props.models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ThemeSettings({ value, onChange }: { value: ThemeChoice; onChange: (choice: ThemeChoice) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label">Theme</legend>
      {THEME_OPTIONS.map((option) => (
        <OptionCard
          key={option.id}
          name="theme"
          value={option.id}
          checked={value === option.id}
          label={option.label}
          description={option.description}
          onChange={() => onChange(option.id)}
        />
      ))}
      <p className="text-caption mt-1 text-ink-muted">Thay đổi được áp dụng ngay, không cần lưu.</p>
    </fieldset>
  );
}
