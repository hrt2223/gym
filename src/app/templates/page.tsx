import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  deleteWorkoutTemplate,
  listExercises,
  listWorkoutTemplates,
  saveWorkoutTemplate,
} from "@/lib/repo";
import { TemplateEditorClient } from "./TemplateEditorClient";

export const dynamic = "force-dynamic";

type SaveInput = {
  templateId?: string;
  name: string;
  exercises: Array<{
    exerciseId: string;
    sets: Array<{ set_order: number; weight: number | null; reps: number | null }>;
  }>;
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  const user = await requireUser();
  const exercises = await listExercises(user.id);
  const templates = await listWorkoutTemplates(user.id);

  const sp = (await searchParams) ?? {};
  const initialSelectedId = typeof sp.edit === "string" ? sp.edit : "";

  async function saveTemplate(input: SaveInput) {
    "use server";
    const user = await requireUser();
    await saveWorkoutTemplate({
      userId: user.id,
      templateId: input.templateId,
      name: input.name,
      exercises: input.exercises,
    });
  }

  async function removeTemplate(input: { templateId: string }) {
    "use server";
    const user = await requireUser();
    await deleteWorkoutTemplate({ userId: user.id, templateId: input.templateId });
  }

  return (
    <div>
      <Header title="テンプレ" />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <div className="space-y-2">
            <div className="text-sm font-semibold">新規作成</div>
            <div className="text-xs text-muted-foreground">
              新しいテンプレを作る場合は、専用ページで作成します。
            </div>
            <Link
              href="/templates/new"
              className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground"
            >
              新規テンプレを作成
            </Link>
          </div>
        </Card>

        <Card>
          <TemplateEditorClient
            templates={templates}
            exercises={(exercises ?? []).map((e) => ({
              id: e.id,
              name: e.name,
              target_parts: e.target_parts ?? [],
            }))}
            initialSelectedId={initialSelectedId}
            onSave={saveTemplate}
            onDelete={removeTemplate}
          />
        </Card>
      </main>
    </div>
  );
}
