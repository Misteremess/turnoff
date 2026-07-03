import { createClient } from "@/lib/supabase/server";
import type { Service, ShiftWithService } from "@/lib/types";
import { CalendarView } from "@/components/calendar/CalendarView";

export default async function CalendarPage() {
  const supabase = await createClient();

  const [{ data: services }, { data: shifts }] = await Promise.all([
    supabase.from("services").select("*").order("created_at", { ascending: true }),
    supabase
      .from("shifts")
      .select("*, service:services(*)")
      .order("starts_at", { ascending: true }),
  ]);

  return (
    <CalendarView
      services={(services as Service[]) ?? []}
      shifts={(shifts as ShiftWithService[]) ?? []}
    />
  );
}
