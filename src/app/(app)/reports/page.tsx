import { createClient } from "@/lib/supabase/server";
import type { PayrollConfig, MonthlyExtra, ShiftWithService } from "@/lib/types";
import { DEFAULT_PAYROLL_CONFIG } from "@/lib/payroll-defaults";
import { monthAccrual } from "@/lib/payroll";
import { ReportsClient } from "./ReportsClient";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();

  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  // Mes anterior: sus horas extra son las que se COBRAN en la nómina de este mes.
  const prevStart = new Date(y, m - 2, 1);
  const prevEnd = start;

  const supabase = await createClient();
  const [{ data: shifts }, { data: prevShifts }, { data: settings }] = await Promise.all([
    supabase
      .from("shifts")
      .select("*, service:services(*)")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("shifts")
      .select("*, service:services(*)")
      .gte("starts_at", prevStart.toISOString())
      .lt("starts_at", prevEnd.toISOString()),
    supabase
      .from("user_settings")
      .select("monthly_extras, monthly_hours, overtime_rate, night_plus, festive_plus")
      .maybeSingle(),
  ]);

  // Si nunca se guardó, usamos los valores del convenio.
  const hasSettings = settings != null;
  const config: PayrollConfig = hasSettings
    ? {
        monthlyExtras: (settings.monthly_extras as MonthlyExtra[]) ?? DEFAULT_PAYROLL_CONFIG.monthlyExtras,
        monthlyHours: settings.monthly_hours != null ? Number(settings.monthly_hours) : DEFAULT_PAYROLL_CONFIG.monthlyHours,
        overtimeRate: settings.overtime_rate != null ? Number(settings.overtime_rate) : DEFAULT_PAYROLL_CONFIG.overtimeRate,
        nightPlus: settings.night_plus != null ? Number(settings.night_plus) : DEFAULT_PAYROLL_CONFIG.nightPlus,
        festivePlus: settings.festive_plus != null ? Number(settings.festive_plus) : DEFAULT_PAYROLL_CONFIG.festivePlus,
      }
    : DEFAULT_PAYROLL_CONFIG;

  const prevAccrual = monthAccrual((prevShifts as ShiftWithService[]) ?? [], config);

  return (
    <ReportsClient
      shifts={(shifts as ShiftWithService[]) ?? []}
      month={month}
      config={config}
      isDefault={!hasSettings}
      prevMonthExtraHours={prevAccrual.extraHours}
    />
  );
}
