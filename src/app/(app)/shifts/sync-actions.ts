"use server";

import { revalidatePath } from "next/cache";
import { pullFromGoogle } from "@/lib/google/calendar";

export async function syncGoogle() {
  const result = await pullFromGoogle();
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/reports");
  }
  return result;
}
