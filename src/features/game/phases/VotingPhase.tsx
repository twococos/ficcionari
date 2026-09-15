import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CheckIcon } from '@/components/CheckIcon'
import { useGameStore } from '@/store/gameStore'
import { stableShuffle } from '@/game/shuffle'
import { submitVote, setRoundPhase, nextPhaseAfterVote } from '../roundApi'
import type { Round } from '@/lib/database.types'

interface VotingPhaseProps {
  voteType: 'real' | 'funny'
}

export function VotingPhase({ voteType }: VotingPhaseProps) {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const round = useGameStore((s) => s.round)
  const definitions = useGameStore((s) => s.definitions)
  const votes = useGameStore((s) => s.votes)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const isNarrator = useGameStore((s) => s.isNarrator)

  const [submitting, setSubmitting] = useState(false)

  const ns = voteType === 'real' ? 'voteReal' : 'voteFunny'

  if (!round) return null

  // El narrador no vota: fa el seguiment i pot tancar la votació a mà.
  if (isNarrator()) {
    return <NarratorVotingView round={round} voteType={voteType} />
  }

  // Amb l'opció activada els votants només veuen números: les definicions les
  // llegeix el narrador, de manera que les faltes d'ortografia o el to no
  // delatin qui les ha escrites.
  const hideDefs = Boolean(game?.hide_definitions_on_vote)

  const myVote = votes.find((v) => v.voter_player_id === localPlayerId && v.vote_type === voteType)

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

  // Sobre el fons accent (votació graciosa) el text ha de ser fosc per contrastar.
  const funny = voteType === 'funny'

  if (myVote) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <CheckIcon />
        <p className={`text-lg font-bold ${funny ? 'text-primary-dark' : 'text-accent'}`}>
          {t(`${ns}.voted`)}
        </p>
        <p className={`text-sm ${funny ? 'text-primary-dark/70' : 'text-white/60'}`}>
          {t(`${ns}.waitingOthers`)}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="text-center">
        <h2 className={`text-2xl font-black ${funny ? 'text-primary-dark' : 'text-white'}`}>
          {t(`${ns}.title`)}
        </h2>
        <p className={`mt-1 text-sm ${funny ? 'text-primary-dark/70' : 'text-white/60'}`}>
          {t(`${ns}.instruction`)}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {shuffled.map((d, i) => {
          // En votació 'real' no pots votar la teva pròpia definició.
          const isOwn = d.author_player_id === localPlayerId
          const disabled = submitting || (voteType === 'real' && isOwn)
          // El número coincideix amb el que llegeix el narrador a ReadingPhase:
          // totes dues llistes fan stableShuffle amb la mateixa llavor.
          const ownLabel = isOwn ? t('voteReal.ownDefinition') : null
          return (
            <li key={d.id}>
              <button
                onClick={() => vote(d.id)}
                disabled={disabled}
                className="w-full text-left disabled:opacity-50"
              >
                {funny ? (
                  // Targeta blanca sobre el fons accent.
                  <div
                    className={`rounded-3xl bg-white p-5 shadow-lg transition ${
                      disabled ? '' : 'hover:ring-2 hover:ring-primary-dark'
                    }`}
                  >
                    {hideDefs ? (
                      <span className="block py-3 text-center text-5xl font-black text-primary-dark">
                        {i + 1}
                      </span>
                    ) : (
                      <span className="text-primary-dark">{d.text}</span>
                    )}
                  </div>
                ) : (
                  <Card
                    className={`transition ${disabled ? '' : 'hover:ring-2 hover:ring-accent'}`}
                  >
                    {hideDefs ? (
                      <span className="block py-3 text-center text-5xl font-black text-accent">
                        {i + 1}
                      </span>
                    ) : (
                      <span className="text-white">{d.text}</span>
                    )}
                    {ownLabel && (
                      <span
                        className={`block text-xs font-bold text-accent ${
                          hideDefs ? 'text-center' : 'mt-1'
                        }`}
                      >
                        {ownLabel}
                      </span>
                    )}
                  </Card>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Vista del narrador durant una votació: veu quanta gent ha votat i pot tancar
 * la votació a mà. Serveix sobretot quan algú es desconnecta i la transició
 * automàtica (que espera tots els no-narradors) no arribaria mai.
 */
function NarratorVotingView({ round, voteType }: { round: Round; voteType: 'real' | 'funny' }) {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const players = useGameStore((s) => s.players)
  const votes = useGameStore((s) => s.votes)
  const definitions = useGameStore((s) => s.definitions)
  const [closing, setClosing] = useState(false)

  const funny = voteType === 'funny'
  const ns = funny ? 'voteFunny' : 'voteReal'

  // Mateix ordre i numeració que veuen els votants (stableShuffle amb la
  // mateixa llavor), perquè el narrador pugui repetir qualsevol definició
  // quan l'hi demanin. Imprescindible amb "amagar definicions" actiu, on els
  // jugadors només veuen els números.
  const ordered = stableShuffle(definitions)

  const nonNarrator = players.filter((p) => p.is_connected && p.id !== round.narrator_player_id)
  const voters = new Set(
    votes.filter((v) => v.vote_type === voteType).map((v) => v.voter_player_id)
  )
  const done = nonNarrator.filter((p) => voters.has(p.id)).length

  async function closeVoting() {
    setClosing(true)
    try {
      // Mateixa decisió que la transició automàtica, via helper compartit.
      await setRoundPhase(
        round.id,
        nextPhaseAfterVote(voteType, Boolean(game?.score_funny_enabled))
      )
    } catch (e) {
      console.error(e)
      setClosing(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className={`text-center font-bold ${funny ? 'text-primary-dark' : 'text-white/80'}`}>
        {t(`${ns}.narratorWaiting`)}
      </p>

      {/* Les definicions numerades, per poder-les repetir en veu alta. */}
      <ul className="flex flex-col gap-2">
        {ordered.map((d, i) => (
          <li key={d.id}>
            {funny ? (
              <div className="rounded-3xl bg-white p-4 shadow-lg">
                <span className="mr-2 font-black text-primary-dark">{i + 1}.</span>
                <span className="text-primary-dark">{d.text}</span>
              </div>
            ) : (
              <Card>
                <span className="mr-2 font-black text-accent">{i + 1}.</span>
                <span className="text-white">{d.text}</span>
              </Card>
            )}
          </li>
        ))}
      </ul>

      {/* Qui ha votat */}
      <ul className="flex flex-col gap-2">
        {nonNarrator.map((p) => {
          const voted = voters.has(p.id)
          return (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                funny ? 'bg-white' : 'bg-primary-dark/40'
              }`}
            >
              <span className={`font-bold ${funny ? 'text-primary-dark' : 'text-white'}`}>
                {p.nickname}
              </span>
              <span
                className={voted ? 'text-accent' : funny ? 'text-primary-dark/40' : 'text-white/40'}
              >
                {voted ? '✓' : '…'}
              </span>
            </li>
          )
        })}
      </ul>

      <p className={`text-center text-sm ${funny ? 'text-primary-dark/70' : 'text-white/60'}`}>
        {t('vote.votedCount', { done, total: nonNarrator.length })}
      </p>

      <div className="mt-auto">
        <Button variant="ghost" onClick={closeVoting} disabled={closing} className="w-full">
          {closing ? t('common.loading') : t('vote.closeVoting')}
        </Button>
      </div>
    </div>
  )
}
