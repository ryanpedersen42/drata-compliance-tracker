"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Tag, Workspace } from "@/lib/types";
import { TemplatedField } from "@/components/TemplatedField";
import { DEFAULT_TITLE_TEMPLATE, DEFAULT_DESCRIPTION_TEMPLATE } from "@/lib/templateVars";

interface ConnectionRef {
  id: string;
  name: string;
  channelType: "SLACK" | "JIRA" | "LINEAR";
}

interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  tagId: string | null;
  tag: Tag | null;
  workspaceId: string | null;
  entityType: "CONTROL" | "TEST" | null;
  provider: string | null;
  connectionId: string;
  connection: ConnectionRef;
  configJson: string;
}

interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

interface LinearProject {
  id: string;
  name: string;
}

export default function NotificationsPage() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [connections, setConnections] = useState<ConnectionRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [tagId, setTagId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [entityType, setEntityType] = useState<"" | "CONTROL" | "TEST">("");
  const [providers, setProviders] = useState<string[]>([]);
  const [provider, setProvider] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [slackChannel, setSlackChannel] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [jiraIssueType, setJiraIssueType] = useState("Task");
  const [linearTeams, setLinearTeams] = useState<LinearTeam[]>([]);
  const [linearTeamId, setLinearTeamId] = useState("");
  const [linearProjects, setLinearProjects] = useState<LinearProject[]>([]);
  const [linearProjectId, setLinearProjectId] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [titleTemplate, setTitleTemplate] = useState("");
  const [descriptionTemplate, setDescriptionTemplate] = useState("");

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ title: string; description: string; usingSampleData: boolean; sourceLabel: string | null } | null>(null);

  const selectedConnection = connections.find((c) => c.id === connectionId);

  const load = useCallback(async () => {
    const [rulesRes, tagsRes, workspacesRes, connectionsRes, providersRes] = await Promise.all([
      fetch("/api/notification-rules"),
      fetch("/api/tags"),
      fetch("/api/workspaces"),
      fetch("/api/connections"),
      fetch("/api/providers"),
    ]);
    setRules(await rulesRes.json());
    setTags(await tagsRes.json());
    setWorkspaces(await workspacesRes.json());
    setConnections(await connectionsRes.json());
    setProviders(await providersRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedConnection?.channelType !== "LINEAR") {
      setLinearTeams([]);
      setLinearTeamId("");
      return;
    }
    fetch(`/api/linear-teams?connectionId=${connectionId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setLinearTeams);
  }, [connectionId, selectedConnection?.channelType]);

  useEffect(() => {
    if (!linearTeamId || !connectionId) {
      setLinearProjects([]);
      setLinearProjectId("");
      return;
    }
    fetch(`/api/linear-projects?connectionId=${connectionId}&teamId=${linearTeamId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setLinearProjects);
  }, [connectionId, linearTeamId]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedConnection) {
      setError("Pick a connection.");
      return;
    }

    const templates = {
      ...(titleTemplate.trim() ? { titleTemplate: titleTemplate.trim() } : {}),
      ...(descriptionTemplate.trim() ? { descriptionTemplate: descriptionTemplate.trim() } : {}),
    };

    const config =
      selectedConnection.channelType === "SLACK"
        ? { channel: slackChannel }
        : selectedConnection.channelType === "JIRA"
          ? { projectKey: jiraProjectKey, issueType: jiraIssueType, ...templates }
          : { teamId: linearTeamId, ...(linearProjectId ? { projectId: linearProjectId } : {}), ...templates };

    const res = await fetch("/api/notification-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        tagId: tagId || null,
        workspaceId: workspaceId || null,
        entityType: entityType || null,
        provider: provider || null,
        connectionId,
        config,
      }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to create rule.");
      return;
    }
    setName("");
    setProvider("");
    setSlackChannel("");
    setJiraProjectKey("");
    setLinearProjectId("");
    setTitleTemplate("");
    setDescriptionTemplate("");
    setShowAdvanced(false);
    setPreview(null);
    await load();
  }

  function toggleAdvanced() {
    setShowAdvanced((wasOpen) => {
      if (!wasOpen) {
        // Opening: start from the real default template text (not just a
        // placeholder) so there's something usable to edit right away.
        if (!titleTemplate.trim()) setTitleTemplate(DEFAULT_TITLE_TEMPLATE);
        if (!descriptionTemplate.trim()) setDescriptionTemplate(DEFAULT_DESCRIPTION_TEMPLATE);
      }
      return !wasOpen;
    });
  }

  async function showPreview() {
    setPreviewing(true);
    const res = await fetch("/api/notification-rules/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagId: tagId || null,
        workspaceId: workspaceId || null,
        entityType: entityType || null,
        provider: provider || null,
        titleTemplate,
        descriptionTemplate,
      }),
    });
    setPreview(await res.json());
    setPreviewing(false);
  }

  async function toggleEnabled(rule: NotificationRule) {
    await fetch(`/api/notification-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    await load();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/notification-rules/${id}`, { method: "DELETE" });
    await load();
  }

  function describeScope(rule: NotificationRule): string {
    const parts: string[] = [];
    parts.push(rule.entityType ? (rule.entityType === "CONTROL" ? "Controls" : "Tests") : "Controls & Tests");
    if (rule.tag) parts.push(`tagged "${rule.tag.name}"`);
    const workspaceName = workspaces.find((w) => w.id === rule.workspaceId)?.name;
    if (workspaceName) parts.push(`in ${workspaceName}`);
    if (rule.provider) parts.push(`(${rule.provider} only)`);
    return parts.join(" ");
  }

  function describeConfig(rule: NotificationRule): string {
    const config = JSON.parse(rule.configJson);
    if (rule.connection.channelType === "SLACK") return `#${config.channel.replace(/^#/, "")}`;
    if (rule.connection.channelType === "JIRA") return `${config.projectKey} / ${config.issueType}`;
    return "Linear team";
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-sm text-neutral-500">
          When a check finds something newly failing in scope, post to Slack or open a Jira/Linear ticket via
          one of your <Link href="/connections" className="underline">connections</Link>. An ongoing failure
          gets a thread reply or comment on later runs instead of a new alert each time, and it&apos;s marked
          resolved once the check passes again.
        </p>
      </div>

      {connections.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 text-sm text-neutral-500">
          No connections yet.{" "}
          <Link href="/connections" className="underline text-neutral-700">
            Add a Slack, Jira, or Linear connection
          </Link>{" "}
          before creating a rule.
        </div>
      ) : (
        <form onSubmit={createRule} className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Rule name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Infra team failures"
                className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Applies to</label>
              <select
                value={entityType}
                onChange={(e) => {
                  const next = e.target.value as "" | "CONTROL" | "TEST";
                  setEntityType(next);
                  if (next === "CONTROL") setProvider("");
                }}
                className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
              >
                <option value="">Controls & Tests</option>
                <option value="CONTROL">Controls only</option>
                <option value="TEST">Tests only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Tag (optional)</label>
              <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5">
                <option value="">Any tag</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Workspace (optional)</label>
              <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5">
                <option value="">Any workspace</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Provider (optional)</label>
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  if (e.target.value) setEntityType("TEST");
                }}
                disabled={entityType === "CONTROL" || providers.length === 0}
                className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5 disabled:opacity-50"
              >
                <option value="">Any provider</option>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {providers.length === 0 ? (
                <p className="text-xs text-neutral-400 mt-1">No providers detected in synced tests yet.</p>
              ) : (
                provider && <p className="text-xs text-neutral-400 mt-1">Narrows this rule to Tests only.</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Connection</label>
            <select
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              required
              className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5 mb-2"
            >
              <option value="">Select a connection…</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.channelType})</option>
              ))}
            </select>

            {selectedConnection?.channelType === "SLACK" && (
              <input
                value={slackChannel}
                onChange={(e) => setSlackChannel(e.target.value)}
                required
                placeholder="#compliance-alerts or channel ID"
                className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
              />
            )}

            {selectedConnection?.channelType === "JIRA" && (
              <div className="flex gap-2">
                <input
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value)}
                  required
                  placeholder="Project key, e.g. SEC"
                  className="flex-1 text-sm border border-neutral-300 rounded-md px-2 py-1.5"
                />
                <input
                  value={jiraIssueType}
                  onChange={(e) => setJiraIssueType(e.target.value)}
                  required
                  placeholder="Issue type, e.g. Task"
                  className="flex-1 text-sm border border-neutral-300 rounded-md px-2 py-1.5"
                />
              </div>
            )}

            {selectedConnection?.channelType === "LINEAR" &&
              (linearTeams.length === 0 ? (
                <p className="text-xs text-amber-700">No teams found for this Linear connection.</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={linearTeamId}
                    onChange={(e) => setLinearTeamId(e.target.value)}
                    required
                    className="flex-1 text-sm border border-neutral-300 rounded-md px-2 py-1.5"
                  >
                    <option value="">Select a team…</option>
                    {linearTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.key} — {t.name}</option>
                    ))}
                  </select>
                  <select
                    value={linearProjectId}
                    onChange={(e) => setLinearProjectId(e.target.value)}
                    disabled={!linearTeamId}
                    className="flex-1 text-sm border border-neutral-300 rounded-md px-2 py-1.5 disabled:opacity-50"
                  >
                    <option value="">No project</option>
                    {linearProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ))}
          </div>

          {(selectedConnection?.channelType === "JIRA" || selectedConnection?.channelType === "LINEAR") && (
            <div>
              <button
                type="button"
                onClick={toggleAdvanced}
                className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline"
              >
                {showAdvanced ? "Hide" : "Customize"} ticket title &amp; description
              </button>
              {showAdvanced && (
                <div className="mt-2 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Title template</label>
                    <TemplatedField
                      value={titleTemplate}
                      onChange={setTitleTemplate}
                      placeholder={DEFAULT_TITLE_TEMPLATE}
                      defaultTemplate={DEFAULT_TITLE_TEMPLATE}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Description template</label>
                    <TemplatedField
                      value={descriptionTemplate}
                      onChange={setDescriptionTemplate}
                      placeholder={DEFAULT_DESCRIPTION_TEMPLATE}
                      defaultTemplate={DEFAULT_DESCRIPTION_TEMPLATE}
                      multiline
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={showPreview}
                      disabled={previewing}
                      className="text-xs px-2 py-1 rounded-md border border-neutral-300 disabled:opacity-50"
                    >
                      {previewing ? "Loading preview…" : "Preview"}
                    </button>
                    {preview && (
                      <div className="mt-2 bg-neutral-50 border border-neutral-200 rounded-md p-3 space-y-2">
                        <p className="text-xs text-neutral-500">
                          {preview.usingSampleData
                            ? "No current failure matches this scope — showing example data."
                            : `Using real data from: ${preview.sourceLabel}`}
                        </p>
                        <div>
                          <div className="text-xs font-medium text-neutral-500">Title</div>
                          <div className="text-sm font-mono whitespace-pre-wrap">{preview.title}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-neutral-500">Description</div>
                          <div className="text-sm font-mono whitespace-pre-wrap">{preview.description}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button type="submit" className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium">
            Add rule
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
        {rules.length === 0 && <div className="px-4 py-6 text-center text-neutral-400 text-sm">No notification rules yet.</div>}
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{rule.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 shrink-0">
                  {rule.connection.name}
                </span>
              </div>
              <div className="text-xs text-neutral-500 truncate">
                {describeScope(rule)} → {describeConfig(rule)}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                <input type="checkbox" checked={rule.enabled} onChange={() => toggleEnabled(rule)} />
                Enabled
              </label>
              <button onClick={() => deleteRule(rule.id)} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
