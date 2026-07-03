import { createClient } from "@/lib/supabase/server";
import type { ShiftWithService } from "@/lib/types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

interface SyncState {
  user_id: string;
  google_refresh_token: string | null;
  google_sync_token: string | null;
  google_calendar_id: string;
  sync_enabled: boolean;
}

/** ¿Están las credenciales de Google configuradas en el servidor? */
function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function getSyncState(supabase: SupabaseServer, userId: string): Promise<SyncState | null> {
  const { data } = await supabase
    .from("sync_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as SyncState) ?? null;
}

/** Obtiene un access_token de Google válido renovándolo con el refresh_token. */
async function getAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("Google token refresh error:", await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

function buildEvent(shift: ShiftWithService) {
  const serviceName = shift.service?.name ?? "Turno";
  return {
    summary: shift.code ? `🛡️ ${shift.code} · ${serviceName}` : `🛡️ ${serviceName}`,
    description: [
      `Servicio: ${serviceName}`,
      shift.code ? `Turno: ${shift.code}` : null,
      shift.break_minutes ? `Descanso: ${shift.break_minutes} min` : null,
      shift.notes ? `Notas: ${shift.notes}` : null,
      shift.service?.address ? `Dirección: ${shift.service.address}` : null,
      "\n— Creado con TurnOff",
    ]
      .filter(Boolean)
      .join("\n"),
    location: shift.service?.address ?? undefined,
    start: { dateTime: shift.starts_at },
    end: { dateTime: shift.ends_at },
    colorId: undefined as string | undefined,
  };
}

/**
 * Crea o actualiza el evento de Google para un turno y guarda el google_event_id.
 * No hace nada si la sincronización no está configurada o desactivada.
 * Acepta un cliente ya creado para poder ejecutarse en segundo plano (after()).
 */
export async function pushShiftToGoogle(shiftId: string, client?: SupabaseServer): Promise<void> {
  if (!googleConfigured()) return;
  const supabase = client ?? (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const sync = await getSyncState(supabase, user.id);
  if (!sync?.sync_enabled || !sync.google_refresh_token) return;

  const { data: shift } = await supabase
    .from("shifts")
    .select("*, service:services(*)")
    .eq("id", shiftId)
    .single();
  if (!shift) return;

  const accessToken = await getAccessToken(sync.google_refresh_token);
  if (!accessToken) return;

  const event = buildEvent(shift as ShiftWithService);
  const calId = encodeURIComponent(sync.google_calendar_id || "primary");
  const existingId = (shift as ShiftWithService).google_event_id;

  const url = existingId
    ? `${CAL_API}/calendars/${calId}/events/${existingId}`
    : `${CAL_API}/calendars/${calId}/events`;

  const res = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    console.error("Google event push error:", await res.text());
    return;
  }

  const created = (await res.json()) as { id?: string };
  if (!existingId && created.id) {
    await supabase.from("shifts").update({ google_event_id: created.id }).eq("id", shiftId);
  }
}

/** Elimina un evento en Google Calendar. */
export async function deleteGoogleEvent(eventId: string, client?: SupabaseServer): Promise<void> {
  if (!googleConfigured()) return;
  const supabase = client ?? (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const sync = await getSyncState(supabase, user.id);
  if (!sync?.sync_enabled || !sync.google_refresh_token) return;

  const accessToken = await getAccessToken(sync.google_refresh_token);
  if (!accessToken) return;

  const calId = encodeURIComponent(sync.google_calendar_id || "primary");
  const res = await fetch(`${CAL_API}/calendars/${calId}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 410 = ya borrado; lo tratamos como éxito.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    console.error("Google event delete error:", await res.text());
  }
}

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * Pull incremental desde Google: trae eventos nuevos/cambiados/borrados usando
 * el syncToken guardado. Solo importa eventos creados por TurnOff (que tienen
 * google_event_id ya asociado) para borrados; para altas nuevas crea turnos
 * "sin asignar" que el usuario puede completar. Devuelve un resumen.
 *
 * Sin argumentos, sincroniza al usuario de la sesión actual (uso desde la
 * app). Con `userId` + `client` (cliente admin), sincroniza a ese usuario
 * concreto sin depender de cookies de sesión (uso desde el cron en segundo
 * plano, ver `/api/cron/sync`).
 */
export async function pullFromGoogle(
  opts: { userId?: string; client?: SupabaseServer } = {},
): Promise<{ imported: number; deleted: number; ok: boolean; message?: string }> {
  if (!googleConfigured()) return { imported: 0, deleted: 0, ok: false, message: "Google no configurado en el servidor" };
  const supabase = opts.client ?? (await createClient());

  let userId = opts.userId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { imported: 0, deleted: 0, ok: false, message: "No autenticado" };
    userId = user.id;
  }

  const sync = await getSyncState(supabase, userId);
  if (!sync?.sync_enabled || !sync.google_refresh_token) {
    return { imported: 0, deleted: 0, ok: false, message: "Sincronización no activada" };
  }

  const accessToken = await getAccessToken(sync.google_refresh_token);
  if (!accessToken) return { imported: 0, deleted: 0, ok: false, message: "No se pudo renovar el token de Google" };

  const calId = encodeURIComponent(sync.google_calendar_id || "primary");

  // Servicio por defecto para eventos que llegan desde Google.
  const { data: defaultService } = await supabase
    .from("services")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let imported = 0;
  let deleted = 0;
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    const params = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "250" });
    if (sync.google_sync_token) {
      params.set("syncToken", sync.google_sync_token);
    } else {
      // Primera vez: solo desde ahora hacia adelante para no importar historial.
      params.set("timeMin", new Date().toISOString());
    }
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${CAL_API}/calendars/${calId}/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 410) {
      // syncToken caducado: reiniciamos.
      await supabase.from("sync_state").update({ google_sync_token: null }).eq("user_id", userId);
      return { imported, deleted, ok: false, message: "El token de sincronización caducó, vuelve a sincronizar" };
    }
    if (!res.ok) {
      return { imported, deleted, ok: false, message: `Error de Google: ${res.status}` };
    }

    const json = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };
    for (const ev of json.items ?? []) {
      // Buscamos si ya tenemos un turno asociado a este evento.
      const { data: existing } = await supabase
        .from("shifts")
        .select("id")
        .eq("google_event_id", ev.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (ev.status === "cancelled") {
        if (existing) {
          await supabase.from("shifts").delete().eq("id", existing.id);
          deleted++;
        }
        continue;
      }

      const start = ev.start?.dateTime ?? ev.start?.date;
      const end = ev.end?.dateTime ?? ev.end?.date;
      if (!start || !end) continue;

      if (existing) {
        await supabase
          .from("shifts")
          .update({ starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() })
          .eq("id", existing.id);
      } else if (defaultService) {
        // Evento nuevo creado desde Google: lo importamos al servicio por defecto.
        await supabase.from("shifts").insert({
          user_id: userId,
          service_id: defaultService.id,
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(end).toISOString(),
          notes: ev.summary ? `Importado de Google: ${ev.summary}` : "Importado de Google",
          google_event_id: ev.id,
        });
        imported++;
      }
    }

    pageToken = json.nextPageToken;
    if (json.nextSyncToken) nextSyncToken = json.nextSyncToken;
  } while (pageToken);

  await supabase
    .from("sync_state")
    .update({ google_sync_token: nextSyncToken ?? sync.google_sync_token, last_synced_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { imported, deleted, ok: true };
}
