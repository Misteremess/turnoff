-- TurnOff — esquema inicial
-- Ejecuta este SQL en el SQL Editor de tu proyecto Supabase.

-- =========================================================
-- Tabla: services (servicios / clientes del mini-CRM)
-- =========================================================
create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  address       text,
  contact_name  text,
  contact_phone text,
  color         text not null default '#2563eb',
  hourly_rate   numeric(8, 2) not null default 0,
  night_rate    numeric(8, 2),
  holiday_rate  numeric(8, 2),
  overtime_rate numeric(8, 2),
  notes         text,
  created_at    timestamptz not null default now()
);

-- =========================================================
-- Tabla: shifts (turnos)
-- =========================================================
create table if not exists public.shifts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  service_id      uuid not null references public.services (id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  break_minutes   integer not null default 0,
  type            text not null default 'normal'
                    check (type in ('normal', 'noche', 'festivo', 'extra')),
  notes           text,
  google_event_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists shifts_user_starts_idx
  on public.shifts (user_id, starts_at);
create index if not exists shifts_google_event_idx
  on public.shifts (user_id, google_event_id);

-- =========================================================
-- Tabla: sync_state (estado de sincronización con Google)
-- =========================================================
create table if not exists public.sync_state (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  google_sync_token   text,
  google_refresh_token text,
  google_calendar_id  text not null default 'primary',
  sync_enabled        boolean not null default false,
  last_synced_at      timestamptz
);

-- =========================================================
-- Trigger: mantener updated_at en shifts
-- =========================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists shifts_set_updated_at on public.shifts;
create trigger shifts_set_updated_at
  before update on public.shifts
  for each row execute function public.set_updated_at();

-- =========================================================
-- Row Level Security: cada usuario solo ve/edita lo suyo
-- =========================================================
alter table public.services   enable row level security;
alter table public.shifts     enable row level security;
alter table public.sync_state enable row level security;

drop policy if exists "own services" on public.services;
create policy "own services" on public.services
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own shifts" on public.shifts;
create policy "own shifts" on public.shifts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own sync_state" on public.sync_state;
create policy "own sync_state" on public.sync_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
