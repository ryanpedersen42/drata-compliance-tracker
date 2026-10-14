import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLatestCheckRun } from "@/lib/status";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const tagId = searchParams.get("tagId") || undefined;
  const status = searchParams.get("status") || undefined; // PASS | FAIL
  const q = searchParams.get("q")?.trim() || undefined;

  const where: Prisma.ControlWhereInput = {};
  if (workspaceId) where.workspaceId = workspaceId;
  if (tagId) where.tagAssignments = { some: { tagId } };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
    ];
  }

  const [controls, latestRun] = await Promise.all([
    db.control.findMany({
      where,
      include: {
        workspace: true,
        tagAssignments: { include: { tag: true } },
        testLinks: { select: { testId: true } },
      },
      orderBy: [{ workspace: { name: "asc" } }, { code: "asc" }],
    }),
    getLatestCheckRun(),
  ]);

  const snapshots = latestRun
    ? await db.statusSnapshot.findMany({
        where: { checkRunId: latestRun.id, entityType: "CONTROL" },
      })
    : [];
  const snapshotByControl = new Map(snapshots.map((s) => [s.controlId!, s]));

  let result = controls.map((c) => {
    const snapshot = snapshotByControl.get(c.id);
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      workspaceId: c.workspaceId,
      workspaceName: c.workspace.name,
      isReady: c.isReady,
      hasPolicy: c.hasPolicy,
      hasPassingTest: c.hasPassingTest,
      hasEvidence: c.hasEvidence,
      testCount: c.testLinks.length,
      tags: c.tagAssignments.map((a) => ({ assignmentId: a.id, tagId: a.tag.id, name: a.tag.name, color: a.tag.color })),
      status: snapshot?.status ?? (c.isReady ? "PASS" : "FAIL"),
      reasonCode: snapshot?.reasonCode ?? null,
      reasonDetail: snapshot?.reasonDetail ?? null,
    };
  });

  if (status) {
    result = result.filter((c) => c.status === status);
  }

  return NextResponse.json({
    controls: result,
    latestCheckRun: latestRun ? { id: latestRun.id, startedAt: latestRun.startedAt } : null,
  });
}
