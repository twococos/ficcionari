import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { WaitingScreen } from '../WaitingScreen'
import { useGameStore } from '@/store/gameStore'
import { setRoundPhase } from '../roundApi'

export function AnnounceWordPhase() {
  const { t } = useTranslation()
  const round = useGameStore((s) => s.round)
  const isNarrator = useGameStore((s) => s.isNarrator)
  const narrator = useGameStore((s) => s.narrator)
  const [submitting, setSubmitting] = useState(false)

  if (!round) return null

  if (!isNarrator()) {
    // Els jugadors NO veuen la paraula: l'han d'escoltar del narrador.
    return (
      <WaitingScreen
        message={t('announce.narratorAnnouncing', { name: narrator()?.nickname ?? '' })}
      />
    )
  }

  async function startWriting() {
    if (!round) return
    setSubmitting(true)
    try {
      await setRoundPhase(round.id, 'writing_definitions')
    } catch (e) {
      console.error(e)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <Card className="text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-white/60">
          {t('announce.yourWord')}
        </p>
        <p className="mt-1 text-4xl font-black text-accent">{round.word}</p>
      </Card>

      <Card>
        <p className="text-sm font-bold uppercase tracking-wide text-white/60">
          {t('announce.realDefinition')}
        </p>
        <p className="mt-2 text-lg text-white">{round.real_definition}</p>
      </Card>

      <p className="text-center text-sm text-white/60">{t('announce.readAloud')}</p>

      <div className="mt-auto">
        <Button variant="accent" onClick={startWriting} disabled={submitting} className="w-full">
          {submitting ? t('common.loading') : t('announce.startWriting')}
        </Button>
      </div>
    </div>
  )
}
