import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { requireUser } from "@/lib/auth";
import { listExercises, saveWorkoutTemplate } from "@/lib/repo";
import { TemplateCreateClient } from "@/app/templates/new/TemplateCreateClient";

export const revalidate = 60;

type SaveInput = {
  name: string;
  exercises: Array<{
    exerciseId: string;
    sets: Array<{ set_order: number; weight: number | null; reps: number | null }>;
  }>;
};

export default async function TemplateNewPage() {
  const user = await requireUser();
  const exercises = await listExercises(user.id);

  async function createTemplate(input: SaveInput) {
    "use server";
    const user = await requireUser();
    const { id } = await saveWorkoutTemplate({
      userId: user.id,
      name: input.name,
      exercises: input.exercises,
    });

    if (!id) {
      redirect("/templates/new");
    }

    redirect(`/templates?edit=${encodeURIComponent(id)}`);
  }

  return (
    <div>
      <Header title="テンプレ（新規作成）" />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/templates"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm"
          >
            テンプレ一覧へ戻る
          </Link>
        </div>

        <Card>
          <TemplateCreateClient
            exercises={(exercises ?? []).map((e) => ({
              id: e.id,
              name: e.name,
              target_parts: e.target_parts ?? [],
            }))}
            onCreate={createTemplate}
          />
        </Card>
      </main>
    </div>
  );
}
