import Link from "next/link";
import { connection } from "next/server";
import { Fragment, Suspense } from "react";
import { AccountMenu, type AiSettingsView } from "@/components/account-menu";
import { getCachedClaudeCodeStatus } from "@/lib/ai-status";
import { AI_MODELS, AI_PROVIDERS, getApiKey, getModel, getProvider, maskApiKey } from "@/lib/settings";

export type Crumb = { label: string; href?: string };

/** App/TopBar: thanh navy cao 52px, logo + đường dẫn bên trái, tài khoản bên phải */
export function TopBar({ path = [] }: { path?: Crumb[] }) {
  return (
    <header className="flex h-13 shrink-0 items-center justify-between gap-4 bg-topbar px-6 text-topbar-ink">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Link href="/projects" className="focus-ring flex shrink-0 items-center gap-2 rounded">
          <span className="text-caption flex size-7 items-center justify-center rounded bg-[#0e7c7b] font-medium text-white">
            BM
          </span>
          <span className="text-sm font-medium">BillMaking</span>
        </Link>
        {path.length > 0 && (
          <>
            <span aria-hidden className="h-5 w-px shrink-0 bg-topbar-divider" />
            <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-2 text-sm text-topbar-muted">
              {path.map((crumb, i) => (
                <Fragment key={i}>
                  {i > 0 && <span aria-hidden>/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="truncate hover:text-topbar-ink hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate">{crumb.label}</span>
                  )}
                </Fragment>
              ))}
            </nav>
          </>
        )}
      </div>
      <Suspense fallback={<span className="h-9 w-40 animate-pulse rounded bg-white/10" />}>
        <Account />
      </Suspense>
    </header>
  );
}

async function Account() {
  await connection();
  const [provider, apiKey, modelMaking, modelChat, claudeCode] = await Promise.all([
    getProvider(),
    getApiKey(),
    getModel("making"),
    getModel("chat"),
    getCachedClaudeCodeStatus(),
  ]);

  const settings: AiSettingsView = {
    provider,
    providers: AI_PROVIDERS.map((p) => ({ ...p })),
    models: AI_MODELS.map((m) => ({ id: m.id, label: m.label.split(" — ")[0] })),
    modelMaking,
    modelChat,
    maskedKey: apiKey ? maskApiKey(apiKey) : null,
    claudeCode,
  };
  return <AccountMenu settings={settings} />;
}
