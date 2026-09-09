import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScreenLayout } from '@/components/ScreenLayout'
import { TextField } from '@/components/TextField'
import { Button } from '@/components/Button'
import { CODE_LENGTH, normalizeCode } from '@/game/constants'
import { joinGame } from './lobbyApi'
import { useGameStore } from '@/store/gameStore'

export function JoinGamePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ code?: string }>()
  const codeFromUrl = params.code ? normalizeCode(params.code) : ''
  const hasCodeFromUrl = codeFromUrl.length === CODE_LENGTH

  const setSession = useGameStore((s) => s.setSession)

  const [code, setCode] = useState(codeFromUrl)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const codeValid = code.length === CODE_LENGTH
  const canSubmit = codeValid && name.trim().length > 0 && !submitting

  async function handleJoin() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const { game, player } = await joinGame(code, name.trim())
      setSession(game, player.id, [])
      navigate(`/lobby/${game.code}`)
    } catch (e) {
      if (e instanceof Error && e.message === 'GAME_NOT_FOUND') {
        setError(t('join.notFound'))
      } else {
        console.error(e)
        setError(t('common.error'))
      }
      setSubmitting(false)
    }
  }

  return (
    <ScreenLayout title={t('join.title')}>
      <div className="flex flex-col gap-5">
        {!hasCodeFromUrl && (
          <TextField
            label={t('join.codeLabel')}
            placeholder={t('join.codePlaceholder')}
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            className="text-center text-2xl font-black tracking-[0.3em] uppercase"
            inputMode="text"
            autoCapitalize="characters"
            autoFocus
          />
        )}

        {hasCodeFromUrl && (
          <div className="text-center">
            <p className="text-sm text-white/60">{t('join.codeLabel')}</p>
            <p className="text-4xl font-black tracking-[0.3em] text-accent">{code}</p>
          </div>
        )}

        <TextField
          label={t('join.yourName')}
          placeholder={t('join.yourNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus={hasCodeFromUrl}
        />

        {error && <p className="text-center text-sm text-accent">{error}</p>}

        <Button variant="accent" onClick={handleJoin} disabled={!canSubmit}>
          {submitting ? t('common.loading') : t('join.joinButton')}
        </Button>
      </div>
    </ScreenLayout>
  )
}
