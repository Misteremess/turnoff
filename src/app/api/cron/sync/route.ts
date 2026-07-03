import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pullFromGoogle } from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

/**
 * Pull periódico en segundo plano: revisa Google Calendar de todos los
 * usuarios con la sincronización activada, aunque no tengan la app abierta.
 * El push (app → Google) ya ocurre al instante en cada cambio; esto cubre el
 * caso contrario, cambios hechos directamente en Google Calendar.
 *
 * Pensado para llamarse desde un cron externo (p. ej. Cron Jobs de Hostinger)
 * cada 10-15 minutos: `curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/turnoff/api/cron/sync`
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("sync_state")
    .select("user_id")
    .eq("sync_enabled", true)
    .not("google_refresh_token", "is", null);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const results = await Promise.allSettled(
    (rows ?? []).map((row) => pullFromGoogle({ userId: row.user_id, client: supabase })),
  );

  const imported = results.reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value.imported : 0), 0);
  const deleted = results.reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value.deleted : 0), 0);
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ ok: true, users: rows?.length ?? 0, imported, deleted, failed });
}
