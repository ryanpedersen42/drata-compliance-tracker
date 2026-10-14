import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { DrataClient } from "@/lib/drata";
import { postRichMessage, replyInThread } from "@/lib/slack";
import { createIssue, addComment } from "@/lib/jira";
import * as linear from "@/lib/linear";
import { parseCredentials, type SlackCredentials, type JiraCredentials, type LinearCredentials } from "@/lib/connections";
import { type TemplateVars, DEFAULT_TITLE_TEMPLATE, DEFAULT_DESCRIPTION_TEMPLATE, renderTemplate } from "@/lib/templateVars";

const DEFAULT_MAX_NEW_PER_RUN = 25;
const FAILING_TEST_RESULTS = new Set(["FAILED", "ERROR"]);

type ChannelType = "SLACK" | "JIRA" | "LINEAR";
type RuleConnection = { channelType: ChannelType; credentialsJson: string };

interface SlackConfig {
  channel: string;
}

interface TicketTemplates {
  titleTemplate?: string;
  descriptionTemplate?: string;
}

interface JiraRuleConfig extends TicketTemplates {
  projectKey: string;
  issueType: string;
  additionalFields?: Record<string, unknown>;
}

interface LinearRuleConfig extends TicketTemplates {
  teamId: string;
  projectId?: string;
}

type TargetEntity = {
  entityType: "CONTROL" | "TEST";
  id: string;
  status: "PASS" | "FAIL";
  vars: Omit<TemplateVars, "ruleName">;
};

/** Evaluates every enabled notification rule against the given check run and sends/updates alerts. Never throws - failures are collected as warnings. */
export async function dispatchNotifications(checkRunId: string): Promise<string[]> {
  const warnings: string[] = [];
  const rules = await db.notificationRule.findMany({ where: { enabled: true }, include: { connection: true } });

  for (const rule of rules) {
    try {
      await dispatchRule(rule, checkRunId, warnings);
    } catch (err) {
      warnings.push(`rule "${rule.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return warnings;
}

async function dispatchRule(
  rule: {
    id: string;
    name: string;
    tagId: string | null;
    workspaceId: string | null;
    entityType: "CONTROL" | "TEST" | null;
    provider: string | null;
    configJson: string;
    connection: RuleConnection;
  },
  checkRunId: string,
  warnings: string[],
) {
  const targets = await resolveTargets(rule, checkRunId);
  const logs = await db.notificationLog.findMany({
    where: { ruleId: rule.id, OR: targets.map((t) => (t.entityType === "CONTROL" ? { controlId: t.id } : { testId: t.id })) },
  });
  const logByEntity = new Map(logs.map((l) => [l.controlId ?? l.testId!, l]));

  let newCount = 0;
  const maxNew = DEFAULT_MAX_NEW_PER_RUN;

  for (const target of targets) {
    const log = logByEntity.get(target.id);

    if (target.status === "FAIL") {
      if (!log || log.state === "RESOLVED") {
        if (newCount >= maxNew) {
          warnings.push(`rule "${rule.name}" hit its per-run cap (${maxNew}) of new alerts - some failures weren't notified this run`);
          continue;
        }
        newCount++;
        await sendNew(rule, target);
      } else {
        await sendStillFailing(rule, target, log);
      }
    } else if (log && log.state === "OPEN") {
      await sendResolved(rule, target, log);
    }
  }
}

