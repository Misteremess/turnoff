-- TurnOff — cálculo automático de nocturnidad/festivos.
-- Ejecuta este SQL en el SQL Editor de Supabase.
-- Es idempotente e incluye lo de 0002 por si no llegó a ejecutarse.

-- Plantillas de turno por servicio (código + horario) para el "modo pintar".
alter table public.services
  add column if not exists templates jsonb not null default '[]'::jsonb;

-- Código del turno (T, I, G, H, ...) para mostrarlo en el calendario.
alter table public.shifts
  add column if not exists code text;

-- El tipo de turno ya no se elige a mano: la nocturnidad (22:00–06:00) y los
-- festivos (calendario de Toledo) se calculan automáticamente por tramos.
-- Se relaja la columna antigua para que no bloquee inserciones.
alter table public.shifts alter column type set default 'normal';
alter table public.shifts drop constraint if exists shifts_type_check;
