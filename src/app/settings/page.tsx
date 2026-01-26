import { requireUser } from "@/lib/auth";
import { getGymLoginUrl, upsertGymLoginUrl } from "@/lib/repo";
import { Header } from "@/app/_components/Header";
import { Card } from "@/app/_components/Card";
import { isLocalOnly } from "@/lib/appMode";
import Link from "next/link";
import { SettingsAutoSaveForm } from "./SettingsAutoSaveForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const gymUrl = await getGymLoginUrl(user.id);

  const mode = isLocalOnly() ? "local" : "supabase";
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GITHUB_COMMIT_SHA || "";

  async function autoSave(input: { gymLoginUrl: string | null }) {
    "use server";

    const user = await requireUser();
    await upsertGymLoginUrl({ userId: user.id, gymLoginUrl: input.gymLoginUrl });
  }

  return (
    <div>
      <Header title="設定" gymUrl={gymUrl} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <SettingsAutoSaveForm initialGymUrl={gymUrl} onSave={autoSave} />
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          mode: {mode}
          {commit ? ` / deploy: ${commit.slice(0, 7)}` : ""}
        </div>

        <Link href="/" className="block text-center text-sm underline">
          カレンダーに戻る
        </Link>
      </main>
    </div>
  );
}
