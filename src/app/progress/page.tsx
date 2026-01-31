import Link from "next/link";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { requireUser } from "@/lib/auth";
import { listExercises, listExerciseProgress } from "@/lib/repo";
import { ExerciseProgressPickerClient } from "./ExerciseProgressPickerClient";

export const dynamic = "force-dynamic";

function formatSetText(weight: number | null, reps: number | null): string {
  const w = weight == null ? "" : `${weight}kg`;
  const r = reps == null ? "" : `${reps}`;
  if (!w && !r) return "-";
  if (w && r) return `${w}×${r}`;
  if (w) return w;
  return `×${r}`;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const w = 240;
  const h = 44;
  const pad = 4;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  const xStep = (w - pad * 2) / (values.length - 1);

  const pts = values
    .map((v, i) => {
      const x = pad + xStep * i;
      const yNorm = range === 0 ? 0.5 : (v - min) / range;
      const y = pad + (h - pad * 2) * (1 - yNorm);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      aria-hidden="true"
      className="block"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-accent"
      />
    </svg>
  );
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciseId?: string }>;
}) {
  const user = await requireUser();
  const exercises = await listExercises(user.id);

  const sp = (await searchParams) ?? {};
  const exerciseId = typeof sp.exerciseId === "string" ? sp.exerciseId : "";

  const selected = (exercises ?? []).find((e) => e.id === exerciseId) ?? null;

  const points = exerciseId
    ? await listExerciseProgress({ userId: user.id, exerciseId, limit: 180 })
    : [];

  const hasWeight = points.some((p) => p.weight != null);
  const metricLabel = hasWeight ? "重量" : "回数";
  const series = points
    .map((p) => (hasWeight ? p.weight : p.reps))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const first = series[0];
  const last = series.length ? series[series.length - 1] : undefined;
  const diff =
    typeof first === "number" && typeof last === "number" ? Math.round((last - first) * 10) / 10 : null;

  return (
    <div>
      <Header title="軌跡" />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <ExerciseProgressPickerClient
            exercises={(exercises ?? []).map((e) => ({
              id: e.id,
              name: e.name,
              target_parts: e.target_parts ?? [],
            }))}
            selectedId={exerciseId}
          />
        </Card>

        {selected && (
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-semibold">{selected.name}</div>
              {series.length >= 2 && (
                <div className="text-xs text-muted-foreground">
                  {metricLabel}の変化：{diff != null ? `${diff > 0 ? "+" : ""}${diff}` : "-"}
                  {hasWeight ? "kg" : "回"}
                </div>
              )}
              <Sparkline values={series} />
            </div>
          </Card>
        )}

        {!exerciseId && (
          <Card>
            <div className="text-sm text-foreground">種目を選ぶと、ベストセットの推移が表示されます。</div>
          </Card>
        )}

        {exerciseId && points.length === 0 && (
          <Card>
            <div className="text-sm text-foreground">まだ記録がありません。</div>
            <div className="mt-2 text-xs text-muted-foreground">
              先に <Link href="/">カレンダー</Link> からワークアウトを作成して記録してください。
            </div>
          </Card>
        )}

        {points.length > 0 && (
          <Card>
            <div className="text-sm font-semibold">履歴</div>
            <div className="mt-2 space-y-2">
              {points
                .slice()
                .reverse()
                .map((p) => (
                  <Link
                    key={`${p.workout_id}`}
                    href={`/workouts/${p.workout_id}`}
                    className="block rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-foreground">{p.workout_date}</div>
                      <div className="text-sm text-foreground">
                        {formatSetText(p.weight, p.reps)}
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </Card>
        )}

        <div className="pb-8" />
      </main>
    </div>
  );
}
