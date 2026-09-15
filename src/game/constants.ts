// Constants de configuració del joc.

// Nombre de jugadors. El joc del diccionari funciona des de 3 (narrador + 2).
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12

// Durada de la partida en VOLTES: una volta = tots els jugadors fan de narrador
// un cop. El nombre real de rondes es calcula en començar (voltes × jugadors),
// de manera que la partida sempre acaba amb els torns repartits equitativament.
export const LAP_OPTIONS = [1, 2, 3] as const
export const DEFAULT_LAPS = 1

// Temps límit per escriure definicions (opció desactivada per defecte). Es desa
// a la BD en segons; a la interfície es configura en minuts enters.
export const DEFAULT_WRITE_TIME_LIMIT_MIN = 3
export const WRITE_TIME_LIMIT_MIN = 1
export const WRITE_TIME_LIMIT_MAX = 10

// Puntuació per defecte (fallback per a partides sense valors configurats).
// Els valors reals es configuren en crear la partida i es desen a la taula games.
export const POINTS = {
  /** Encertar la definició real. */
  GUESS_REAL: 1,
  /** Per cada jugador que voti (es cregui) la teva definició inventada. */
  PER_DECEIVED: 1,
  /** La definició més votada com a graciosa (si el mode està actiu). */
  FUNNIEST: 1,
} as const

// Límits dels camps numèrics de puntuació al crear la partida.
export const POINTS_MIN = 0
export const POINTS_MAX = 20
export const DEFAULT_POINTS = { guessReal: 1, deceived: 1, funniest: 1 } as const

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
