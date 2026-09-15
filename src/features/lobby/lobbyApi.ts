import { supabase, ensureAnonymousSession } from '@/lib/supabase'
import { getDeviceId, rememberLastGame } from '@/lib/device'
import { generateGameCode } from '@/game/constants'
import type { Game, Player } from '@/lib/database.types'

export interface CreateGameOptions {
  language: string
  // Voltes: total_rounds es calcula en començar (voltes × jugadors).
  totalLaps: number
  scoreFunnyEnabled: boolean
  hostNickname: string
  // Punts configurables (encertar la real / que et votin / més graciosa).
  pointsGuessReal: number
  pointsDeceived: number
  pointsFunniest: number
  // El narrador veu la definició del diccionari mentre tria paraula.
  showDefinitionOnPick: boolean
  // Els votants només veuen números; el narrador llegeix les definicions.
  hideDefinitionsOnVote: boolean
  // Temps límit per escriure, en segons. 0 = desactivat.
  writeTimeLimitSeconds: number
}

export interface GameWithPlayers extends Game {
  players: Player[]
}

/**
 * Crea una partida i hi afegeix el jugador host. Reintenta si el codi col·lisiona.
 * Retorna la partida i el jugador host creat.
 */
export async function createGame(opts: CreateGameOptions): Promise<{ game: Game; player: Player }> {
  const authUserId = await ensureAnonymousSession()
  const deviceId = getDeviceId()

  let lastError: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGameCode()
    const { data: game, error } = await supabase
      .from('games')
      .insert({
        code,
        language: opts.language,
        total_laps: opts.totalLaps,
        score_funny_enabled: opts.scoreFunnyEnabled,
        score_guess_real: opts.pointsGuessReal,
        score_deceived: opts.pointsDeceived,
        score_funniest: opts.pointsFunniest,
        show_definition_on_pick: opts.showDefinitionOnPick,
        hide_definitions_on_vote: opts.hideDefinitionsOnVote,
        write_time_limit_seconds: opts.writeTimeLimitSeconds,
        status: 'lobby',
        current_round: 0,
      })
      .select()
      .single()

    if (error) {
      // 23505 = unique_violation (codi repetit) → reintenta
      if (error.code === '23505') {
        lastError = error
        continue
      }
      throw error
    }

    // Crear el jugador host
    const { data: player, error: pErr } = await supabase
      .from('players')
      .insert({
        game_id: game.id,
        device_id: deviceId,
        auth_user_id: authUserId,
        nickname: opts.hostNickname,
        is_host: true,
        is_connected: true,
      })
      .select()
      .single()
    if (pErr) throw pErr

    // Assignar el host a la partida
    await supabase.from('games').update({ host_player_id: player.id }).eq('id', game.id)

    rememberLastGame(game.code)
    return { game: { ...game, host_player_id: player.id }, player }
  }

  throw lastError ?? new Error("No s'ha pogut generar un codi de partida únic")
}

/** Llegeix una partida pel seu codi, amb la llista de jugadors. */
export async function fetchGameByCode(code: string): Promise<GameWithPlayers | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*, players(*)')
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  return (data as GameWithPlayers | null) ?? null
}

/**
 * Uneix aquest dispositiu a una partida. Si el dispositiu ja hi era (mateix
 * device_id), recupera el jugador existent (reconnexió) i actualitza l'àlies
 * si cal. Si no, crea un jugador nou.
 */
export async function joinGame(
  code: string,
  nickname: string
): Promise<{ game: Game; player: Player }> {
  const authUserId = await ensureAnonymousSession()
  const deviceId = getDeviceId()

  const game = await fetchGameByCode(code)
  if (!game) throw new Error('GAME_NOT_FOUND')

  // Ja existeix aquest dispositiu a la partida? → reconnexió
  const existing = game.players.find((p) => p.device_id === deviceId)
  if (existing) {
    const { data: updated, error } = await supabase
      .from('players')
      .update({ is_connected: true, nickname, auth_user_id: authUserId })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    rememberLastGame(game.code)
    return { game, player: updated }
  }

  // Nou jugador
  const { data: player, error } = await supabase
    .from('players')
    .insert({
      game_id: game.id,
      device_id: deviceId,
      auth_user_id: authUserId,
      nickname,
      is_host: false,
      is_connected: true,
    })
    .select()
    .single()
  if (error) throw error

  rememberLastGame(game.code)
  return { game, player }
}

/** Marca un jugador com a desconnectat (en sortir/tancar). */
export async function setPlayerConnected(playerId: string, connected: boolean): Promise<void> {
  await supabase.from('players').update({ is_connected: connected }).eq('id', playerId)
}

/** Promou un jugador a host (traspàs quan l'host marxa). */
export async function promoteToHost(gameId: string, playerId: string): Promise<void> {
  // Treu el flag d'host a tothom i l'assigna al nou.
  await supabase.from('players').update({ is_host: false }).eq('game_id', gameId)
  await supabase.from('players').update({ is_host: true }).eq('id', playerId)
  await supabase.from('games').update({ host_player_id: playerId }).eq('id', gameId)
}

/** Expulsa un jugador de la partida (només host). */
export async function kickPlayer(playerId: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw error
}

/** Avorta la partida (només host): la torna a l'estat de lobby finalitzat. */
export async function abortGame(gameId: string): Promise<void> {
  const { error } = await supabase.from('games').update({ status: 'finished' }).eq('id', gameId)
  if (error) throw error
}

/** Opcions editables d'una partida des del lobby (només host). */
export interface UpdateGameOptions {
  language: string
  totalLaps: number
  scoreFunnyEnabled: boolean
  showDefinitionOnPick: boolean
  hideDefinitionsOnVote: boolean
  writeTimeLimitSeconds: number
  pointsGuessReal: number
  pointsDeceived: number
  pointsFunniest: number
}

/**
 * Actualitza les opcions de la partida des del lobby (només host). El realtime
 * propaga els canvis a tots els dispositius.
 */
export async function updateGameOptions(gameId: string, opts: UpdateGameOptions): Promise<void> {
  const { error } = await supabase
    .from('games')
    .update({
      language: opts.language,
      total_laps: opts.totalLaps,
      score_funny_enabled: opts.scoreFunnyEnabled,
      show_definition_on_pick: opts.showDefinitionOnPick,
      hide_definitions_on_vote: opts.hideDefinitionsOnVote,
      write_time_limit_seconds: opts.writeTimeLimitSeconds,
      score_guess_real: opts.pointsGuessReal,
      score_deceived: opts.pointsDeceived,
      score_funniest: opts.pointsFunniest,
    })
    .eq('id', gameId)
  if (error) throw error
}

/**
 * Inicia la partida (només el host). Passa l'estat a 'in_round' i fixa el
 * nombre total de rondes, calculat a partir de les voltes i dels jugadors que
 * hi ha en aquest moment (voltes × jugadors), perquè tothom faci de narrador
 * el mateix nombre de cops.
 */
export async function startGame(gameId: string, totalRounds: number): Promise<void> {
  const { error } = await supabase
    .from('games')
    .update({ status: 'in_round', current_round: 1, total_rounds: totalRounds })
    .eq('id', gameId)
  if (error) throw error
}
