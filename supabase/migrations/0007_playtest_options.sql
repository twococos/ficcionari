-- Canvis tanda #3 (post-playtest).

-- 1) Opcions noves de partida.
alter table public.games
  -- Amagar el text de les definicions als votants: només veuen números i el
  -- narrador les llegeix en veu alta (així les faltes d'ortografia no delaten).
  add column if not exists hide_definitions_on_vote boolean not null default false,
  -- Temps límit per escriure definicions, en segons. 0 = opció desactivada.
  add column if not exists write_time_limit_seconds int not null default 0,
  -- Durada de la partida en "voltes" (1 volta = tothom fa de narrador un cop).
  -- En començar la partida es calcula total_rounds = total_laps * jugadors.
  add column if not exists total_laps int not null default 1;

-- 2) La definició del diccionari es mostra al narrador per defecte.
alter table public.games
  alter column show_definition_on_pick set default true;

-- 3) Marca de temps d'entrada a la fase actual de la ronda. Ancora els comptes
--    enrere al rellotge del servidor i no al muntatge del component, perquè qui
--    recarregui la pàgina vegi el temps restant real i no el reiniciï.
alter table public.rounds
  add column if not exists phase_started_at timestamptz not null default now();
