import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import { useGameStore } from '@/store/gameStore'

const MEDALS = ['🥇', '🥈', '🥉']

/** Classificació acumulada de la partida, ordenada per puntuació. */
export function Scoreboard() {
  const { t } = useTranslation()
  const players = useGameStore((s) => s.players)
  const localPlayerId = useGameStore((s) => s.localPlayerId)

  const ranked = [...players]
    .filter((p) => p.is_connected)
    .sort((a, b) => b.score - a.score)

  return (
    <Card>
      <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-white/60">
        {t('reveal.scoreboard')}
      </h3>
      <ul className="flex flex-col gap-2">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded-2xl px-3 py-2 ${
              p.id === localPlayerId ? 'bg-accent/15' : 'bg-primary-dark/40'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-6 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
              <span className="font-bold text-white">{p.nickname}</span>
              {p.id === localPlayerId && (
                <span className="text-xs text-accent">({t('lobby.you')})</span>
              )}
            </span>
            <span className="text-lg font-black text-white">{p.score}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
