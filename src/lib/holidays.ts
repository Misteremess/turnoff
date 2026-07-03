/**
 * Festivos de Toledo capital (nacionales + Castilla-La Mancha + locales).
 *
 * Fijos: Año Nuevo, Reyes, San Ildefonso (local), Fiesta del Trabajo, Día de
 * Castilla-La Mancha, Asunción, Fiesta Nacional, Todos los Santos, Constitución,
 * Inmaculada y Navidad.
 * Móviles (según Pascua): Jueves Santo, Viernes Santo y Corpus Christi (local).
 *
 * Nota: cuando un festivo cae en domingo, la administración puede trasladarlo;
 * este cálculo usa las fechas "canónicas". Si un año difiere, se puede ajustar.
 */

/** Domingo de Pascua (algoritmo de Butcher, calendario gregoriano). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// [mes, día] — festivos de fecha fija.
const FIXED: [number, number][] = [
  [1, 1], // Año Nuevo
  [1, 6], // Epifanía (Reyes)
  [1, 23], // San Ildefonso (local Toledo)
  [5, 1], // Fiesta del Trabajo
  [5, 31], // Día de Castilla-La Mancha
  [8, 15], // Asunción de la Virgen
  [10, 12], // Fiesta Nacional de España
  [11, 1], // Todos los Santos
  [12, 6], // Día de la Constitución
  [12, 8], // Inmaculada Concepción
  [12, 25], // Navidad
];

const cache = new Map<number, Set<string>>();

const key = (month: number, day: number) => `${month}-${day}`;

/** Conjunto de festivos ("mes-día") de un año en Toledo. */
export function toledoHolidays(year: number): Set<string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const set = new Set(FIXED.map(([m, d]) => key(m, d)));
  const easter = easterSunday(year);
  const addFromEaster = (offsetDays: number) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + offsetDays);
    set.add(key(d.getMonth() + 1, d.getDate()));
  };
  addFromEaster(-3); // Jueves Santo
  addFromEaster(-2); // Viernes Santo
  addFromEaster(60); // Corpus Christi (local Toledo)

  cache.set(year, set);
  return set;
}

/** ¿Es festivo en Toledo el día (local) de esta fecha? */
export function isToledoHoliday(d: Date): boolean {
  return toledoHolidays(d.getFullYear()).has(key(d.getMonth() + 1, d.getDate()));
}
