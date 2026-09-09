-- =============================================================================
-- Ficcionari — Esquema inicial (Fase 1)
-- Model de dades del joc del diccionari: partides, jugadors, rondes,
-- definicions i vots. Vegeu .claude/PLA-DESENVOLUPAMENT.md.
-- =============================================================================

-- Extensió per generar codis aleatoris curts
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- games — una partida
-- -----------------------------------------------------------------------------
create table if not exists public.games (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,               -- codi curt per unir-se (p.ex. "ABCD")
  host_player_id      uuid,                               -- fk lògica a players.id (el host actual)
  language            text not null default 'ca',         -- 'ca' | 'es' (idioma del diccionari)
  total_rounds        int  not null default 3,
  score_funny_enabled boolean not null default false,
  status              text not null default 'lobby',      -- lobby | in_round | round_results | finished
  current_round       int  not null default 0,
  created_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- players — un jugador dins d'una partida (sense compte; només àlies)
-- -----------------------------------------------------------------------------
create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games(id) on delete cascade,
  device_id    text not null,                             -- persistit a localStorage (reconnexió)
  auth_user_id uuid,                                       -- user_id de la sessió anònima de Supabase
  nickname     text not null,
  score        int  not null default 0,
  is_host      boolean not null default false,
  is_connected boolean not null default true,
  joined_at    timestamptz not null default now(),
  unique (game_id, device_id)                             -- un dispositiu = un jugador per partida
);

-- -----------------------------------------------------------------------------
-- rounds — una ronda (torn) d'una partida
-- -----------------------------------------------------------------------------
create table if not exists public.rounds (
  id                 uuid primary key default gen_random_uuid(),
  game_id            uuid not null references public.games(id) on delete cascade,
  round_number       int not null,
  narrator_player_id uuid references public.players(id) on delete set null,
  word               text,
  real_definition    text,                                -- protegit per RLS fins a la fase reveal
  phase              text not null default 'narrator_picking_word',
  -- narrator_picking_word | announcing_word | writing_definitions
  -- | narrator_reading | voting_real | voting_funny | reveal
  created_at         timestamptz not null default now(),
  unique (game_id, round_number)
);

-- -----------------------------------------------------------------------------
-- definitions — les definicions (la real + les inventades pels jugadors)
-- -----------------------------------------------------------------------------
create table if not exists public.definitions (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references public.rounds(id) on delete cascade,
  author_player_id uuid references public.players(id) on delete set null, -- null = la definició real
  text             text not null,
  is_real          boolean not null default false,        -- protegit per RLS fins a reveal
  created_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- votes — vots dels jugadors (a la real i, opcionalment, a la més graciosa)
-- -----------------------------------------------------------------------------
create table if not exists public.votes (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references public.rounds(id) on delete cascade,
  voter_player_id  uuid not null references public.players(id) on delete cascade,
  definition_id    uuid not null references public.definitions(id) on delete cascade,
  vote_type        text not null default 'real',          -- 'real' | 'funny'
  created_at       timestamptz not null default now(),
  unique (round_id, voter_player_id, vote_type)            -- un vot per tipus i ronda
);

-- Índexs útils
create index if not exists idx_players_game on public.players(game_id);
create index if not exists idx_rounds_game on public.rounds(game_id);
create index if not exists idx_definitions_round on public.definitions(round_id);
create index if not exists idx_votes_round on public.votes(round_id);

-- -----------------------------------------------------------------------------
-- Realtime — publiquem els canvis d'aquestes taules perquè els clients s'hi
-- puguin subscriure.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.definitions;
alter publication supabase_realtime add table public.votes;
