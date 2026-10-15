"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { TagPicker } from "@/components/TagPicker";
import type { TestListItem, Tag, Workspace } from "@/lib/types";

export default function TestsPage() {
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [workspaceId, setWorkspaceId] = useState("");
  const [tagId, setTagId] = useState("");
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const [checkStatus, setCheckStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTests = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspaceId", workspaceId);
    if (tagId) params.set("tagId", tagId);
    if (status) params.set("status", status);
    if (provider) params.set("provider", provider);
    if (checkStatus) params.set("checkStatus", checkStatus);
    if (q) params.set("q", q);

    const res = await fetch(`/api/tests?${params}`);
    const json = await res.json();
    setTests(json.tests);
    setLoading(false);
  }, [workspaceId, tagId, status, provider, checkStatus, q]);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then(setWorkspaces);
    fetch("/api/tags").then((r) => r.json()).then(setTags);
    fetch("/api/providers").then((r) => r.json()).then(setProviders);
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Monitoring Tests</h1>

      <div className="flex flex-wrap gap-2 items-center bg-white border border-neutral-200 rounded-lg p-3">
        <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="text-sm border border-neutral-300 rounded-md px-2 py-1.5">
          <option value="">All workspaces</option>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="text-sm border border-neutral-300 rounded-md px-2 py-1.5">
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm border border-neutral-300 rounded-md px-2 py-1.5">
          <option value="">All statuses</option>
          <option value="PASS">Passing</option>
          <option value="FAIL">Failing</option>
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="text-sm border border-neutral-300 rounded-md px-2 py-1.5">
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={checkStatus} onChange={(e) => setCheckStatus(e.target.value)} className="text-sm border border-neutral-300 rounded-md px-2 py-1.5">
          <option value="">Enabled & disabled</option>
          <option value="ENABLED">Enabled</option>
          <option value="DISABLED">Disabled</option>
          <option value="TESTING">Testing</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tests…" className="text-sm border border-neutral-300 rounded-md px-2 py-1.5 flex-1 min-w-[180px]" />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Test</th>
              <th className="text-left px-4 py-2 font-medium">Workspace</th>
              <th className="text-left px-4 py-2 font-medium">Provider</th>
              <th className="text-left px-4 py-2 font-medium">Enabled</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Controls</th>
              <th className="text-left px-4 py-2 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-400">Loading…</td></tr>
            )}
            {!loading && tests.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-400">No tests synced yet.</td></tr>
            )}
            {tests.map((t) => (
              <tr key={t.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2 text-neutral-600">{t.workspaceName}</td>
                <td className="px-4 py-2 text-neutral-600 text-xs">{t.provider ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-600 text-xs">{t.checkStatus ?? "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-2 text-neutral-600 text-xs">
                  {t.controls.map((c) => c.code).join(", ") || "—"}
                </td>
                <td className="px-4 py-2">
                  <TagPicker entityType="TEST" entityId={t.id} tags={t.tags} allTags={tags} onChange={loadTests} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
