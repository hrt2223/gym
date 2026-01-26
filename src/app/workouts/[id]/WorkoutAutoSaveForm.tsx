"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

type Props = {
  workoutId: string;
  initialWorkoutDate: string;
  initialMemo: string | null;
  onSave: (input: {
    id: string;
    workoutDate: string;
    memo: string | null;
    previousWorkoutDate: string;
  }) => Promise<void>;
};

function normalizeMemo(raw: string): string | null {
  const v = raw.trim();
  return v ? v : null;
}

export function WorkoutAutoSaveForm({
  workoutId,
  initialWorkoutDate,
  initialMemo,
  onSave,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [workoutDate, setWorkoutDate] = useState<string>(initialWorkoutDate);
  const [memo, setMemo] = useState<string>(initialMemo ?? "");
  const [previousWorkoutDate, setPreviousWorkoutDate] = useState<string>(initialWorkoutDate);

  const [savedAt, setSavedAt] = useState<number>(0);
  const [error, setError] = useState<string>("");

  const timerRef = useRef<number | null>(null);
  const lastPayloadRef = useRef<string>("");

  const payload = useMemo(() => {
    return JSON.stringify({
      id: workoutId,
      workoutDate,
      memo: normalizeMemo(memo),
    });
  }, [memo, workoutDate, workoutId]);

  const doSave = useCallback(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) {
      setError("日付が不正です");
      return;
    }

    const nextPayload = payload;
    if (nextPayload === lastPayloadRef.current) return;

    setError("");

    startTransition(() => {
      onSave({
        id: workoutId,
        workoutDate,
        memo: normalizeMemo(memo),
        previousWorkoutDate,
      })
        .then(() => {
          lastPayloadRef.current = nextPayload;
          setSavedAt(Date.now());
          setPreviousWorkoutDate(workoutDate);
        })
        .catch(() => {
          setError("保存に失敗しました");
        });
    });
  }, [memo, onSave, payload, previousWorkoutDate, workoutDate, workoutId]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      doSave();
    }, 700);
  }, [doSave]);

  useEffect(() => {
    lastPayloadRef.current = payload;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText = useMemo(() => {
    if (error) return error;
    if (isPending) return "保存中…";
    if (savedAt) return "保存しました";
    return "";
  }, [error, isPending, savedAt]);

  return (
    <div className="space-y-3">
      {statusText && (
        <div
          className={`rounded-xl px-3 py-2 text-sm ${
            error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {statusText}
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground">日付</label>
        <input
          type="date"
          value={workoutDate}
          onChange={(e) => {
            setWorkoutDate(e.target.value);
            scheduleSave();
          }}
          onBlur={() => doSave()}
          className="mt-1 w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">メモ</label>
        <textarea
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value);
            scheduleSave();
          }}
          onBlur={() => doSave()}
          placeholder="例: 眠い / 混んでた / フォーム意識"
          className="mt-1 w-full rounded-xl border px-3 py-2"
          rows={3}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        自動保存します（入力後少し待つ or フォーカスを外す）。
      </div>
    </div>
  );
}
