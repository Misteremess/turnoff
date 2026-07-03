import type { MonthlyExtra, PayrollConfig, ShiftWithService } from "./types";
import { isToledoHoliday } from "./holidays";

/** Ventana de nocturnidad: de 22:00 a 06:00. */
export const NIGHT_START = 22;
export const NIGHT_END = 6;

interface ShiftTimes {
  starts_at: string;
  ends_at: string;
  break_minutes?: number | null;
}

/** Tarifas de plus por hora (de convenio, iguales para todos los servicios). */
export interface PlusRates {
  nightPlus: number;
  festivePlus: number;
}

/**
 * Desglose de un turno. NO hay pago por hora base: el sueldo base lo cubre la
 * retribución fija mensual (162 h). Aquí solo se cuentan las horas y el importe
 * de los PLUSES (nocturno y domingo/festivo), que se cobran aparte por hora.
 */
export interface Breakdown {
  totalHours: number;
  nightHours: number;
  festiveHours: number;
  nightAmount: number;
  festiveAmount: number;
  plusAmount: number; // nightAmount + festiveAmount
}

export function emptyBreakdown(): Breakdown {
  return {
    totalHours: 0,
    nightHours: 0,
    festiveHours: 0,
    nightAmount: 0,
    festiveAmount: 0,
    plusAmount: 0,
  };
}

/** Horas netas de un turno (descontando el descanso). */
export function shiftHours(shift: ShiftTimes): number {
  const ms = new Date(shift.ends_at).getTime() - new Date(shift.starts_at).getTime();
  const gross = ms / 3_600_000;
  const net = gross - (shift.break_minutes ?? 0) / 60;
  return Math.max(0, net);
}

function isNightHour(d: Date): boolean {
  const h = d.getHours();
  return h >= NIGHT_START || h < NIGHT_END;
}

/** Domingo o festivo en Toledo: devenga el plus de domingo/festivo. */
function isFestiveDay(d: Date): boolean {
  return d.getDay() === 0 || isToledoHoliday(d);
}

/** Siguiente frontera de cálculo tras `d`: las 06:00, las 22:00 o medianoche. */
function nextBoundary(d: Date): Date {
  const six = new Date(d);
  six.setHours(NIGHT_END, 0, 0, 0);
  const night = new Date(d);
  night.setHours(NIGHT_START, 0, 0, 0);
  const midnight = new Date(d);
  midnight.setHours(24, 0, 0, 0);
  const candidates = [six, night, midnight].filter((c) => c > d);
  return new Date(Math.min(...candidates.map((c) => c.getTime())));
}

/**
 * Desglosa un turno en horas totales, nocturnas y de domingo/festivo. Un mismo
 * tramo puede ser a la vez nocturno y festivo (madrugada de un domingo) y
 * cobra ambos pluses. El descanso se descuenta proporcionalmente.
 */
export function shiftBreakdown(shift: ShiftTimes, rates?: Partial<PlusRates>): Breakdown {
  const start = new Date(shift.starts_at);
  const end = new Date(shift.ends_at);
  const b = emptyBreakdown();
  if (!(end > start)) return b;

  let totalHours = 0;
  let nightHours = 0;
  let festiveHours = 0;

  let cur = new Date(start);
  while (cur < end) {
    const to = new Date(Math.min(nextBoundary(cur).getTime(), end.getTime()));
    const hours = (to.getTime() - cur.getTime()) / 3_600_000;
    totalHours += hours;
    if (isNightHour(cur)) nightHours += hours;
    if (isFestiveDay(cur)) festiveHours += hours;
    cur = to;
  }

  // Descanso: descuento proporcional.
  const net = Math.max(0, totalHours - (shift.break_minutes ?? 0) / 60);
  const factor = totalHours > 0 ? net / totalHours : 0;
  b.totalHours = totalHours * factor;
  b.nightHours = nightHours * factor;
  b.festiveHours = festiveHours * factor;
  b.nightAmount = b.nightHours * (rates?.nightPlus ?? 0);
  b.festiveAmount = b.festiveHours * (rates?.festivePlus ?? 0);
  b.plusAmount = b.nightAmount + b.festiveAmount;
  return b;
}

/** Importe variable de un turno = solo sus pluses (el base es mensual). */
export function shiftPlus(shift: ShiftTimes, rates?: Partial<PlusRates>): number {
  return shiftBreakdown(shift, rates).plusAmount;
}

