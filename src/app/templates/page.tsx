import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
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

export default async function TemplatesPage() {
  const user = await requireUser();
  const exercises = await listExercises(user.id);
  const templates = await listWorkoutTemplates(user.id);

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
      <Header title="????" />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <TemplateEditorClient
            templates={templates}
            exercises={(exercises ?? []).map((e) => ({ id: e.id, name: e.name }))}
            onSave={saveTemplate}
            onDelete={removeTemplate}
          />
        </Card>
      </main>
    </div>
  );
}
