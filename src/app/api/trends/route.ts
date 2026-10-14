import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const RUN_HISTORY_LIMIT = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const tagId = searchParams.get("tagId") || undefined;

  let controlIdsForTag: string[] | undefined;
  if (tagId) {
    const assignments = await db.tagAssignment.findMany({
      where: { tagId, entityType: "CONTROL" },
      select: { controlId: true },
    });
    controlIdsForTag = assignments.map((a) => a.controlId!).filter(Boolean);
  }

  // --- Time series: control pass rate per check run ---
  const runs = await db.checkRun.findMany({
    where: { status: { in: ["SUCCEEDED", "SUCCEEDED_WITH_WARNINGS"] } },
    orderBy: { startedAt: "desc" },
    take: RUN_HISTORY_LIMIT,
  });
  const runIds = runs.map((r) => r.id);

  const snapshotWhere: Record<string, unknown> = { entityType: "CONTROL", checkRunId: { in: runIds } };
  if (workspaceId) snapshotWhere.workspaceId = workspaceId;
  if (controlIdsForTag) snapshotWhere.controlId = { in: controlIdsForTag };

  const grouped = await db.statusSnapshot.groupBy({
    by: ["checkRunId", "status"],
    where: snapshotWhere,
    _count: { _all: true },
  });

  const countsByRun = new Map<string, { PASS: number; FAIL: number }>();
  for (const g of grouped) {
    const entry = countsByRun.get(g.checkRunId) ?? { PASS: 0, FAIL: 0 };
    entry[g.status] = g._count._all;
    countsByRun.set(g.checkRunId, entry);
  }

  const series = runs
    .map((r) => {
      const c = countsByRun.get(r.id) ?? { PASS: 0, FAIL: 0 };
      const total = c.PASS + c.FAIL;
      return {
        checkRunId: r.id,
        date: r.startedAt,
        passing: c.PASS,
        failing: c.FAIL,
        total,
        passRate: total > 0 ? Math.round((c.PASS / total) * 1000) / 10 : null,
      };
    })
    .reverse(); // chronological order for charting

  // --- Current failing count by tag, for controls and tests ---
  const latestRun = runs[0];
  const byTag = latestRun ? await failuresByTag(latestRun.id, workspaceId) : [];

  return NextResponse.json({ series, byTag, latestCheckRunAt: latestRun?.startedAt ?? null });
}

async function failuresByTag(checkRunId: string, workspaceId?: string) {
  const [tags, controlSnapshots, testSnapshots] = await Promise.all([
    db.tag.findMany({ include: { assignments: true } }),
    db.statusSnapshot.findMany({
      where: { checkRunId, entityType: "CONTROL", ...(workspaceId ? { workspaceId } : {}) },
      select: { controlId: true, status: true },
    }),
    db.statusSnapshot.findMany({
      where: { checkRunId, entityType: "TEST", ...(workspaceId ? { workspaceId } : {}) },
      select: { testId: true, status: true },
    }),
  ]);

  const controlStatus = new Map(controlSnapshots.map((s) => [s.controlId!, s.status]));
  const testStatus = new Map(testSnapshots.map((s) => [s.testId!, s.status]));

  return tags
    .map((tag) => {
      const controlAssignments = tag.assignments.filter((a) => a.entityType === "CONTROL" && controlStatus.has(a.controlId!));
      const testAssignments = tag.assignments.filter((a) => a.entityType === "TEST" && testStatus.has(a.testId!));

      const failingControls = controlAssignments.filter((a) => controlStatus.get(a.controlId!) === "FAIL").length;
      const failingTests = testAssignments.filter((a) => testStatus.get(a.testId!) === "FAIL").length;

      return {
        tagId: tag.id,
        name: tag.name,
        color: tag.color,
        totalControls: controlAssignments.length,
        failingControls,
        totalTests: testAssignments.length,
        failingTests,
      };
    })
    .filter((t) => t.totalControls > 0 || t.totalTests > 0)
    .sort((a, b) => b.failingControls + b.failingTests - (a.failingControls + a.failingTests));
}
