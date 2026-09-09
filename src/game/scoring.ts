// Càlcul de la puntuació d'una ronda. Funció pura i testejable.
// (A la Fase 4-B es duplicarà al servidor via Edge Function per anti-trampes.)
import { POINTS } from './constants'
import type { Definition, Vote } from '@/lib/database.types'

/** Valors de punts d'una partida (encertar / enganyar / més graciosa). */
export interface PointsConfig {
  guessReal: number
  deceived: number
  funniest: number
}

/** Punts per defecte (fallback) a partir de la constant POINTS. */
const DEFAULT_POINTS_CONFIG: PointsConfig = {
  guessReal: POINTS.GUESS_REAL,
  deceived: POINTS.PER_DECEIVED,
  funniest: POINTS.FUNNIEST,
}

/**
 * Extreu la configuració de punts d'una partida, amb fallback als defaults per a
 * partides antigues que encara no tinguin les columnes (valors undefined).
 */
export function pointsFromGame(game: {
  score_guess_real?: number
  score_deceived?: number
  score_funniest?: number
}): PointsConfig {
  return {
    guessReal: game.score_guess_real ?? DEFAULT_POINTS_CONFIG.guessReal,
    deceived: game.score_deceived ?? DEFAULT_POINTS_CONFIG.deceived,
    funniest: game.score_funniest ?? DEFAULT_POINTS_CONFIG.funniest,
  }
}

export interface RoundScoreDetail {
  playerId: string
  /** Punts per haver encertat la definició real. */
  guessedReal: number
  /** Punts per jugadors enganyats (que han votat la teva definició). */
  deceived: number
  /** Punts per ser la definició més graciosa. */
  funniest: number
  /** Total de la ronda. */
  total: number
}

export interface RoundScoreResult {
  /** Detall per jugador (només els que puntuen; els altres queden a 0). */
  byPlayer: Record<string, RoundScoreDetail>
  /** Id de la definició real. */
  realDefinitionId: string | null
  /** Id de la definició guanyadora de "més graciosa" (buit si hi ha empat: no
   *  puntua ningú i no es corona cap definició). */
  funniestDefinitionIds: string[]
}

function emptyDetail(playerId: string): RoundScoreDetail {
  return { playerId, guessedReal: 0, deceived: 0, funniest: 0, total: 0 }
}

/**
 * Calcula la puntuació d'una ronda a partir de les definicions i els vots.
 *
 * @param definitions  Totes les definicions de la ronda (inclosa la real).
 * @param votes        Tots els vots de la ronda (tipus 'real' i 'funny').
 * @param funnyEnabled Si el mode de votar la més graciosa està actiu.
 */
export function computeRoundScores(
  definitions: Definition[],
  votes: Vote[],
  funnyEnabled: boolean,
  points: PointsConfig = DEFAULT_POINTS_CONFIG
): RoundScoreResult {
  const byPlayer: Record<string, RoundScoreDetail> = {}
  const detail = (playerId: string) =>
    (byPlayer[playerId] ??= emptyDetail(playerId))

  const real = definitions.find((d) => d.is_real) ?? null
  const realId = real?.id ?? null

  const realVotes = votes.filter((v) => v.vote_type === 'real')

  // 1) Punts a qui ha encertat la real
  for (const v of realVotes) {
    if (realId && v.definition_id === realId) {
      detail(v.voter_player_id).guessedReal += points.guessReal
    }
  }

  // 2) Punts a l'autor per cada vot 'real' rebut per una definició inventada
  //    (algú s'ha cregut la seva mentida).
  const defById = new Map(definitions.map((d) => [d.id, d]))
  for (const v of realVotes) {
    const def = defById.get(v.definition_id)
    if (def && !def.is_real && def.author_player_id) {
      detail(def.author_player_id).deceived += points.deceived
    }
  }

  // 3) Més graciosa (opcional): la/les definicions amb més vots 'funny'.
  let funniestIds: string[] = []
  if (funnyEnabled) {
    const funnyVotes = votes.filter((v) => v.vote_type === 'funny')
    const counts = new Map<string, number>()
    for (const v of funnyVotes) {
      counts.set(v.definition_id, (counts.get(v.definition_id) ?? 0) + 1)
    }
    let max = 0
    for (const c of counts.values()) max = Math.max(max, c)
    if (max > 0) {
      const topIds = [...counts.entries()].filter(([, c]) => c === max).map(([id]) => id)
      // En cas d'EMPAT a la més graciosa, ningú puntua ni es corona: només hi ha
      // guanyadora si és única.
      if (topIds.length === 1) {
        funniestIds = topIds
        const def = defById.get(topIds[0])
        if (def?.author_player_id) {
          detail(def.author_player_id).funniest += points.funniest
        }
      }
    }
  }

  // Totals
  for (const d of Object.values(byPlayer)) {
    d.total = d.guessedReal + d.deceived + d.funniest
  }

  return { byPlayer, realDefinitionId: realId, funniestDefinitionIds: funniestIds }
}
