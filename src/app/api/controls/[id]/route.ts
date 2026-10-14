import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLatestCheckRun } from "@/lib/status";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const control = await db.control.findUnique({
    where: { id },
    include: {
      workspace: true,
      tagAssignments: { include: { tag: true } },
      testLinks: { include: { test: { include: { tagAssignments: { include: { tag: true } } } } } },
      evidenceLinks: { include: { evidence: true } },
    },
  });

  if (!control) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const latestRun = await getLatestCheckRun();
  const testIds = control.testLinks.map((l) => l.testId);
  const testSnapshots = latestRun
    ? await db.statusSnapshot.findMany({
        where: { checkRunId: latestRun.id, entityType: "TEST", testId: { in: testIds } },
      })
    : [];
  const snapshotByTest = new Map(testSnapshots.map((s) => [s.testId!, s]));

  return NextResponse.json({
    id: control.id,
    code: control.code,
    name: control.name,
    description: control.description,
    workspaceName: control.workspace.name,
    isReady: control.isReady,
    hasPolicy: control.hasPolicy,
    hasPassingTest: control.hasPassingTest,
    hasEvidence: control.hasEvidence,
    tags: control.tagAssignments.map((a) => ({ assignmentId: a.id, tagId: a.tag.id, name: a.tag.name, color: a.tag.color })),
    tests: control.testLinks.map((l) => {
      const snapshot = snapshotByTest.get(l.test.id);
      return {
        id: l.test.id,
        name: l.test.name,
        checkResultStatus: l.test.checkResultStatus,
        checkStatus: l.test.checkStatus,
        status: snapshot?.status ?? null,
        tags: l.test.tagAssignments.map((a) => ({ assignmentId: a.id, tagId: a.tag.id, name: a.tag.name, color: a.tag.color })),
      };
    }),
    evidence: control.evidenceLinks.map((l) => ({
      id: l.evidence.id,
      name: l.evidence.name,
      status: l.evidence.status,
      renewalDate: l.evidence.renewalDate,
    })),
  });
}
