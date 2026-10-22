/**
 * Rate limit con ventana fija.
 *
 * Backend principal: tabla `rate_limits` + función `consume_rate_limit` en
 * Supabase (migración 0028). Se llama por REST con la clave de servicio, así
 * que funciona tanto en Server Actions (Node) como en el proxy (Edge).
 *
 * Si la migración no está aplicada o la base de datos no responde, se usa un
 * fallback en memoria. Ese fallback solo protege una instancia y no debe
 * considerarse definitivo en producción.
 *
 * Las claves se hashean con SHA-256 antes de viajar a la base de datos para no
 * almacenar correos ni IPs en claro.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface RateLimitOptions {
  /** Si el backend falla, niega la petición (login). Por defecto permite. */
  failClosed?: boolean;
}

async function hashKey(key: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(key);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return key;
  }
}

function memoryLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();

  if (memoryStore.size > 5000) {
    for (const [storedKey, entry] of memoryStore) {
      if (now > entry.resetAt) memoryStore.delete(storedKey);
    }
  }

  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.max - 1,
      retryAfterMs: config.windowMs,
    };
  }

  entry.count += 1;

  if (entry.count > config.max) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  return {
    allowed: true,
    remaining: config.max - entry.count,
    retryAfterMs: entry.resetAt - now,
  };
}

type RemoteResult =
  | { status: "ok"; limit: RateLimitResult }
  /** La migración 0028 aún no está aplicada: se usa el fallback. */
  | { status: "missing" }
  | { status: "error" };

async function remoteLimit(
  key: string,
  config: RateLimitConfig
): Promise<RemoteResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return { status: "missing" };

  try {
    const response = await fetch(`${url}/rest/v1/rpc/consume_rate_limit`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_key: key,
        p_window_ms: config.windowMs,
        p_max: config.max,
      }),
      cache: "no-store",
    });

    if (response.status === 404) return { status: "missing" };
    if (!response.ok) {
      console.warn("rate-limit RPC failed", response.status);
      return { status: "error" };
    }

    const data = (await response.json()) as
      | Array<{ allowed?: boolean; remaining?: number; retry_after_ms?: number }>
      | null;

    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row.allowed !== "boolean") return { status: "error" };

    return {
      status: "ok",
      limit: {
        allowed: row.allowed,
        remaining: Number(row.remaining ?? 0),
        retryAfterMs: Number(row.retry_after_ms ?? config.windowMs),
      },
    };
  } catch (error) {
    console.warn("rate-limit RPC error", error);
    return { status: "error" };
  }
}

export async function rateLimit(
  key: string,
  config: RateLimitConfig,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const hashedKey = await hashKey(key);
  const remote = await remoteLimit(hashedKey, config);

  if (remote.status === "ok") return remote.limit;

  // Sin migración aplicada el fallback en memoria es la única opción.
  if (remote.status === "missing") return memoryLimit(hashedKey, config);

  if (options.failClosed) {
    // Error del backend (no tabla ausente): no se puede garantizar el límite.
    return { allowed: false, remaining: 0, retryAfterMs: config.windowMs };
  }

  return memoryLimit(hashedKey, config);
}

export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 5 },
  placeOrder: { windowMs: 10 * 60 * 1000, max: 10 },
  review: { windowMs: 10 * 60 * 1000, max: 15 },
  pqr: { windowMs: 30 * 60 * 1000, max: 5 },
  api: { windowMs: 60 * 1000, max: 60 },
} as const;
