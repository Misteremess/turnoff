"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(value: FormDataEntryValue | null): string | null {
  const s = (value as string | null)?.trim();
  return s ? s : null;
}

export async function saveService(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Las plantillas viajan serializadas en un campo oculto; nos quedamos solo
  // con los campos esperados.
  let templates: { id: string; code: string; start: string; end: string }[] = [];
  try {
    const parsed = JSON.parse((formData.get("templates") as string) || "[]");
    if (Array.isArray(parsed)) {
      templates = parsed
        .filter((t) => t && typeof t.code === "string" && t.code.trim())
        .map((t) => ({
          id: String(t.id ?? crypto.randomUUID()),
          code: String(t.code).trim(),
          start: String(t.start ?? "08:00"),
          end: String(t.end ?? "16:00"),
        }));
    }
  } catch {
    templates = [];
  }

  const id = str(formData.get("id"));
  const payload = {
    user_id: user.id,
    name: str(formData.get("name")) ?? "Servicio",
    address: str(formData.get("address")),
    contact_name: str(formData.get("contact_name")),
    contact_phone: str(formData.get("contact_phone")),
    color: str(formData.get("color")) ?? "#2563eb",
    notes: str(formData.get("notes")),
    templates,
  };

  if (id) {
    const { error } = await supabase.from("services").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("services").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/services");
  revalidatePath("/");
}

/** Añade una plantilla de turno a un servicio (desde la paleta del modo pintar). */
export async function addTemplateToService(
  serviceId: string,
  tpl: { code: string; start: string; end: string },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const code = tpl.code.trim();
  if (!code) throw new Error("El turno necesita un código (ej: T)");

  const { data: service, error: readError } = await supabase
    .from("services")
    .select("templates")
    .eq("id", serviceId)
    .single();
  if (readError) throw new Error(readError.message);

  const templates = Array.isArray(service?.templates) ? service.templates : [];
  templates.push({
    id: crypto.randomUUID(),
    code,
    start: tpl.start || "08:00",
    end: tpl.end || "16:00",
  });

  const { error } = await supabase
    .from("services")
    .update({ templates })
    .eq("id", serviceId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/services");
}

export async function deleteService(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/services");
  revalidatePath("/");
}
