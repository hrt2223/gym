import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isLocalOnly } from "@/lib/appMode";

export async function middleware(request: NextRequest) {
  if (isLocalOnly()) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // 環境変数未設定でもログイン画面だけは見せたいので、ここでは落とさない
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  const pathname = request.nextUrl.pathname;
  const perfEnabled = process.env.GYMAPP_PERF_LOG === "1";

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const authStart = perfEnabled ? Date.now() : 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (perfEnabled) {
    const authMs = Date.now() - authStart;
    console.log(
      `[perf] middleware auth.getUser ${authMs.toFixed(1)}ms ${JSON.stringify({
        pathname,
        hasUser: Boolean(user),
      })}`
    );
  }

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico";

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
