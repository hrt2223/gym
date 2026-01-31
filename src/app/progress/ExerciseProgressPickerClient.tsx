"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ExerciseOption = { id: string; name: string; target_parts: string[] };

const PART_ORDER = ["胸", "背中", "肩", "腕", "脚", "腹"] as const;

type PartKey = (typeof PART_ORDER)[number] | "未分類";

export function ExerciseProgressPickerClient({
  exercises,
  selectedId,
}: {
  exercises: ExerciseOption[];
  selectedId: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState<string>("");

  const grouped = useMemo(() => {
    const map = new Map<PartKey, ExerciseOption[]>();
    for (const e of exercises ?? []) {
      const first = (e.target_parts ?? [])[0];
      const key: PartKey = (PART_ORDER as readonly string[]).includes(String(first))
        ? (first as PartKey)
        : "未分類";
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }

    const keys: PartKey[] = [
      ...PART_ORDER.filter((p) => (map.get(p) ?? []).length > 0),
      ...(map.get("未分類")?.length ? (["未分類"] as PartKey[]) : []),
    ];

    for (const k of keys) {
      const arr = map.get(k) ?? [];
      arr.sort((a, b) => a.name.localeCompare(b.name, "ja"));
      map.set(k, arr);
    }

    return { keys, map };
  }, [exercises]);

  const trimmed = q.trim().toLowerCase();

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-xl border px-3 py-2 text-sm"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="種目検索"
      />

      <select
        className="w-full rounded-xl border px-3 py-2 text-sm"
        value={selectedId}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) {
            router.push("/progress");
            return;
          }
          router.push(`/progress?exerciseId=${encodeURIComponent(next)}`);
        }}
      >
        <option value="">種目を選択</option>
        {grouped.keys.map((k) => {
          const opts = (grouped.map.get(k) ?? []).filter((opt) => {
            if (!trimmed) return true;
            return opt.name.toLowerCase().includes(trimmed);
          });
          if (opts.length === 0) return null;
          return (
            <optgroup key={k} label={`${k}（${opts.length}）`}>
              {opts.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>

      <div className="text-xs text-muted-foreground">
        ベストセット（重量が高い→同重量なら回数が多い）で推移を表示します。
      </div>
    </div>
  );
}
