"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PartPicker } from "../PartPicker";

type Props = {
  exerciseId: string;
  initialName: string;
  initialParts: string[];
  onSave: (input: { id: string; name: string; targetParts: string[] }) => Promise<void>;
};

function normalizeName(raw: string): string {
  return raw.trim();
}

export function ExerciseAutoSaveForm({
  exerciseId,
  initialName,
  initialParts,
  onSave,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState<string>(initialName);
  const [parts, setParts] = useState<string[]>(initialParts);

  const [savedAt, setSavedAt] = useState<number>(0);
  const [error, setError] = useState<string>("");

  const timerRef = useRef<number | null>(null);
  const lastPayloadRef = useRef<string>("");

  const payload = useMemo(() => {
    return JSON.stringify({ id: exerciseId, name: normalizeName(name), parts });
  }, [exerciseId, name, parts]);

  const doSave = useCallback(() => {
    const trimmed = normalizeName(name);

    if (!trimmed) {
      setError("種目名を入力してください");
      return;
    }

    const nextPayload = JSON.stringify({ id: exerciseId, name: trimmed, parts });
    if (nextPayload === lastPayloadRef.current) return;

    setError("");

    startTransition(() => {
      onSave({ id: exerciseId, name: trimmed, targetParts: parts })
        .then(() => {
          lastPayloadRef.current = nextPayload;
          setSavedAt(Date.now());
        })
        .catch(() => {
          setError("保存に失敗しました");
        });
    });
  }, [exerciseId, name, onSave, parts]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      doSave();
    }, 700);
  }, [doSave]);

  useEffect(() => {
    // 初期状態を「保存済み」として扱う
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
        <label className="text-xs text-muted-foreground">種目名</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            scheduleSave();
          }}
          onBlur={() => doSave()}
          className="mt-1 w-full rounded-xl border px-3 py-2"
        />
      </div>

      <PartPicker
        initial={initialParts}
        onChange={(next) => {
          setParts(next);
          scheduleSave();
        }}
      />

      <div className="text-xs text-muted-foreground">
        自動保存します（入力後少し待つ or フォーカスを外す）。
      </div>
    </div>
  );
}
