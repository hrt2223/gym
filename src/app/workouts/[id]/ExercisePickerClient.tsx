"use client";

import { useMemo, useState } from "react";

type PartKey = "胸" | "背中" | "肩" | "腕" | "脚" | "腹" | "未分類";

type ExerciseOption = { id: string; name: string };

export function ExercisePickerClient({
  name,
  groups,
  placeholder,
  value,
  onChange,
}: {
  name: string;
  placeholder: string;
  groups: Array<{ key: PartKey; options: ExerciseOption[] }>;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [q, setQ] = useState<string>("");

  const filteredGroups = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return groups;

    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => o.name.toLowerCase().includes(query)),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, q]);

  return (
    <div className="w-full space-y-2">
      <input
        className="w-full rounded-xl border px-3 py-2 text-sm"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="種目検索"
      />
      <select
        name={name}
        className="w-full rounded-xl border px-3 py-2"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {filteredGroups.map((g) => (
          <optgroup key={g.key} label={`${g.key}（${g.options.length}）`}>
            {g.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
