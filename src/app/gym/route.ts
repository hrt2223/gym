import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getGymLoginUrl } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = await getGymLoginUrl(user.id);

  if (!url) {
    return NextResponse.redirect(new URL("/settings", request.url));
  }

  return NextResponse.redirect(url);
}
