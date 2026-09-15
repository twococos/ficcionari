import { DEFAULT_LAPS, DEFAULT_POINTS, DEFAULT_WRITE_TIME_LIMIT_MIN } from '@/game/constants'
import type { SupportedLanguage } from '@/i18n/config'
import type { Game } from '@/lib/database.types'

/**
 * Valors de les opcions configurables d'una partida, en el format del
 * formulari (camelCase). La traducció cap a i des de les columnes de la BD
 * viu aquí, compartida entre la creació de partida i l'edició al lobby.
 */
export interface GameOptionsValue {
  language: SupportedLanguage
  laps: number
  funnyMode: boolean
  showDefinitionOnPick: boolean
  hideDefinitionsOnVote: boolean
  writeTimeLimitEnabled: boolean
  writeTimeLimitMinutes: number
  pointsGuessReal: number
  pointsDeceived: number
  pointsFunniest: number
}

/** Valors per defecte d'una partida nova. */
export function defaultGameOptions(language: SupportedLanguage): GameOptionsValue {
  return {
    language,
    laps: DEFAULT_LAPS,
    funnyMode: false,
    showDefinitionOnPick: true,
    hideDefinitionsOnVote: false,
    writeTimeLimitEnabled: false,
    writeTimeLimitMinutes: DEFAULT_WRITE_TIME_LIMIT_MIN,
    pointsGuessReal: DEFAULT_POINTS.guessReal,
    pointsDeceived: DEFAULT_POINTS.deceived,
    pointsFunniest: DEFAULT_POINTS.funniest,
  }
}

/** Opcions del formulari → payload de l'API (create/update). */
export function gameOptionsToApi(v: GameOptionsValue) {
  return {
    language: v.language,
    totalLaps: v.laps,
    scoreFunnyEnabled: v.funnyMode,
    showDefinitionOnPick: v.showDefinitionOnPick,
    hideDefinitionsOnVote: v.hideDefinitionsOnVote,
    // 0 = desactivat, per no haver de desar un booleà a part.
    writeTimeLimitSeconds: v.writeTimeLimitEnabled ? v.writeTimeLimitMinutes * 60 : 0,
    pointsGuessReal: v.pointsGuessReal,
    pointsDeceived: v.pointsDeceived,
    pointsFunniest: v.pointsFunniest,
  }
}

/**
 * Fila de la BD → valors del formulari. Amb fallbacks als camps afegits més
 * tard, perquè les partides creades abans d'aquestes opcions no petin.
 */
export function gameOptionsFromGame(game: Game): GameOptionsValue {
  const limit = game.write_time_limit_seconds ?? 0
  return {
    language: game.language as SupportedLanguage,
    laps: game.total_laps ?? DEFAULT_LAPS,
    funnyMode: game.score_funny_enabled,
    showDefinitionOnPick: game.show_definition_on_pick,
    hideDefinitionsOnVote: game.hide_definitions_on_vote ?? false,
    writeTimeLimitEnabled: limit > 0,
    writeTimeLimitMinutes: limit > 0 ? Math.round(limit / 60) : DEFAULT_WRITE_TIME_LIMIT_MIN,
    pointsGuessReal: game.score_guess_real,
    pointsDeceived: game.score_deceived,
    pointsFunniest: game.score_funniest,
  }
}
