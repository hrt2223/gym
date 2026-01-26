import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { revalidatePath } from "next/cache";
import { getExercise, getGymLoginUrl, listExerciseHistory, updateExercise as repoUpdateExercise } from "@/lib/repo";
import { ExerciseAutoSaveForm } from "./ExerciseAutoSaveForm";

export const dynamic = "force-dynamic";

function formatSet(weight: number | null, reps: number | null): string {
  const w = weight == null ? "" : `${weight}kg`;
  const r = reps == null ? "" : `${reps}`;
  if (!w && !r) return "-";
  if (w && r) return `${w}×${r}`;
  if (w) return w;
  return `×${r}`;
}

type PageProps = { params: Promise<{ id: string }> };

export default async function ExerciseEditPage({ params }: PageProps) {
  const { id } = await params;

  const user = await requireUser();
  const gymUrl = await getGymLoginUrl(user.id);
  const exercise = await getExercise(user.id, id);

  const history = await listExerciseHistory({ userId: user.id, exerciseId: id, limit: 30 });

  if (!exercise) {
    redirect("/exercises");
  }

  async function autoSave(input: { id: string; name: string; targetParts: string[] }) {
    "use server";

    const user = await requireUser();
    const name = String(input.name || "").trim();
    const parts = Array.isArray(input.targetParts) ? input.targetParts.map(String) : [];

    if (!name) return;

    await repoUpdateExercise({ userId: user.id, id: input.id, name, targetParts: parts });
    revalidatePath("/exercises");
    revalidatePath(`/exercises/${input.id}`);
  }

  return (
    <div>
      <Header title="種目編集" gymUrl={gymUrl} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm"
          >
            カレンダーに戻る
          </Link>
          <Link
            href="/exercises"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm"
          >
            一覧へ
          </Link>
        </div>

        <Card>
          <ExerciseAutoSaveForm
            exerciseId={exercise.id}
            initialName={exercise.name}
            initialParts={exercise.target_parts ?? []}
            onSave={autoSave}
          />
        </Card>

        <Card>
          <div className="text-sm font-semibold">履歴</div>
          <div className="mt-1 text-xs text-muted-foreground">
            直近 {history.length} 回（日時順）
          </div>

          <div className="mt-3 space-y-2">
            {history.length === 0 && (
              <div className="text-sm text-muted-foreground">まだ記録がありません。</div>
            )}

            {history.map((h) => {
              const setText = (h.sets ?? [])
                .slice(0, 8)
                .map((s) => formatSet(s.weight, s.reps))
                .join(" / ");
              const more = (h.sets ?? []).length > 8 ? ` / ＋${(h.sets ?? []).length - 8}` : "";

              return (
                <Link
                  key={`${h.workout_id}-${h.workout_created_at}`}
                  href={`/workouts/${h.workout_id}`}
                  className="block rounded-xl border border-border bg-background px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-foreground">{h.workout_date}</div>
                    <div className="text-xs text-muted-foreground">開く</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {(h.sets ?? []).length ? `${setText}${more}` : "セットなし"}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

      </main>
    </div>
  );
}
