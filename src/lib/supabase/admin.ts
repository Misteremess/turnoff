import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la Service Role Key: bypassa RLS para poder leer/escribir
 * turnos de todos los usuarios sin una sesión de cookies. Solo debe usarse
 * en procesos de servidor de confianza (el cron de sincronización) y nunca
 * exponerse a código de cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
