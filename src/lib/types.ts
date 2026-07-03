/**
 * Plantilla de turno predefinida de un servicio (para el "modo pintar").
 * La nocturnidad y los festivos se calculan automáticamente por horario,
 * así que la plantilla solo necesita código y horas.
 */
export interface ShiftTemplate {
  id: string;
  code: string; // p.ej. "T", "I", "G", "H"
  start: string; // "HH:MM"
  end: string; // "HH:MM" (si es <= start, cruza medianoche → día siguiente)
}

/**
 * Un servicio es solo organizativo (dónde trabajas y con qué turnos-tipo).
 * La retribución NO depende del servicio: es de convenio y se configura una
 * sola vez en Informes.
 */
export interface Service {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  color: string;
  notes: string | null;
  templates: ShiftTemplate[];
  created_at: string;
}

/** Concepto fijo mensual de la nómina (salario base, transporte, vestuario…). */
export interface MonthlyExtra {
  id: string;
  name: string;
  amount: number; // €/mes
}

/** Configuración de nómina (global, según convenio). */
export interface PayrollConfig {
  monthlyExtras: MonthlyExtra[];
  monthlyHours: number; // jornada completa, p.ej. 162
  overtimeRate: number; // €/h por hora extraordinaria
  nightPlus: number; // €/h nocturno (22:00–06:00)
  festivePlus: number; // €/h domingo o festivo
}

export interface Shift {
  id: string;
  user_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  code: string | null;
  notes: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Turno con su servicio embebido (join). */
export interface ShiftWithService extends Shift {
  service: Service | null;
}
