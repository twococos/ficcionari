-- =============================================================================
-- Ficcionari — Fase 5: polítiques DELETE que faltaven
-- Necessàries per al "tornar a jugar" (restart), que esborra les rondes de la
-- partida. Sense política DELETE, RLS bloqueja l'esborrat silenciosament.
-- (definitions i votes s'esborren en cascada, però afegim les seves polítiques
-- per si es necessiten esborrats directes.)
-- =============================================================================

create policy "rounds_delete" on public.rounds
  for delete using (auth.role() = 'authenticated');

create policy "definitions_delete" on public.definitions
  for delete using (auth.role() = 'authenticated');

create policy "votes_delete" on public.votes
  for delete using (auth.role() = 'authenticated');
