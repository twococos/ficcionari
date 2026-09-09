import { create } from 'zustand'
import type { Game, Player, Round, Definition, Vote } from '@/lib/database.types'
import { fetchGameByCode } from '@/features/lobby/lobbyApi'
import { fetchCurrentRound, fetchDefinitions, fetchVotes } from '@/features/game/roundApi'

interface GameState {
  game: Game | null
  players: Player[]
  // id del jugador local (aquest dispositiu) dins de la partida actual
  localPlayerId: string | null

  // Estat de la ronda en curs
  round: Round | null
  definitions: Definition[]
  votes: Vote[]

  setSession: (game: Game, localPlayerId: string | null, players: Player[]) => void
  /** Recarrega partida + jugadors des de la BD pel codi actual. */
  refresh: () => Promise<void>
  /** Recarrega la ronda actual + definicions + vots. */
  refreshRound: () => Promise<void>
  clear: () => void

  // Selectors derivats
  localPlayer: () => Player | null
  isHost: () => boolean
  isNarrator: () => boolean
  connectedPlayers: () => Player[]
  narrator: () => Player | null
}

export const useGameStore = create<GameState>((set, get) => ({
  game: null,
  players: [],
  localPlayerId: null,
  round: null,
  definitions: [],
  votes: [],

  setSession: (game, localPlayerId, players) => set({ game, localPlayerId, players }),

  refresh: async () => {
    const { game } = get()
    if (!game) return
    const fresh = await fetchGameByCode(game.code)
    if (fresh) {
      const { players, ...rest } = fresh
      set({ game: rest, players: players ?? [] })
    }
  },

  refreshRound: async () => {
    const { game } = get()
    if (!game) return
    const round = await fetchCurrentRound(game.id)
    if (!round) {
      set({ round: null, definitions: [], votes: [] })
      return
    }
    const [definitions, votes] = await Promise.all([
      fetchDefinitions(round.id),
      fetchVotes(round.id),
    ])
    set({ round, definitions, votes })
  },

  clear: () =>
    set({ game: null, players: [], localPlayerId: null, round: null, definitions: [], votes: [] }),

  localPlayer: () => {
    const { players, localPlayerId } = get()
    return players.find((p) => p.id === localPlayerId) ?? null
  },

  isHost: () => Boolean(get().localPlayer()?.is_host),

  isNarrator: () => {
    const { round, localPlayerId } = get()
    return Boolean(round && localPlayerId && round.narrator_player_id === localPlayerId)
  },

  connectedPlayers: () => get().players.filter((p) => p.is_connected),

  narrator: () => {
    const { players, round } = get()
    if (!round?.narrator_player_id) return null
    return players.find((p) => p.id === round.narrator_player_id) ?? null
  },
}))
