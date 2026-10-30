import { createClient } from "@/lib/supabase/server";

export interface StaffCheck {
  ok: boolean;
  userId?: string;
  isAdmin?: boolean;
  error?: string;
}

/**
 * Verifica que el usuario autenticado tenga perfil de staff (fila en profiles)
 * y opcionalmente rol ADMIN. Necesario antes de mutar con service_role, que
 * ignora RLS.
 */
export async function checkStaff(requireAdmin = false): Promise<StaffCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role_id, roles(name)")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Tu cuenta no tiene permisos de operador." };
  }

  const roleName = (data as unknown as { roles?: { name?: string } | null }).roles
    ?.name;
  const isAdmin = roleName === "ADMIN";

  if (requireAdmin && !isAdmin) {
    return { ok: false, error: "Esta acción requiere permisos de administrador." };
  }

  return { ok: true, userId: user.id, isAdmin };
}
