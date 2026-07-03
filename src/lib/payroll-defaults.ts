import type { MonthlyExtra, PayrollConfig } from "./types";

/**
 * Valores del convenio colectivo estatal de empresas de seguridad 2026-2030
 * (BOE-A-2026-8569) para Vigilante de Seguridad sin arma.
 *
 * Derivación: nóminas reales de 2025 (Salzillo Seguridad) × 1,03 (el convenio
 * 2026 aplica +3% sobre 2025). Validado: plus peligrosidad 23,38 × 1,03 =
 * 24,08 €, que coincide con el Anexo II publicado. Todo es editable en Informes.
 */
export const DEFAULT_MONTHLY_EXTRAS: MonthlyExtra[] = [
  { id: "salario-base", name: "Salario base", amount: 1161.28 },
  { id: "prorrata-extras", name: "Prorrata pagas extra", amount: 296.34 },
  { id: "plus-transporte", name: "Plus transporte", amount: 137.81 },
  { id: "plus-vestuario", name: "Plus vestuario", amount: 112.27 },
  { id: "plus-peligrosidad", name: "Plus peligrosidad", amount: 24.08 },
  { id: "prima-seguro", name: "Prima seguro convenio", amount: 0.75 },
];

/** Jornada mensual completa del convenio: 162 h/mes (1.782 h/año). */
export const DEFAULT_MONTHLY_HOURS = 162;

/** Hora extraordinaria 2026, vigilante sin arma. */
export const DEFAULT_OVERTIME_RATE = 9.98;

/** Plus por hora nocturna (22:00–06:00), 2026. */
export const DEFAULT_NIGHT_PLUS = 1.26;

/** Plus por hora en domingo o festivo, 2026. */
export const DEFAULT_FESTIVE_PLUS = 1.02;

/** Configuración de nómina por defecto (convenio 2026). */
export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  monthlyExtras: DEFAULT_MONTHLY_EXTRAS,
  monthlyHours: DEFAULT_MONTHLY_HOURS,
  overtimeRate: DEFAULT_OVERTIME_RATE,
  nightPlus: DEFAULT_NIGHT_PLUS,
  festivePlus: DEFAULT_FESTIVE_PLUS,
};
