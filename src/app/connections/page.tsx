"use client";

import { useEffect, useState, useCallback } from "react";

interface ConnectionSummary {
  id: string;
  name: string;
  channelType: "SLACK" | "JIRA" | "LINEAR";
  createdAt: string;
  _count: { rules: number };
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState<"SLACK" | "JIRA" | "LINEAR">("SLACK");
  const [slackToken, setSlackToken] = useState("");
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [linearApiKey, setLinearApiKey] = useState("");

  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/connections");
    setConnections(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createConnection(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const credentials =
      channelType === "SLACK"
        ? { token: slackToken }
        : channelType === "JIRA"
          ? { baseUrl: jiraBaseUrl, email: jiraEmail, apiToken: jiraApiToken }
          : { apiKey: linearApiKey };

    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, channelType, credentials }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to create connection.");
      return;
    }
    setName("");
    setSlackToken("");
    setJiraBaseUrl("");
    setJiraEmail("");
    setJiraApiToken("");
    setLinearApiKey("");
    await load();
  }

  async function testConnection(id: string) {
    setTestingId(id);
    const res = await fetch(`/api/connections/${id}/test`, { method: "POST" });
    const json = await res.json();
    setTestingId(null);
    setTestResults((prev) => ({ ...prev, [id]: json.ok ? json.detail : `Failed: ${json.error}` }));
  }

  async function deleteConnection(id: string) {
    const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error ?? "Failed to delete connection.");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">Connections</h1>
        <p className="text-sm text-neutral-500">
          Named credentials for Slack, Jira, or Linear. Add more than one of the same type — e.g. separate
          Linear workspaces for a parent company and a subsidiary — and notification rules pick which one to
          use.
        </p>
      </div>

      <form onSubmit={createConnection} className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Linear - Main Co"
              className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Type</label>
            <select
              value={channelType}
              onChange={(e) => setChannelType(e.target.value as "SLACK" | "JIRA" | "LINEAR")}
              className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
            >
              <option value="SLACK">Slack</option>
              <option value="JIRA">Jira</option>
              <option value="LINEAR">Linear</option>
            </select>
          </div>
        </div>

        {channelType === "SLACK" && (
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Bot User OAuth Token</label>
            <input
              type="password"
              value={slackToken}
              onChange={(e) => setSlackToken(e.target.value)}
              required
              placeholder="xoxb-…"
              className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
            />
            <p className="text-xs text-neutral-400 mt-1">
              From a Slack app with the <code>chat:write</code> scope, installed to the workspace.
            </p>
          </div>
        )}

        {channelType === "JIRA" && (
          <div className="space-y-2">
            <input
              value={jiraBaseUrl}
              onChange={(e) => setJiraBaseUrl(e.target.value)}
              required
              placeholder="https://your-domain.atlassian.net"
              className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
            />
            <input
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
            />
            <input
              type="password"
              value={jiraApiToken}
              onChange={(e) => setJiraApiToken(e.target.value)}
              required
              placeholder="API token"
              className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
            />
          </div>
        )}

        {channelType === "LINEAR" && (
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">API key</label>
            <input
              type="password"
              value={linearApiKey}
              onChange={(e) => setLinearApiKey(e.target.value)}
              required
              placeholder="lin_api_…"
              className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
            />
            <p className="text-xs text-neutral-400 mt-1">From Linear → Settings → API, for this workspace.</p>
          </div>
        )}

        <button type="submit" className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium">
          Add connection
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
        {connections.length === 0 && <div className="px-4 py-6 text-center text-neutral-400 text-sm">No connections yet.</div>}
        {connections.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{c.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 shrink-0">{c.channelType}</span>
              </div>
              <div className="text-xs text-neutral-500">
                {c._count.rules} rule{c._count.rules === 1 ? "" : "s"} using this
                {testResults[c.id] && <span className="ml-2">· {testResults[c.id]}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => testConnection(c.id)} disabled={testingId === c.id} className="text-xs px-2 py-1 rounded-md border border-neutral-300 disabled:opacity-50">
                {testingId === c.id ? "Testing…" : "Test"}
              </button>
              <button onClick={() => deleteConnection(c.id)} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
