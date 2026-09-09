import { supabase } from '@/lib/supabase'
import type { Game, Player, Round, RoundPhase, Definition, Vote } from '@/lib/database.types'
import { computeRoundScores, pointsFromGame } from '@/game/scoring'

// -----------------------------------------------------------------------------
// Selecció de narrador
// -----------------------------------------------------------------------------

/**
 * Tria el narrador de la ronda següent de forma rotativa i justa: el jugador
 * (ordenat per joined_at) que fa més temps que no és narrador. Rep la llista de
 * jugadors i el narrador de la ronda anterior.
 */
export function pickNextNarrator(players: Player[], previousNarratorId: string | null): Player {
  const ordered = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at))
  if (!previousNarratorId) return ordered[0]
  const prevIdx = ordered.findIndex((p) => p.id === previousNarratorId)
  if (prevIdx === -1) return ordered[0]
  return ordered[(prevIdx + 1) % ordered.length]
}

// -----------------------------------------------------------------------------
// Cicle de ronda
// -----------------------------------------------------------------------------

/** Crea una nova ronda per a la partida amb el narrador indicat. */
export async function createRound(
  gameId: string,
  roundNumber: number,
  narratorPlayerId: string
): Promise<Round> {
  const { data, error } = await supabase
    .from('rounds')
    .insert({
      game_id: gameId,
      round_number: roundNumber,
      narrator_player_id: narratorPlayerId,
      phase: 'narrator_picking_word',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Llegeix la ronda actual (la de número més alt) d'una partida. */
export async function fetchCurrentRound(gameId: string): Promise<Round | null> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('game_id', gameId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * El narrador tria una paraula: es guarda la paraula i la definició real, i la
 * ronda passa a la fase d'anunciar la paraula. La definició real queda a la BD
 * (a la Fase 4 es protegirà amb RLS/Edge Functions).
 */
export async function chooseWord(
  roundId: string,
  word: string,
  realDefinition: string
): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ word, real_definition: realDefinition, phase: 'announcing_word' })
    .eq('id', roundId)
  if (error) throw error
}

/** Avança la fase de la ronda (usat pel narrador per passar de pantalla). */
export async function setRoundPhase(roundId: string, phase: RoundPhase): Promise<void> {
  const { error } = await supabase.from('rounds').update({ phase }).eq('id', roundId)
  if (error) throw error
}

/**
 * Reassigna el narrador d'una ronda (traspàs quan marxa) i reinicia el torn a
 * la fase de triar paraula, netejant la paraula i definició anteriors.
 */
export async function reassignNarrator(roundId: string, newNarratorId: string): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({
      narrator_player_id: newNarratorId,
      phase: 'narrator_picking_word',
      word: null,
      real_definition: null,
      scored: false,
    })
    .eq('id', roundId)
  if (error) throw error
}

// -----------------------------------------------------------------------------
// Definicions
// -----------------------------------------------------------------------------

/** Un jugador envia (o actualitza) la seva definició inventada per a la ronda. */
export async function submitDefinition(
  roundId: string,
  authorPlayerId: string,
  text: string
): Promise<void> {
  // Comprovem si ja n'havia enviat una (per si edita abans de tancar la fase).
  const { data: existing } = await supabase
    .from('definitions')
    .select('id')
    .eq('round_id', roundId)
    .eq('author_player_id', authorPlayerId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('definitions')
      .update({ text })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('definitions')
      .insert({ round_id: roundId, author_player_id: authorPlayerId, text, is_real: false })
    if (error) throw error
  }
}

/**
 * Insereix la definició real com una "definició" més (author null, is_real true)
 * per barrejar-la amb les inventades a l'hora de votar. Idempotent.
 */
export async function ensureRealDefinition(
  roundId: string,
  realText: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('definitions')
    .select('id')
    .eq('round_id', roundId)
    .eq('is_real', true)
    .maybeSingle()
  if (existing) return
  const { error } = await supabase
    .from('definitions')
    .insert({ round_id: roundId, author_player_id: null, text: realText, is_real: true })
  if (error) throw error
}

