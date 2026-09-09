import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/TextField'
import { useGameStore } from '@/store/gameStore'
import { submitDefinition, setRoundPhase, ensureRealDefinition } from '../roundApi'
import type { Round } from '@/lib/database.types'

export function WriteDefinitionPhase() {
  const round = useGameStore((s) => s.round)
  const isNarrator = useGameStore((s) => s.isNarrator)

  if (!round) return null
  return isNarrator() ? (
    <NarratorWritingView round={round} />
  ) : (
    <PlayerWritingView round={round} />
  )
}

function NarratorWritingView({ round }: { round: Round }) {
  const { t } = useTranslation()
  const definitions = useGameStore((s) => s.definitions)
  const players = useGameStore((s) => s.players)
  const [forcing, setForcing] = useState(false)

  const connected = players.filter((p) => p.is_connected)
  const nonNarrator = connected.filter((p) => p.id !== round.narrator_player_id)
  const authored = definitions.filter((d) => d.author_player_id)
  const authoredIds = new Set(authored.map((d) => d.author_player_id))
  const done = nonNarrator.filter((p) => authoredIds.has(p.id)).length

  async function force() {
    setForcing(true)
    try {
      if (round.real_definition) await ensureRealDefinition(round.id, round.real_definition)
      await setRoundPhase(round.id, 'narrator_reading')
    } catch (e) {
      console.error(e)
      setForcing(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-center font-bold text-white/80">{t('write.narratorWaiting')}</p>
      <p className="text-center text-sm text-white/60">
        {t('write.submittedCount', { done, total: nonNarrator.length })}
      </p>

      <ul className="flex flex-col gap-2">
        {nonNarrator.map((p) => {
          const def = authored.find((d) => d.author_player_id === p.id)
          return (
            <li key={p.id} className="rounded-2xl bg-primary-dark/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{p.nickname}</span>
                <span className={def ? 'text-accent' : 'text-white/40'}>{def ? '✓' : '…'}</span>
              </div>
              {def && <p className="mt-1 text-sm text-white/70">{def.text}</p>}
            </li>
          )
        })}
      </ul>

      <div className="mt-auto">
        <Button variant="ghost" onClick={force} disabled={forcing} className="w-full">
          {t('write.forceNext')}
        </Button>
      </div>
    </div>
  )
}

function PlayerWritingView({ round }: { round: Round }) {
  const { t } = useTranslation()
  const definitions = useGameStore((s) => s.definitions)
  const localPlayerId = useGameStore((s) => s.localPlayerId)

  const mine = definitions.find((d) => d.author_player_id === localPlayerId)
  const [text, setText] = useState(mine?.text ?? '')
  const [editing, setEditing] = useState(!mine)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!text.trim() || !localPlayerId) return
    setSubmitting(true)
    try {
      await submitDefinition(round.id, localPlayerId, text.trim())
      setEditing(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const wordCard = (
    <Card className="text-center">
      <p className="text-sm font-bold uppercase tracking-wide text-white/60">{t('write.wordIs')}</p>
      <p className="mt-1 text-3xl font-black text-accent">{round.word}</p>
    </Card>
  )

  if (!editing && mine) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        {wordCard}
        <Card>
          <p className="text-white">{text}</p>
        </Card>
        <p className="text-center font-bold text-accent">{t('write.submitted')}</p>
        <p className="text-center text-sm text-white/60">{t('write.waitingOthers')}</p>
        <div className="mt-auto">
          <Button variant="ghost" onClick={() => setEditing(true)} className="w-full">
            {t('write.edit')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {wordCard}
      <TextField
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('write.placeholder')}
        maxLength={200}
        autoFocus
      />
      <div className="mt-auto">
        <Button
          variant="accent"
          onClick={submit}
          disabled={submitting || !text.trim()}
          className="w-full"
        >
          {submitting ? t('common.loading') : t('write.submit')}
        </Button>
      </div>
    </div>
  )
}
