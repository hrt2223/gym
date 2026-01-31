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

function ymdToDate(ymd: string): Date {
  // yyyy-MM-dd をローカル日付として扱う
  return new Date(`${ymd}T00:00:00`);
}

function formatMd(ymd: string): string {
  // 例: 2026-01-31 -> 1/31
  const m = ymd.slice(5, 7);
  const d = ymd.slice(8, 10);
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

type Point = {
  workout_id: string;
  workout_date: string;
  workout_created_at: string;
  weight: number | null;
  reps: number | null;
};

function pickBetterPoint(a: Point | null, b: Point): Point {
  if (!a) return b;
  const aw = a.weight ?? -1;
  const bw = b.weight ?? -1;
  if (bw > aw) return b;
  if (bw < aw) return a;
  const ar = a.reps ?? -1;
  const br = b.reps ?? -1;
  if (br > ar) return b;
  return a;
}

function aggregateBiWeekly(points: Point[]): Point[] {
  if (points.length <= 1) return points;

  const sorted = [...points].sort((a, b) => {
    if (a.workout_date !== b.workout_date) return a.workout_date < b.workout_date ? -1 : 1;
    return a.workout_created_at < b.workout_created_at ? -1 : a.workout_created_at > b.workout_created_at ? 1 : 0;
  });

  const out: Point[] = [];
  let i = 0;
  while (i < sorted.length) {
    const startDate = ymdToDate(sorted[i].workout_date);
    const end = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    let best: Point | null = null;
    let lastInBucket: Point = sorted[i];

    while (i < sorted.length) {
      const p = sorted[i];
      const d = ymdToDate(p.workout_date);
      if (d >= end) break;
      best = pickBetterPoint(best, p);
      lastInBucket = p;
      i += 1;
    }

    if (best) {
      // バケットの代表日付は最後の記録日に寄せる（見た目が自然）
      out.push({
        ...best,
        workout_date: lastInBucket.workout_date,
        workout_created_at: lastInBucket.workout_created_at,
        workout_id: lastInBucket.workout_id,
      });
    }
  }

  return out;
}

function ProgressChart({
  points,
  metric,
}: {
  points: Array<{ date: string; value: number }>;
  metric: { label: string; unit: string };
}) {
  if (points.length < 2) return null;

  const w = 320;
  const h = 140;
  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 26;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const safeRange = range === 0 ? 1 : range;

  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const xStep = innerW / (points.length - 1);

  const xy = points.map((p, i) => {
    const x = padL + xStep * i;
    const yNorm = (p.value - min) / safeRange;
    const y = padT + innerH * (1 - yNorm);
    return { x, y };
  });

  const path = xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const yMinText = `${min}${metric.unit}`;
  const yMaxText = `${max}${metric.unit}`;

  const firstDate = points[0].date;
  const lastDate = points[points.length - 1].date;

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        role="img"
        aria-label={`${metric.label}の推移`}
        className="block"
      >
        {/* グリッド */}
        {[0, 1, 2, 3, 4].map((t) => {
          const y = padT + (innerH * t) / 4;
          return (
            <line
              key={t}
              x1={padL}
              x2={w - padR}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.12}
            />
          );
        })}

        {/* 軸（左/下） */}
        <line
          x1={padL}
          x2={padL}
          y1={padT}
          y2={h - padB}
          stroke="currentColor"
          strokeOpacity={0.25}
        />
        <line
          x1={padL}
          x2={w - padR}
          y1={h - padB}
          y2={h - padB}
          stroke="currentColor"
          strokeOpacity={0.25}
        />

        {/* ラベル */}
        <text x={2} y={padT + 10} fontSize="10" fill="currentColor" opacity={0.7}>
          {yMaxText}
        </text>
        <text x={2} y={h - padB} fontSize="10" fill="currentColor" opacity={0.7}>
          {yMinText}
        </text>

        {/* ライン */}
        <polyline
          points={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-accent"
        />

        {/* 点 */}
        {xy.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.2}
            fill="currentColor"
            className="text-accent"
          />
        ))}

        {/* 端の日付 */}
        <text
          x={padL}
          y={h - 8}
          fontSize="10"
          fill="currentColor"
          opacity={0.7}
        >
          {formatMd(firstDate)}
        </text>
        <text
          x={w - padR}
          y={h - 8}
          fontSize="10"
          fill="currentColor"
          opacity={0.7}
          textAnchor="end"
        >
          {formatMd(lastDate)}
        </text>
      </svg>

      <div className="text-[11px] text-muted-foreground">
        2週間ごと（各期間のベストセット）
      </div>
    </div>
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

  const aggregated = aggregateBiWeekly(points as Point[]);
  const hasWeight = aggregated.some((p) => p.weight != null);
  const metric = hasWeight ? { label: "重量", unit: "kg" } : { label: "回数", unit: "回" };
  const series = aggregated
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
                  {metric.label}の変化：{diff != null ? `${diff > 0 ? "+" : ""}${diff}` : "-"}
                  {metric.unit}
                </div>
              )}
              <ProgressChart
                metric={metric}
                points={aggregated
                  .map((p) => ({
                    date: p.workout_date,
                    value: (hasWeight ? p.weight : p.reps) ?? NaN,
                  }))
                  .filter((p) => Number.isFinite(p.value))}
              />
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

        {aggregated.length > 0 && (
          <Card>
            <div className="text-sm font-semibold">履歴</div>
            <div className="mt-2 space-y-2">
              {aggregated
                .slice()
                .reverse()
                .map((p) => (
                  <Link
                    key={`${p.workout_id}`}
                    href={`/workouts/${p.workout_id}`}
                    className="app-secondary-block"
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
