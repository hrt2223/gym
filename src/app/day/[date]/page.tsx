import { redirect } from "next/navigation";
import Link from "next/link";
import { parseISO, isValid, format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { createWorkout as repoCreateWorkout, listWorkoutsMenuByDate } from "@/lib/repo";

type PageProps = { params: Promise<{ date: string }> };

export default async function DayPage({ params }: PageProps) {
  const { date } = await params;
  const parsed = parseISO(date);

  if (!isValid(parsed) || date.length !== 10) {
    redirect("/");
  }

  const user = await requireUser();
  const workouts = await listWorkoutsMenuByDate({ userId: user.id, date });

  async function createWorkout(formData: FormData) {
    "use server";
    const workoutDate = String(formData.get("workout_date") || "");

    const user = await requireUser();
    const created = await repoCreateWorkout({
      userId: user.id,
      workoutDate,
      memo: null,
    });

    if (!created) {
      redirect(`/day/${workoutDate}`);
    }

    redirect(`/workouts/${created.id}`);
  }

  const title = format(parsed, "M/d（EEE）");

  return (
    <div>
      <Header title={title} />
      <main className="mx-auto max-w-md space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm"
          >
            カレンダーに戻る
          </Link>
          <div className="text-xs text-muted-foreground">{date}</div>
        </div>

        <form action={createWorkout}>
          <input type="hidden" name="workout_date" value={date} />
          <PrimaryButton pendingText="作成中…" aria-label="この日のワークアウトを作成">この日のワークアウトを作成</PrimaryButton>
        </form>

        <div className="space-y-2">
          {(workouts ?? []).map((w) => (
            <Link key={w.id} href={`/workouts/${w.id}`} className="block">
              <Card>
                <div className="text-sm font-medium">ワークアウト</div>
                {(w.workout_exercises ?? []).length > 0 && (
                  <div className="mt-2 space-y-2">
                    {(w.workout_exercises ?? []).slice(0, 6).map((we) => {
                      const sets = (we.sets ?? []).slice(0, 4).map((s) => {
                        const wv = s.weight == null ? "" : `${s.weight}`;
                        const rv = s.reps == null ? "" : `${s.reps}`;
                        if (!wv && !rv) return "-";
                        if (wv && rv) return `${wv}kg×${rv}`;
                        if (wv) return `${wv}kg`;
                        return `×${rv}`;
                      });

                      return (
                        <div key={we.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm text-foreground">{we.exercise_name || "(種目)"}</div>
                            {(we.sets ?? []).length > 0 && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {sets.join(" / ")}
                                {(we.sets ?? []).length > 4 && ` / ＋${(we.sets ?? []).length - 4}`}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {(w.workout_exercises ?? []).length > 6 && (
                      <div className="text-xs text-muted-foreground">
                        ＋{(w.workout_exercises ?? []).length - 6} 種目
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {w.memo ? w.memo : "メモなし"}
                </div>
              </Card>
            </Link>
          ))}

          {(workouts ?? []).length === 0 && (
            <Card>
              <div className="text-sm text-foreground">
                まだ記録がありません。
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
