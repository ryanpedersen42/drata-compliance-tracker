"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Tag, Workspace } from "@/lib/types";

interface SeriesPoint {
  checkRunId: string;
  date: string;
  passing: number;
  failing: number;
  total: number;
  passRate: number | null;
}

interface TagFailures {
  tagId: string;
  name: string;
  color: string;
  totalControls: number;
  failingControls: number;
  totalTests: number;
  failingTests: number;
}

export default function TrendsPage() {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [byTag, setByTag] = useState<TagFailures[]>([]);
  const [latestAt, setLatestAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [tagId, setTagId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspaceId", workspaceId);
    if (tagId) params.set("tagId", tagId);
    const res = await fetch(`/api/trends?${params}`);
    const json = await res.json();
    setSeries(json.series);
    setByTag(json.byTag);
    setLatestAt(json.latestCheckRunAt);
    setLoading(false);
  }, [workspaceId, tagId]);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then(setWorkspaces);
    fetch("/api/tags").then((r) => r.json()).then(setTags);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxFailures = Math.max(1, ...byTag.map((t) => t.failingControls + t.failingTests));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Trends</h1>
        <p className="text-sm text-neutral-500">
          {latestAt
            ? `Based on ${series.length} check run(s), most recent ${new Date(latestAt).toLocaleString()}.`
            : "No check history yet — run a check to start building trends."}
        </p>
      </div>

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
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Control pass rate over time</h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-sm text-neutral-400">Loading…</div>
        ) : series.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-neutral-400">Not enough history yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                tick={{ fontSize: 12, fill: "#737373" }}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#737373" }} unit="%" />
              <Tooltip
                formatter={(value) => [`${value}%`, "Pass rate"]}
                labelFormatter={(d) => new Date(String(d)).toLocaleString()}
              />
              <Line type="monotone" dataKey="passRate" stroke="#059669" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Current failures by tag</h2>
        {byTag.length === 0 ? (
          <div className="py-6 text-center text-sm text-neutral-400">
            No tagged controls or tests have failures right now.
          </div>
        ) : (
          <div className="space-y-2">
            {byTag.map((t) => {
              const totalFailing = t.failingControls + t.failingTests;
              return (
                <div key={t.tagId} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm font-medium truncate" style={{ color: t.color }}>
                    {t.name}
                  </span>
                  <div className="flex-1 h-5 bg-neutral-100 rounded">
                    <div
                      className="h-5 rounded"
                      style={{ width: `${(totalFailing / maxFailures) * 100}%`, backgroundColor: t.color, opacity: 0.8 }}
                    />
                  </div>
                  <span className="w-40 shrink-0 text-xs text-neutral-500 text-right">
                    {t.failingControls}/{t.totalControls} controls, {t.failingTests}/{t.totalTests} tests
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
