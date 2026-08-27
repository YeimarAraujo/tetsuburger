import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rate limit en login
  if (pathname === "/admin/login" && request.method === "POST") {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "anonymous";
    const { allowed, resetMs } = rateLimit(`login:${ip}`, RATE_LIMITS.login);
    if (!allowed) {
      const retryAfter = Math.ceil(resetMs / 1000);
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta más tarde." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
