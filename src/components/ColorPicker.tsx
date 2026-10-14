"use client";

import { useEffect, useRef, useState } from "react";
import { TAG_PALETTE } from "@/lib/colors";

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose tag color"
        className="w-9 h-9 rounded-md border border-neutral-300 flex items-center justify-center"
      >
        <span className="w-5 h-5 rounded-full" style={{ backgroundColor: value }} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-10 w-44 rounded-md border border-neutral-200 bg-white shadow-lg p-2">
          <div className="grid grid-cols-5 gap-1.5">
            {TAG_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                aria-label={`Use color ${c}`}
                className="w-6 h-6 rounded-full"
                style={{
                  backgroundColor: c,
                  boxShadow: value === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                }}
              />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500 border-t border-neutral-100 pt-2 cursor-pointer">
            Custom…
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-5 w-8 border border-neutral-300 rounded cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
}
