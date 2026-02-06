import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { SetRowClient } from "./SetRowClient";
import { WorkoutAutoSaveForm } from "./WorkoutAutoSaveForm";
import { WorkoutTemplateClient } from "./WorkoutTemplateClient";
import { AddExerciseClient } from "./AddExerciseClient";
import {
  addSet as repoAddSet,
  addWorkoutExercise,
  applyWorkoutTemplateToWorkout,
  deleteWorkoutTemplate as repoDeleteWorkoutTemplate,
  copyPreviousSets as repoCopyPreviousSets,
  deleteWorkout as repoDeleteWorkout,
  deleteSet as repoDeleteSet,
  deleteWorkoutExercise,
  getWorkout,
  listExercises,
  listPreviousTopSetsBefore,
  listSetsByWorkoutExerciseIds,
  listWorkoutExercises,
  listWorkoutTemplates,
  saveWorkoutTemplate,
  updateSet as repoUpdateSet,
  updateWorkout as repoUpdateWorkout,
} from "@/lib/repo";

export const revalidate = 10;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkoutEditPage({ params }: PageProps) {
  const { id } = await params;

  const user = await requireUser();
  
  // 全データを最大限並列取得（2段階 → 1段階に統合）
  const [workout, exercises, workoutExercises, templates] = await Promise.all([
    getWorkout(user.id, id),
    listExercises(user.id),
    listWorkoutExercises({ userId: user.id, workoutId: id }),
    listWorkoutTemplates(user.id),
  ]);

  if (!workout) {
    redirect("/");
  }

  const workoutRecord = workout;

  const PART_ORDER = ["胸", "背中", "肩", "腕", "脚", "腹"] as const;
  type PartKey = (typeof PART_ORDER)[number] | "未分類";
  type Exercise = NonNullable<typeof exercises>[number];

  const groupedExercises = new Map<PartKey, Exercise[]>();
  for (const e of exercises ?? []) {
    const first = (e.target_parts ?? [])[0];
    const key: PartKey = (PART_ORDER as readonly string[]).includes(String(first))
      ? (first as PartKey)
      : "未分類";
    const arr = groupedExercises.get(key) ?? [];
    arr.push(e);
    groupedExercises.set(key, arr);
  }

  const exerciseGroupKeys: PartKey[] = [
    ...PART_ORDER.filter((p) => (groupedExercises.get(p) ?? []).length > 0),
    ...(groupedExercises.get("未分類")?.length ? (["未分類"] as PartKey[]) : []),
  ];

  const workoutExerciseIds = (workoutExercises ?? []).map((we) => we.id);
  const exerciseIds = (workoutExercises ?? []).map((we) => we.exercise_id);
  
  // セット情報と前回記録を並列取得
  const [setsByWorkoutExerciseId, prevTopByExerciseId] = await Promise.all([
    listSetsByWorkoutExerciseIds({ workoutExerciseIds }),
    listPreviousTopSetsBefore({
      userId: user.id,
      beforeWorkout: { workoutDate: workoutRecord.workout_date, createdAt: workoutRecord.created_at },
      exerciseIds,
    }),
  ]);


  async function autoSaveWorkout(input: {
    id: string;
    workoutDate: string;
    memo: string | null;
    previousWorkoutDate: string;
  }) {
    "use server";

    const user = await requireUser();
    await repoUpdateWorkout({
      userId: user.id,
      id: input.id,
      workoutDate: input.workoutDate,
      memo: input.memo,
    });

    const prevDate = input.previousWorkoutDate || workoutRecord.workout_date;
    const dateChanged = prevDate !== input.workoutDate;

    if (dateChanged) {
      revalidatePath("/");
      revalidatePath(`/day/${prevDate}`);
      revalidatePath(`/day/${input.workoutDate}`);
    }
  }

  async function addExercise(exerciseId: string) {
    "use server";

    try {
      const user = await requireUser();

      if (!exerciseId) {
        return;
      }

      await addWorkoutExercise({ userId: user.id, workoutId: id, exerciseId });

      revalidatePath(`/workouts/${id}`);
    } catch (error) {
      console.error("addExercise failed:", error);
      throw new Error("種目の追加に失敗しました");
    }
  }

  async function removeWorkoutExercise(formData: FormData) {
    "use server";

    try {
      const workoutExerciseId = String(formData.get("workout_exercise_id") || "");

      await requireUser();
      await deleteWorkoutExercise({ workoutExerciseId });
      revalidatePath(`/workouts/${id}`);
    } catch (error) {
      console.error("removeWorkoutExercise failed:", error);
      throw new Error("種目の削除に失敗しました");
    }
  }

  async function deleteWorkout() {
    "use server";

    const user = await requireUser();
    await repoDeleteWorkout({ userId: user.id, workoutId: id });
    revalidatePath("/");
    revalidatePath(`/day/${workoutRecord.workout_date}`);
    redirect(`/day/${workoutRecord.workout_date}`);
  }

  async function applyTemplate(input: { templateId: string }) {
    "use server";

    try {
      const user = await requireUser();
      await applyWorkoutTemplateToWorkout({
        userId: user.id,
        workoutId: id,
        templateId: input.templateId,
      });

      revalidatePath(`/workouts/${id}`);
    } catch (error) {
      console.error("applyTemplate failed:", error);
      throw new Error("テンプレの適用に失敗しました");
    }
  }

  async function saveTemplateFromWorkout(input: { name: string }) {
    "use server";

    const user = await requireUser();
    const exerciseBlocks = (workoutExercises ?? []).map((we, idx) => ({
      exerciseId: we.exercise_id,
      sortOrder: we.sort_order ?? idx,
      sets: (setsByWorkoutExerciseId[we.id] ?? []).map((s) => ({
        set_order: s.set_order,
        weight: s.weight ?? null,
        reps: s.reps ?? null,
      })),
    }));

    await saveWorkoutTemplate({
      userId: user.id,
      name: input.name,
      exercises: exerciseBlocks.map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets,
      })),
    });
  }

  async function deleteTemplate(input: { templateId: string }) {
    "use server";

    const user = await requireUser();
    await repoDeleteWorkoutTemplate({ userId: user.id, templateId: input.templateId });
  }

  return (
    <div>
      <Header title="ワークアウト" />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <div className="flex gap-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm"
          >
            カレンダーへ戻る
          </Link>
          <Link
            href={`/day/${workoutRecord.workout_date}`}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm"
          >
            この日へ
          </Link>
          <form action={deleteWorkout} className="ml-auto">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm text-red-600"
              aria-label="このワークアウトを削除"
            >
              削除
            </button>
          </form>
        </div>

        <Card>
          <WorkoutAutoSaveForm
            workoutId={workoutRecord.id}
            initialWorkoutDate={workoutRecord.workout_date}
            initialMemo={workoutRecord.memo}
            onSave={autoSaveWorkout}
          />
        </Card>

        <Card>
          <AddExerciseClient
            groups={exerciseGroupKeys.map((k) => ({
              key: k as "胸" | "背中" | "肩" | "腕" | "脚" | "腹" | "未分類",
              options: (groupedExercises.get(k) ?? []).map((e) => ({ id: e.id, name: e.name })),
            }))}
            onAdd={addExercise}
          />
          {(exercises ?? []).length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              先に <Link href="/exercises" className="underline">種目</Link> を登録してください。
            </p>
          )}
        </Card>

        <Card>
          <WorkoutTemplateClient
            templates={templates}
            exercises={(exercises ?? []).map((e) => ({ id: e.id, name: e.name }))}
            currentExerciseCount={(workoutExercises ?? []).length}
            onApply={applyTemplate}
            onSaveFromWorkout={saveTemplateFromWorkout}
            onDelete={deleteTemplate}
          />
        </Card>

        <div className="space-y-3">
          {(workoutExercises ?? []).map((we) => (
            <WorkoutExerciseBlock
              key={we.id}
              workoutExerciseId={we.id}
              workoutId={id}
              exerciseId={we.exercise_id}
              title={we.exercises?.name ?? ""}
              targetParts={we.exercises?.target_parts ?? []}
              sets={setsByWorkoutExerciseId[we.id] ?? []}
              prevTop={prevTopByExerciseId[we.exercise_id] ?? null}
              removeAction={removeWorkoutExercise}
            />
          ))}
        </div>

        <div className="pb-8" />
      </main>
    </div>
  );
}

