"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pushShiftToGoogle, deleteGoogleEvent } from "@/lib/google/calendar";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Sincroniza con Google en segundo plano, sin bloquear la respuesta al usuario. */
function pushToGoogleInBackground(shiftId: string, supabase: SupabaseServer) {
  after(async () => {
    try {
      await pushShiftToGoogle(shiftId, supabase);
    } catch (e) {
      console.error("Google push falló:", e);
    }
  });
}

export async function saveShift(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const id = (formData.get("id") as string) || null;
  const payload = {
    user_id: user.id,
    service_id: formData.get("service_id") as string,
    starts_at: new Date(formData.get("starts_at") as string).toISOString(),
    ends_at: new Date(formData.get("ends_at") as string).toISOString(),
    break_minutes: Number(formData.get("break_minutes") ?? 0) || 0,
    code: ((formData.get("code") as string) || "").trim() || null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
  };

  if (!payload.service_id) throw new Error("Selecciona un servicio");
  if (new Date(payload.ends_at) <= new Date(payload.starts_at)) {
    throw new Error("La hora de fin debe ser posterior a la de inicio");
  }

  let shiftId = id;
  if (id) {
    const { error } = await supabase.from("shifts").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("shifts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    shiftId = data.id;
  }

  if (shiftId) pushToGoogleInBackground(shiftId, supabase);

  revalidatePath("/");
  revalidatePath("/reports");
}

/**
 * "Estampa" un turno en el calendario a partir de una plantilla (modo pintar).
 * Recibe las fechas ya calculadas en hora local del cliente (ISO).
 */
export async function stampShift(input: {
  serviceId: string;
  startsAt: string;
  endsAt: string;
  code: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("shifts")
    .insert({
      user_id: user.id,
      service_id: input.serviceId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      code: input.code || null,
      break_minutes: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  pushToGoogleInBackground(data.id, supabase);

  revalidatePath("/");
  revalidatePath("/reports");
}

export async function updateShiftTimes(id: string, startsAt: string, endsAt: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shifts")
    .update({ starts_at: startsAt, ends_at: endsAt })
    .eq("id", id);
  if (error) throw new Error(error.message);

  pushToGoogleInBackground(id, supabase);

  revalidatePath("/");
  revalidatePath("/reports");
}

export async function deleteShift(id: string) {
  const supabase = await createClient();

  // Recuperamos el evento de Google antes de borrar para poder eliminarlo allí.
  const { data: shift } = await supabase
    .from("shifts")
    .select("google_event_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (shift?.google_event_id) {
    const eventId = shift.google_event_id;
    after(async () => {
      try {
        await deleteGoogleEvent(eventId, supabase);
      } catch (e) {
        console.error("Google delete falló:", e);
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/reports");
}
