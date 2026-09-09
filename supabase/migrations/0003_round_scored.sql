-- =============================================================================
-- Ficcionari — Fase 4: marca de ronda puntuada
-- Afegeix una columna 'scored' a rounds per aplicar els punts una sola vegada.
-- =============================================================================

alter table public.rounds
  add column if not exists scored boolean not null default false;