/** Suma los desgloses de una lista de turnos. */
export function sumBreakdown(shifts: ShiftWithService[], rates?: Partial<PlusRates>): Breakdown {
  const acc = emptyBreakdown();
  for (const s of shifts) {
    const b = shiftBreakdown(s, rates);
    acc.totalHours += b.totalHours;
    acc.nightHours += b.nightHours;
    acc.festiveHours += b.festiveHours;
    acc.nightAmount += b.nightAmount;
    acc.festiveAmount += b.festiveAmount;
    acc.plusAmount += b.plusAmount;
  }
  return acc;
}

/** Total de la retribución fija mensual (jornada completa). */
export function monthlyExtrasTotal(extras: MonthlyExtra[]): number {
  return extras.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/**
 * Lo que GENERA un mes trabajado, según convenio:
 * - El fijo mensual corresponde a la jornada completa (p.ej. 162 h); se
 *   devenga la parte proporcional a las horas ordinarias trabajadas.
 * - Las horas por encima de la jornada son extraordinarias. OJO: las horas
 *   extra se cobran a mes vencido (la nómina del mes siguiente), así que aquí
 *   solo se cuentan las horas generadas — el importe se calcula en
 *   `monthPayout` con la tarifa vigente el mes en que se cobran.
 * - Los pluses (nocturno, domingo/festivo) se cobran el mismo mes.
 */
export interface MonthAccrual {
  workedHours: number;
  ordinaryHours: number;
  extraHours: number; // generadas este mes; se pagan el mes siguiente
  fixedFull: number; // fijo de jornada completa
  fixedEarned: number; // fijo devengado este mes (prorrateado)
  plusAmount: number; // nocturno + domingo/festivo, se cobra este mismo mes
}

export function monthAccrual(shifts: ShiftWithService[], config: PayrollConfig): MonthAccrual {
  const jornada = config.monthlyHours > 0 ? config.monthlyHours : 162;
  const b = sumBreakdown(shifts, config);
  const workedHours = b.totalHours;
  const ordinaryHours = Math.min(workedHours, jornada);
  const extraHours = Math.max(0, workedHours - jornada);

  const fixedFull = monthlyExtrasTotal(config.monthlyExtras);
  const fixedEarned = fixedFull * (ordinaryHours / jornada);

  return { workedHours, ordinaryHours, extraHours, fixedFull, fixedEarned, plusAmount: b.plusAmount };
}

/**
 * Lo que se COBRA en la nómina de un mes: el fijo y los pluses devengados
 * ESTE mes, más las horas extra GENERADAS EL MES ANTERIOR (mes vencido),
 * pagadas a la tarifa de hora extra vigente.
 */
export interface MonthPayout extends MonthAccrual {
  extraHoursPaid: number; // generadas el mes anterior, cobradas este mes
  overtimeAmount: number;
  grandTotal: number;
}

export function monthPayout(
  accrual: MonthAccrual,
  previousMonthExtraHours: number,
  overtimeRate: number,
): MonthPayout {
  const extraHoursPaid = Math.max(0, previousMonthExtraHours);
  const overtimeAmount = extraHoursPaid * (overtimeRate || 0);
  return {
    ...accrual,
    extraHoursPaid,
    overtimeAmount,
    grandTotal: accrual.fixedEarned + accrual.plusAmount + overtimeAmount,
  };
}

export interface ServiceTotals {
  serviceId: string;
  serviceName: string;
  color: string;
  hours: number;
  plus: number;
  count: number;
}

/** Agrupa por servicio: horas trabajadas y pluses generados en cada uno. */
export function totalsByService(shifts: ShiftWithService[], rates?: Partial<PlusRates>): ServiceTotals[] {
  const map = new Map<string, ServiceTotals>();
  for (const s of shifts) {
    if (!s.service) continue;
    const entry =
      map.get(s.service.id) ??
      {
        serviceId: s.service.id,
        serviceName: s.service.name,
        color: s.service.color,
        hours: 0,
        plus: 0,
        count: 0,
      };
    entry.hours += shiftHours(s);
    entry.plus += shiftPlus(s, rates);
    entry.count += 1;
    map.set(s.service.id, entry);
  }
  return [...map.values()].sort((a, b) => b.hours - a.hours);
}
