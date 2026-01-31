"use client";

import { useMemo, useState, useTransition } from "react";
import {
  deleteWorkoutTemplate,
  loadWorkoutTemplates,
  upsertWorkoutTemplate,
  type WorkoutTemplate,
} from "@/lib/workoutTemplates";

type ExerciseOption = { id: string; name: string };

export function WorkoutTemplateClient({
  workoutId,
  workoutExerciseIds,
  exercises,
  onApply,
}: {
  workoutId: string;
  workoutExerciseIds: string[];
  exercises: ExerciseOption[];
  onApply: (input: { workoutId: string; exerciseIds: string[] }) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(() => loadWorkoutTemplates());
  const [selectedId, setSelectedId] = useState<string>("");

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const exerciseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of exercises) map.set(e.id, e.name);
    return map;
  }, [exercises]);

  const currentMenuCount = workoutExerciseIds.length;

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">テンプレ</div>

      <div className="flex gap-2">
        <select
          className="w-full rounded-xl border px-3 py-2 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">テンプレを選択</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}（{t.exerciseIds.length}）
            </option>
          ))}
        </select>

        <button
          type="button"
          className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-50"
          disabled={!selected || selected.exerciseIds.length === 0 || isPending}
          onClick={() => {
            if (!selected) return;
            startTransition(() => onApply({ workoutId, exerciseIds: selected.exerciseIds }));
          }}
        >
          追加
        </button>
      </div>

      {selected && selected.exerciseIds.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selected.exerciseIds
            .slice(0, 6)
            .map((id) => exerciseNameById.get(id) ?? "(種目)")
            .join(" / ")}
          {selected.exerciseIds.length > 6 && ` / ＋${selected.exerciseIds.length - 6}`}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl border border-border bg-background px-4 py-2 text-sm"
          onClick={() => {
            if (currentMenuCount === 0) {
              window.alert("まずこのワークアウトに種目を追加してください");
              return;
            }

            const name = window.prompt("テンプレ名", "いつものメニュー");
            if (name == null) return;
            const trimmed = name.trim();
            if (!trimmed) return;

            upsertWorkoutTemplate({ name: trimmed, exerciseIds: workoutExerciseIds });
            const next = loadWorkoutTemplates();
            setTemplates(next);
            setSelectedId(next[0]?.id ?? "");
          }}
        >
          このメニューを保存
        </button>

        <button
          type="button"
          className="rounded-xl border border-border bg-background px-4 py-2 text-sm text-red-600 disabled:opacity-50"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return;
            if (!window.confirm("このテンプレを削除しますか？")) return;
            deleteWorkoutTemplate(selectedId);
            const next = loadWorkoutTemplates();
            setTemplates(next);
            setSelectedId("");
          }}
        >
          削除
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        テンプレはこの端末（ブラウザ）に保存されます。
      </div>
    </div>
  );
}
