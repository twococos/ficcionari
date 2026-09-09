import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useGameStore } from '@/store/gameStore'
import { setPlayerConnected } from '@/features/lobby/lobbyApi'

/**
 * Gestiona la presència en temps real: marca el jugador local com a connectat
 * mentre té el canal obert, i detecta quan altres jugadors marxen per
 * actualitzar-ne l'estat a la BD (per a traspassos i neteja del lobby).
 *
 * Fem servir el Presence de Supabase: cada client "tracka" el seu player_id al
 * canal; quan un client es desconnecta, els altres reben l'event 'leave'.
 */
export function usePresence() {
  const game = useGameStore((s) => s.game)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const gameId = game?.id

  useEffect(() => {
    if (!gameId || !localPlayerId) return

    const channel = supabase.channel(`presence:${gameId}`, {
      config: { presence: { key: localPlayerId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        // L'estat de presència ha canviat; no cal fer res especial aquí perquè
        // les marques de connexió es gestionen als events join/leave.
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        // Un jugador ha marxat: el marquem com a desconnectat a la BD.
        // Ho pot fer qualsevol client que ho rebi (és idempotent).
        if (key && key !== localPlayerId) {
          void setPlayerConnected(key, false)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ player_id: localPlayerId, at: Date.now() })
          // En (re)connectar, ens marquem com a connectats.
          await setPlayerConnected(localPlayerId, true)
        }
      })

    // En tancar la pestanya, intentem marcar-nos com a desconnectats.
    const handleUnload = () => {
      void setPlayerConnected(localPlayerId, false)
    }
    window.addEventListener('pagehide', handleUnload)

    return () => {
      window.removeEventListener('pagehide', handleUnload)
      void setPlayerConnected(localPlayerId, false)
      supabase.removeChannel(channel)
    }
  }, [gameId, localPlayerId])
}
