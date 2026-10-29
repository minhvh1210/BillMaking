import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TopBar } from "@/components/top-bar";
import { cargoTypeLabel } from "@/lib/cargo-types";
import { db } from "@/lib/db";
import { isFormSource } from "@/lib/form-result";
import { getApiKey, getProvider } from "@/lib/settings";
import { Workspace, type WorkspaceView } from "./workspace";

export default function BillMakingPage({ params }: PageProps<"/projects/[projectId]/documents/[documentTypeId]">) {
  return (
    <Suspense fallback={<TopBar />}>
      <BillMakingContent params={params} />
    </Suspense>
  );
}

async function BillMakingContent({ params }: { params: Promise<{ projectId: string; documentTypeId: string }> }) {
  await connection();
  const { projectId, documentTypeId } = await params;
  const documentType = await db.documentType.findUnique({
    where: { id: documentTypeId },
    include: { projectCargoType: { include: { project: true } }, template: true },
  });
  if (!documentType || documentType.projectCargoType.projectId !== projectId) notFound();

  // Mỗi loại chứng từ có một workspace, tạo khi mở lần đầu
  const [bill, provider, apiKey] = await Promise.all([
    db.bill.upsert({
      where: { documentTypeId },
      create: { documentTypeId },
      update: {},
      include: {
        versions: { orderBy: { createdAt: "desc" }, select: { id: true, source: true, note: true, createdAt: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    }),
    getProvider(),
    getApiKey(),
  ]);

  const project = documentType.projectCargoType.project;
  const cargoLabel = cargoTypeLabel(documentType.projectCargoType.cargoType);
  const { template } = documentType;

  const view: WorkspaceView = {
    projectId,
    documentType: { id: documentType.id, name: documentType.name, code: documentType.code },
    template: template ? { id: template.id, fileName: template.fileName, fileSize: template.fileSize } : null,
    query: documentType.query,
    // Claude Code được kiểm tra khi chạy Making (gọi CLI ở mỗi lần tải trang sẽ chậm)
    aiReady: provider === "claude-code" || apiKey !== null,
    bill: {
      id: bill.id,
      status: bill.status,
      source:
        bill.sourceFileName && bill.sourceFileSize != null
          ? { fileName: bill.sourceFileName, fileSize: bill.sourceFileSize, isWord: isFormSource(bill.sourceMimeType) }
          : null,
      sourceQuery: bill.sourceQuery,
      resultQuery: bill.resultQuery,
      resultKind: bill.resultKind === "DOCX" && bill.resultDocxPath ? "DOCX" : "HTML",
      resultHtml: bill.resultHtml,
      hasResult: Boolean(bill.resultHtml || bill.resultDocxPath),
      hasPdf: Boolean(bill.resultPdfPath),
      resultVersion: bill.updatedAt.getTime(),
      fields: JSON.parse(bill.extractedFields ?? "[]"),
      warnings: JSON.parse(bill.warnings ?? "[]"),
      summary: bill.summary,
      errorMessage: bill.errorMessage,
      model: bill.model,
      inputTokens: bill.inputTokens,
      outputTokens: bill.outputTokens,
      versions: bill.versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
      messages: bill.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        isError: m.isError,
        versionId: m.versionId,
      })),
    },
  };

  return (
    <>
      <TopBar
        path={[
          { label: project.name, href: `/projects/${projectId}` },
          { label: `${cargoLabel} · ${documentType.name}` },
        ]}
      />
      <Workspace view={view} />
    </>
  );
}
