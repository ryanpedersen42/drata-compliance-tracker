import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLatestCheckRun } from "@/lib/status";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const tagId = searchParams.get("tagId") || undefined;
  const status = searchParams.get("status") || undefined; // PASS | FAIL
  const provider = searchParams.get("provider") || undefined;
  const checkStatus = searchParams.get("checkStatus") || undefined; // ENABLED | DISABLED | TESTING
  const q = searchParams.get("q")?.trim() || undefined;

  const where: Prisma.MonitoringTestWhereInput = {};
  if (workspaceId) where.workspaceId = workspaceId;
  if (tagId) where.tagAssignments = { some: { tagId } };
  if (provider) where.provider = provider;
  if (checkStatus) where.checkStatus = checkStatus;
  if (q) where.name = { contains: q };

  const [tests, latestRun] = await Promise.all([
    db.monitoringTest.findMany({
      where,
      include: {
        workspace: true,
        tagAssignments: { include: { tag: true } },
        controlLinks: { include: { control: { select: { id: true, code: true, name: true } } } },
      },
      orderBy: [{ workspace: { name: "asc" } }, { name: "asc" }],
    }),
    getLatestCheckRun(),
  ]);

  const snapshots = latestRun
    ? await db.statusSnapshot.findMany({ where: { checkRunId: latestRun.id, entityType: "TEST" } })
    : [];
  const snapshotByTest = new Map(snapshots.map((s) => [s.testId!, s]));

  let result = tests.map((t) => {
    const snapshot = snapshotByTest.get(t.id);
    return {
      id: t.id,
      name: t.name,
      workspaceId: t.workspaceId,
      workspaceName: t.workspace.name,
      checkResultStatus: t.checkResultStatus,
      checkStatus: t.checkStatus,
      source: t.source,
      provider: t.provider,
      controls: t.controlLinks.map((l) => l.control),
      tags: t.tagAssignments.map((a) => ({ assignmentId: a.id, tagId: a.tag.id, name: a.tag.name, color: a.tag.color })),
      status: snapshot?.status ?? null,
    };
  });

  if (status) {
    result = result.filter((t) => t.status === status);
  }

  return NextResponse.json({ tests: result });
}
