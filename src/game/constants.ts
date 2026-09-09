// Constants de configuració del joc.

// Nombre de jugadors. El joc del diccionari funciona des de 3 (narrador + 2).
// TEMPORAL (desenvolupament): mínim a 2 per poder provar amb 2 dispositius.
// TODO: tornar a 3 abans de publicar.
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 12

// Rondes configurables en crear la partida.
export const ROUND_OPTIONS = [3, 5, 8, 10] as const
export const DEFAULT_ROUNDS = 3

// Puntuació (vegeu .claude/PLA-DESENVOLUPAMENT.md).
export const POINTS = {
  /** Encertar la definició real. */
  GUESS_REAL: 3,
  /** Per cada jugador que voti (es cregui) la teva definició inventada. */
  PER_DECEIVED: 1,
  /** La definició més votada com a graciosa (si el mode està actiu). */
  FUNNIEST: 2,
} as const

// Alfabet per als codis de partida: majúscules sense caràcters ambigus
// (fora O, I) per evitar confusions en dir-los/teclejar-los.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export const CODE_LENGTH = 4

/**
 * Genera un codi de partida de 4 lletres majúscules.
 * Fem servir crypto per a una distribució uniforme quan estigui disponible.
 */
export function generateGameCode(): string {
  const n = CODE_ALPHABET.length
  let code = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(CODE_LENGTH)
    crypto.getRandomValues(buf)
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[buf[i] % n]
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * n)]
    }
  }
  return code
}

/** Normalitza un codi introduït per l'usuari (majúscules, sense espais). */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, CODE_LENGTH)
}
