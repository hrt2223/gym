import { redirect } from "next/navigation";
import { cache } from "react";
import { isLocalOnly } from "@/lib/appMode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { seedDefaultExercisesIfEmpty } from "@/lib/repo";

export type AppUser = { id: string };

// 同一リクエスト内でキャッシュ（重複した認証チェックを防ぐ）
export const getUser = cache(async (): Promise<AppUser | null> => {
  if (isLocalOnly()) {
    return { id: "local-user" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { id: user.id } : null;
});

export async function requireUser(): Promise<AppUser> {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  try {
    await seedDefaultExercisesIfEmpty(user.id);
  } catch (err) {
    console.error("seedDefaultExercisesIfEmpty failed", err);
  }

  return user;
}
