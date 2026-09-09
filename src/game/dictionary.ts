// Càrrega i selecció de paraules del diccionari empaquetat.

export interface DictionaryEntry {
  word: string
  pos: string
  definition: string
}

interface DictionaryFile {
  language: string
  attribution: string
  words: DictionaryEntry[]
}

// Cache en memòria per idioma per no recarregar el JSON.
const cache = new Map<string, DictionaryEntry[]>()

/** Carrega (i cacheja) el diccionari d'un idioma des de /dictionaries/<lang>.json */
export async function loadDictionary(language: string): Promise<DictionaryEntry[]> {
  const cached = cache.get(language)
  if (cached) return cached

  const res = await fetch(`/dictionaries/${language}.json`)
  if (!res.ok) throw new Error(`No s'ha pogut carregar el diccionari '${language}'`)
  const data: DictionaryFile = await res.json()
  cache.set(language, data.words)
  return data.words
}

/**
 * "Tira els daus": tria una paraula aleatòria del diccionari, evitant les que
 * ja s'han fet servir (per `word`). Si totes s'han fet servir, permet repetir.
 */
export function pickRandomWord(
  entries: DictionaryEntry[],
  usedWords: string[] = []
): DictionaryEntry {
  const used = new Set(usedWords.map((w) => w.toLowerCase()))
  const available = entries.filter((e) => !used.has(e.word.toLowerCase()))
  const pool = available.length > 0 ? available : entries
  const idx = Math.floor(Math.random() * pool.length)
  return pool[idx]
}
