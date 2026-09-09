import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { useGameStore } from '@/store/gameStore'
import { stableShuffle } from '@/game/shuffle'
import { computeRoundScores, pointsFromGame } from '@/game/scoring'
import { advanceToNextRound } from '../roundApi'
import { RoundPointsBreakdown } from '../RoundPointsBreakdown'
import { Scoreboard } from '../Scoreboard'
import { ProgressBar } from '../ProgressBar'

// Temps abans que els resultats avancin automàticament a la ronda següent.
export const AUTO_ADVANCE_MS = 20000

// Pantalla de resultats de la ronda: revela la real, l'autoria i els vots de
// cada definició, i mostra els punts guanyats + la classificació acumulada.
export function RevealPhase() {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const round = useGameStore((s) => s.round)
  const definitions = useGameStore((s) => s.definitions)
  const players = useGameStore((s) => s.players)
  const votes = useGameStore((s) => s.votes)
  const isNarrator = useGameStore((s) => s.isNarrator)
  const narrator = useGameStore((s) => s.narrator)
  const [advancing, setAdvancing] = useState(false)

  const scores = useMemo(
    () =>
      computeRoundScores(
        definitions,
        votes,
        Boolean(game?.score_funny_enabled),
        game ? pointsFromGame(game) : undefined
      ),
    [definitions, votes, game]
  )

  const advance = async () => {
    if (!game || !round) return
    setAdvancing(true)
    try {
      await advanceToNextRound(game, round, players)
      // La transició la propaga el realtime.
    } catch (e) {
      console.error(e)
      setAdvancing(false)
    }
  }
  // Ref sempre actualitzat perquè el timeout cridi la versió vigent.
  const advanceRef = useRef(advance)
  advanceRef.current = advance

  // Auto-avanç: passats 20s, el NARRADOR avança sol (anti-cursa: només ell).
  const roundId = round?.id
  const amNarrator = isNarrator()
  useEffect(() => {
    if (!roundId || !amNarrator) return
    const timer = setTimeout(() => void advanceRef.current(), AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [roundId, amNarrator])

  if (!round || !game) return null

  const isLastRound = round.round_number >= game.total_rounds

  const nameOf = (id: string | null) => players.find((p) => p.id === id)?.nickname ?? null
  const realVotes = votes.filter((v) => v.vote_type === 'real')
  const votesFor = (defId: string) => realVotes.filter((v) => v.definition_id === defId).length
  const funnyEnabled = game.score_funny_enabled
  const isFunniest = (defId: string) => scores.funniestDefinitionIds.includes(defId)

  // Ordre estable (el mateix que a la votació) perquè sigui coherent.
  const ordered = stableShuffle(definitions)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <h2 className="text-center text-2xl font-black text-white">{t('reveal.title')}</h2>

      {/* Definicions revelades */}
      <ul className="flex flex-col gap-3">
        {ordered.map((d, i) => {
          const authorName = d.is_real ? null : nameOf(d.author_player_id)
          return (
            <li
              key={d.id}
              className="animate-[fadeIn_0.4s_ease-out_both]"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <Card className={d.is_real ? 'ring-2 ring-accent' : ''}>
                <p className="text-white">{d.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {d.is_real ? (
                    <span className="font-bold text-accent">✔ {t('reveal.theRealOne')}</span>
                  ) : (
                    <span className="text-white/70">
                      {t('reveal.writtenBy', { name: authorName ?? t('reveal.nobody') })}
                    </span>
                  )}
                  <span className="text-white/50">
                    {t('reveal.votesReceived', { count: votesFor(d.id) })}
                  </span>
                  {funnyEnabled && isFunniest(d.id) && (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 font-bold text-accent">
                      😂 {t('reveal.funniest')}
                    </span>
                  )}
                </div>
              </Card>
            </li>
          )
        })}
      </ul>

      {/* Punts d'aquesta ronda */}
      <RoundPointsBreakdown scores={scores} />

      {/* Classificació acumulada */}
      <Scoreboard />

      {/* Navegació: el narrador avança a la ronda següent o al podi final */}
      {isNarrator() ? (
        <Button
          variant="accent"
          onClick={advance}
          disabled={advancing}
          className="relative w-full overflow-hidden"
        >
          {/* Barra de progrés festiva com a fons animat dins el botó */}
          {!advancing && <ProgressBar durationMs={AUTO_ADVANCE_MS} variant="fill" />}
          <span className="relative z-10">
            {advancing
              ? t('common.loading')
              : isLastRound
                ? t('reveal.finishGame')
                : t('reveal.nextRound')}
          </span>
        </Button>
      ) : (
        <p className="text-center text-sm text-white/60">
          {t('reveal.waitingNarratorNext', { name: narrator()?.nickname ?? '' })}
        </p>
      )}
      {/* La barra de progrés dels jugadors es renderitza a GamePage, fora del
          contenidor animat, perquè el `fixed` s'ancori de veritat al viewport. */}
    </div>
  )
}
