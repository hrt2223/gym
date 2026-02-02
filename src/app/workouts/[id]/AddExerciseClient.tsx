"use client";

import { useState, useTransition } from "react";
import { ExercisePickerClient } from "./ExercisePickerClient";

type Props = {
  groups: Array<{
    key: string;
    options: Array<{ id: string; name: string }>;
  }>;
  onAdd: (exerciseId: string) => Promise<void>;
};

export function AddExerciseClient({ groups, onAdd }: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedId) return;

    setMessage("");
    startTransition(() => {
      onAdd(selectedId)
        .then(() => {
          setMessage("追加しました");
          setSelectedId("");
          setTimeout(() => setMessage(""), 2000);
        })
        .catch(() => {
          setMessage("追加に失敗しました");
        });
    });
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <ExercisePickerClient
          name="exercise_id"
          placeholder="種目を選択"
          groups={groups}
          value={selectedId}
          onChange={setSelectedId}
        />
        <button
          type="submit"
          disabled={isPending || !selectedId}
          className="rounded-xl bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
        >
          {isPending ? "追加中…" : "追加"}
        </button>
      </form>
      {message && (
        <div
          className={`mt-2 text-sm ${
            message.includes("失敗") ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
