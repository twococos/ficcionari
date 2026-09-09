import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { WaitingScreen } from '../WaitingScreen'
import { useGameStore } from '@/store/gameStore'
import { stableShuffle } from '@/game/shuffle'
import { setRoundPhase } from '../roundApi'

export function ReadingPhase() {
  const { t } = useTranslation()
  const round = useGameStore((s) => s.round)
  const definitions = useGameStore((s) => s.definitions)
  const isNarrator = useGameStore((s) => s.isNarrator)
  const narrator = useGameStore((s) => s.narrator)
  const [submitting, setSubmitting] = useState(false)

  if (!round) return null

  if (!isNarrator()) {
    return (
      <WaitingScreen message={t('read.narratorReading', { name: narrator()?.nickname ?? '' })} />
    )
  }

  const shuffled = stableShuffle(definitions)

  async function startVoting() {
    if (!round) return
    setSubmitting(true)
    try {
      await setRoundPhase(round.id, 'voting_real')
    } catch (e) {
      console.error(e)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-center text-sm text-white/60">{t('read.instruction')}</p>

      <ul className="flex flex-col gap-3">
        {shuffled.map((d, i) => (
          <li key={d.id}>
            <Card>
              <span className="mr-2 font-black text-accent">{i + 1}.</span>
              <span className="text-white">{d.text}</span>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        <Button variant="accent" onClick={startVoting} disabled={submitting} className="w-full">
          {submitting ? t('common.loading') : t('read.startVoting')}
        </Button>
      </div>
    </div>
  )
}
