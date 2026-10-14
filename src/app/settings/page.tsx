"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface SettingsResponse {
  hasDrataApiKey: boolean;
  scheduleEnabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  scheduleTimezone: string;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const COMMON_TIMEZONES = (() => {
  // "UTC" itself isn't always part of Intl.supportedValuesOf("timeZone"),
  // but it's a universally valid zone name and a sane default, so it's
  // pinned to the top regardless of what the browser's list contains.
  try {
    return ["UTC", ...Intl.supportedValuesOf("timeZone")];
  } catch {
    return [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Berlin",
      "Asia/Tokyo",
    ];
  }
})();

interface CheckRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  trigger: string;
  errorMessage: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [runs, setRuns] = useState<CheckRun[]>([]);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("06:00");
  const [scheduleTimezone, setScheduleTimezone] = useState("UTC");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    const json: SettingsResponse = await res.json();
    setSettings(json);
    setScheduleEnabled(json.scheduleEnabled);
    setScheduleTime(`${pad2(json.scheduleHour)}:${pad2(json.scheduleMinute)}`);
    setScheduleTimezone(json.scheduleTimezone);
  }, []);

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/sync");
    setRuns(await res.json());
  }, []);

  useEffect(() => {
    loadSettings();
    loadRuns();
  }, [loadSettings, loadRuns]);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setSaveMessage(null);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drataApiKey: apiKey }),
    });
    setApiKey("");
    setSaving(false);
    setSaveMessage("Saved.");
    await loadSettings();
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/settings/test-connection", { method: "POST" });
    const json = await res.json();
    setTesting(false);
    setTestResult(
      json.ok ? `Connected — found ${json.workspaceCount} workspace(s).` : `Failed: ${json.error}`,
    );
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSavingSchedule(true);
    setScheduleMessage(null);
    const [hourStr, minuteStr] = scheduleTime.split(":");
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduleEnabled,
        scheduleHour: Number(hourStr),
        scheduleMinute: Number(minuteStr),
        scheduleTimezone,
      }),
    });
    setSavingSchedule(false);
    setScheduleMessage("Saved.");
    await loadSettings();
  }

  async function runCheckNow() {
    setSyncing(true);
    setSyncError(null);
    const res = await fetch("/api/sync", { method: "POST" });
    const json = await res.json();
    setSyncing(false);
    if (!json.ok) setSyncError(json.error);
    await loadRuns();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold">Settings</h1>

      <section className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Drata API key</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Generated in Drata under Settings → API, with read access to controls, monitoring tests,
            policies, evidence, and workspaces. Stored in this app&apos;s local database only.
          </p>
        </div>

        <div className="text-sm">
          Status:{" "}
          {settings?.hasDrataApiKey ? (
            <span className="text-emerald-700 font-medium">Key configured</span>
          ) : (
            <span className="text-amber-700 font-medium">Not configured</span>
          )}
        </div>

        <form onSubmit={saveKey} className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings?.hasDrataApiKey ? "Enter a new key to replace it" : "Paste your Drata API key"}
            className="flex-1 text-sm border border-neutral-300 rounded-md px-2 py-1.5"
          />
          <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
        {saveMessage && <p className="text-xs text-emerald-700">{saveMessage}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={testConnection} disabled={testing || !settings?.hasDrataApiKey} className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm font-medium disabled:opacity-50">
            {testing ? "Testing…" : "Test connection"}
          </button>
          {testResult && <span className="text-xs text-neutral-600">{testResult}</span>}
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-4 space-y-2">
        <h2 className="text-sm font-semibold">Slack / Jira / Linear</h2>
        <p className="text-xs text-neutral-500">
          Credentials for notification channels now live under{" "}
          <Link href="/connections" className="underline text-neutral-700">
            Connections
          </Link>
          , where you can add more than one of the same type (e.g. separate Linear workspaces for a parent
          company and a subsidiary).
        </p>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Scheduled checks</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Runs the same check automatically once a day, so status history builds up without you having to
            remember to click anything.
          </p>
        </div>

        <form onSubmit={saveSchedule} className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Run daily
          </label>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Time</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              disabled={!scheduleEnabled}
              className="text-sm border border-neutral-300 rounded-md px-2 py-1.5 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Timezone</label>
            <select
              value={scheduleTimezone}
              onChange={(e) => setScheduleTimezone(e.target.value)}
              disabled={!scheduleEnabled}
              className="text-sm border border-neutral-300 rounded-md px-2 py-1.5 disabled:opacity-50 max-w-[200px]"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={savingSchedule} className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm font-medium disabled:opacity-50">
            {savingSchedule ? "Saving…" : "Save schedule"}
          </button>
          {scheduleMessage && <span className="text-xs text-emerald-700">{scheduleMessage}</span>}
        </form>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Checks</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Pulls controls, tests, policies, and evidence from Drata and records status. You can also
              trigger one on demand here.
            </p>
          </div>
          <button onClick={runCheckNow} disabled={syncing} className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap">
            {syncing ? "Running…" : "Run check now"}
          </button>
        </div>
        {syncError && <p className="text-xs text-red-600">{syncError}</p>}

        <table className="w-full text-xs mt-2">
          <thead className="text-neutral-400 uppercase tracking-wide">
            <tr>
              <th className="text-left py-1 font-medium">Started</th>
              <th className="text-left py-1 font-medium">Trigger</th>
              <th className="text-left py-1 font-medium">Status</th>
              <th className="text-left py-1 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-center text-neutral-400">No checks have run yet.</td></tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="py-1.5 pr-4">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="py-1.5 pr-4">{r.trigger}</td>
                <td className="py-1.5 pr-4">{r.status}</td>
                <td className="py-1.5 text-red-600">{r.errorMessage ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
