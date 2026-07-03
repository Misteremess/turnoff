import type { ShiftTemplate } from "./types";

/** "14:00" -> [14, 0] */
function parseHM(hm: string): [number, number] {
  const [h, m] = hm.split(":").map(Number);
  return [h || 0, m || 0];
}

/**
 * Calcula las fechas de inicio y fin de un turno al aplicar una plantilla sobre
 * un día concreto (en hora local). Si la hora de fin es <= la de inicio, el
 * turno cruza medianoche y termina al día siguiente (p.ej. G 22:00–07:30).
 */
export function templateTimes(day: Date, tpl: ShiftTemplate): { start: Date; end: Date } {
  const [sh, sm] = parseHM(tpl.start);
  const [eh, em] = parseHM(tpl.end);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh, sm, 0, 0);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh, em, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1); // cruza medianoche
  return { start, end };
}

/** Texto corto de una plantilla: "T 14:00–22:00". */
export function templateLabel(tpl: ShiftTemplate): string {
  return `${tpl.code} ${tpl.start}–${tpl.end}`;
}

/** Genera un id para una plantilla nueva. */
export function newTemplateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}
