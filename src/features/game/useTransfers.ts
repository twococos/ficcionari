import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import { promoteToHost } from '@/features/lobby/lobbyApi'
import { reassignNarrator } from './roundApi'

/**
 * Gestiona els traspassos quan el narrador o l'host es desconnecten.
 * Per evitar curses, només el "supervisor" executa els traspassos: el jugador
 * connectat amb l'id alfabèticament més baix (determinista a tots els clients).
 *
 * - Si l'HOST no està connectat → promou el supervisor (o el primer connectat).
 * - Si el NARRADOR de la ronda actual no està connectat i la partida està en
 *   joc → passa el rol al següent connectat i reinicia la fase del torn.
 */
export function useTransfers() {
  const game = useGameStore((s) => s.game)
  const players = useGameStore((s) => s.players)
  const round = useGameStore((s) => s.round)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const lastActionRef = useRef<string>('')

  useEffect(() => {
    if (!game || !localPlayerId) return

    const connected = players.filter((p) => p.is_connected)
    if (connected.length === 0) return

    // Supervisor determinista: id connectat més baix.
    const supervisor = [...connected].sort((a, b) => a.id.localeCompare(b.id))[0]
    if (supervisor.id !== localPlayerId) return

    // 1) Traspàs d'host si l'host actual no està connectat.
    const host = players.find((p) => p.is_host)
    if (!host || !host.is_connected) {
      const key = `host:${game.id}`
      if (lastActionRef.current !== key) {
        lastActionRef.current = key
        void promoteToHost(game.id, supervisor.id)
      }
      return
    }

    // 2) Traspàs de narrador si marxa enmig del torn.
    if (game.status === 'in_round' && round) {
      const narrator = players.find((p) => p.id === round.narrator_player_id)
      if (!narrator || !narrator.is_connected) {
        const others = connected.filter((p) => p.id !== round.narrator_player_id)
        if (others.length > 0) {
          const key = `narr:${round.id}`
          if (lastActionRef.current !== key) {
            lastActionRef.current = key
            const next = [...others].sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0]
            void reassignNarrator(round.id, next.id)
          }
        }
      }
    }
  }, [game, players, round, localPlayerId])
}
