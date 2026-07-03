-- TurnOff — modelo de nómina real (derivado de nóminas del convenio de
-- seguridad privada): retribución fija mensual + pluses por hora ADITIVOS.
-- Ejecuta este SQL en el SQL Editor de Supabase.

-- Pluses por hora del servicio: se SUMAN a la tarifa base (no la sustituyen).
alter table public.services
  add column if not exists night_plus numeric(8, 2),
  add column if not exists sunday_holiday_plus numeric(8, 2);

-- Las tarifas sustitutivas antiguas dejan de usarse.
alter table public.services drop column if exists night_rate;
alter table public.services drop column if exists holiday_rate;
alter table public.services drop column if exists overtime_rate;

-- Retribución fija mensual (salario base, prorrata pagas, transporte,
-- vestuario, peligrosidad, seguro...). Es global (por contrato), no por
-- servicio: se cobra una vez al mes trabajes en el puesto que trabajes.
create table if not exists public.user_settings (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  monthly_extras jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "own user_settings" on public.user_settings;
create policy "own user_settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
