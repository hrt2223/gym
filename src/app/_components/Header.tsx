import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocalOnly } from "@/lib/appMode";

export function Header({ title }: { title: string }) {
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
    <header className="app-header sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-background px-3 py-2 text-xs text-foreground"
        >
          📅 カレンダー
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/gym"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent px-3 py-2 text-xs text-accent-foreground"
          >
            🏋️ ジム
          </Link>
          <Link href="/exercises" className="shrink-0 rounded-lg px-2 py-2 text-sm text-foreground">
            種目
          </Link>
          <Link href="/templates" className="shrink-0 rounded-lg px-2 py-2 text-sm text-foreground">
            テンプレ
          </Link>
          <Link href="/progress" className="shrink-0 rounded-lg px-2 py-2 text-sm text-foreground">
            軌跡
          </Link>
          <Link href="/settings" className="shrink-0 rounded-lg px-2 py-2 text-sm text-foreground">
            設定
          </Link>
          {!isLocalOnly() && (
            <form action={signOut}>
              <button type="submit" className="shrink-0 text-sm text-foreground">
                ログアウト
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
