-- Canvis tanda #2.

-- 1) Opció: mostrar la definició del diccionari al narrador mentre tria paraula.
alter table public.games
  add column if not exists show_definition_on_pick boolean not null default false;

-- 2) Increment ATÒMIC de la puntuació d'un jugador, calculat al servidor.
--    Evita que un client amb un snapshot antic sobreescrigui el total acumulat
--    (causa que el podi/classificació divergissin entre dispositius).
create or replace function public.increment_player_score(p_player_id uuid, p_delta int)
returns void
language sql
as $$
  update public.players set score = score + p_delta where id = p_player_id;
$$;
