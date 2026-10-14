import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  DrataClient,
  type DrataControl,
  type DrataEvidence,
  type DrataMonitoringTest,
} from "@/lib/drata";
import { dispatchNotifications } from "@/lib/notifications";
import { detectProvider } from "@/lib/provider";

const FAILING_TEST_RESULTS = new Set(["FAILED", "ERROR"]);
const FAILING_EVIDENCE_STATUSES = new Set(["EXPIRED", "EXPIRING_SOON", "NEEDS_ARTIFACT", "NEEDS_ATTENTION", "ERROR"]);

/**
 * Drata's `checkResultStatus` isn't just PASSED/FAILED - a disabled or
 * not-yet-evaluated test reports "READY", which is a pending state, not a
 * failure. Only PASSED/FAILED/ERROR are verdicts; everything else (READY,
 * disabled tests, missing data) has no verdict yet.
 */
function testVerdict(t: { checkResultStatus?: string | null; checkStatus?: string | null }): "PASS" | "FAIL" | null {
  if (t.checkStatus === "DISABLED") return null;
  if (t.checkResultStatus === "PASSED") return "PASS";
  if (t.checkResultStatus && FAILING_TEST_RESULTS.has(t.checkResultStatus)) return "FAIL";
  return null;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function unwrap<T>(result: PromiseSettledResult<T>, fallback: T, label: string, warnings: string[]): T {
  if (result.status === "fulfilled") return result.value;
  warnings.push(`${label} - ${describeError(result.reason)}`);
  return fallback;
}

export async function runSync(trigger: "MANUAL" | "SCHEDULED") {
  const checkRun = await db.checkRun.create({ data: { trigger } });

  try {
    const settings = await getSettings();
    if (!settings.drataApiKey) {
      throw new Error("No Drata API key configured. Add one in Settings before running a check.");
    }

    const client = new DrataClient(settings.drataApiKey);

    const workspaces = await client.listWorkspaces();
    const workspaceRows = await Promise.all(
      workspaces.map((w) =>
        db.workspace.upsert({
          where: { drataId: String(w.id) },
          create: { drataId: String(w.id), name: w.name, isPrimary: w.primary, lastSyncedAt: new Date() },
          update: { name: w.name, isPrimary: w.primary, lastSyncedAt: new Date() },
        }),
      ),
    );

    // Policies are account-level, not per-workspace.
    const policies = await client.listPolicies();
    for (const p of policies) {
      await db.policy.upsert({
        where: { drataId: String(p.id) },
        create: {
          drataId: String(p.id),
          name: p.name,
          status: p.status ?? null,
          approvedAt: p.approvedAt ? new Date(p.approvedAt) : null,
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
          renewalDate: p.renewalDate ? new Date(p.renewalDate) : null,
          currentVersion: p.version ?? null,
          rawJson: JSON.stringify(p),
        },
        update: {
          name: p.name,
          status: p.status ?? null,
          approvedAt: p.approvedAt ? new Date(p.approvedAt) : null,
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
          renewalDate: p.renewalDate ? new Date(p.renewalDate) : null,
          currentVersion: p.version ?? null,
          rawJson: JSON.stringify(p),
        },
      });
    }

    const warnings: string[] = [];

    for (const workspace of workspaceRows) {
      const drataWorkspaceId = workspace.drataId;

      // Each resource is fetched independently: a hiccup on one workspace's
      // evidence listing (for example) shouldn't abort the whole nightly
      // check for every other workspace. A failed fetch just falls back to
      // an empty list - control status still works off `isReady`/the other
      // flags, it just loses the fine-grained reason attribution for that
      // resource on that workspace until the next successful sync.
      const [testsResult, evidenceResult, controlsResult] = await Promise.allSettled([
        client.listMonitoringTests(drataWorkspaceId),
        client.listEvidence(drataWorkspaceId),
        client.listControls(drataWorkspaceId),
      ]);

      const tests = unwrap(testsResult, [], `${workspace.name}: monitoring tests`, warnings);
      const evidence = unwrap(evidenceResult, [], `${workspace.name}: evidence`, warnings);

      if (controlsResult.status === "rejected") {
        warnings.push(`${workspace.name}: controls - ${describeError(controlsResult.reason)}`);
        continue; // nothing to snapshot for this workspace without controls
      }
      const controls = controlsResult.value;

      const testRows = await upsertTests(workspace.id, tests);
      const evidenceRows = await upsertEvidence(workspace.id, evidence);
      const controlRows = await upsertControls(workspace.id, controls);

      await linkControlsToTestsAndEvidence(controls, controlRows, testRows, evidenceRows);
      await snapshotControls(workspace.id, controls, controlRows, tests, evidence, checkRun.id);
      await snapshotTests(workspace.id, tests, testRows, checkRun.id);
    }

    const notificationWarnings = await dispatchNotifications(checkRun.id);
    warnings.push(...notificationWarnings);

    await db.checkRun.update({
      where: { id: checkRun.id },
      data: {
        status: warnings.length ? "SUCCEEDED_WITH_WARNINGS" : "SUCCEEDED",
        finishedAt: new Date(),
        errorMessage: warnings.length ? warnings.join("; ") : null,
      },
    });
  } catch (err) {
    await db.checkRun.update({
      where: { id: checkRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  return checkRun.id;
}

async function upsertTests(workspaceDbId: string, tests: DrataMonitoringTest[]) {
  const rows = new Map<string, { id: string }>();
  for (const t of tests) {
    const provider = detectProvider(t.name);
    const row = await db.monitoringTest.upsert({
      where: { drataId: String(t.id) },
      create: {
        drataId: String(t.id),
        testTemplateId: String(t.testId),
        workspaceId: workspaceDbId,
        name: t.name,
        checkResultStatus: t.checkResultStatus ?? null,
        checkStatus: t.checkStatus ?? null,
        source: t.testSource ?? null,
        provider,
        lastCheckedAt: new Date(),
        rawJson: JSON.stringify(t),
      },
      update: {
        name: t.name,
        checkResultStatus: t.checkResultStatus ?? null,
        checkStatus: t.checkStatus ?? null,
        source: t.testSource ?? null,
        provider,
        lastCheckedAt: new Date(),
        rawJson: JSON.stringify(t),
      },
    });
    rows.set(String(t.id), row);
  }
  return rows;
}

async function upsertEvidence(workspaceDbId: string, evidence: DrataEvidence[]) {
  const rows = new Map<string, { id: string }>();
  for (const e of evidence) {
    const row = await db.evidence.upsert({
      where: { drataId: String(e.id) },
      create: {
        drataId: String(e.id),
        workspaceId: workspaceDbId,
        name: e.name,
        status: e.status,
        renewalDate: e.renewalDate ? new Date(e.renewalDate) : null,
        rawJson: JSON.stringify(e),
      },
      update: {
        name: e.name,
        status: e.status,
        renewalDate: e.renewalDate ? new Date(e.renewalDate) : null,
        rawJson: JSON.stringify(e),
      },
    });
    rows.set(String(e.id), row);
  }
  return rows;
}

async function upsertControls(workspaceDbId: string, controls: DrataControl[]) {
  const rows = new Map<string, { id: string }>();
  for (const c of controls) {
    const flags = c.flags ?? {};
    const row = await db.control.upsert({
      where: { drataId: String(c.id) },
      create: {
        drataId: String(c.id),
        workspaceId: workspaceDbId,
        code: c.code,
        name: c.name,
        description: c.description ?? null,
        isReady: Boolean(flags.isReady),
        hasPolicy: Boolean(flags.hasPolicy),
        hasPassingTest: Boolean(flags.hasPassingTest),
        hasEvidence: Boolean(flags.hasEvidence),
        isMonitored: Boolean(flags.isMonitored),
        ownersJson: c.owners ? JSON.stringify(c.owners) : null,
        frameworkTagsJson: c.frameworkTags ? JSON.stringify(c.frameworkTags) : null,
        rawJson: JSON.stringify(c),
      },
      update: {
        code: c.code,
        name: c.name,
        description: c.description ?? null,
        isReady: Boolean(flags.isReady),
        hasPolicy: Boolean(flags.hasPolicy),
        hasPassingTest: Boolean(flags.hasPassingTest),
        hasEvidence: Boolean(flags.hasEvidence),
        isMonitored: Boolean(flags.isMonitored),
        ownersJson: c.owners ? JSON.stringify(c.owners) : null,
        frameworkTagsJson: c.frameworkTags ? JSON.stringify(c.frameworkTags) : null,
        rawJson: JSON.stringify(c),
      },
    });
    rows.set(String(c.id), row);
  }
  return rows;
}

async function linkControlsToTestsAndEvidence(
  controls: DrataControl[],
  controlRows: Map<string, { id: string }>,
  testRows: Map<string, { id: string }>,
  evidenceRows: Map<string, { id: string }>,
) {
  for (const c of controls) {
    const control = controlRows.get(String(c.id));
    if (!control) continue;

    await db.controlTest.deleteMany({ where: { controlId: control.id } });
    const testLinks = (c.testIds ?? [])
      .map((tid) => testRows.get(String(tid)))
      .filter((t): t is { id: string } => Boolean(t));
    if (testLinks.length) {
      await db.controlTest.createMany({
        data: testLinks.map((t) => ({ controlId: control.id, testId: t.id })),
      });
    }

    await db.controlEvidence.deleteMany({ where: { controlId: control.id } });
    const evidenceLinks = (c.evidenceIds ?? [])
      .map((eid) => evidenceRows.get(String(eid)))
      .filter((e): e is { id: string } => Boolean(e));
    if (evidenceLinks.length) {
      await db.controlEvidence.createMany({
        data: evidenceLinks.map((e) => ({ controlId: control.id, evidenceId: e.id })),
      });
    }
  }
}

/**
 * Drata's `isReady` flag is the authoritative pass/fail verdict for a control
 * (it already accounts for policy+test+evidence requirements). We mirror that
 * verdict rather than recompute it, and only use the individual flags plus
 * linked test/evidence status to attribute a best-effort reason.
 */
async function snapshotControls(
  workspaceDbId: string,
  controls: DrataControl[],
  controlRows: Map<string, { id: string }>,
  tests: DrataMonitoringTest[],
  evidence: DrataEvidence[],
  checkRunId: string,
) {
  const testById = new Map(tests.map((t) => [String(t.id), t]));
  const evidenceById = new Map(evidence.map((e) => [String(e.id), e]));

  for (const c of controls) {
    const control = controlRows.get(String(c.id));
    if (!control) continue;
    const flags = c.flags ?? {};
    const status = flags.isReady ? "PASS" : "FAIL";

    let reasonCode: string | null = null;
    let reasonDetail: string | null = null;

    if (status === "FAIL") {
      const failingTest = (c.testIds ?? [])
        .map((tid) => testById.get(String(tid)))
        .find((t) => t && testVerdict(t) === "FAIL");
      const failingEvidence = (c.evidenceIds ?? [])
        .map((eid) => evidenceById.get(String(eid)))
        .find((e) => e && FAILING_EVIDENCE_STATUSES.has(e.status));

      if (!flags.hasPassingTest && failingTest) {
        reasonCode = "TEST_FAILED";
        reasonDetail = failingTest.name;
      } else if (!flags.hasPolicy) {
        reasonCode = "POLICY_NOT_READY";
        reasonDetail = "Control has no approved/published policy";
      } else if (!flags.hasEvidence || failingEvidence) {
        reasonCode = "EVIDENCE_NOT_READY";
        reasonDetail = failingEvidence
          ? `${failingEvidence.name} (${failingEvidence.status})`
          : "Control is missing required evidence";
      } else {
        reasonCode = "NOT_READY";
        reasonDetail = "Not ready per Drata (see control detail)";
      }
    }

    await db.statusSnapshot.create({
      data: {
        entityType: "CONTROL",
        controlId: control.id,
        workspaceId: workspaceDbId,
        status,
        reasonCode,
        reasonDetail,
        checkRunId,
      },
    });
  }
}

async function snapshotTests(
  workspaceDbId: string,
  tests: DrataMonitoringTest[],
  testRows: Map<string, { id: string }>,
  checkRunId: string,
) {
  for (const t of tests) {
    const test = testRows.get(String(t.id));
    if (!test) continue;

    const verdict = testVerdict(t);
    if (!verdict) continue; // no PASS/FAIL verdict yet (disabled, pending, etc.) - don't snapshot it

    await db.statusSnapshot.create({
      data: {
        entityType: "TEST",
        testId: test.id,
        workspaceId: workspaceDbId,
        status: verdict,
        reasonCode: verdict === "FAIL" ? "TEST_FAILED" : null,
        reasonDetail: verdict === "FAIL" ? (t.checkResultStatus ?? "Unknown result") : null,
        checkRunId,
      },
    });
  }
}
