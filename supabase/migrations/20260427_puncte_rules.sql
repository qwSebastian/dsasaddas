-- Create puncte_rules table
CREATE TABLE IF NOT EXISTS puncte_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  label text NOT NULL,
  value text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Row Level Security
ALTER TABLE puncte_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_puncte_rules" ON puncte_rules;
DROP POLICY IF EXISTS "auth_write_puncte_rules" ON puncte_rules;

CREATE POLICY "public_read_puncte_rules" ON puncte_rules FOR SELECT USING (true);
CREATE POLICY "auth_write_puncte_rules" ON puncte_rules FOR ALL USING (auth.role() = 'authenticated');

-- Seed initial data (only if table is empty)
INSERT INTO puncte_rules (category, label, value, sort_order)
SELECT category, label, value, sort_order FROM (VALUES
  ('puncte_mobs',      'Jaf Exchange / Biju / Rapire câștigate',                                       '10 puncte',              1),
  ('puncte_mobs',      'Jaf Exchange / Biju / Rapire pierdute',                                        '5 puncte',               2),
  ('puncte_mobs',      'Patrulă',                                                                      '2 puncte',               3),
  ('puncte_mobs',      'Mineriada',                                                                    '5 puncte',               4),
  ('puncte_mobs',      'Adus Hacking Device',                                                          '2 puncte',               5),
  ('puncte_mobs',      'Donații pentru Vendetta''s (puncte în funcție de ce aduceți)',                  '',                       6),
  ('ajutor_vendettas', '100 meta livrat',                                                              '2 puncte + 25% din bani', 1),
  ('ajutor_vendettas', '200 meta livrat',                                                              '4 puncte + 25% din bani', 2),
  ('ajutor_vendettas', 'Ținut la livrat om mare',                                                      '2 puncte',               3),
  ('regulament',       'Ca să puteți fi eligibili pentru up, va trebui să adunați un total de 50 puncte + participare obligatorie la un jaf și la o mineriada!', '', 1),
  ('regulament',       'În caz că veți face dublul punctelor, veți primi double up.',                   '',                       2),
  ('regulament',       'În caz că veți face triplul punctelor, nu veți primi triple up, ci se va ține cont pentru săptămâna următoare!', '', 3),
  ('regulament',       'Ultimul grad, adică Half V, ca să-și mențină gradul, va trebui să adune un minim de 20 puncte pe săptămână!', '', 4),
  ('regulament',       'Half V vă pot da și ei puncte, adică vă pot pune la treabă!',                  '',                       5),
  ('regulament',       'Ca să vă mențineți gradul pe care îl aveți, va trebui să adunați un minim de 25 puncte pe săptămână!', '', 6),
  ('half_v_reguli',    'Toate licențele: HS, Pilot Heli (altele nu mă interesează)!',                  '',                       1),
  ('half_v_reguli',    'Runflat pe minim 2 mașini: una pe LS, una pe Cayo!',                           '',                       2),
  ('half_v_reguli',    'Minim 5.000.000 cash, în bancă sau împachetați!',                              '',                       3),
  ('half_v_reguli',    'Să cunoști tot orașul!',                                                       '',                       4),
  ('half_v_reguli',    'Să știi să conduci!',                                                          '',                       5)
) AS t(category, label, value, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM puncte_rules LIMIT 1);
