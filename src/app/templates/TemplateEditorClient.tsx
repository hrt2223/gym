"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ExerciseOption = { id: string; name: string };

type Template = {
  id: string;
  name: string;
  exercises: Array<{
    exercise_id: string;
    sets: Array<{ set_order: number; weight: number | null; reps: number | null }>;
  }>;
};

type DraftSet = { key: string; weight: string; reps: string };

type DraftExercise = { key: string; exerciseId: string; sets: DraftSet[] };

type DraftTemplate = { id?: string; name: string; exercises: DraftExercise[] };

function makeKey(): string {
  return Math.random().toString(16).slice(2);
}

function toDraft(template: Template | null): DraftTemplate {
  if (!template) {
    return { name: "", exercises: [] };
  }

  return {
    id: template.id,
    name: template.name,
    exercises: template.exercises.map((ex) => ({
      key: makeKey(),
      exerciseId: ex.exercise_id,
      sets: (ex.sets ?? []).map((s) => ({
        key: makeKey(),
        weight: s.weight == null ? "" : String(s.weight),
        reps: s.reps == null ? "" : String(s.reps),
      })),
    })),
  };
}

function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function TemplateEditorClient({
  templates,
  exercises,
  onSave,
  onDelete,
}: {
  templates: Template[];
  exercises: ExerciseOption[];
  onSave: (input: {
    templateId?: string;
    name: string;
    exercises: Array<{
      exerciseId: string;
      sets: Array<{ set_order: number; weight: number | null; reps: number | null }>;
    }>;
  }) => Promise<void>;
  onDelete: (input: { templateId: string }) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? "");
  const [draft, setDraft] = useState<DraftTemplate>(() => toDraft(templates[0] ?? null));
  const [newExerciseId, setNewExerciseId] = useState<string>("");
  const router = useRouter();

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  useEffect(() => {
    setDraft(toDraft(selected));
  }, [selected]);

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold">テンプレ編集</div>

      <div className="flex gap-2">
        <select
          className="w-full rounded-xl border px-3 py-2 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">テンプレを選択</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {selectedId && (
          <button
            type="button"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm text-red-600 disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              if (!selectedId) return;
              if (!window.confirm("このテンプレを削除しますか？")) return;
              startTransition(async () => {
                await onDelete({ templateId: selectedId });
                setSelectedId("");
                router.refresh();
              });
            }}
          >
            削除
          </button>
        )}
      </div>

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
                {exercises.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
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
        <select
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
          value={newExerciseId}
          onChange={(e) => setNewExerciseId(e.target.value)}
        >
          <option value="">追加する種目</option>
          {exercises.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
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
          if (!name) {
            window.alert("テンプレ名を入力してください");
            return;
          }
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
            await onSave({
              templateId: draft.id,
              name,
              exercises: exercisesPayload,
            });
            router.refresh();
          });
        }}
      >
        保存
      </button>
    </div>
  );
}
