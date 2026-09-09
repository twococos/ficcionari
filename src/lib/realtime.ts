import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Subscriu-te a tots els canvis d'una partida (games, players, rounds,
 * definitions, votes) filtrant per game_id. Crida `onChange` a cada canvi.
 * Retorna una funció per desubscriure's.
 */
export function subscribeToGame(
  gameId: string,
  onChange: (table: string) => void
): () => void {
  const channel: RealtimeChannel = supabase.channel(`game:${gameId}`)

  const tablesByGame = ['games', 'players', 'rounds'] as const
  for (const table of tablesByGame) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: table === 'games' ? `id=eq.${gameId}` : `game_id=eq.${gameId}`,
      },
      () => onChange(table)
    )
  }

  // definitions i votes no tenen game_id directe (van per round_id); ens hi
  // subscrivim sense filtre de game i deixem que el consumidor recarregui.
  // A la Fase 3/4 s'afinarà per round_id actiu.
  for (const table of ['definitions', 'votes'] as const) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
      onChange(table)
    )
  }

  channel.subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