function WorkoutExerciseBlock({
  workoutExerciseId,
  workoutId,
  exerciseId,
  title,
  targetParts,
  sets,
  prevTop,
  removeAction,
}: {
  workoutExerciseId: string;
  workoutId: string;
  exerciseId: string;
  title: string;
  targetParts: string[];
  sets: Array<{ id: string; set_order: number; weight: number | null; reps: number | null }>;
  prevTop: { weight: number | null; reps: number | null } | null;
  removeAction: (formData: FormData) => Promise<void>;
}) {
  const prevText = prevTop
    ? `${prevTop.weight != null ? `${prevTop.weight}kg` : ""}${prevTop.reps != null ? `×${prevTop.reps}` : ""}`
    : "";

  async function addSet() {
    "use server";
    await requireUser();
    const last = (sets ?? []).at(-1);
    await repoAddSet({
      workoutExerciseId,
      weight: last?.weight ?? null,
      reps: last?.reps ?? null,
    });

    revalidatePath(`/workouts/${workoutId}`);
  }

  async function updateSet(input: { setId: string; weight: number | null; reps: number | null }) {
    "use server";

    const safeWeight =
      typeof input.weight === "number" && Number.isFinite(input.weight) ? input.weight : null;
    const safeReps =
      typeof input.reps === "number" && Number.isFinite(input.reps) ? input.reps : null;

    await requireUser();
    await repoUpdateSet({ setId: input.setId, weight: safeWeight, reps: safeReps });
  }

  async function deleteSet(input: { setId: string }) {
    "use server";
    await requireUser();
    await repoDeleteSet({ setId: input.setId });
    revalidatePath(`/workouts/${workoutId}`);
  }

  async function copyPreviousSets() {
    "use server";

    const user = await requireUser();
    await repoCopyPreviousSets({
      userId: user.id,
      workoutId,
      workoutExerciseId,
      exerciseId,
    });

    revalidatePath(`/workouts/${workoutId}`);
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <div className="flex items-center gap-2">
            <div className="text-base font-bold text-foreground">{title}</div>
            {(sets ?? []).length > 0 && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
                {(sets ?? []).length}セット
              </span>
            )}
          </div>
          {prevText && (
            <div className="mt-1 flex items-center gap-1 text-xs text-accent">
              <span>前回：</span>
              <span className="font-semibold">{prevText}</span>
            </div>
          )}
          {targetParts.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {targetParts.map((p) => {
                return (
                  <span
                    key={p}
                    className="app-chip bg-accent/10 border-accent/30"
                  >
                    {p}
                  </span>
                );
              })}
            </div>
          )}
          <div className="mt-3 space-y-2">
            {(sets ?? []).map((s) => (
              <SetRowClient
                key={s.id}
                setId={s.id}
                initialWeight={s.weight}
                initialReps={s.reps}
                exerciseName={title}
                onSave={updateSet}
                onDelete={deleteSet}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
          <form action={copyPreviousSets}>
            <button className="app-secondary w-full text-xs font-semibold">
              前回コピー
            </button>
          </form>
          <form action={addSet}>
            <button 
              className="app-secondary w-full text-xs font-semibold bg-accent/5 border-accent/30"
              title={(sets ?? []).length > 0 ? "直前のセットをコピーして追加" : "新しいセットを追加"}
            >
              {(sets ?? []).length > 0 ? "＋ 同じ重量" : "＋ セット"}
            </button>
          </form>
          <form action={removeAction}>
            <input type="hidden" name="workout_exercise_id" value={workoutExerciseId} />
            <button type="submit" className="app-secondary w-full text-xs text-red-600">
              削除
            </button>
          </form>
        </div>
      </div>
    </Card>
  );
}
