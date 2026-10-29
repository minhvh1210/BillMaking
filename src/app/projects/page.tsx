import { connection } from "next/server";
import { Suspense } from "react";
import { TopBar } from "@/components/top-bar";
import { db } from "@/lib/db";
import { ProjectList } from "./project-list";

export default function ProjectsPage() {
  return (
    <>
      <TopBar />
      <main className="mx-auto flex w-full max-w-[1168px] flex-col gap-6 px-6 py-6">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-surface-sunken" />}>
          <Projects />
        </Suspense>
      </main>
    </>
  );
}

async function Projects() {
  await connection();
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, pinned: true },
  });
  return <ProjectList projects={projects} />;
}
