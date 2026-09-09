import { useTranslation } from 'react-i18next'
import { useGameStore } from '@/store/gameStore'

/** Capçalera del joc: ronda actual i qui és el narrador. */
export function GameHeader() {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const narrator = useGameStore((s) => s.narrator)
  const isNarrator = useGameStore((s) => s.isNarrator)

  if (!game) return null
  const narratorPlayer = narrator()

  return (
    <div className="mb-6 text-center">
      <p className="text-sm font-bold uppercase tracking-wide text-white/60">
        {t('game.round', { current: game.current_round, total: game.total_rounds })}
      </p>
      <p className="mt-1 text-white/80">
        {isNarrator()
          ? t('game.youAreNarrator')
          : t('game.narratorIs', { name: narratorPlayer?.nickname ?? '' })}
      </p>
    </div>
  )
}
