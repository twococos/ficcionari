import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import { useGameStore } from '@/store/gameStore'
import type { RoundScoreResult } from '@/game/scoring'

/** Desglossament dels punts guanyats per cada jugador en aquesta ronda. */
export function RoundPointsBreakdown({ scores }: { scores: RoundScoreResult }) {
  const { t } = useTranslation()
  const players = useGameStore((s) => s.players)
  const round = useGameStore((s) => s.round)

  // Jugadors que poden puntuar (tots menys el narrador), ordenats per punts.
  const scoring = players
    .filter((p) => p.id !== round?.narrator_player_id)
    .map((p) => ({ player: p, detail: scores.byPlayer[p.id] }))
    .sort((a, b) => (b.detail?.total ?? 0) - (a.detail?.total ?? 0))

  return (
    <Card>
      <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-white/60">
        {t('reveal.roundPoints')}
      </h3>
      <ul className="flex flex-col gap-3">
        {scoring.map(({ player, detail }) => (
          <li key={player.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-white">{player.nickname}</p>
              <div className="text-xs text-white/60">
                {!detail || detail.total === 0 ? (
                  <span>{t('reveal.noPoints')}</span>
                ) : (
                  <div className="flex flex-col">
                    {detail.guessedReal > 0 && (
                      <span>{t('reveal.pointGuessed', { points: detail.guessedReal })}</span>
                    )}
                    {detail.deceived > 0 && (
                      <span>
                        {t('reveal.pointDeceived', {
                          points: detail.deceived,
                          count: detail.deceived,
                        })}
                      </span>
                    )}
                    {detail.funniest > 0 && (
                      <span>{t('reveal.pointFunniest', { points: detail.funniest })}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-accent/20 px-3 py-1 text-lg font-black text-accent">
              +{detail?.total ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