export async function resolveTargets(
  rule: { tagId: string | null; workspaceId: string | null; entityType: "CONTROL" | "TEST" | null; provider?: string | null },
  checkRunId: string,
): Promise<TargetEntity[]> {
  // The provider filter only means anything for Tests (it's inferred per
  // monitoring test, not per control), so a rule scoped to a provider is
  // implicitly Tests-only even if its own entityType is unset.
  const entityTypes: ("CONTROL" | "TEST")[] = rule.provider ? ["TEST"] : rule.entityType ? [rule.entityType] : ["CONTROL", "TEST"];
  const targets: TargetEntity[] = [];
  const workspaceNames = new Map((await db.workspace.findMany({ select: { id: true, name: true } })).map((w) => [w.id, w.name]));

  for (const entityType of entityTypes) {
    let idFilter: string[] | undefined;
    if (rule.tagId) {
      const assignments = await db.tagAssignment.findMany({
        where: { tagId: rule.tagId, entityType },
        select: { controlId: true, testId: true },
      });
      idFilter = assignments.map((a) => (entityType === "CONTROL" ? a.controlId : a.testId)!).filter(Boolean);
      if (idFilter.length === 0) continue;
    }

    if (entityType === "CONTROL") {
      const snapshots = await db.statusSnapshot.findMany({
        where: {
          checkRunId,
          entityType: "CONTROL",
          ...(rule.workspaceId ? { workspaceId: rule.workspaceId } : {}),
          ...(idFilter ? { controlId: { in: idFilter } } : {}),
        },
        include: { control: { include: { tagAssignments: { include: { tag: true } } } } },
      });
      for (const s of snapshots) {
        const c = s.control;
        if (!c) continue;
        targets.push({
          entityType: "CONTROL",
          id: c.id,
          status: s.status,
          vars: {
            code: c.code,
            name: c.name,
            label: `${c.code} — ${c.name}`,
            status: s.status,
            reasonCode: s.reasonCode ?? "",
            reasonDetail: s.reasonDetail ?? "",
            workspace: workspaceNames.get(s.workspaceId) ?? "",
            tags: c.tagAssignments.map((a) => a.tag.name).join(", "),
            entityType: "Control",
            providerName: "",
            failureCount: "",
            failureDetails: "",
          },
        });
      }
    } else {
      const snapshots = await db.statusSnapshot.findMany({
        where: {
          checkRunId,
          entityType: "TEST",
          ...(rule.workspaceId ? { workspaceId: rule.workspaceId } : {}),
          ...(idFilter ? { testId: { in: idFilter } } : {}),
          ...(rule.provider ? { test: { provider: rule.provider } } : {}),
        },
        include: { test: { include: { tagAssignments: { include: { tag: true } } } } },
      });
      for (const s of snapshots) {
        const t = s.test;
        if (!t) continue;
        targets.push({
          entityType: "TEST",
          id: t.id,
          status: s.status,
          vars: {
            code: "",
            name: t.name,
            label: t.name,
            status: s.status,
            reasonCode: s.reasonCode ?? "",
            reasonDetail: s.reasonDetail ?? "",
            workspace: workspaceNames.get(s.workspaceId) ?? "",
            tags: t.tagAssignments.map((a) => a.tag.name).join(", "),
            entityType: "Test",
            providerName: "",
            failureCount: "",
            failureDetails: "",
          },
        });
      }
    }
  }

  return targets;
}

interface TestRef {
  workspaceDrataId: string;
  testTemplateId: string;
}

/** For a TEST target, that test; for a CONTROL target, one of its linked tests that's currently failing (if any). */
async function findTestRef(target: TargetEntity): Promise<TestRef | null> {
  if (target.entityType === "TEST") {
    const test = await db.monitoringTest.findUnique({ where: { id: target.id }, include: { workspace: true } });
    if (!test) return null;
    return { workspaceDrataId: test.workspace.drataId, testTemplateId: test.testTemplateId };
  }

  const links = await db.controlTest.findMany({
    where: { controlId: target.id },
    include: { test: { include: { workspace: true } } },
  });
  const failing = links.find((l) => l.test.checkResultStatus && FAILING_TEST_RESULTS.has(l.test.checkResultStatus));
  if (!failing) return null;
  return { workspaceDrataId: failing.test.workspace.drataId, testTemplateId: failing.test.testTemplateId };
}

