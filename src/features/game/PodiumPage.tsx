import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { Confetti } from '@/components/Confetti'
import { useGameStore } from '@/store/gameStore'
import { useGameRealtime } from '@/features/lobby/useGameRealtime'
import { fetchGameByCode } from '@/features/lobby/lobbyApi'
import { restartGame } from './roundApi'
import { getDeviceId } from '@/lib/device'
import { normalizeCode } from '@/game/constants'
import type { Player } from '@/lib/database.types'

export function PodiumPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ code: string }>()
  const code = params.code ? normalizeCode(params.code) : ''

  const game = useGameStore((s) => s.game)
  const players = useGameStore((s) => s.players)
  const isHost = useGameStore((s) => s.isHost)
  const setSession = useGameStore((s) => s.setSession)
  const [restarting, setRestarting] = useState(false)

  useGameRealtime()

  // Reconstruir sessió si arribem sense estat (refresc).
  const hasSessionForCode = Boolean(game && game.code === code)
  useEffect(() => {
    if (hasSessionForCode) return
    let active = true
    ;(async () => {
      const fresh = await fetchGameByCode(code)
      if (!active || !fresh) return
      const me = fresh.players.find((p) => p.device_id === getDeviceId())
      const { players: pl, ...gameRow } = fresh
      setSession(gameRow, me?.id ?? null, pl ?? [])
    })()
    return () => {
      active = false
    }
  }, [code, hasSessionForCode, setSession])

  // Si la partida es reinicia (torna a lobby) o segueix jugant, redirigeix.
  const status = game?.status
  const gameCode = game?.code
  useEffect(() => {
    if (!status || !gameCode) return
    if (status === 'lobby') navigate(`/lobby/${gameCode}`)
    else if (status === 'in_round') navigate(`/game/${gameCode}`)
  }, [status, gameCode, navigate])

  if (!game) {
    return (
      <ScreenLayout showLanguage={false}>
        <p className="text-center text-white/70">{t('common.loading')}</p>
      </ScreenLayout>
    )
  }

  const ranked = [...players]
    .filter((p) => p.is_connected)
    .sort((a, b) => b.score - a.score)

  const top = ranked[0]
  const isTie = ranked.length > 1 && ranked[1].score === top?.score

  async function handleRestart() {
    if (!game) return
    setRestarting(true)
    try {
      await restartGame(game.id)
    } catch (e) {
      console.error(e)
      setRestarting(false)
    }
  }

  return (
    <ScreenLayout showLanguage={false} onBack={() => navigate('/')}>
      <Confetti />
      <div className="flex flex-1 flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-black text-white">{t('podium.title')}</h1>
          <p className="mt-2 text-lg font-bold text-accent">
            {isTie ? t('podium.tie') : t('podium.winner', { name: top?.nickname ?? '' })}
          </p>
        </div>

        <PodiumTop players={ranked} />

        {/* Resta de jugadors (a partir del 4t) */}
        {ranked.length > 3 && (
          <ul className="flex flex-col gap-2">
            {ranked.slice(3).map((p, i) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-2xl bg-primary-dark/40 px-4 py-2"
              >
                <span className="font-bold text-white">
                  {i + 4}. {p.nickname}
                </span>
                <span className="font-black text-white">{p.score}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-col gap-3">
          {isHost() ? (
            <Button
              variant="accent"
              onClick={handleRestart}
              disabled={restarting}
              className="w-full"
            >
              {restarting ? t('common.loading') : t('podium.playAgain')}
            </Button>
          ) : (
            <p className="text-center text-sm text-white/60">{t('podium.waitingHostRestart')}</p>
          )}
          <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
            {t('podium.exit')}
          </Button>
        </div>
      </div>
    </ScreenLayout>
  )
}

/** Els 3 primers en format podi visual (1r al centre més alt). */
function PodiumTop({ players }: { players: Player[] }) {
  const { t } = useTranslation()
  const [first, second, third] = players

  const Column = ({
    player,
    place,
    heightClass,
    medal,
  }: {
    player?: Player
    place: number
    heightClass: string
    medal: string
  }) => {
    if (!player) return <div className="flex-1" />
    return (
      <div className="flex flex-1 flex-col items-center justify-end gap-2">
        <span className="text-3xl">{medal}</span>
        <span className="max-w-full truncate px-1 text-center font-bold text-white">
          {player.nickname}
        </span>
        <span className="text-sm font-black text-accent">
          {t('podium.points', { count: player.score })}
        </span>
        <div
          className={`w-full origin-bottom rounded-t-2xl bg-gradient-to-b from-accent/80 to-accent/30 ${heightClass} animate-[podiumRise_0.5s_ease-out_both]`}
          style={{ animationDelay: `${place * 120}ms` }}
        >
          <span className="flex h-full items-start justify-center pt-2 text-2xl font-black text-primary-dark">
            {place}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2">
      <Column player={second} place={2} heightClass="h-24" medal="🥈" />
      <Column player={first} place={1} heightClass="h-36" medal="🥇" />
      <Column player={third} place={3} heightClass="h-16" medal="🥉" />
    </div>
  )
}
