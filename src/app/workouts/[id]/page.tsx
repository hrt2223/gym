import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { SetRowClient } from "./SetRowClient";
import { WorkoutAutoSaveForm } from "./WorkoutAutoSaveForm";
import { WorkoutTemplateClient } from "./WorkoutTemplateClient";
import {
  addSet as repoAddSet,
  addWorkoutExercise,
  addWorkoutExercisesBestEffort,
  copyPreviousSets as repoCopyPreviousSets,
  deleteWorkout as repoDeleteWorkout,
  deleteSet as repoDeleteSet,
  deleteWorkoutExercise,
  getWorkout,
  listExercises,
  listPreviousTopSetsBefore,
  listSetsByWorkoutExerciseIds,
  listWorkoutExercises,
  updateSet as repoUpdateSet,
  updateWorkout as repoUpdateWorkout,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkoutEditPage({ params }: PageProps) {
  const { id } = await params;

  const user = await requireUser();
  const workout = await getWorkout(user.id, id);

  if (!workout) {
    redirect("/");
  }

  const workoutRecord = workout;

  const exercises = await listExercises(user.id);
  const workoutExercises = await listWorkoutExercises({ userId: user.id, workoutId: id });
  const workoutExerciseIds = (workoutExercises ?? []).map((we) => we.id);
  const exerciseIds = (workoutExercises ?? []).map((we) => we.exercise_id);
  const setsByWorkoutExerciseId = await listSetsByWorkoutExerciseIds({
    workoutExerciseIds,
  });
  const prevTopByExerciseId = await listPreviousTopSetsBefore({
    userId: user.id,
    beforeWorkout: { workoutDate: workoutRecord.workout_date, createdAt: workoutRecord.created_at },
    exerciseIds,
  });


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

  async function addExercise(formData: FormData) {
    "use server";

    const exerciseId = String(formData.get("exercise_id") || "");

    const user = await requireUser();

    if (!exerciseId) {
      redirect(`/workouts/${id}`);
    }

    await addWorkoutExercise({ userId: user.id, workoutId: id, exerciseId });

    redirect(`/workouts/${id}`);
  }

  async function removeWorkoutExercise(formData: FormData) {
    "use server";

    const workoutExerciseId = String(formData.get("workout_exercise_id") || "");

    await requireUser();
    await deleteWorkoutExercise({ workoutExerciseId });
    redirect(`/workouts/${id}`);
  }

  async function deleteWorkout() {
    "use server";

    const user = await requireUser();
    await repoDeleteWorkout({ userId: user.id, workoutId: id });
    revalidatePath("/");
    revalidatePath(`/day/${workoutRecord.workout_date}`);
    redirect(`/day/${workoutRecord.workout_date}`);
  }

  async function applyTemplate(input: { workoutId: string; exerciseIds: string[] }) {
    "use server";

    const user = await requireUser();
    await addWorkoutExercisesBestEffort({
      userId: user.id,
      workoutId: input.workoutId,
      exerciseIds: input.exerciseIds,
    });

    revalidatePath(`/workouts/${input.workoutId}`);
    redirect(`/workouts/${input.workoutId}`);
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
          <form action={addExercise} className="flex gap-2">
            <select
              name="exercise_id"
              className="w-full rounded-xl border px-3 py-2"
              defaultValue=""
            >
              <option value="" disabled>
                種目を選択
              </option>
              {(exercises ?? []).map((e) => {
                return (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                );
              })}
            </select>
            <button className="rounded-xl bg-accent px-4 py-2 text-accent-foreground">
              追加
            </button>
          </form>
          {(exercises ?? []).length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              先に <Link href="/exercises" className="underline">種目</Link> を登録してください。
            </p>
          )}
        </Card>

        <Card>
          <WorkoutTemplateClient
            workoutId={id}
            workoutExerciseIds={(workoutExercises ?? []).map((we) => we.exercise_id)}
            exercises={(exercises ?? []).map((e) => ({ id: e.id, name: e.name }))}
            onApply={applyTemplate}
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

    redirect(`/workouts/${workoutId}`);
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

    redirect(`/workouts/${workoutId}`);
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <div className="text-sm font-semibold">{title}</div>
          {prevText && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              前回：{prevText}
            </div>
          )}
          {targetParts.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {targetParts.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 space-y-2">
            {(sets ?? []).map((s) => (
              <SetRowClient
                key={s.id}
                setId={s.id}
                initialWeight={s.weight}
                initialReps={s.reps}
                onSave={updateSet}
                onDelete={deleteSet}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
          <form action={copyPreviousSets}>
            <button className="w-full rounded-lg border px-3 py-2 text-xs">
              前回コピー
            </button>
          </form>
          <form action={addSet}>
            <button className="w-full rounded-lg border px-3 py-2 text-xs">セット＋</button>
          </form>
          <form action={removeAction}>
            <input type="hidden" name="workout_exercise_id" value={workoutExerciseId} />
            <button className="w-full rounded-lg border px-3 py-2 text-xs">削除</button>
          </form>
        </div>
      </div>
    </Card>
  );
}
