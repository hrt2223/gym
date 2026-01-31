"use client";

import { useMemo, useState, useTransition } from "react";
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

export function WorkoutTemplateClient({
  templates,
  exercises,
  currentExerciseCount,
  onApply,
  onSaveFromWorkout,
  onDelete,
}: {
  templates: Template[];
  exercises: ExerciseOption[];
  currentExerciseCount: number;
  onApply: (input: { templateId: string }) => Promise<void>;
  onSaveFromWorkout: (input: { name: string }) => Promise<void>;
  onDelete: (input: { templateId: string }) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? "");
  const [name, setName] = useState<string>("");
  const router = useRouter();

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const exerciseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of exercises) map.set(e.id, e.name);
    return map;
  }, [exercises]);

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">????</div>

      <div className="flex gap-2">
        <select
          className="w-full rounded-xl border px-3 py-2 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">???????</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.exercises.length})
            </option>
          ))}
        </select>

        <button
          type="button"
          className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-50"
          disabled={!selected || selected.exercises.length === 0 || isPending}
          onClick={() => {
            if (!selected) return;
            startTransition(async () => {
              await onApply({ templateId: selected.id });
              router.refresh();
            });
          }}
        >
          ??
        </button>
      </div>

      {selected && selected.exercises.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selected.exercises
            .slice(0, 6)
            .map((ex) => exerciseNameById.get(ex.exercise_id) ?? "(??)")
            .join(" / ")}
          {selected.exercises.length > 6 && ` / +${selected.exercises.length - 6}`}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="?????"
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="rounded-xl border border-border bg-background px-4 py-2 text-sm"
          onClick={() => {
            if (currentExerciseCount === 0) {
              window.alert("?????????????");
              return;
            }
            const trimmed = name.trim();
            if (!trimmed) {
              window.alert("??????????????");
              return;
            }
            startTransition(async () => {
              await onSaveFromWorkout({ name: trimmed });
              setName("");
              router.refresh();
            });
          }}
        >
          ???????????
        </button>

        <button
          type="button"
          className="rounded-xl border border-border bg-background px-4 py-2 text-sm text-red-600 disabled:opacity-50"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return;
            if (!window.confirm("????????????")) return;
            startTransition(async () => {
              await onDelete({ templateId: selectedId });
              setSelectedId("");
              router.refresh();
            });
          }}
        >
          ??
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        ?????????????????
      </div>
    </div>
  );
}
