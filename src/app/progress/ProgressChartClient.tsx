"use client";

import { useMemo, useRef, useState } from "react";

function formatMd(ymd: string): string {
  const m = ymd.slice(5, 7);
  const d = ymd.slice(8, 10);
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

type ChartPoint = { date: string; value: number };

type Metric = { label: string; unit: string };

const FALLBACK_POINTS: ChartPoint[] = [
  { date: "2000-01-01", value: 0 },
  { date: "2000-01-02", value: 1 },
];

export function ProgressChartClient({
  points,
  metric,
  subtitle,
}: {
  points: ChartPoint[];
  metric: Metric;
  subtitle: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const hasEnoughPoints = points.length >= 2;
  const safePoints = hasEnoughPoints ? points : FALLBACK_POINTS;

  const w = 320;
  const h = 140;
  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 26;

  const values = safePoints.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const safeRange = range === 0 ? 1 : range;

  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const xStep = innerW / Math.max(1, safePoints.length - 1);

  const xy = useMemo(() => {
    return safePoints.map((p, i) => {
      const x = padL + xStep * i;
      const yNorm = (p.value - min) / safeRange;
      const y = padT + innerH * (1 - yNorm);
      return { x, y };
    });
  }, [safePoints, padL, xStep, min, safeRange, padT, innerH]);

  const linePoints = xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoints = `${linePoints} ${(w - padR).toFixed(1)},${(h - padB).toFixed(1)} ${padL.toFixed(
    1
  )},${(h - padB).toFixed(1)}`;

  const yMinText = `${min}${metric.unit}`;
  const yMaxText = `${max}${metric.unit}`;

  const firstDate = safePoints[0].date;
  const lastDate = safePoints[safePoints.length - 1].date;

  function pickIndexFromClientX(clientX: number) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;

    const svgLeft = 0;
    const svgRight = rect.width;
    const clamped = Math.max(svgLeft, Math.min(svgRight, x));

    // Map to 0..(points-1)
    const t = rect.width ? clamped / rect.width : 0;
    const approx = Math.round(t * (points.length - 1));
    const idx = Math.max(0, Math.min(points.length - 1, approx));
    setActiveIndex(idx);
  }

  const active = typeof activeIndex === "number" ? safePoints[activeIndex] : null;
  const activeXY = typeof activeIndex === "number" ? xy[activeIndex] : null;

  if (!hasEnoughPoints) return null;

  return (
    <div className="space-y-1">
      <div
        ref={wrapRef}
        className="relative"
        onPointerLeave={() => setActiveIndex(null)}
        onPointerCancel={() => setActiveIndex(null)}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          height={h}
          role="img"
          aria-label={`${metric.label}の推移`}
          className="block"
          onPointerDown={(e) => pickIndexFromClientX(e.clientX)}
          onPointerMove={(e) => {
            if (activeIndex == null) return;
            pickIndexFromClientX(e.clientX);
          }}
        >
          <defs>
            <linearGradient id="progressArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

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
          <line x1={padL} x2={padL} y1={padT} y2={h - padB} stroke="currentColor" strokeOpacity={0.25} />
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

          {/* 面 */}
          <polygon points={areaPoints} fill="url(#progressArea)" className="text-accent" />

          {/* ライン */}
          <polyline
            points={linePoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-accent"
          />

          {/* 点 */}
          {xy.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.2} fill="currentColor" className="text-accent" />
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

          {/* アクティブ */}
          {activeXY && (
            <>
              <line
                x1={activeXY.x}
                x2={activeXY.x}
                y1={padT}
                y2={h - padB}
                stroke="currentColor"
                strokeOpacity={0.18}
              />
              <circle cx={activeXY.x} cy={activeXY.y} r={6} fill="currentColor" className="text-accent" opacity={0.18} />
              <circle cx={activeXY.x} cy={activeXY.y} r={4} fill="currentColor" className="text-accent" />
            </>
          )}

          {/* 端の日付 */}
          <text x={padL} y={h - 8} fontSize="10" fill="currentColor" opacity={0.7}>
            {formatMd(firstDate)}
          </text>
          <text x={w - padR} y={h - 8} fontSize="10" fill="currentColor" opacity={0.7} textAnchor="end">
            {formatMd(lastDate)}
          </text>
        </svg>

        {active && activeXY && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-xl border border-border bg-background/90 px-3 py-2 text-xs text-foreground backdrop-blur"
            style={{
              left: `${(activeXY.x / w) * 100}%`,
              top: Math.max(6, activeXY.y - 36),
            }}
          >
            <div className="text-[11px] text-muted-foreground">{active.date}</div>
            <div className="mt-0.5 font-semibold">
              {metric.label}：{active.value}
              {metric.unit}
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground">{subtitle}（チャートをタップで値表示）</div>
    </div>
  );
}
