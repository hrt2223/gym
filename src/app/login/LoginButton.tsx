"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isLocalOnly } from "@/lib/appMode";

export function LoginButton() {
  if (isLocalOnly()) {
    return (
      <div className="rounded-xl border px-4 py-3 text-center text-sm">
        ローカルモード有効（ログイン不要）
      </div>
    );
  }

  const handleLogin = async () => {
    const supabase = createSupabaseBrowserClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="w-full rounded-xl bg-accent px-4 py-3 text-accent-foreground"
    >
      Googleでログイン
    </button>
  );
}
