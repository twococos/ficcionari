import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { QRCode } from '@/components/QRCode'
import { MIN_PLAYERS, normalizeCode } from '@/game/constants'
import { useGameStore } from '@/store/gameStore'
import { useGameRealtime } from './useGameRealtime'
import { usePresence } from '@/features/game/usePresence'
import { useTransfers } from '@/features/game/useTransfers'
import { useKickRedirect } from '@/features/game/useKickRedirect'
import { fetchGameByCode, startGame, kickPlayer, updateGameOptions } from './lobbyApi'
import { GameOptionsFields, type GameOptionsValue } from './GameOptionsFields'
import type { SupportedLanguage } from '@/i18n/config'
import type { Game } from '@/lib/database.types'
import { getDeviceId } from '@/lib/device'

export function LobbyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ code: string }>()
  const code = params.code ? normalizeCode(params.code) : ''

  const game = useGameStore((s) => s.game)
  const players = useGameStore((s) => s.players)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const setSession = useGameStore((s) => s.setSession)
  const isHost = useGameStore((s) => s.isHost)

  const [loading, setLoading] = useState(!game || game.code !== code)
  const [notFound, setNotFound] = useState(false)
  const [starting, setStarting] = useState(false)

  // Esborrany viu de les opcions editades pel host (l'omple GameOptionsEditor).
  // En començar, es desa abans d'arrencar la partida (sense botó de desar).
  const optionsDraftRef = useRef<GameOptionsValue | null>(null)

  // Manté el store sincronitzat via Realtime + presència + traspàs d'host.
  useGameRealtime()
  usePresence()
  useTransfers()
  useKickRedirect()

  // Si arribem sense sessió en memòria (refresc, reconnexió), reconstruïm-la
  // des de la BD identificant el jugador local pel device_id.
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
        if (!active) return
        if (!fresh) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const deviceId = getDeviceId()
        const me = fresh.players.find((p) => p.device_id === deviceId)
        const { players: pl, ...gameRow } = fresh
        setSession(gameRow, me?.id ?? null, pl ?? [])
        setLoading(false)
      } catch (e) {
        console.error(e)
        if (active) {
          setNotFound(true)
          setLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [code, hasSessionForCode, setSession])

  // Quan la partida arrenca, tots els dispositius naveguen a la pantalla de joc.
  const gameStatus = game?.status
  const gameCode = game?.code
  useEffect(() => {
    if (gameStatus && gameStatus !== 'lobby' && gameCode) {
      navigate(`/game/${gameCode}`)
    }
  }, [gameStatus, gameCode, navigate])

  if (loading) {
    return (
      <ScreenLayout showLanguage={false}>
        <p className="text-center text-white/70">{t('common.loading')}</p>
      </ScreenLayout>
    )
  }

  if (notFound || !game) {
    return (
      <ScreenLayout title={t('join.title')}>
        <p className="text-center text-accent">{t('join.notFound')}</p>
      </ScreenLayout>
    )
  }

  const joinUrl = `${window.location.origin}/join/${game.code}`
  const connected = players.filter((p) => p.is_connected)
  const enoughPlayers = connected.length >= MIN_PLAYERS

  // En començar: desa primer les opcions editades (si n'hi ha) i després arrenca.
  async function handleStart() {
    if (!game) return
    setStarting(true)
    try {
      const draft = optionsDraftRef.current
      if (draft) {
        await updateGameOptions(game.id, {
          language: draft.language,
          totalRounds: draft.rounds,
          scoreFunnyEnabled: draft.funnyMode,
          showDefinitionOnPick: draft.showDefinitionOnPick,
          pointsGuessReal: draft.pointsGuessReal,
          pointsDeceived: draft.pointsDeceived,
          pointsFunniest: draft.pointsFunniest,
        })
      }
      await startGame(game.id)
    } catch (e) {
      console.error(e)
      setStarting(false)
    }
  }

  return (
    <ScreenLayout title={t('lobby.title')} onBack={() => navigate('/')}>
      <div className="flex flex-col gap-6">
        {/* Codi + QR per convidar */}
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-bold text-white/70">{t('lobby.code')}</p>
          <p className="text-5xl font-black tracking-[0.3em] text-accent">{game.code}</p>
          <QRCode value={joinUrl} size={180} />
          <p className="text-xs text-white/50">{t('lobby.scanQr')}</p>
          <ShareButton url={joinUrl} />
        </Card>

        {/* Llista de jugadors (realtime) */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white">{t('lobby.players')}</h2>
            <span className="rounded-full bg-primary-dark/50 px-3 py-1 text-sm font-bold text-white/80">
              {connected.length}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {connected.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-2xl bg-primary-dark/40 px-4 py-3"
              >
                <span className="font-bold text-white">
                  {p.nickname}
                  {p.id === localPlayerId && (
                    <span className="ml-2 text-xs font-normal text-accent">({t('lobby.you')})</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {p.is_host && (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                      {t('lobby.host')}
                    </span>
                  )}
                  {isHost() && p.id !== localPlayerId && (
                    <button
                      onClick={() => kickPlayer(p.id)}
                      aria-label={t('lobby.kick')}
                      className="rounded-full px-2 py-0.5 text-xs text-white/40 hover:text-accent"
                    >
                      ✕
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Opcions de la partida (només el host les pot editar). L'esborrany
            s'informa cap amunt i es desa en clicar Començar. */}
        {isHost() && (
          <GameOptionsEditor
            game={game}
            onDraftChange={(d) => {
              optionsDraftRef.current = d
            }}
          />
        )}

        {/* Acció: començar (host) o esperar */}
        {isHost() ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="accent"
              onClick={handleStart}
              disabled={!enoughPlayers || starting}
            >
              {starting ? t('common.loading') : t('lobby.startGame')}
            </Button>
            {!enoughPlayers && (
              <p className="text-center text-xs text-white/60">
                {t('lobby.needMorePlayers', { count: MIN_PLAYERS })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-white/70">{t('lobby.waitingForHost')}</p>
        )}
      </div>
    </ScreenLayout>
  )
}

/** Deriva els valors del formulari d'opcions a partir de la fila de la partida. */
function optionsFromGame(game: Game): GameOptionsValue {
  return {
    language: game.language as SupportedLanguage,
    rounds: game.total_rounds,
    funnyMode: game.score_funny_enabled,
    showDefinitionOnPick: game.show_definition_on_pick,
    pointsGuessReal: game.score_guess_real,
    pointsDeceived: game.score_deceived,
    pointsFunniest: game.score_funniest,
  }
}

/**
 * Editor plegable de les opcions de la partida al lobby (només host). Manté un
 * esborrany local i l'informa cap amunt via `onDraftChange`; no es desa amb un
 * botó, sinó que el LobbyPage el desa en clicar "Començar partida".
 */
function GameOptionsEditor({
  game,
  onDraftChange,
}: {
  game: Game
  onDraftChange: (draft: GameOptionsValue) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<GameOptionsValue>(() => optionsFromGame(game))

  // Informa el pare del valor inicial (i cada cop que canvia) perquè el pugui
  // desar en començar. No depenem de `game` per no trepitjar edicions en curs.
  useEffect(() => {
    onDraftChange(draft)
  }, [draft, onDraftChange])

  const patch = (p: Partial<GameOptionsValue>) => setDraft((d) => ({ ...d, ...p }))

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="font-bold text-white">{t('lobby.editOptions')}</span>
        <span className="text-white/50">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-5">
          <GameOptionsFields value={draft} onChange={patch} />
        </div>
      )}
    </Card>
  )
}

function ShareButton({ url }: { url: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({ url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* usuari ha cancel·lat o no suportat */
    }
  }

  return (
    <button
      onClick={handleShare}
      className="rounded-full border-2 border-white/30 px-4 py-1.5 text-sm font-bold text-white hover:border-white"
    >
      {copied ? t('common.copied') : t('lobby.shareLink')}
    </button>
  )
}
