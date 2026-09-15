import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScreenLayout } from '@/components/ScreenLayout'
import { useGameStore } from '@/store/gameStore'
import { useGameRealtime } from '@/features/lobby/useGameRealtime'
import { useRoundOrchestration } from './useRoundOrchestration'
import { usePresence } from './usePresence'
import { useTransfers } from './useTransfers'
import { useKickRedirect } from './useKickRedirect'
import { GameHeader } from './GameHeader'
import { HostControls } from './HostControls'
import { FunnyBackground } from './FunnyBackground'
import { fetchGameByCode } from '@/features/lobby/lobbyApi'
import { getDeviceId } from '@/lib/device'
import { normalizeCode } from '@/game/constants'
import { createRound, fetchCurrentRound, pickNextNarrator } from './roundApi'
import { PickWordPhase } from './phases/PickWordPhase'
import { AnnounceWordPhase } from './phases/AnnounceWordPhase'
import { WriteDefinitionPhase } from './phases/WriteDefinitionPhase'
import { ReadingPhase } from './phases/ReadingPhase'
import { VotingPhase } from './phases/VotingPhase'
import { RevealPhase } from './phases/RevealPhase'
import { WordBanner } from './WordBanner'

// Fases en què la paraula de la ronda es manté visible per a TOTHOM. No hi és
// `announcing_word` a posta: allà els jugadors l'han d'escoltar del narrador.
const WORD_VISIBLE_PHASES = new Set([
  'writing_definitions',
  'narrator_reading',
  'voting_real',
  'voting_funny',
  'reveal',
])

// A `writing_definitions` els jugadors ja tenen la paraula dins del quadre
// d'escriure (capçalera unida al textarea), així que el banner hi sobra: només
// el veu el narrador, que no té aquell quadre.
function showsWordBanner(phase: string, isNarrator: boolean): boolean {
  if (!WORD_VISIBLE_PHASES.has(phase)) return false
  return phase !== 'writing_definitions' || isNarrator
}

export function GamePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ code: string }>()
  const code = params.code ? normalizeCode(params.code) : ''

  const game = useGameStore((s) => s.game)
  const round = useGameStore((s) => s.round)
  const players = useGameStore((s) => s.players)
  const isHost = useGameStore((s) => s.isHost)
  const isNarrator = useGameStore((s) => s.isNarrator)
  const setSession = useGameStore((s) => s.setSession)

  const [loading, setLoading] = useState(!game || game.code !== code)

  useGameRealtime()
  useRoundOrchestration()
  usePresence()
  useTransfers()
  useKickRedirect()

  // Reconstruir sessió si arribem sense estat en memòria (refresc/reconnexió).
  const hasSessionForCode = Boolean(game && game.code === code)
  useEffect(() => {
    if (hasSessionForCode) {
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      try {
        const fresh = await fetchGameByCode(code)
        if (!active || !fresh) return
        const me = fresh.players.find((p) => p.device_id === getDeviceId())
        const { players: pl, ...gameRow } = fresh
        setSession(gameRow, me?.id ?? null, pl ?? [])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [code, hasSessionForCode, setSession])

  // El HOST crea la primera ronda quan la partida acaba d'arrencar i no n'hi ha.
  const creatingRef = useRef(false)
  useEffect(() => {
    if (!game || game.status !== 'in_round') return
    if (!isHost()) return
    if (round) return
    if (creatingRef.current) return
    creatingRef.current = true
    ;(async () => {
      try {
        const existing = await fetchCurrentRound(game.id)
        if (existing) return // ja existeix (una altra carrera)
        const narrator = pickNextNarrator(
          players.filter((p) => p.is_connected),
          null
        )
        await createRound(game.id, game.current_round, narrator.id)
      } catch (e) {
        console.error(e)
        creatingRef.current = false
      }
    })()
  }, [game, round, players, isHost])

  // Redireccions segons l'estat de la partida.
  const gameStatus = game?.status
  const gameCode = game?.code
  useEffect(() => {
    if (!gameCode) return
    if (gameStatus === 'lobby') navigate(`/lobby/${gameCode}`)
    else if (gameStatus === 'finished') navigate(`/podium/${gameCode}`)
  }, [gameStatus, gameCode, navigate])

  if (loading || !game) {
    return (
      <ScreenLayout showLanguage={false}>
        <p className="text-center text-white/70">{t('common.loading')}</p>
      </ScreenLayout>
    )
  }

  return (
    <ScreenLayout
      showLanguage={false}
      onBack={() => navigate('/')}
      backLabel={t('common.leaveGame')}
    >
      <FunnyBackground active={round?.phase === 'voting_funny'} />
      <GameHeader />

      {/* La paraula es renderitza aquí, fora del contenidor animat de la fase,
          perquè no parpellegi a cada canvi de fase. */}
      {round?.word && showsWordBanner(round.phase, isNarrator()) && (
        <div className="mb-4">
          <WordBanner
            word={round.word}
            compact
            tone={round.phase === 'voting_funny' ? 'onAccent' : 'default'}
          />
        </div>
      )}

      {!round ? (
        <p className="text-center text-white/60">{t('common.loading')}</p>
      ) : (
        <PhaseView phase={round.phase} />
      )}
      <HostControls />
    </ScreenLayout>
  )
}

function PhaseView({ phase }: { phase: string }) {
  // Re-anima suaument cada cop que canvia la fase (key força el remuntatge).
  return (
    <div key={phase} className="flex flex-1 animate-[fadeIn_0.35s_ease-out_both] flex-col">
      <PhaseContent phase={phase} />
    </div>
  )
}

function PhaseContent({ phase }: { phase: string }) {
  switch (phase) {
    case 'narrator_picking_word':
      return <PickWordPhase />
    case 'announcing_word':
      return <AnnounceWordPhase />
    case 'writing_definitions':
      return <WriteDefinitionPhase />
    case 'narrator_reading':
      return <ReadingPhase />
    case 'voting_real':
      return <VotingPhase voteType="real" />
    case 'voting_funny':
      return <VotingPhase voteType="funny" />
    case 'reveal':
      return <RevealPhase />
    default:
      return null
  }
}
