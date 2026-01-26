import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  createExercise as repoCreateExercise,
  deleteExercise as repoDeleteExercise,
  getGymLoginUrl,
  listExercises,
} from "@/lib/repo";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { inferTargetParts } from "@/lib/inferTargetParts";
import { PartPicker } from "./PartPicker";

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
  const gymUrl = await getGymLoginUrl(user.id);
  const exercises = await listExercises(user.id);

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
      <Header title="種目管理" gymUrl={gymUrl} />
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

            <button className="w-full rounded-xl bg-accent px-4 py-3 text-accent-foreground">
              追加
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
              部位未選択なら種目名から自動推定します。
            </p>
          </form>
        </Card>

        <div className="space-y-2">
          {(exercises ?? []).map((e) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{e.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(e.target_parts ?? []).map((p: string) => (
                      <span
                        key={p}
                        className="rounded-full bg-muted px-2 py-1 text-[11px] text-foreground"
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
                    className="rounded-lg border border-border bg-background px-3 py-2 text-center text-xs"
                  >
                    編集
                  </a>
                  <form action={deleteExercise}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                    >
                      削除
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
