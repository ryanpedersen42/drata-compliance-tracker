"use client";

import { useRef } from "react";
import { TEMPLATE_FIELDS } from "@/lib/templateVars";

const TOKEN_PATTERN = /(\{\{\s*\w+\s*\}\})/g;

function renderHighlighted(text: string) {
  return text.split(TOKEN_PATTERN).map((part, i) =>
    /^\{\{\s*\w+\s*\}\}$/.test(part) ? (
      <mark key={i} className="bg-indigo-100 text-indigo-700 rounded">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const FIELD_CLASSES = "w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5 font-mono";

/**
 * A text input/textarea that highlights `{{field}}` tokens inline, plus a
 * dropdown that inserts one at the cursor - so it's clear at a glance which
 * parts of a template are live Drata data versus literal text.
 */
export function TemplatedField({
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 6,
  defaultTemplate,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  /** When given, shows a "Reset to default" action that restores this text. */
  defaultTemplate?: string;
}) {
  const elRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  function insertField(key: string) {
    const el = elRef.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const controlClassName = `${FIELD_CLASSES} relative bg-transparent text-transparent caret-neutral-900 placeholder:text-neutral-400 resize-none`;

  return (
    <div className="space-y-1">
      <div className="relative">
        <div
          aria-hidden
          className={`${FIELD_CLASSES} absolute inset-0 border-transparent whitespace-pre-wrap break-words overflow-hidden pointer-events-none`}
        >
          {renderHighlighted(value)}
          {multiline ? "\n" : ""}
        </div>
        {multiline ? (
          <textarea
            ref={(node) => {
              elRef.current = node;
            }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className={controlClassName}
          />
        ) : (
          <input
            ref={(node) => {
              elRef.current = node;
            }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={controlClassName}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) insertField(e.target.value);
          }}
          className="text-xs border border-neutral-200 rounded-md px-1.5 py-1 text-neutral-500 bg-neutral-50"
        >
          <option value="">+ Insert field…</option>
          {TEMPLATE_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        {defaultTemplate !== undefined && value !== defaultTemplate && (
          <button type="button" onClick={() => onChange(defaultTemplate)} className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline">
            Reset to default
          </button>
        )}
      </div>
    </div>
  );
}
