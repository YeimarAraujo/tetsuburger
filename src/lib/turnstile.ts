import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  ok: boolean;
  error?: string;
}

/**
 * Verifica un token de Cloudflare Turnstile en el servidor.
 *
 * - Sin `TURNSTILE_SECRET_KEY` la verificación se omite (útil en local y en
 *   despliegues donde aún no se ha configurado). Se registra un aviso.
 * - Con clave configurada, un token ausente o inválido bloquea la acción.
 */
export async function verifyTurnstile(
  token: string,
  ip?: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "TURNSTILE_SECRET_KEY no está configurada: la verificación anti-bot está desactivada."
      );
    }
    return { ok: true };
  }

  if (!token) {
    return { ok: false, error: "Completa la verificación de seguridad." };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "anonymous") body.set("remoteip", ip);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        error: "No se pudo verificar la seguridad. Intenta de nuevo.",
      };
    }

    const data = (await response.json()) as { success?: boolean };
    if (!data.success) {
      return {
        ok: false,
        error: "La verificación de seguridad falló. Recarga la página e intenta de nuevo.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("verifyTurnstile error", error);
    return {
      ok: false,
      error: "No se pudo verificar la seguridad. Intenta de nuevo.",
    };
  }
}
