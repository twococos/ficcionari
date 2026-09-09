import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import { WaitingScreen } from '../WaitingScreen'
import { useGameStore } from '@/store/gameStore'
import { stableShuffle } from '@/game/shuffle'
import { submitVote } from '../roundApi'

interface VotingPhaseProps {
  voteType: 'real' | 'funny'
}

export function VotingPhase({ voteType }: VotingPhaseProps) {
  const { t } = useTranslation()
  const round = useGameStore((s) => s.round)
  const definitions = useGameStore((s) => s.definitions)
  const votes = useGameStore((s) => s.votes)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const isNarrator = useGameStore((s) => s.isNarrator)

  const [submitting, setSubmitting] = useState(false)

  const ns = voteType === 'real' ? 'voteReal' : 'voteFunny'

  if (!round) return null

  // El narrador no vota; espera.
  if (isNarrator()) {
    return (
      <WaitingScreen message={t(`${ns}.narratorWaiting`, t('voteReal.narratorWaiting'))} />
    )
  }

  const myVote = votes.find(
    (v) => v.voter_player_id === localPlayerId && v.vote_type === voteType
  )

  const shuffled = stableShuffle(definitions)

  async function vote(definitionId: string) {
    if (!localPlayerId || !round) return
    setSubmitting(true)
    try {
      await submitVote(round.id, localPlayerId, definitionId, voteType)
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  if (myVote) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-2xl">✅</p>
        <p className="text-lg font-bold text-accent">{t(`${ns}.voted`)}</p>
        <p className="text-sm text-white/60">{t(`${ns}.waitingOthers`)}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white">{t(`${ns}.title`)}</h2>
        <p className="mt-1 text-sm text-white/60">{t(`${ns}.instruction`)}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {shuffled.map((d) => {
          // En votació 'real' no pots votar la teva pròpia definició.
          const isOwn = d.author_player_id === localPlayerId
          const disabled = submitting || (voteType === 'real' && isOwn)
          return (
            <li key={d.id}>
              <button
                onClick={() => vote(d.id)}
                disabled={disabled}
                className="w-full text-left disabled:opacity-50"
              >
                <Card
                  className={`transition ${
                    disabled ? '' : 'hover:ring-2 hover:ring-accent'
                  }`}
                >
                  <span className="text-white">{d.text}</span>
                  {voteType === 'real' && isOwn && (
                    <span className="mt-1 block text-xs font-bold text-accent">
                      {t('voteReal.ownDefinition')}
                    </span>
                  )}
                </Card>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
