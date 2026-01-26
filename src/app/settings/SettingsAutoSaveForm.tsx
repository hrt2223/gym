"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

type Props = {
  initialGymUrl: string | null;
  onSave: (
    input: { gymLoginUrl: string | null }
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
};

function normalizeGymUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  return v;
}

export function SettingsAutoSaveForm({ initialGymUrl, onSave }: Props) {
  const [isPending, startTransition] = useTransition();

  const [gymUrl, setGymUrl] = useState<string>(initialGymUrl ?? "");
  const [savedAt, setSavedAt] = useState<number>(0);
  const [error, setError] = useState<string>("");

  const timerRef = useRef<number | null>(null);
  const lastPayloadRef = useRef<string>("");

  const payload = useMemo(() => {
    return JSON.stringify({ gymLoginUrl: normalizeGymUrl(gymUrl) });
  }, [gymUrl]);

  const doSave = useCallback(() => {
    const next = normalizeGymUrl(gymUrl);

    if (next && !/^https?:\/\//.test(next)) {
      setError("http(s):// から始まるURLを入力してください");
      return;
    }

    const nextPayload = payload;
    if (nextPayload === lastPayloadRef.current) return;

    setError("");

    startTransition(() => {
      onSave({ gymLoginUrl: next })
        .then((res) => {
          if (res.ok) {
            lastPayloadRef.current = nextPayload;
            setSavedAt(Date.now());
            return;
          }

          const raw = res.message || "保存に失敗しました";

          // ありがちな原因をユーザー向けに整形
          if (/relation\s+"user_settings"\s+does\s+not\s+exist/i.test(raw)) {
            setError("Supabaseにスキーマが入っていません（user_settings）。SQL Editorで schema.sql を実行してください。");
            return;
          }

          if (/row[-\s]?level\s+security|RLS/i.test(raw)) {
            setError("権限エラー（RLS）です。いったんログアウト→ログインし直して再試行してください。");
            return;
          }

          setError(raw);
        })
        .catch(() => {
          setError("保存に失敗しました");
        });
    });
  }, [gymUrl, onSave, payload]);

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
        <label className="text-xs text-muted-foreground">ジムログインURL（任意）</label>
        <input
          type="url"
          inputMode="url"
          placeholder="https://..."
          value={gymUrl}
          onChange={(e) => {
            setGymUrl(e.target.value);
            scheduleSave();
          }}
          onBlur={() => doSave()}
          className="mt-1 w-full rounded-xl border px-3 py-2"
        />
        <div className="mt-1 text-xs text-muted-foreground">
          設定すると、画面上部に「🏋️ ジム」ボタンが出ます（新しいタブで開きます）。
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        自動保存します（入力後少し待つ or フォーカスを外す）。
      </div>
    </div>
  );
}
