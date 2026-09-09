-- =============================================================================
-- Ficcionari — Modificacions #1: puntuacions configurables per partida
-- Afegeix 3 columnes a 'games' amb els valors de punts configurables al crear la
-- partida. Default 1/1/1 (compatible amb partides antigues sense les columnes).
-- =============================================================================

alter table public.games
  add column if not exists score_guess_real int not null default 1,
  add column if not exists score_deceived   int not null default 1,
  add column if not exists score_funniest   int not null default 1;