/** Renders an arbitrarily-shaped value (string, number, nested array/object - Drata's fact engine produces all of these) into one readable, bounded-length snippet. */
function safeStringify(value: unknown, maxLen = 120): string {
  let text: string;
  if (value === null || value === undefined) text = "";
  else if (typeof value === "string") text = value;
  else if (typeof value === "number" || typeof value === "boolean") text = String(value);
  else if (Array.isArray(value)) text = value.map((v) => safeStringify(v, maxLen)).join(", ");
  else text = JSON.stringify(value);

  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

/**
 * Drata's `cause` field isn't a plain string - for cloud-provider checks it's
 * an array of evaluated facts (e.g. `{ fact: "accessKey1LastRotated", value:
 * 90, operator: "withinLastDays", factResult: "2024-03-25T18:28:24Z" }`),
 * and `factResult` itself can be a nested array/object. This renders
 * whatever shape shows up into one readable, bounded-length line.
 */
function formatCause(cause: unknown): string {
  if (!cause) return "";
  if (typeof cause === "string") return cause;
  if (Array.isArray(cause)) {
    const joined = cause
      .slice(0, 3)
      .map((c) => {
        if (c && typeof c === "object" && "fact" in c) {
          const fc = c as { fact?: string; operator?: string; value?: unknown; factResult?: unknown };
          return `${fc.fact} ${fc.operator} ${fc.value} (actual: ${safeStringify(fc.factResult, 60)})`;
        }
        return safeStringify(c, 60);
      })
      .join("; ");
    return cause.length > 3 ? `${joined}; …` : joined;
  }
  return safeStringify(cause, 200);
}

/** Pulls the individual failing resources (e.g. specific S3 buckets, users) for a ticket's body. Best-effort: any failure just means the ticket goes out without this detail. */
export async function buildFailureVars(
  target: TargetEntity,
): Promise<Pick<TemplateVars, "failureCount" | "failureDetails" | "providerName">> {
  const empty = { failureCount: "", failureDetails: "", providerName: "" };
  try {
    const settings = await getSettings();
    if (!settings.drataApiKey) return empty;

    const ref = await findTestRef(target);
    if (!ref) return empty;

    const client = new DrataClient(settings.drataApiKey);
    const { items, totalCount } = await client.listTestFailures(ref.workspaceDrataId, ref.testTemplateId, 5);
    if (items.length === 0) return { failureCount: "0", failureDetails: "", providerName: "" };

    const details = items
      .map((f) => {
        const head = [f.resourceName ?? String(f.id), f.region, f.providerName].filter(Boolean).join(" · ");
        const cause = formatCause(f.cause);
        return cause ? `- ${head}: ${cause}` : `- ${head}`;
      })
      .join("\n");

    return {
      failureCount: String(totalCount ?? items.length),
      failureDetails: details,
      providerName: items[0]?.providerName ?? "",
    };
  } catch {
    return empty;
  }
}

async function sendNew(
  rule: { id: string; name: string; configJson: string; connection: RuleConnection },
  target: TargetEntity,
) {
  const failureVars = await buildFailureVars(target);
  const vars: TemplateVars = { ...target.vars, ...failureVars, ruleName: rule.name };
  let externalRef: string;

  if (rule.connection.channelType === "SLACK") {
    const config: SlackConfig = JSON.parse(rule.configJson);
    const { token } = parseCredentials<SlackCredentials>(rule.connection);
    externalRef = await postRichMessage(token, config.channel, {
      fallbackText: `🔴 ${vars.label} is failing`,
      headerText: `🔴 ${vars.label}`,
      color: "#dc2626",
      fields: [
        { label: "Status", value: vars.status },
        { label: "Reason", value: vars.reasonDetail },
        { label: "Workspace", value: vars.workspace },
        { label: "Tags", value: vars.tags },
        { label: "Provider", value: vars.providerName },
        { label: "Failing resources", value: vars.failureCount },
        { label: "Rule", value: rule.name },
      ],
    });
  } else if (rule.connection.channelType === "JIRA") {
    const config: JiraRuleConfig = JSON.parse(rule.configJson);
    const jiraConfig = parseCredentials<JiraCredentials>(rule.connection);
    externalRef = await createIssue(jiraConfig, {
      projectKey: config.projectKey,
      issueType: config.issueType,
      summary: renderTemplate(config.titleTemplate || DEFAULT_TITLE_TEMPLATE, vars),
      description: renderTemplate(config.descriptionTemplate || DEFAULT_DESCRIPTION_TEMPLATE, vars),
      labels: jiraLabelsFor(vars),
      additionalFields: config.additionalFields,
    });
  } else {
    const config: LinearRuleConfig = JSON.parse(rule.configJson);
    const { apiKey } = parseCredentials<LinearCredentials>(rule.connection);
    const issue = await linear.createIssue(apiKey, {
      teamId: config.teamId,
      projectId: config.projectId,
      title: renderTemplate(config.titleTemplate || DEFAULT_TITLE_TEMPLATE, vars),
      description: renderTemplate(config.descriptionTemplate || DEFAULT_DESCRIPTION_TEMPLATE, vars),
    });
    externalRef = issue.id;
  }

  await db.notificationLog.upsert({
    where: entityWhere(rule.id, target),
    create: {
      ruleId: rule.id,
      entityType: target.entityType,
      controlId: target.entityType === "CONTROL" ? target.id : null,
      testId: target.entityType === "TEST" ? target.id : null,
      state: "OPEN",
      externalRef,
    },
    update: { state: "OPEN", externalRef, lastNotifiedAt: new Date() },
  });
}

async function sendStillFailing(
  rule: { connection: RuleConnection; configJson: string },
  target: TargetEntity,
  log: { id: string; externalRef: string | null },
) {
  if (!log.externalRef) return;
  const reason = target.vars.reasonDetail ? ` (${target.vars.reasonDetail})` : "";
  await sendFollowUp(rule, log.externalRef, `Still failing as of today${reason}.`);
  await db.notificationLog.update({ where: { id: log.id }, data: { lastNotifiedAt: new Date() } });
}

async function sendResolved(
  rule: { connection: RuleConnection; configJson: string },
  target: TargetEntity,
  log: { id: string; externalRef: string | null },
) {
  if (log.externalRef) {
    await sendFollowUp(rule, log.externalRef, `✅ Resolved: ${target.vars.label} is passing again.`);
  }
  await db.notificationLog.update({ where: { id: log.id }, data: { state: "RESOLVED", lastNotifiedAt: new Date() } });
}

/** Posts a follow-up (thread reply / comment) to an already-open alert. `externalRef` is channel-specific: a Slack message ts, a Jira issue key, or a Linear issue id. */
async function sendFollowUp(rule: { connection: RuleConnection; configJson: string }, externalRef: string, text: string) {
  if (rule.connection.channelType === "SLACK") {
    const config: SlackConfig = JSON.parse(rule.configJson);
    const { token } = parseCredentials<SlackCredentials>(rule.connection);
    await replyInThread(token, config.channel, externalRef, text);
  } else if (rule.connection.channelType === "JIRA") {
    const jiraConfig = parseCredentials<JiraCredentials>(rule.connection);
    await addComment(jiraConfig, externalRef, text);
  } else {
    const { apiKey } = parseCredentials<LinearCredentials>(rule.connection);
    await linear.addComment(apiKey, externalRef, text);
  }
}

/** Jira labels can't contain spaces or most punctuation; this carries the entity's tags and provider over as labels, each sanitized into a valid one. */
function jiraLabelsFor(vars: TemplateVars): string[] {
  const raw = ["compliance-tracker", vars.providerName, ...vars.tags.split(",").map((t) => t.trim())];
  return [...new Set(raw.filter(Boolean).map((t) => t.replace(/[^a-zA-Z0-9_.-]+/g, "-")))];
}

function entityWhere(ruleId: string, target: TargetEntity) {
  return target.entityType === "CONTROL"
    ? { ruleId_controlId: { ruleId, controlId: target.id } }
    : { ruleId_testId: { ruleId, testId: target.id } };
}
