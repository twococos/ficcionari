import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScreenLayout } from '@/components/ScreenLayout'
import { TextField } from '@/components/TextField'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { ROUND_OPTIONS, DEFAULT_ROUNDS } from '@/game/constants'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/config'
import { createGame } from './lobbyApi'
import { useGameStore } from '@/store/gameStore'

export function CreateGamePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setSession = useGameStore((s) => s.setSession)

  const [name, setName] = useState('')
  const [rounds, setRounds] = useState<number>(DEFAULT_ROUNDS)
  const [gameLanguage, setGameLanguage] = useState<SupportedLanguage>(
    (i18n.resolvedLanguage as SupportedLanguage) ?? 'ca'
  )
  const [funnyMode, setFunnyMode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && !submitting

  async function handleCreate() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const { game, player } = await createGame({
        language: gameLanguage,
        totalRounds: rounds,
        scoreFunnyEnabled: funnyMode,
        hostNickname: name.trim(),
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

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-white/80">{t('create.rounds')}</span>
          <div className="flex gap-2">
            {ROUND_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRounds(r)}
                aria-pressed={rounds === r}
                className={`flex-1 rounded-2xl py-3 text-lg font-extrabold transition ${
                  rounds === r
                    ? 'bg-accent text-primary-dark'
                    : 'bg-primary-dark/40 text-white/70 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-white/80">{t('create.gameLanguage')}</span>
          <div className="flex gap-2">
            {SUPPORTED_LANGUAGES.map((lng) => (
              <button
                key={lng}
                onClick={() => setGameLanguage(lng)}
                aria-pressed={gameLanguage === lng}
                className={`flex-1 rounded-2xl py-3 font-extrabold transition ${
                  gameLanguage === lng
                    ? 'bg-accent text-primary-dark'
                    : 'bg-primary-dark/40 text-white/70 hover:text-white'
                }`}
              >
                {t(`language.${lng}`)}
              </button>
            ))}
          </div>
          <span className="text-xs text-white/50">{t('create.gameLanguageHint')}</span>
        </div>

        <Card>
          <button
            onClick={() => setFunnyMode((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-pressed={funnyMode}
          >
            <span>
              <span className="block font-bold text-white">{t('create.funnyMode')}</span>
              <span className="block text-xs text-white/50">{t('create.funnyModeHint')}</span>
            </span>
            <span
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                funnyMode ? 'bg-accent' : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  funnyMode ? 'left-6' : 'left-1'
                }`}
              />
            </span>
          </button>
        </Card>

        {error && <p className="text-center text-sm text-accent">{error}</p>}

        <Button variant="accent" onClick={handleCreate} disabled={!canSubmit}>
          {submitting ? t('common.loading') : t('create.createButton')}
        </Button>
      </div>
    </ScreenLayout>
  )
}
