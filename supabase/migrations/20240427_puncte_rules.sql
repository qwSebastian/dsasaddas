create table if not exists puncte_rules (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  label text not null default '',
  value text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table puncte_rules enable row level security;

create policy "Allow public read" on puncte_rules
  for select using (true);

create policy "Allow authenticated insert" on puncte_rules
  for insert with check (auth.role() = 'authenticated');

create policy "Allow authenticated update" on puncte_rules
  for update using (auth.role() = 'authenticated');

create policy "Allow authenticated delete" on puncte_rules
  for delete using (auth.role() = 'authenticated');

insert into puncte_rules (category, label, value, sort_order) values
  ('puncte_mobs', 'Jaf Exchange/Biju/Rapire castigate', '10 puncte', 1),
  ('puncte_mobs', 'Jaf Exchange/Biju/Rapire pierdute', '5 puncte', 2),
  ('puncte_mobs', 'Patrula', '2 puncte', 3),
  ('puncte_mobs', 'Mineriada', '5 puncte', 4),
  ('puncte_mobs', 'Adus Hacking Device', '2 puncte', 5),
  ('puncte_mobs', 'Donatii pentru Vendetta''s (puncte in functie de ce aduceti)', '', 6),

  ('ajutor_vendettas', '100 meta livrat', '2 puncte+25% din bani', 1),
  ('ajutor_vendettas', '200 Meta livrat', '4 puncte +25% din bani', 2),
  ('ajutor_vendettas', 'Tinut la livrat om mare', '2 puncte', 3),

  ('regulament', 'Ca sa puteti fi eligibili pentru up, va trebui sa adunati un total de 50 puncte + participare obligatorie la un jaf si la o mineriada!', '', 1),
  ('regulament', 'In caz ca veti face dublul punctelor, veti primi double up', '', 2),
  ('regulament', 'In caz ca veti face triplul punctelor, nu veti primi triple up, ci se va tine cont pentru urmatoarea saptamana!', '', 3),
  ('regulament', 'Ultimul grad, adica Half V, ca sa-si mentina gradul, va trebui sa adune un minim de 20 puncte pe saptamana!', '', 4),
  ('regulament', 'Half V, va pot da si ei puncte, adica va pot pune la treaba!', '', 5),
  ('regulament', 'Ca sa va mentineti gradul pe care il aveti, va trebui sa adunati un minim de 25 puncte pe saptamana!', '', 6),

  ('half_v_reguli', 'Toate licentele: HS, Pilot Heli (altele nu ma intereseaza)!', '', 1),
  ('half_v_reguli', 'Runflat pe minim 2 masini: una pe LS, una pe Cayo!', '', 2),
  ('half_v_reguli', 'Minim 5.000.000 cash, in banca sau impachetati!', '', 3),
  ('half_v_reguli', 'Sa cunosti tot orasul!', '', 4),
  ('half_v_reguli', 'Sa stii sa conduci!', '', 5);
