-- TurnOff — la retribución es 100% de convenio (global), no por servicio.
-- El sueldo base YA cubre las 162 h de jornada: no existe un precio/hora que se
-- sume encima. Todo lo que exceda de 162 h es hora extraordinaria.
-- Ejecuta este SQL en el SQL Editor de Supabase.

-- El servicio deja de tener tarifas: pasa a ser solo organizativo.
alter table public.services drop column if exists hourly_rate;
alter table public.services drop column if exists night_plus;
alter table public.services drop column if exists sunday_holiday_plus;
alter table public.services drop column if exists night_rate;
alter table public.services drop column if exists holiday_rate;
alter table public.services drop column if exists overtime_rate;

-- Configuración de nómina (global, por trabajador). Idempotente.
create table if not exists public.user_settings (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  monthly_extras jsonb not null default '[]'::jsonb,
  monthly_hours  numeric(5, 1) not null default 162,
  overtime_rate  numeric(8, 2) not null default 9.98,
  night_plus     numeric(8, 2) not null default 1.26,
  festive_plus   numeric(8, 2) not null default 1.02,
  updated_at     timestamptz not null default now()
);

alter table public.user_settings
  add column if not exists monthly_hours numeric(5, 1) not null default 162,
  add column if not exists overtime_rate numeric(8, 2) not null default 9.98,
  add column if not exists night_plus numeric(8, 2) not null default 1.26,
  add column if not exists festive_plus numeric(8, 2) not null default 1.02;

alter table public.user_settings enable row level security;

drop policy if exists "own user_settings" on public.user_settings;
create policy "own user_settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
