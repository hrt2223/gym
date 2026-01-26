"use client";

import { useMemo, useState } from "react";

const PARTS = ["胸", "背中", "肩", "腕", "脚", "腹"] as const;

export function PartPicker({
  initial = [],
  onChange,
}: {
  initial?: string[];
  onChange?: (parts: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial)
  );

  const value = useMemo(() => JSON.stringify(Array.from(selected)), [selected]);

  return (
    <div>
      <label className="text-xs text-muted-foreground">効く部位（任意・複数可）</label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {PARTS.map((p) => {
          const active = selected.has(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(p)) next.delete(p);
                  else next.add(p);
                  onChange?.(Array.from(next));
                  return next;
                });
              }}
              className={`rounded-xl border border-border px-3 py-2 text-sm ${
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "bg-background"
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="target_parts" value={value} />
    </div>
  );
}
