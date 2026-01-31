import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  createExercise as repoCreateExercise,
  createExercisesBestEffort,
  deleteExercise as repoDeleteExercise,
  listExercises,
} from "@/lib/repo";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { inferTargetParts } from "@/lib/inferTargetParts";
import { GYM_MACHINE_PRESET_EXERCISES } from "@/lib/exercisePresets";
import { PartPicker } from "./PartPicker";

export const dynamic = "force-dynamic";

function toParts(value: FormDataEntryValue | null): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(String(value));
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export default async function ExercisesPage() {
  const user = await requireUser();
  const exercises = await listExercises(user.id);

  const PART_ORDER = ["胸", "背中", "肩", "腕", "脚", "腹"] as const;
  type PartKey = (typeof PART_ORDER)[number] | "未分類";

  const grouped = new Map<PartKey, typeof exercises>();
  for (const e of exercises ?? []) {
    const first = (e.target_parts ?? [])[0];
    const key: PartKey = (PART_ORDER as readonly string[]).includes(String(first))
      ? (first as PartKey)
      : "未分類";
    const arr = grouped.get(key) ?? [];
    arr.push(e);
    grouped.set(key, arr);
  }

  const groupKeys: PartKey[] = [
    ...PART_ORDER.filter((p) => (grouped.get(p) ?? []).length > 0),
    ...(grouped.get("未分類")?.length ? (["未分類"] as const) : []),
  ];

  for (const k of groupKeys) {
    const arr = grouped.get(k) ?? [];
    arr.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    grouped.set(k, arr);
  }

  async function addGymPresets() {
    "use server";
    const user = await requireUser();

    await createExercisesBestEffort({
      userId: user.id,
      exercises: GYM_MACHINE_PRESET_EXERCISES,
    });

    redirect("/exercises");
  }

  async function createExercise(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const parts = toParts(formData.get("target_parts"));

    if (!name) {
      redirect("/exercises");
    }

    const user = await requireUser();

    const targetParts = parts.length ? parts : inferTargetParts(name);

    await repoCreateExercise({
      userId: user.id,
      name,
      targetParts,
    });

    redirect("/exercises");
  }

  async function deleteExercise(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");

    const user = await requireUser();

    if (!id) {
      redirect("/exercises");
    }

    await repoDeleteExercise(user.id, id);
    redirect("/exercises");
  }

  return (
    <div>
      <Header title="種目管理" />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm"
          >
            カレンダーに戻る
          </Link>
        </div>

        <Card>
          <form action={createExercise} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">種目名</label>
              <input
                name="name"
                placeholder="例: ベンチプレス"
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            <PartPicker />

            <PrimaryButton pendingText="追加中…">追加</PrimaryButton>
            <p className="mt-1 text-xs text-muted-foreground">
              部位未選択なら種目名から自動推定します。
            </p>
          </form>
        </Card>

        <Card>
          <form action={addGymPresets} className="space-y-2">
            <div className="text-sm font-medium">ジムのマシン一覧を追加</div>
            <p className="text-xs text-muted-foreground">
              有酸素/筋トレ/プレートロード/フリーウェイトを合計{GYM_MACHINE_PRESET_EXERCISES.length}
              件、一括で登録します（同名はスキップ）。
            </p>
            <PrimaryButton pendingText="追加中…">一覧を追加</PrimaryButton>
          </form>
        </Card>

        {groupKeys.length > 0 && (
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex gap-2">
              {groupKeys.map((k) => (
                <a
                  key={k}
                  href={`#part-${encodeURIComponent(k)}`}
                  className="app-pill shrink-0 text-xs text-foreground"
                >
                  {k}
                  <span className="ml-1 text-muted-foreground">
                    {(grouped.get(k) ?? []).length}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {groupKeys.length === 0 && (
          <Card>
            <div className="text-sm text-muted-foreground">まだ種目がありません。</div>
          </Card>
        )}

        <div className="space-y-6">
          {groupKeys.map((k) => (
            <section key={k} id={`part-${k}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{k}</h2>
                <div className="text-xs text-muted-foreground">
                  {(grouped.get(k) ?? []).length}件
                </div>
              </div>

              {(grouped.get(k) ?? []).map((e) => (
                <Card key={e.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{e.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(e.target_parts ?? []).map((p: string) => (
                          <span
                            key={p}
                            className="app-chip"
                          >
                            {p}
                          </span>
                        ))}
                        {(e.target_parts ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">部位なし</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <a
                        href={`/exercises/${e.id}`}
                        className="app-secondary w-full text-center text-xs"
                      >
                        編集
                      </a>
                      <form action={deleteExercise}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          className="app-secondary w-full text-xs"
                        >
                          削除
                        </button>
                      </form>
                    </div>
                  </div>
                </Card>
              ))}

              {k !== "未分類" && (
                <div className="text-[11px] text-muted-foreground">
                  ※複数部位の種目は、先頭の部位で分類しています。
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
