import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocalOnly } from "@/lib/appMode";

export function Header({ title, gymUrl }: { title: string; gymUrl?: string | null }) {
  async function signOut() {
    "use server";
    if (isLocalOnly()) {
      redirect("/");
    }
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <h1 className="text-base font-semibold">{title}</h1>
        <div className="flex items-center gap-3">
          {gymUrl ? (
            <a
              href={gymUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-2 text-xs text-accent-foreground"
            >
              🏋️ ジム
            </a>
          ) : (
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-full border border-border bg-background px-3 py-2 text-xs text-foreground"
            >
              🏋️ ジム
            </Link>
          )}
          <Link href="/exercises" className="text-sm text-foreground">
            種目
          </Link>
          <Link href="/settings" className="text-sm text-foreground">
            設定
          </Link>
          {!isLocalOnly() && (
            <form action={signOut}>
              <button type="submit" className="text-sm text-foreground">
                ログアウト
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
