import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente anónimo sin cookies, apto para páginas con ISR.
 *
 * No lee la sesión del usuario: úsalo solo para datos públicos que RLS ya
 * permite a `anon`. Para el panel admin usa `@/lib/supabase/server`.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
