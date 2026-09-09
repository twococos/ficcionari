// Barreja determinista: el mateix input dona sempre el mateix ordre a tots els
// dispositius (imprescindible perquè narrador i jugadors vegin les definicions
// en el mateix ordre sense coordinar-se). Ordenem per un hash de l'id.

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Retorna una còpia ordenada de forma estable i "aleatòria" per id. */
export function stableShuffle<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => hashString(a.id) - hashString(b.id))
}
