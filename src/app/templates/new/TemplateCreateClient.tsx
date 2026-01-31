"use client";

import { useMemo, useState, useTransition } from "react";

type ExerciseOption = { id: string; name: string; target_parts: string[] };

type DraftSet = { key: string; weight: string; reps: string };

type DraftExercise = { key: string; exerciseId: string; sets: DraftSet[] };

type DraftTemplate = { name: string; exercises: DraftExercise[] };

const PART_ORDER = ["胸", "背中", "肩", "腕", "脚", "腹"] as const;

type PartKey = (typeof PART_ORDER)[number] | "未分類";

function makeKey(): string {
  return Math.random().toString(16).slice(2);
}

function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function TemplateCreateClient({
  exercises,
  onCreate,
}: {
  exercises: ExerciseOption[];
  onCreate: (input: {
    name: string;
    exercises: Array<{
      exerciseId: string;
      sets: Array<{ set_order: number; weight: number | null; reps: number | null }>;
    }>;
  }) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DraftTemplate>({ name: "", exercises: [] });
  const [newExerciseId, setNewExerciseId] = useState<string>("");
  const [exerciseSearch, setExerciseSearch] = useState<string>("");

  const groupedExercises = useMemo(() => {
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

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold">新規テンプレ作成</div>

      <div>
        <label className="text-xs text-muted-foreground">テンプレ名</label>
        <input
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          value={draft.name}
          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="例: 胸の日"
        />
      </div>

      <div className="space-y-3">
        {draft.exercises.map((ex, exIndex) => (
          <div key={ex.key} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <select
                className="w-full rounded-lg border px-2 py-1 text-sm"
                value={ex.exerciseId}
                onChange={(e) => {
                  const next = e.target.value;
                  setDraft((prev) => {
                    const copy = [...prev.exercises];
                    copy[exIndex] = { ...copy[exIndex], exerciseId: next };
                    return { ...prev, exercises: copy };
                  });
                }}
              >
                <option value="">種目を選択</option>
                {groupedExercises.keys.map((k) => (
                  <optgroup key={k} label={`${k}（${(groupedExercises.map.get(k) ?? []).length}）`}>
                    {(groupedExercises.map.get(k) ?? []).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                className="shrink-0 rounded-lg border px-2 py-1 text-xs text-red-600"
                onClick={() => {
                  setDraft((prev) => ({
                    ...prev,
                    exercises: prev.exercises.filter((_, i) => i != exIndex),
                  }));
                }}
              >
                削除
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {ex.sets.map((s, sIndex) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">{sIndex + 1}セット</div>
                  <input
                    className="w-24 rounded-lg border px-2 py-1 text-sm"
                    placeholder="kg"
                    value={s.weight}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDraft((prev) => {
                        const exCopy = [...prev.exercises];
                        const setsCopy = [...exCopy[exIndex].sets];
                        setsCopy[sIndex] = { ...setsCopy[sIndex], weight: next };
                        exCopy[exIndex] = { ...exCopy[exIndex], sets: setsCopy };
                        return { ...prev, exercises: exCopy };
                      });
                    }}
                  />
                  <input
                    className="w-20 rounded-lg border px-2 py-1 text-sm"
                    placeholder="回"
                    value={s.reps}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDraft((prev) => {
                        const exCopy = [...prev.exercises];
                        const setsCopy = [...exCopy[exIndex].sets];
                        setsCopy[sIndex] = { ...setsCopy[sIndex], reps: next };
                        exCopy[exIndex] = { ...exCopy[exIndex], sets: setsCopy };
                        return { ...prev, exercises: exCopy };
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border px-2 py-1 text-xs"
                    onClick={() => {
                      setDraft((prev) => {
                        const exCopy = [...prev.exercises];
                        const setsCopy = exCopy[exIndex].sets.filter((_, i) => i != sIndex);
                        exCopy[exIndex] = { ...exCopy[exIndex], sets: setsCopy };
                        return { ...prev, exercises: exCopy };
                      });
                    }}
                  >
                    -
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-xs"
                onClick={() => {
                  setDraft((prev) => {
                    const exCopy = [...prev.exercises];
                    const setsCopy = [...exCopy[exIndex].sets];
                    setsCopy.push({ key: makeKey(), weight: "", reps: "" });
                    exCopy[exIndex] = { ...exCopy[exIndex], sets: setsCopy };
                    return { ...prev, exercises: exCopy };
                  });
                }}
              >
                セット＋
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm"
          value={exerciseSearch}
          onChange={(e) => setExerciseSearch(e.target.value)}
          placeholder="種目検索（追加用）"
        />
        <select
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
          value={newExerciseId}
          onChange={(e) => setNewExerciseId(e.target.value)}
        >
          <option value="">追加する種目</option>
          {groupedExercises.keys.map((k) => (
            <optgroup key={k} label={`${k}（${(groupedExercises.map.get(k) ?? []).length}）`}>
              {(groupedExercises.map.get(k) ?? [])
                .filter((opt) => {
                  const q = exerciseSearch.trim().toLowerCase();
                  if (!q) return true;
                  return opt.name.toLowerCase().includes(q);
                })
                .map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          className="rounded-xl border border-border bg-background px-4 py-2 text-sm"
          onClick={() => {
            if (!newExerciseId) return;
            setDraft((prev) => ({
              ...prev,
              exercises: [
                ...prev.exercises,
                {
                  key: makeKey(),
                  exerciseId: newExerciseId,
                  sets: [
                    { key: makeKey(), weight: "", reps: "" },
                    { key: makeKey(), weight: "", reps: "" },
                    { key: makeKey(), weight: "", reps: "" },
                  ],
                },
              ],
            }));
            setNewExerciseId("");
            setExerciseSearch("");
          }}
        >
          追加
        </button>
      </div>

      <button
        type="button"
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground disabled:opacity-50"
        disabled={isPending}
        onClick={() => {
          const name = draft.name.trim();
          const finalName = name || "無題テンプレ";

          const exercisesPayload = draft.exercises
            .filter((ex) => ex.exerciseId.trim().length > 0)
            .map((ex) => ({
              exerciseId: ex.exerciseId,
              sets: ex.sets.map((s, sIndex) => ({
                set_order: sIndex,
                weight: parseNumber(s.weight),
                reps: parseNumber(s.reps),
              })),
            }));

          startTransition(async () => {
            await onCreate({ name: finalName, exercises: exercisesPayload });
          });
        }}
      >
        新規作成
      </button>

      <div className="text-xs text-muted-foreground">
        作成後に、テンプレ一覧（編集画面）へ移動します。
      </div>
    </div>
  );
}
