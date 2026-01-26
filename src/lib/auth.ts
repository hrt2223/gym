import { redirect } from "next/navigation";
import { isLocalOnly } from "@/lib/appMode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppUser = { id: string };

export async function getUser(): Promise<AppUser | null> {
  if (isLocalOnly()) {
    return { id: "local-user" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { id: user.id } : null;
}

export async function requireUser(): Promise<AppUser> {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
