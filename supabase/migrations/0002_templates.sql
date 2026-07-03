-- TurnOff — plantillas de turno + código en turnos
-- Ejecuta este SQL en el SQL Editor de tu proyecto Supabase.

-- Plantillas de turno por servicio (código + horario), guardadas como JSON.
-- Cada elemento: { "id": "...", "code": "T", "start": "14:00", "end": "22:00", "type": "normal" }
alter table public.services
  add column if not exists templates jsonb not null default '[]'::jsonb;

-- Código del turno (T, I, G, H, ...) para mostrarlo en el calendario.
alter table public.shifts
  add column if not exists code text;
