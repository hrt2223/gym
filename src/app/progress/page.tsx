import Link from "next/link";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { requireUser } from "@/lib/auth";
import { listExercises, listExerciseProgress } from "@/lib/repo";
import { ExerciseProgressPickerClient } from "./ExerciseProgressPickerClient";
import { ProgressChartClient } from "./ProgressChartClient";

export const revalidate = 60;

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

function aggregateByDays(points: Point[], bucketDays: number): Point[] {
  if (points.length <= 1) return points;

  const sorted = [...points].sort((a, b) => {
    if (a.workout_date !== b.workout_date) return a.workout_date < b.workout_date ? -1 : 1;
    return a.workout_created_at < b.workout_created_at ? -1 : a.workout_created_at > b.workout_created_at ? 1 : 0;
  });

  const out: Point[] = [];
  let i = 0;
  while (i < sorted.length) {
    const startDate = ymdToDate(sorted[i].workout_date);
    const end = new Date(startDate.getTime() + bucketDays * 24 * 60 * 60 * 1000);

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

type MetricKey = "weight" | "reps";
type RangeKey = "12w" | "6m" | "all";
type BucketKey = "2w" | "4w";

function clampMetric(v: unknown): MetricKey | null {
  if (v === "weight" || v === "reps") return v;
  return null;
}

function clampRange(v: unknown): RangeKey {
  if (v === "12w" || v === "6m" || v === "all") return v;
  return "12w";
}

function clampBucket(v: unknown): BucketKey {
  if (v === "2w" || v === "4w") return v;
  return "2w";
}

function bucketLabel(bucket: BucketKey): string {
  return bucket === "4w" ? "4週間ごと（各期間のベストセット）" : "2週間ごと（各期間のベストセット）";
}

function bucketDays(bucket: BucketKey): number {
  return bucket === "4w" ? 28 : 14;
}

function rangeLabel(range: RangeKey): string {
  if (range === "6m") return "直近6ヶ月";
  if (range === "all") return "全部";
  return "直近12週";
}

function metricLabel(metric: MetricKey): { label: string; unit: string } {
  return metric === "weight" ? { label: "重量", unit: "kg" } : { label: "回数", unit: "回" };
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startYmdForRange(range: RangeKey): string | null {
  if (range === "all") return null;
  const now = new Date();
  const days = range === "6m" ? 183 : 84;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return toYmd(start);
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "-";
  const rounded = Math.round(v * 10) / 10;
  return String(rounded);
}

function signNumber(v: number): string {
  if (!Number.isFinite(v)) return "-";
  const rounded = Math.round(v * 10) / 10;
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams?: Promise<{ exerciseId?: string; metric?: string; range?: string; bucket?: string }>;
}) {
  const user = await requireUser();
  const exercises = await listExercises(user.id);

  const sp = (await searchParams) ?? {};
  const exerciseId = typeof sp.exerciseId === "string" ? sp.exerciseId : "";

  const bucket = clampBucket(sp.bucket);
  const range = clampRange(sp.range);
  const startYmd = startYmdForRange(range);

  const selected = (exercises ?? []).find((e) => e.id === exerciseId) ?? null;

  const baseLimit = range === "all" ? 540 : range === "6m" ? 270 : 180;
  const rawPoints = exerciseId
    ? await listExerciseProgress({ userId: user.id, exerciseId, limit: baseLimit })
    : [];

  const points = (rawPoints as Point[]).filter((p) => {
    if (!startYmd) return true;
    return p.workout_date >= startYmd;
  });

  const aggregated = aggregateByDays(points, bucketDays(bucket));

  const hasWeight = aggregated.some((p) => p.weight != null);
  const hasReps = aggregated.some((p) => p.reps != null);
  const requestedMetric = clampMetric(sp.metric);
  const metricKey: MetricKey =
    requestedMetric && ((requestedMetric === "weight" && hasWeight) || (requestedMetric === "reps" && hasReps))
      ? requestedMetric
      : hasWeight
        ? "weight"
        : "reps";

  const metric = metricLabel(metricKey);

  const series = aggregated
    .map((p) => (metricKey === "weight" ? p.weight : p.reps))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const first = series[0];
  const last = series.length ? series[series.length - 1] : undefined;
  const prev = series.length >= 2 ? series[series.length - 2] : undefined;
  const best = series.length ? Math.max(...series) : undefined;
  const diffAll =
    typeof first === "number" && typeof last === "number" ? Math.round((last - first) * 10) / 10 : null;
  const diffPrev =
    typeof prev === "number" && typeof last === "number" ? Math.round((last - prev) * 10) / 10 : null;

  const url = new URL("http://local/progress");
  if (exerciseId) url.searchParams.set("exerciseId", exerciseId);
  url.searchParams.set("range", range);
  url.searchParams.set("bucket", bucket);
  url.searchParams.set("metric", metricKey);

  function makeHref(next: Partial<{ metric: MetricKey; range: RangeKey; bucket: BucketKey }>) {
    const u = new URL(url.toString());
    if (next.metric) u.searchParams.set("metric", next.metric);
    if (next.range) u.searchParams.set("range", next.range);
    if (next.bucket) u.searchParams.set("bucket", next.bucket);
    return `${u.pathname}?${u.searchParams.toString()}`;
  }

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
            keepParams={{
              metric: metricKey,
              range,
              bucket,
            }}
          />
        </Card>

        {selected && (
          <Card>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">{selected.name}</div>

                <div className="flex flex-wrap gap-2">
                  {(hasWeight && hasReps) && (
                    <div className="flex gap-2">
                      <Link
                        href={makeHref({ metric: "weight" })}
                        className={`app-pill text-xs ${metricKey === "weight" ? "app-pill-accent" : "text-foreground"}`}
                      >
                        重量
                      </Link>
                      <Link
                        href={makeHref({ metric: "reps" })}
                        className={`app-pill text-xs ${metricKey === "reps" ? "app-pill-accent" : "text-foreground"}`}
                      >
                        回数
                      </Link>
                    </div>
                  )}

                  <Link
                    href={makeHref({ range: "12w" })}
                    className={`app-pill text-xs ${range === "12w" ? "app-pill-accent" : "text-foreground"}`}
                  >
                    12週
                  </Link>
                  <Link
                    href={makeHref({ range: "6m" })}
                    className={`app-pill text-xs ${range === "6m" ? "app-pill-accent" : "text-foreground"}`}
                  >
                    6ヶ月
                  </Link>
                  <Link
                    href={makeHref({ range: "all" })}
                    className={`app-pill text-xs ${range === "all" ? "app-pill-accent" : "text-foreground"}`}
                  >
                    全部
                  </Link>

                  <Link
                    href={makeHref({ bucket: "2w" })}
                    className={`app-pill text-xs ${bucket === "2w" ? "app-pill-accent" : "text-foreground"}`}
                  >
                    2週
                  </Link>
                  <Link
                    href={makeHref({ bucket: "4w" })}
                    className={`app-pill text-xs ${bucket === "4w" ? "app-pill-accent" : "text-foreground"}`}
                  >
                    4週
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="app-secondary">
                  <div className="text-[11px] font-semibold text-accent">最新</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {typeof last === "number" ? `${formatNumber(last)}${metric.unit}` : "-"}
                  </div>
                  {typeof diffPrev === "number" && (
                    <div className={`mt-1 text-[11px] font-semibold ${diffPrev > 0 ? 'text-green-600' : diffPrev < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      前回比 {signNumber(diffPrev)}{metric.unit}
                    </div>
                  )}
                </div>
                <div className="app-secondary bg-accent/5 border-accent/30">
                  <div className="text-[11px] font-semibold text-accent">ベスト</div>
                  <div className="mt-1 text-lg font-bold text-accent">
                    {typeof best === "number" ? `${formatNumber(best)}${metric.unit}` : "-"}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{rangeLabel(range)}</div>
                </div>
                <div className="app-secondary">
                  <div className="text-[11px] font-semibold text-foreground">変化</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {diffAll != null ? `${diffAll > 0 ? "+" : ""}${formatNumber(diffAll)}${metric.unit}` : "-"}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">最初→最新</div>
                </div>
              </div>

              <ProgressChartClient
                metric={metric}
                subtitle={`${bucketLabel(bucket)} / ${rangeLabel(range)}`}
                points={aggregated
                  .map((p) => ({
                    date: p.workout_date,
                    value: (metricKey === "weight" ? p.weight : p.reps) ?? NaN,
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
                    <div className="w-full space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm text-foreground">{p.workout_date}</div>
                        <div className="text-sm font-semibold text-foreground">
                          {metricKey === "weight"
                            ? p.weight != null
                              ? `${p.weight}${metric.unit}`
                              : "-"
                            : p.reps != null
                              ? `${p.reps}${metric.unit}`
                              : "-"}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        ベストセット：{formatSetText(p.weight, p.reps)}
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
