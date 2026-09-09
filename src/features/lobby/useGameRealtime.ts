import { useEffect } from 'react'
import { subscribeToGame } from '@/lib/realtime'
import { ensureAnonymousSession } from '@/lib/supabase'
import { useGameStore } from '@/store/gameStore'

/**
 * Manté el store sincronitzat amb la BD via Realtime mentre hi hagi una
 * partida activa. A cada canvi rellevant, recarrega partida + jugadors.
 */
export function useGameRealtime() {
  const game = useGameStore((s) => s.game)
  const refresh = useGameStore((s) => s.refresh)
  const refreshRound = useGameStore((s) => s.refreshRound)

  const gameId = game?.id

  useEffect(() => {
    if (!gameId) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      // Garanteix sessió (i token al realtime) abans de subscriure's.
      await ensureAnonymousSession()
      if (cancelled) return
      void refresh()
      void refreshRound()
      unsubscribe = subscribeToGame(gameId, (table) => {
        // Canvis a jugadors/partida → refresca lobby; a ronda/def/vots → ronda.
        if (table === 'games' || table === 'players') {
          void refresh()
        } else {
          void refreshRound()
        }
      })
    })()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [gameId, refresh, refreshRound])
}
