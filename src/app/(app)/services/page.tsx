import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/lib/types";
import { ServicesClient } from "./ServicesClient";

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .order("created_at", { ascending: true });

  return <ServicesClient services={(data as Service[]) ?? []} />;
}
