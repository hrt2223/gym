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

function ProgressChart({
  points,
  metric,
  subtitle,
}: {
  points: Array<{ date: string; value: number }>;
  metric: { label: string; unit: string };
  subtitle: string;
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

        {/* 最新だけ少し強調 */}
        {(() => {
          const last = xy[xy.length - 1];
          return (
            <circle
              cx={last.x}
              cy={last.y}
              r={5}
              fill="currentColor"
              className="text-accent"
              opacity={0.9}
            />
          );
        })()}

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
        {subtitle}
      </div>
    </div>
  );
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
                  <div className="text-[11px] text-muted-foreground">最新</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {typeof last === "number" ? `${formatNumber(last)}${metric.unit}` : "-"}
                  </div>
                  {typeof diffPrev === "number" && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      前回比 {signNumber(diffPrev)}{metric.unit}
                    </div>
                  )}
                </div>
                <div className="app-secondary">
                  <div className="text-[11px] text-muted-foreground">ベスト</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {typeof best === "number" ? `${formatNumber(best)}${metric.unit}` : "-"}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{rangeLabel(range)}</div>
                </div>
                <div className="app-secondary">
                  <div className="text-[11px] text-muted-foreground">変化</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {diffAll != null ? `${diffAll > 0 ? "+" : ""}${formatNumber(diffAll)}${metric.unit}` : "-"}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">最初→最新</div>
                </div>
              </div>

              <ProgressChart
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
