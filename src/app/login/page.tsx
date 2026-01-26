import { redirect } from "next/navigation";
import { LoginButton } from "./LoginButton";
import { isLocalOnly } from "@/lib/appMode";
import { getUser } from "@/lib/auth";

export default async function LoginPage() {
  if (isLocalOnly()) {
    redirect("/");
  }

  const user = await getUser();
  if (user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <h1 className="mb-6 text-center text-xl font-semibold">筋トレ記録</h1>
      <LoginButton />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Googleログインのみ対応（MVP）
      </p>
    </main>
  );
}
