"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { site } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkStaff } from "@/features/auth/guard";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { pqrSchema } from "@/features/legal/schema";

export interface PqrResult {
  ok?: true;
  error?: string;
}

/** Canal PQR público: guarda la solicitud para atención del negocio. */
export async function submitPqr(raw: unknown): Promise<PqrResult> {
  const parsed = pqrSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  if (input.website) return { ok: true };

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "anonymous";
  const { allowed } = rateLimit(`pqr:${ip}`, RATE_LIMITS.pqr);
  if (!allowed) {
    return { error: "Has enviado varias solicitudes. Intenta de nuevo más tarde." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("pqr_requests").insert({
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    type: input.type,
    message: input.message,
    policy_version: site.legal.policyVersion,
  });

  if (error) {
    // 42P01 / PGRST205: la migración aún no se aplicó.
    if (error.code === "42P01" || error.code === "PGRST205") {
      return {
        error: `El formulario no está disponible en este momento. Escríbenos a ${site.pqrEmail}.`,
      };
    }
    console.error("submitPqr insert error", { code: error.code });
    return { error: "No se pudo enviar la solicitud. Intenta de nuevo." };
  }

  return { ok: true };
}

const pqrStatusSchema = z.enum(["NUEVO", "EN_PROCESO", "CERRADO"]);

export async function setPqrStatus(
  id: string,
  status: "NUEVO" | "EN_PROCESO" | "CERRADO"
): Promise<{ error?: string }> {
  const check = await checkStaff();
  if (!check.ok) return { error: check.error };

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Solicitud no válida" };
  }
  const parsedStatus = pqrStatusSchema.safeParse(status);
  if (!parsedStatus.success) return { error: "Estado no válido" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("pqr_requests")
    .update({ status: parsedStatus.data })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar la solicitud" };

  revalidatePath("/admin/pqr");
  return {};
}
