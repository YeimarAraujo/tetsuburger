import { NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Recibe reportes de violaciones CSP (Content-Security-Policy-Report-Only).
 * No guarda datos personales: solo escribe el reporte truncado en el log.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous";

  const { allowed } = await rateLimit(`csp-report:${ip}`, RATE_LIMITS.api);
  if (!allowed) {
    return new NextResponse(null, { status: 429 });
  }

  try {
    const body = await request.text();
    if (body.length > 0 && body.length <= 5000) {
      console.warn("CSP violation", body.slice(0, 2000));
    }
  } catch {
    // Un reporte inválido no debe romper nada.
  }

  return new NextResponse(null, { status: 204 });
}
