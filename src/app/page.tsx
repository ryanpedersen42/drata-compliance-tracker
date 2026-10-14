"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { TagPicker } from "@/components/TagPicker";
import type { ControlListItem, ControlDetail, Tag, Workspace } from "@/lib/types";

export default function ControlsPage() {
  const [controls, setControls] = useState<ControlListItem[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [latestCheckAt, setLatestCheckAt] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState("");
  const [tagId, setTagId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<ControlDetail | null>(null);

  const loadTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    setTags(await res.json());
  }, []);

  const loadControls = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspaceId", workspaceId);
    if (tagId) params.set("tagId", tagId);
    if (status) params.set("status", status);
    if (q) params.set("q", q);

    const res = await fetch(`/api/controls?${params}`);
    const json = await res.json();
    setControls(json.controls);
    setLatestCheckAt(json.latestCheckRun?.startedAt ?? null);
    setLoading(false);
  }, [workspaceId, tagId, status, q]);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then(setWorkspaces);
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    loadControls();
  }, [loadControls]);

  async function loadDetail(id: string) {
    const res = await fetch(`/api/controls/${id}`);
    setDetail(await res.json());
  }

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    setDetail(null);
    await loadDetail(id);
  }

  async function runCheckNow() {
    setSyncing(true);
    setSyncError(null);
    const res = await fetch("/api/sync", { method: "POST" });
    const json = await res.json();
    setSyncing(false);
    if (!json.ok) {
      setSyncError(json.error);
      return;
    }
    await loadControls();
    if (expanded) await loadDetail(expanded);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold">Controls</h1>
          <p className="text-sm text-neutral-500">
            {latestCheckAt
              ? `Last checked ${new Date(latestCheckAt).toLocaleString()}`
              : "No check has run yet — run one below."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncError && <span className="text-sm text-red-600">{syncError}</span>}
          <button
            onClick={runCheckNow}
            disabled={syncing}
            className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium disabled:opacity-50"
          >
            {syncing ? "Running…" : "Run check now"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center bg-white border border-neutral-200 rounded-lg p-3">
        <select
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="text-sm border border-neutral-300 rounded-md px-2 py-1.5"
        >
          <option value="">All workspaces</option>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          value={tagId}
          onChange={(e) => setTagId(e.target.value)}
          className="text-sm border border-neutral-300 rounded-md px-2 py-1.5"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-neutral-300 rounded-md px-2 py-1.5"
        >
          <option value="">All statuses</option>
          <option value="PASS">Passing</option>
          <option value="FAIL">Failing</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or code…"
          className="text-sm border border-neutral-300 rounded-md px-2 py-1.5 flex-1 min-w-[180px]"
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Control</th>
              <th className="text-left px-4 py-2 font-medium">Workspace</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Reason</th>
              <th className="text-left px-4 py-2 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && controls.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  No controls synced yet. Add a Drata API key in Settings and run a check.
                </td>
              </tr>
            )}
            {controls.map((c) => (
              <Fragment key={c.id}>
                <tr
                  onClick={() => toggleExpand(c.id)}
                  className="border-t border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{c.code}</div>
                    <div className="text-neutral-500 text-xs">{c.name}</div>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{c.workspaceName}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{c.reasonDetail ?? "—"}</td>
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <TagPicker
                      entityType="CONTROL"
                      entityId={c.id}
                      tags={c.tags}
                      allTags={tags}
                      onChange={loadControls}
                    />
                  </td>
                </tr>
                {expanded === c.id && (
                  <tr className="border-t border-neutral-100 bg-neutral-50/50">
                    <td colSpan={5} className="px-4 py-3">
                      {!detail && <div className="text-sm text-neutral-400">Loading tests…</div>}
                      {detail && detail.id === c.id && (
                        <div className="space-y-3">
                          {detail.tests.length === 0 ? (
                            <div className="text-sm text-neutral-400">No monitoring tests linked to this control.</div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead className="text-neutral-400 uppercase tracking-wide">
                                <tr>
                                  <th className="text-left py-1 font-medium">Test</th>
                                  <th className="text-left py-1 font-medium">Result</th>
                                  <th className="text-left py-1 font-medium">Tags</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.tests.map((t) => (
                                  <tr key={t.id} className="border-t border-neutral-200">
                                    <td className="py-1.5 pr-4">{t.name}</td>
                                    <td className="py-1.5 pr-4">
                                      <StatusBadge status={t.status} />
                                    </td>
                                    <td className="py-1.5">
                                      <TagPicker
                                        entityType="TEST"
                                        entityId={t.id}
                                        tags={t.tags}
                                        allTags={tags}
                                        onChange={() => loadDetail(c.id)}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {detail.evidence.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-neutral-500 mb-1">Evidence</div>
                              <ul className="text-xs text-neutral-600 space-y-0.5">
                                {detail.evidence.map((e) => (
                                  <li key={e.id}>
                                    {e.name} — <span className="font-medium">{e.status}</span>
                                    {e.renewalDate && ` (renews ${new Date(e.renewalDate).toLocaleDateString()})`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
