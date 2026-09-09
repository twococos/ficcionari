-- =============================================================================
-- Ficcionari — Row Level Security (Fase 1, bàsic)
--
-- NOTA IMPORTANT: aquestes polítiques són INTENCIONADAMENT permissives per a
-- l'MVP. Permeten llegir/escriure a qualsevol sessió autenticada (incloent-hi
-- les sessions anònimes que fem servir, ja que no hi ha comptes).
--
-- La protecció FORTA anti-trampes — amagar `real_definition` / `is_real` fins a
-- la fase reveal i validar QUI pot avançar cada fase — es fa a la Fase 4
-- delegant les operacions sensibles a Edge Functions (service_role) i afegint
-- vistes/polítiques que filtren aquestes columnes. Vegeu el pla, Fase 4.
-- =============================================================================

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.definitions enable row level security;
alter table public.votes enable row level security;

-- Helper: només sessions autenticades (anon o no). auth.role() = 'authenticated'
-- per a sessions anònimes de Supabase.

-- games ------------------------------------------------------------------------
create policy "games_select" on public.games
  for select using (true);
create policy "games_insert" on public.games
  for insert with check (auth.role() = 'authenticated');
create policy "games_update" on public.games
  for update using (auth.role() = 'authenticated');

-- players ----------------------------------------------------------------------
create policy "players_select" on public.players
  for select using (true);
create policy "players_insert" on public.players
  for insert with check (auth.role() = 'authenticated');
create policy "players_update" on public.players
  for update using (auth.role() = 'authenticated');
create policy "players_delete" on public.players
  for delete using (auth.role() = 'authenticated');

-- rounds -----------------------------------------------------------------------
create policy "rounds_select" on public.rounds
  for select using (true);
create policy "rounds_insert" on public.rounds
  for insert with check (auth.role() = 'authenticated');
create policy "rounds_update" on public.rounds
  for update using (auth.role() = 'authenticated');

-- definitions ------------------------------------------------------------------
create policy "definitions_select" on public.definitions
  for select using (true);
create policy "definitions_insert" on public.definitions
  for insert with check (auth.role() = 'authenticated');
create policy "definitions_update" on public.definitions
  for update using (auth.role() = 'authenticated');

-- votes ------------------------------------------------------------------------
create policy "votes_select" on public.votes
  for select using (true);
create policy "votes_insert" on public.votes
  for insert with check (auth.role() = 'authenticated');
create policy "votes_update" on public.votes
  for update using (auth.role() = 'authenticated');
