import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { forgetLastGame } from '@/lib/device'

/**
 * Si el jugador local ha estat expulsat (ja no és a la llista de jugadors
 * després d'haver-hi estat), el redirigeix a l'inici. Evita quedar-se en una
 * pantalla morta.
 */
export function useKickRedirect() {
  const navigate = useNavigate()
  const players = useGameStore((s) => s.players)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const clear = useGameStore((s) => s.clear)

  useEffect(() => {
    if (!localPlayerId) return
    // Només considerem "expulsat" si ja hi ha jugadors carregats i el nostre no hi és.
    if (players.length > 0 && !players.some((p) => p.id === localPlayerId)) {
      forgetLastGame()
      clear()
      navigate('/')
    }
  }, [players, localPlayerId, navigate, clear])
}
