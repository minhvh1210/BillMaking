import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TopBar } from "@/components/top-bar";
import { cargoTypeOrder } from "@/lib/cargo-types";
import { db } from "@/lib/db";
import { ProjectDetail } from "./project-detail";

export default function ProjectPage({ params }: PageProps<"/projects/[projectId]">) {
  return (
    <Suspense
      fallback={
        <>
          <TopBar />
          <div className="mx-auto mt-6 h-40 w-full max-w-[1120px] animate-pulse rounded-lg bg-surface-sunken" />
        </>
      }
    >
      <ProjectContent params={params} />
    </Suspense>
  );
}

async function ProjectContent({ params }: { params: Promise<{ projectId: string }> }) {
  await connection();
  const { projectId } = await params;
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      cargoTypes: {
        include: {
          documentTypes: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, code: true } },
        },
      },
    },
  });
  if (!project) notFound();

  // Loại hàng chỉ hiện khi có ít nhất một loại chứng từ
  const groups = project.cargoTypes
    .filter((c) => c.documentTypes.length > 0)
    .sort((a, b) => cargoTypeOrder(a.cargoType) - cargoTypeOrder(b.cargoType))
    .map((c) => ({ id: c.id, cargoType: c.cargoType, documentTypes: c.documentTypes }));

  return (
    <>
      <TopBar path={[{ label: project.name }]} />
      <main className="mx-auto flex w-full max-w-[1168px] flex-col gap-6 px-6 py-6">
        <ProjectDetail projectId={project.id} name={project.name} groups={groups} />
      </main>
    </>
  );
}
