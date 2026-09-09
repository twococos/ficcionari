import { useEffect, useState } from 'react'
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
import { fetchGameByCode, startGame, kickPlayer } from './lobbyApi'
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

        {/* Acció: començar (host) o esperar */}
        {isHost() ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="accent"
              onClick={() => startGame(game.id)}
              disabled={!enoughPlayers}
            >
              {t('lobby.startGame')}
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
