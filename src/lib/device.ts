// Identitat persistent del dispositiu per a reconnexió automàtica.
// Guardem un device_id estable a localStorage; quan un jugador torna a obrir
// l'app (mateix navegador), recuperem el seu lloc a la partida via aquest id.

const DEVICE_ID_KEY = 'ficcionari-device-id'

/**
 * Genera un identificador únic. Prioritza crypto.randomUUID; si no està
 * disponible, cau a un fallback prou robust per a l'ús previst.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Retorna el device_id d'aquest dispositiu, creant-lo i persistint-lo si cal.
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = generateId()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

// Última partida a la qual s'ha unit aquest dispositiu (per reconnexió ràpida).
const LAST_GAME_KEY = 'ficcionari-last-game'

export function rememberLastGame(code: string): void {
  localStorage.setItem(LAST_GAME_KEY, code)
}

export function getLastGame(): string | null {
  return localStorage.getItem(LAST_GAME_KEY)
}

export function forgetLastGame(): void {
  localStorage.removeItem(LAST_GAME_KEY)
}
