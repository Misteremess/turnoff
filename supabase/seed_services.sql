-- TurnOff — carga inicial de tus servicios.
-- IMPORTANTE: ejecútalo DESPUÉS de haber iniciado sesión al menos una vez
-- (así ya existe tu usuario). Ajusta el email si hiciera falta.
-- Las tarifas quedan a 0: edítalas luego desde la app.

insert into public.services (user_id, name, color, templates)
select u.id, v.name, v.color, v.templates
from (
  select id from auth.users where email = 'maximoduperez@gmail.com' limit 1
) u,
(values
  ('Consejería de Economía y Empleo',            '#2563eb', '[]'::jsonb),
  ('Consejería de Hacienda y AAPP',              '#16a34a', '[]'::jsonb),
  ('Oficina de Empleo',                          '#dc2626', '[]'::jsonb),
  ('Centro Nacional de Formación IPEX',          '#d97706', '[]'::jsonb),
  ('Delegación Provincial de Economía y Empleo', '#0891b2', '[]'::jsonb),
  ('Universidad Laboral de Toledo',              '#7c3aed',
    '[
      {"id":"t","code":"T","start":"14:00","end":"22:00"},
      {"id":"i","code":"I","start":"07:30","end":"19:30"},
      {"id":"g","code":"G","start":"22:00","end":"07:30"},
      {"id":"h","code":"H","start":"19:30","end":"07:30"}
    ]'::jsonb),
  ('Edificio del SESCAM',                        '#db2777', '[]'::jsonb),
  ('Consejería de Sanidad y Bienestar Social',   '#0d9488', '[]'::jsonb),
  ('Delegación de Agricultura',                  '#65a30d', '[]'::jsonb),
  ('Consejería de Fomento',                      '#9333ea', '[]'::jsonb),
  ('Centro de Drogodependencia El Alba',         '#e11d48', '[]'::jsonb)
) as v(name, color, templates);
