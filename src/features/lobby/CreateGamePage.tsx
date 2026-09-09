import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScreenLayout } from '@/components/ScreenLayout'
import { TextField } from '@/components/TextField'
import { Button } from '@/components/Button'
import { DEFAULT_ROUNDS, DEFAULT_POINTS } from '@/game/constants'
import { type SupportedLanguage } from '@/i18n/config'
import { createGame } from './lobbyApi'
import { GameOptionsFields, type GameOptionsValue } from './GameOptionsFields'
import { useGameStore } from '@/store/gameStore'

export function CreateGamePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setSession = useGameStore((s) => s.setSession)

  const [name, setName] = useState('')
  const [options, setOptions] = useState<GameOptionsValue>({
    language: (i18n.resolvedLanguage as SupportedLanguage) ?? 'ca',
    rounds: DEFAULT_ROUNDS,
    funnyMode: false,
    showDefinitionOnPick: false,
    pointsGuessReal: DEFAULT_POINTS.guessReal,
    pointsDeceived: DEFAULT_POINTS.deceived,
    pointsFunniest: DEFAULT_POINTS.funniest,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && !submitting

  const patch = (p: Partial<GameOptionsValue>) => setOptions((o) => ({ ...o, ...p }))

  async function handleCreate() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const { game, player } = await createGame({
        language: options.language,
        totalRounds: options.rounds,
        scoreFunnyEnabled: options.funnyMode,
        hostNickname: name.trim(),
        pointsGuessReal: options.pointsGuessReal,
        pointsDeceived: options.pointsDeceived,
        pointsFunniest: options.pointsFunniest,
        showDefinitionOnPick: options.showDefinitionOnPick,
      })
      setSession(game, player.id, [player])
      navigate(`/lobby/${game.code}`)
    } catch (e) {
      console.error(e)
      setError(t('common.error'))
      setSubmitting(false)
    }
  }

  return (
    <ScreenLayout title={t('create.title')}>
      <div className="flex flex-col gap-5">
        <TextField
          label={t('create.yourName')}
          placeholder={t('create.yourNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
        />

        <GameOptionsFields value={options} onChange={patch} />

        {error && <p className="text-center text-sm text-accent">{error}</p>}

        <Button variant="accent" onClick={handleCreate} disabled={!canSubmit}>
          {submitting ? t('common.loading') : t('create.createButton')}
        </Button>
      </div>
    </ScreenLayout>
  )
}
