import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { WaitingScreen } from '../WaitingScreen'
import { useGameStore } from '@/store/gameStore'
import { loadDictionary, pickRandomWord, type DictionaryEntry } from '@/game/dictionary'
import { chooseWord } from '../roundApi'

export function PickWordPhase() {
  const { t } = useTranslation()
  const game = useGameStore((s) => s.game)
  const round = useGameStore((s) => s.round)
  const isNarrator = useGameStore((s) => s.isNarrator)
  const narrator = useGameStore((s) => s.narrator)

  const [entries, setEntries] = useState<DictionaryEntry[]>([])
  const [current, setCurrent] = useState<DictionaryEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const narratorView = isNarrator()

  // Carrega el diccionari de l'idioma del joc (només el narrador el necessita).
  const language = game?.language
  useEffect(() => {
    if (!language || !narratorView) return
    let active = true
    loadDictionary(language)
      .then((words) => {
        if (!active) return
        setEntries(words)
        setCurrent(pickRandomWord(words))
        setLoading(false)
      })
      .catch((e) => {
        console.error(e)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [language, narratorView])

  if (!round) return null

  // Vista dels altres jugadors: esperen que el narrador triï.
  if (!narratorView) {
    return (
      <WaitingScreen
        message={t('pickWord.narratorPicking', { name: narrator()?.nickname ?? '' })}
      />
    )
  }

  function rollAgain() {
    if (entries.length === 0) return
    setCurrent(pickRandomWord(entries, current ? [current.word] : []))
  }

  async function choose() {
    if (!current || !round) return
    setSubmitting(true)
    try {
      await chooseWord(round.id, current.word, current.definition)
      // La transició la propaga el realtime; no cal navegar manualment.
    } catch (e) {
      console.error(e)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-center text-white/70">{t('pickWord.instruction')}</p>

      <Card className="flex min-h-[140px] flex-col items-center justify-center gap-3 text-center">
        {loading || !current ? (
          <span className="text-white/50">{t('common.loading')}</span>
        ) : (
          <>
            <span className="text-4xl font-black text-accent">{current.word}</span>
            {game?.show_definition_on_pick && (
              <span className="text-sm text-white/70">{current.definition}</span>
            )}
          </>
        )}
      </Card>

      <div className="mt-auto flex flex-col gap-3">
        <Button variant="ghost" onClick={rollAgain} disabled={loading || submitting}>
          🎲 {t('pickWord.rollAgain')}
        </Button>
        <Button variant="accent" onClick={choose} disabled={loading || submitting || !current}>
          {submitting ? t('common.loading') : t('pickWord.chooseThis')}
        </Button>
      </div>
    </div>
  )
}
