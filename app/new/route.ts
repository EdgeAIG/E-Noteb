import { NextRequest, NextResponse } from "next/server";
import { createNotebook } from "@/lib/store";
import { ensureSeed } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(req: NextRequest, path: string) {
  const forwarded = req.headers.get("x-forwarded-host");
  const referer = req.headers.get("referer");
  let origin = req.nextUrl.origin;
  if (forwarded) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    origin = `${proto}://${forwarded}`;
  } else if (referer) {
    try {
      origin = new URL(referer).origin;
    } catch {
      /* keep nextUrl.origin */
    }
  }
  return NextResponse.redirect(`${origin}${path}`, 303);
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const nb = createNotebook();
  return redirectTo(req, `/n/${nb.id}`);
}

export async function GET(req: NextRequest) {
  return POST(req);
}
