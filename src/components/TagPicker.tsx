"use client";

import { useState, useRef, useEffect } from "react";
import { TagChip } from "@/components/TagChip";
import type { Tag, TagRef } from "@/lib/types";

export function TagPicker({
  entityType,
  entityId,
  tags,
  allTags,
  onChange,
}: {
  entityType: "CONTROL" | "TEST";
  entityId: string;
  tags: TagRef[];
  allTags: Tag[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const assignedIds = new Set(tags.map((t) => t.tagId));
  const available = allTags.filter((t) => !assignedIds.has(t.id));

  async function assign(tagId: string) {
    await fetch("/api/tag-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId, entityType, entityId }),
    });
    setOpen(false);
    onChange();
  }

  async function unassign(assignmentId: string) {
    await fetch(`/api/tag-assignments?id=${assignmentId}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 relative" ref={ref}>
      {tags.map((t) => (
        <TagChip key={t.assignmentId} name={t.name} color={t.color} onRemove={() => unassign(t.assignmentId)} />
      ))}
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-1.5 py-0.5 rounded-full border border-dashed border-neutral-300 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
      >
        + tag
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-10 w-48 max-h-60 overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg py-1">
          {available.length === 0 && (
            <div className="px-3 py-1.5 text-xs text-neutral-400">No more tags</div>
          )}
          {available.map((t) => (
            <button
              key={t.id}
              onClick={() => assign(t.id)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-50 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
