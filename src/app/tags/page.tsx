"use client";

import { useEffect, useState, useCallback } from "react";
import type { Tag } from "@/lib/types";
import { TAG_PALETTE, nextTagColor } from "@/lib/colors";
import { ColorPicker } from "@/components/ColorPicker";

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(TAG_PALETTE[0]);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/tags");
    const loaded: Tag[] = await res.json();
    setTags(loaded);
    setColor(nextTagColor(loaded.length));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to create tag.");
      return;
    }
    setName("");
    await load(); // also advances the suggested color for the next tag
  }

  async function deleteTag(id: string) {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    setConfirmingId(null);
    await load();
  }

  function startEdit(t: Tag) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor(t.color);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setEditError(null);
    const res = await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setEditError(json.error ?? "Failed to save changes.");
      return;
    }
    setEditingId(null);
    await load();
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-semibold">Tags</h1>
      <p className="text-sm text-neutral-500">
        Group controls and tests by team, framework, severity, or anything else, then filter the dashboard
        and build notification rules off of them.
      </p>

      <form onSubmit={createTag} className="flex items-end gap-2 bg-white border border-neutral-200 rounded-lg p-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-500 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. team-infra, soc2-critical"
            className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5"
          />
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <button type="submit" className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium">
          Add tag
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
        {tags.length === 0 && <div className="px-4 py-6 text-center text-neutral-400 text-sm">No tags yet.</div>}
        {tags.map((t) =>
          editingId === t.id ? (
            <div key={t.id} className="flex items-center gap-2 px-4 py-2.5">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 text-sm border border-neutral-300 rounded-md px-2 py-1"
                autoFocus
              />
              <ColorPicker value={editColor} onChange={setEditColor} />
              <button onClick={() => saveEdit(t.id)} className="text-xs text-emerald-700 font-medium hover:underline">
                Save
              </button>
              <button onClick={() => setEditingId(null)} className="text-xs text-neutral-500 hover:underline">
                Cancel
              </button>
              {editError && <span className="text-xs text-red-600">{editError}</span>}
            </div>
          ) : (
            <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="text-sm font-medium">{t.name}</span>
                <span className="text-xs text-neutral-400">{t._count?.assignments ?? 0} assigned</span>
              </div>
              {confirmingId === t.id ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500">Remove from all controls/tests?</span>
                  <button onClick={() => deleteTag(t.id)} className="text-red-600 font-medium hover:underline">
                    Confirm
                  </button>
                  <button onClick={() => setConfirmingId(null)} className="text-neutral-500 hover:underline">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-xs">
                  <button onClick={() => startEdit(t)} className="text-neutral-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => setConfirmingId(t.id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