/** Totes les definicions d'una ronda. */
export async function fetchDefinitions(roundId: string): Promise<Definition[]> {
  const { data, error } = await supabase
    .from('definitions')
    .select('*')
    .eq('round_id', roundId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// -----------------------------------------------------------------------------
// Vots
// -----------------------------------------------------------------------------

/** Un jugador vota una definició (tipus 'real' o 'funny'). Idempotent per tipus. */
export async function submitVote(
  roundId: string,
  voterPlayerId: string,
  definitionId: string,
  voteType: 'real' | 'funny'
): Promise<void> {
  const { data: existing } = await supabase
    .from('votes')
    .select('id')
    .eq('round_id', roundId)
    .eq('voter_player_id', voterPlayerId)
    .eq('vote_type', voteType)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('votes')
      .update({ definition_id: definitionId })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('votes').insert({
      round_id: roundId,
      voter_player_id: voterPlayerId,
      definition_id: definitionId,
      vote_type: voteType,
    })
    if (error) throw error
  }
}

/** Tots els vots d'una ronda. */
export async function fetchVotes(roundId: string): Promise<Vote[]> {
  const { data, error } = await supabase.from('votes').select('*').eq('round_id', roundId)
  if (error) throw error
  return data ?? []
}

// -----------------------------------------------------------------------------
// Encadenar rondes / final de partida
// -----------------------------------------------------------------------------

/**
 * Avança a la ronda següent, o finalitza la partida si ja s'han jugat totes.
 * Ho executa el narrador de la ronda actual des de la pantalla de resultats.
 * Rota el narrador respecte l'actual.
 *
 * @returns 'next' si s'ha creat una nova ronda, 'finished' si s'ha acabat.
 */
export async function advanceToNextRound(
  game: Game,
  currentRound: Round,
  players: Player[]
): Promise<'next' | 'finished'> {
  const isLast = currentRound.round_number >= game.total_rounds
  if (isLast) {
    const { error } = await supabase
      .from('games')
      .update({ status: 'finished' })
      .eq('id', game.id)
    if (error) throw error
    return 'finished'
  }

  const nextNumber = currentRound.round_number + 1
  const connected = players.filter((p) => p.is_connected)
  const narrator = pickNextNarrator(connected, currentRound.narrator_player_id)

  // Evita duplicar la ronda si ja existeix (carrera).
  const existing = await fetchCurrentRound(game.id)
  if (existing && existing.round_number === nextNumber) return 'next'

  await createRound(game.id, nextNumber, narrator.id)
  const { error } = await supabase
    .from('games')
    .update({ current_round: nextNumber })
    .eq('id', game.id)
  if (error) throw error
  return 'next'
}

/**
 * Reinicia la partida per tornar a jugar amb els mateixos jugadors (només host):
 * esborra les rondes, posa els punts a 0 i torna l'estat a 'lobby'.
 */
export async function restartGame(gameId: string): Promise<void> {
  // Esborra totes les rondes (i, en cascada, definicions i vots).
  await supabase.from('rounds').delete().eq('game_id', gameId)
  // Punts a 0
  await supabase.from('players').update({ score: 0 }).eq('game_id', gameId)
  // Torna al lobby
  const { error } = await supabase
    .from('games')
    .update({ status: 'lobby', current_round: 0 })
    .eq('id', gameId)
  if (error) throw error
}

// -----------------------------------------------------------------------------
// Puntuació
// -----------------------------------------------------------------------------

/**
 * Aplica els punts de la ronda als jugadors, una sola vegada. Fa servir la
 * columna `scored` amb una actualització condicional (`.eq('scored', false)`)
 * per garantir que només un client apliqui la puntuació encara que diversos ho
 * intentin alhora: qui marca `scored=true` primer és qui suma els punts.
 *
 * Retorna true si aquest client ha estat el que ha aplicat la puntuació.
 */
export async function applyRoundScoring(
  round: Round,
  definitions: Definition[],
  votes: Vote[],
  game: Game
): Promise<boolean> {
  if (round.scored) return false

  // Intent atòmic de "reclamar" la puntuació d'aquesta ronda.
  const { data: claimed, error: claimErr } = await supabase
    .from('rounds')
    .update({ scored: true })
    .eq('id', round.id)
    .eq('scored', false)
    .select('id')
  if (claimErr) throw claimErr
  if (!claimed || claimed.length === 0) return false // un altre client ja ho ha fet

  // Calcula els punts amb els valors configurats de la partida.
  const result = computeRoundScores(
    definitions,
    votes,
    game.score_funny_enabled,
    pointsFromGame(game)
  )

  // Suma ATÒMICA al servidor: score = score + delta, calculat a la BD. Així el
  // total no depèn del snapshot local (que pot anar endarrerit), cosa que abans
  // feia divergir el podi/classificació entre dispositius quan el narrador rotava.
  await Promise.all(
    Object.values(result.byPlayer)
      .filter((d) => d.total > 0)
      .map((d) =>
        supabase.rpc('increment_player_score', {
          p_player_id: d.playerId,
          p_delta: d.total,
        })
      )
  )

  return true
}
