"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PayrollConfig } from "@/lib/types";

/** Guarda la configuración de nómina (fijo mensual, jornada, hora extra, pluses). */
export async function savePayrollSettings(config: PayrollConfig) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const clean = config.monthlyExtras
    .filter((e) => e && e.name.trim())
    .map((e) => ({
      id: e.id || crypto.randomUUID(),
      name: e.name.trim(),
      amount: Number(e.amount) || 0,
    }));

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      monthly_extras: clean,
      monthly_hours: Number(config.monthlyHours) > 0 ? Number(config.monthlyHours) : 162,
      overtime_rate: Number(config.overtimeRate) || 0,
      night_plus: Number(config.nightPlus) || 0,
      festive_plus: Number(config.festivePlus) || 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/reports");
}
