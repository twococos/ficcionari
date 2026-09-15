import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { CheckIcon } from '@/components/CheckIcon'
import { ProgressBar } from '../ProgressBar'
import { useGameStore } from '@/store/gameStore'
import { submitDefinition, setRoundPhase, ensureRealDefinition } from '../roundApi'
import type { Round } from '@/lib/database.types'

// Amb 4+ jugadors, quan tots menys un han escrit, l'últim té aquest temps.
// Només s'aplica si la partida NO té temps límit configurat (si en té, tothom
// juga amb el mateix rellotge des del principi).
const LAST_ONE_COUNTDOWN_MS = 30000

export function WriteDefinitionPhase() {
  const round = useGameStore((s) => s.round)
  const isNarrator = useGameStore((s) => s.isNarrator)

  if (!round) return null
  return isNarrator() ? <NarratorWritingView round={round} /> : <PlayerWritingView round={round} />
}

/**
 * Temps límit d'escriptura de la partida, ancorat a l'instant d'entrada a la
 * fase (rellotge compartit): una recàrrega no el reinicia. `limitMs` és 0 quan
 * l'opció està desactivada.
 */
function useWriteTimeLimit(round: Round) {
  const game = useGameStore((s) => s.game)
  const limitMs = (game?.write_time_limit_seconds ?? 0) * 1000
  const elapsedMs = limitMs > 0 ? Date.now() - new Date(round.phase_started_at).getTime() : 0
  return {
    limitMs,
    elapsedMs,
    remainingMs: limitMs > 0 ? Math.max(0, limitMs - elapsedMs) : 0,
    expired: limitMs > 0 && elapsedMs >= limitMs,
  }
}

/** Barra del temps límit, amb l'etiqueta a sobre. */
function TimeLimitBar({ limitMs, elapsedMs }: { limitMs: number; elapsedMs: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      <p className="text-center text-xs font-bold text-accent">{t('write.timeLeft')}</p>
      <ProgressBar durationMs={limitMs} variant="bar" elapsedMs={elapsedMs} />
    </div>
  )
}

function NarratorWritingView({ round }: { round: Round }) {
  const { t } = useTranslation()
  const definitions = useGameStore((s) => s.definitions)
  const players = useGameStore((s) => s.players)
  const [forcing, setForcing] = useState(false)
  const { limitMs, elapsedMs, expired } = useWriteTimeLimit(round)

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

      <div className="mt-auto flex flex-col gap-3">
        {/* El narrador també veu córrer el temps, per saber quant queda. */}
        {limitMs > 0 && !expired && <TimeLimitBar limitMs={limitMs} elapsedMs={elapsedMs} />}
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
  const players = useGameStore((s) => s.players)
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
  const submitRef = useRef(submit)
  submitRef.current = submit

  const { limitMs, elapsedMs, remainingMs, expired } = useWriteTimeLimit(round)

  // Compte enrere per a l'ÚLTIM que queda per escriure (amb 4+ jugadors). Només
  // té sentit quan no hi ha temps límit global; si n'hi ha, ja corre per a tothom.
  const connected = players.filter((p) => p.is_connected)
  const nonNarrator = connected.filter((p) => p.id !== round.narrator_player_id)
  const authoredIds = new Set(
    definitions.filter((d) => d.author_player_id).map((d) => d.author_player_id)
  )
  const pendingIds = nonNarrator.filter((p) => !authoredIds.has(p.id)).map((p) => p.id)
  const iAmLastPending =
    limitMs === 0 &&
    !mine &&
    nonNarrator.length >= 3 &&
    pendingIds.length === 1 &&
    pendingIds[0] === localPlayerId

  // En expirar el compte enrere, auto-enviem el que hi hagi (si hi ha text).
  useEffect(() => {
    if (!iAmLastPending) return
    const timer = setTimeout(() => {
      if (submitRef.current) void submitRef.current()
    }, LAST_ONE_COUNTDOWN_MS)
    return () => clearTimeout(timer)
  }, [iAmLastPending])

  // Mateix efecte per al temps límit global. S'arma mentre s'estigui editant
  // (encara que ja s'hagi enviat abans: si has obert "Editar" quan s'acaba el
  // temps, val el text que tens a la pantalla). `submitDefinition` és idempotent.
  useEffect(() => {
    if (limitMs === 0 || expired || !editing) return
    const timer = setTimeout(() => {
      if (submitRef.current) void submitRef.current()
    }, remainingMs)
    return () => clearTimeout(timer)
    // `remainingMs` deriva de phase_started_at, que ja és a les dependències.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitMs, expired, editing, round.phase_started_at])

  // Barra de progrés del compte enrere, mostrada sota el botó quan escau.
  const countdown = iAmLastPending ? (
    <div className="flex flex-col gap-1">
      <p className="text-center text-xs font-bold text-accent">{t('write.hurryUp')}</p>
      <ProgressBar durationMs={LAST_ONE_COUNTDOWN_MS} variant="bar" />
    </div>
  ) : limitMs > 0 && !expired ? (
    <TimeLimitBar limitMs={limitMs} elapsedMs={elapsedMs} />
  ) : null

  // Capçalera blanca amb la paraula, unida al quadre de text per una línia:
  // així la paraula queda just sobre el que s'està escrivint.
  const wordHeader = (
    <div className="bg-white px-4 py-3 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-primary-dark/50">
        {t('write.wordIs')}
      </p>
      <p className="text-3xl font-black text-accent">{round.word}</p>
    </div>
  )

  if (!editing && mine) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          {wordHeader}
          <div className="border-t border-primary-dark/10 px-4 py-3">
            <p className="text-primary-dark">{text}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          <CheckIcon className="h-6 w-6" />
          <p className="font-bold text-accent">{t('write.submitted')}</p>
        </div>
        <p className="text-center text-sm text-white/60">{t('write.waitingOthers')}</p>
        <div className="mt-auto flex flex-col gap-3">
          {countdown}
          <Button variant="ghost" onClick={() => setEditing(true)} className="w-full">
            {t('write.edit')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Quadre blanc: capçalera amb la paraula + textarea, units. */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
        {wordHeader}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('write.placeholder')}
          maxLength={200}
          autoFocus
          rows={4}
          className="w-full resize-none border-t border-primary-dark/10 bg-white px-4 py-3 text-primary-dark placeholder:text-primary-dark/40 outline-none"
        />
      </div>
      {/* El botó va JUST sota el quadre (no a baix de tot) perquè amb el teclat
          del mòbil obert quedi accessible sense haver de fer scroll. */}
      <Button
        variant="accent"
        onClick={submit}
        disabled={submitting || !text.trim()}
        className="w-full"
      >
        {submitting ? t('common.loading') : t('write.submit')}
      </Button>

      {countdown}
    </div>
  )
}
