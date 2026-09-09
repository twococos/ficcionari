import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '@/store/gameStore'
import { abortGame } from '@/features/lobby/lobbyApi'

/** Controls d'host durant la partida: avortar (acabar anticipadament). */
export function HostControls() {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const isHost = useGameStore((s) => s.isHost)
  const [confirming, setConfirming] = useState(false)

  if (!game || !isHost()) return null

  return (
    <div className="mt-6 border-t border-white/10 pt-4">
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="w-full text-center text-xs text-white/40 hover:text-white/70"
        >
          {t('host.abort')}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs text-white/60">{t('host.abortConfirm')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-xl border border-white/20 py-2 text-sm text-white/70"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => abortGame(game.id)}
              className="flex-1 rounded-xl bg-accent/80 py-2 text-sm font-bold text-primary-dark"
            >
              {t('host.abortYes')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
