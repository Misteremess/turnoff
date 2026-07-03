-- TurnOff — jornada mensual y hora extraordinaria (convenio 2026-2030).
-- La retribución fija corresponde a la jornada completa (162 h/mes): si se
-- trabajan menos horas se prorratea, y por encima son horas extraordinarias.
-- Ejecuta este SQL en el SQL Editor de Supabase.

alter table public.user_settings
  add column if not exists monthly_hours numeric(5, 1) not null default 162,
  add column if not exists overtime_rate numeric(8, 2) not null default 9.98;
