"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

type Props = {
  setId: string;
  initialWeight: number | null;
  initialReps: number | null;
  exerciseName: string;
  onSave: (input: { setId: string; weight: number | null; reps: number | null }) => Promise<void>;
  onDelete: (input: { setId: string }) => Promise<void>;
};

function formatNumber(value: number): string {
  // 2.5 刻みを想定。末尾の .0 は落とす
  const s = String(value);
  if (s.endsWith(".0")) return s.slice(0, -2);
  return s;
}

function parseWeight(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseReps(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

// ランニングマシンかどうか判定
function isRunningMachine(exerciseName: string): boolean {
  const name = exerciseName.toLowerCase();
  return name.includes("ランニング") || name.includes("トレッドミル") || name.includes("ジョギング");
}

export function SetRowClient({ setId, initialWeight, initialReps, exerciseName, onSave, onDelete }: Props) {
  const isRunning = isRunningMachine(exerciseName);
  
  const [isPending, startTransition] = useTransition();
  const [weight, setWeight] = useState<string>(initialWeight == null ? "" : formatNumber(initialWeight));
  const [reps, setReps] = useState<string>(initialReps == null ? "" : String(initialReps));

  const [savedAt, setSavedAt] = useState<number>(0);
  const [error, setError] = useState<string>("");

  const weightRef = useRef<HTMLInputElement | null>(null);
  const repsRef = useRef<HTMLInputElement | null>(null);
  const lastFocus = useRef<"weight" | "reps">("reps");

  const saveTimerRef = useRef<number | null>(null);
  const lastPayloadRef = useRef<string>("");

  const doSave = useCallback(() => {
    const nextWeight = parseWeight(weight);
    const nextReps = parseReps(reps);
    const payload = JSON.stringify({ setId, weight: nextWeight, reps: nextReps });
    if (payload === lastPayloadRef.current) return;

    setError("");

    startTransition(() => {
      onSave({ setId, weight: nextWeight, reps: nextReps })
        .then(() => {
          lastPayloadRef.current = payload;
          setSavedAt(Date.now());
        })
        .catch(() => {
          setError("保存に失敗しました");
        });
    });
  }, [onSave, reps, setId, weight]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      doSave();
    }, 800);
  }, [doSave]);

  useEffect(() => {
    lastPayloadRef.current = JSON.stringify({
      setId,
      weight: parseWeight(weight),
      reps: parseReps(reps),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const del = useCallback(() => {
    startTransition(() => {
      onDelete({ setId });
    });
  }, [onDelete, setId]);

  const statusText = useMemo(() => {
    if (error) return error;
    if (isPending) return "保存中…";
    if (savedAt) return "保存しました";
    return "";
  }, [error, isPending, savedAt]);

  const bumpTimer = useRef<{ t?: number; i?: number } | null>(null);

  const startBump = useCallback((fn: () => void) => {
    fn();
    // 300ms 以上押しっぱなしなら連続
    bumpTimer.current = {};
    bumpTimer.current.t = window.setTimeout(() => {
      bumpTimer.current!.i = window.setInterval(fn, 120);
    }, 300);
  }, []);

  const stopBump = useCallback(() => {
    const t = bumpTimer.current?.t;
    const i = bumpTimer.current?.i;
    if (t) window.clearTimeout(t);
    if (i) window.clearInterval(i);
    bumpTimer.current = null;
  }, []);

  const adjustWeight = useCallback(
    (delta: number) => {
      lastFocus.current = "weight";
      setWeight((prev) => {
        const n = parseWeight(prev);
        const next = (n ?? 0) + delta;
        const clamped = next < 0 ? 0 : next;
        return formatNumber(Math.round(clamped * 10) / 10);
      });
      weightRef.current?.focus();
      scheduleSave();
    },
    [scheduleSave]
  );

  const adjustReps = useCallback(
    (delta: number) => {
      lastFocus.current = "reps";
      setReps((prev) => {
        const n = parseReps(prev);
        const next = (n ?? 0) + delta;
        const clamped = next < 0 ? 0 : next;
        return String(clamped);
      });
      repsRef.current?.focus();
      scheduleSave();
    },
    [scheduleSave]
  );

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {isRunning ? (
          // ランニングマシン: 時間のみ
          <div className="flex items-center gap-1">
            <input
              ref={weightRef}
              name="weight"
              inputMode="decimal"
              placeholder="時間"
              value={weight}
              onChange={(e) => {
                lastFocus.current = "weight";
                setWeight(e.target.value);
                scheduleSave();
              }}
              onBlur={() => doSave()}
              className="w-24 rounded-lg border border-border bg-card px-2 py-1 text-sm"
            />
            <span className="text-xs text-muted-foreground">分</span>
          </div>
        ) : (
          // 通常の種目: 重量と回数
          <>
            <div className="flex items-center gap-1">
              <input
                ref={weightRef}
                name="weight"
                inputMode="decimal"
                placeholder="kg"
                value={weight}
                onChange={(e) => {
                  lastFocus.current = "weight";
                  setWeight(e.target.value);
                  scheduleSave();
                }}
                onBlur={() => doSave()}
                className="w-24 rounded-lg border border-border bg-card px-2 py-1 text-sm"
              />
              <span className="text-xs text-muted-foreground">kg</span>
            </div>

            <div className="flex items-center gap-1">
              <input
                ref={repsRef}
                name="reps"
                inputMode="numeric"
                placeholder="回"
                value={reps}
                onChange={(e) => {
                  lastFocus.current = "reps";
                  setReps(e.target.value);
                  scheduleSave();
                }}
                onBlur={() => doSave()}
                className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-sm"
              />
              <span className="text-xs text-muted-foreground">回</span>
            </div>
          </>
        )}

        {statusText && (
          <div className={`ml-auto text-xs ${error ? "text-red-600" : "text-muted-foreground"}`}>
            {statusText}
          </div>
        )}
      </div>

      {!isRunning && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="app-control px-2 py-1 text-xs"
            onPointerDown={() => startBump(() => adjustWeight(-2.5))}
            onPointerUp={stopBump}
            onPointerCancel={stopBump}
            onPointerLeave={stopBump}
            onClick={(e) => e.preventDefault()}
          >
            -2.5kg
          </button>
          <button
            type="button"
            className="app-control px-2 py-1 text-xs"
            onPointerDown={() => startBump(() => adjustWeight(2.5))}
            onPointerUp={stopBump}
            onPointerCancel={stopBump}
            onPointerLeave={stopBump}
            onClick={(e) => e.preventDefault()}
          >
            +2.5kg
          </button>
          <button
            type="button"
            className="app-control px-2 py-1 text-xs"
            onPointerDown={() => startBump(() => adjustReps(-1))}
            onPointerUp={stopBump}
            onPointerCancel={stopBump}
            onPointerLeave={stopBump}
            onClick={(e) => e.preventDefault()}
          >
            -1回
          </button>
          <button
            type="button"
            className="app-control px-2 py-1 text-xs"
            onPointerDown={() => startBump(() => adjustReps(1))}
            onPointerUp={stopBump}
            onPointerCancel={stopBump}
            onPointerLeave={stopBump}
            onClick={(e) => e.preventDefault()}
          >
            +1回
          </button>
          <button
            type="button"
            className="app-control px-2 py-1 text-xs"
            disabled={isPending}
            onClick={del}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
