// =============================================================================
// Ficcionari — Neteja de jugabilitat dels diccionaris
//
// Post-procés de public/dictionaries/<lang>.json (generat per parse-dump.mjs)
// amb dues correccions detectades jugant amb gent de veritat:
//
//   1. TREU l'etiqueta de camp entre parèntesis del principi de la definició
//      ("(botànica) Qualitat d'un sistema…" → "Qualitat d'un sistema…"). Els
//      jugadors no escriuen mai aquestes etiquetes, així que delaten la real.
//
//   2. DESCARTA les definicions autoreferents, les que expliquen la paraula
//      amb una altra de la mateixa família ("empetitir: tornar o fer semblar
//      més petit", "sorneguerament: d'una manera sorneguera"). Són
//      injugables: qui les sent ja té la resposta.
//
// Ús:  node scripts/clean-dictionary.mjs           (ca + es, escriu)
//      node scripts/clean-dictionary.mjs ca        (només un idioma)
//      node scripts/clean-dictionary.mjs --dry-run (informe, sense escriure)
//      node scripts/clean-dictionary.mjs --report 40   (mostra N exemples)
//
// Idempotent: tornar-lo a executar sobre un fitxer ja netejat no hi fa canvis.
// =============================================================================

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const reportIdx = args.indexOf('--report')
const REPORT = reportIdx !== -1 ? parseInt(args[reportIdx + 1] ?? '20', 10) : 20
const langs = args.filter((a) => a === 'ca' || a === 'es')
const LANGS = langs.length ? langs : ['ca', 'es']

// --- 1. Etiqueta de camp inicial -----------------------------------------------

// Només tractem com a etiqueta el parèntesi del PRINCIPI i prou: un de sol, curt
// i sense puntuació de frase. Així no ens carreguem parèntesis que són part de la
// definició ("(establecer relaciones, semejanzas y diferencias), o de compararse").
const MAX_LABEL_WORDS = 4
const MAX_LABEL_CHARS = 34

// Els noms científics són etiquetes encara que siguin llargs: van en llatí amb
// el gènere en majúscula ("Thunnus alalunga y/o Thunnus albacares", "Capsicum
// spp.", "Olea europaea var. sylvestris"). El jugador no els escriurà mai.
const SCIENTIFIC_NAME = /^[A-Z][a-zA-Z.×]*(\s+(?:[a-zA-Z.×]+|var\.|subsp\.|spp\.|y\/o|o|×))*$/

function isFieldLabel(label) {
  if (!label) return false
  if (SCIENTIFIC_NAME.test(label) && /\s|\./.test(label)) return true
  if (label.length > MAX_LABEL_CHARS) return false
  if (label.split(/\s+/).length > MAX_LABEL_WORDS) return false
  if (/[.;:!?]/.test(label)) return false
  return true
}

function stripLeadingLabel(definition) {
  let def = definition.trim()
  let changed = false

  // Pot haver-hi etiquetes encadenades: "(plantes) (Annonaceae) Família de…"
  for (;;) {
    const m = def.match(/^\(([^()]*)\)\s*/)
    if (!m) break
    const label = m[1].trim()
    const rest = def.slice(m[0].length).trim()

    // Si no queda definició, el parèntesi ERA la definició: no el toquis.
    if (!rest) break
    if (!isFieldLabel(label)) break

    def = rest
    changed = true
  }

  if (!changed) return { definition, changed: false }

  // L'etiqueta podia anar seguida de puntuació que ara quedaria òrfena al davant
  // ("(Damasonium alisma), comúnmente llamada…" → ", comúnmente llamada…").
  def = def.replace(/^[,;:.\s]+/, '')
  if (!def) return { definition, changed: false }

  // La definició sovint començava en minúscula perquè l'etiqueta feia de capçalera.
  const first = def[0]
  if (first && first === first.toLowerCase() && first !== first.toUpperCase()) {
    def = first.toUpperCase() + def.slice(1)
  }
  return { definition: def, changed: true }
}

// --- 2. Autoreferència ---------------------------------------------------------

// Normalitza per comparar arrels: sense accents, sense volada, 'll' → 'l'
// (empetitir/petit, abrigall/abrigar comparteixen arrel un cop normalitzats).
function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[·'’]/g, '')
    .replace(/ll/g, 'l')
    .toLowerCase()
}

// Llindars calibrats sobre els dos diccionaris (veure scripts/README.md):
// el prefix compartit ha de cobrir bona part del token de la definició I de la
// paraula, per no enganxar coincidències casuals de començament.
const MIN_SHARED = 4
const TOKEN_RATIO = 0.75
const WORD_RATIO = 0.5

// Preposicions i adverbis que també són prefixos de composició. Casen amb el
// començament de mots compostos sense ser-ne cap arrel: "entrepà" no s'explica
// amb "entre", ni "paraigües" amb "para" — i són paraules boníssimes per jugar.
// (Compte: NO hi posem arrels de veritat com "forma" o "general", que sí que
// delaten "formal" o "generalitat".)
const FUNCTION_WORDS = new Set([
  // ca
  'entre', 'contra', 'sobre', 'sota', 'davant', 'darrere', 'dins', 'fora', 'amb',
  'cap', 'vers', 'segons', 'menys', 'mitja',
  // es
  'para', 'ante', 'bajo', 'tras', 'hacia', 'sin', 'según', 'segun', 'medio',
])

function sharedPrefixLength(a, b) {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a[i] === b[i]) i++
  return i
}

// Prefixos derivatius: la definició sol fer servir l'arrel nua ("empetitir" →
// "petit", "engrandir" → "gran"), així que també provem la paraula sense ells.
const DERIVATIONAL_PREFIXES = [
  'des', 'dis', 'sub', 'super', 'inter', 'contra', 'sobre', 'trans', 'auto',
  'anti', 'pre', 'pro', 'per', 're', 'en', 'em', 'in', 'im', 'a', 'e',
]

function prefixVariants(nw) {
  const variants = [nw]
  for (const p of DERIVATIONAL_PREFIXES) {
    // Deixem prou arrel perquè la comparació segueixi sent significativa.
    if (nw.startsWith(p) && nw.length - p.length >= 4) variants.push(nw.slice(p.length))
  }
  return variants
}

// Retorna el token culpable si la definició és autoreferent, si no null.
function selfReferenceHit(word, definition) {
  const nw = normalize(word)
  const variants = prefixVariants(nw)
  const tokens = new Set(
    normalize(definition)
      .split(/[^a-z]+/)
      .filter((t) => t.length >= 4)
  )
  for (const token of tokens) {
    if (FUNCTION_WORDS.has(token)) continue
    for (const variant of variants) {
      const shared = sharedPrefixLength(variant, token)
      if (shared < MIN_SHARED || shared < Math.ceil(token.length * TOKEN_RATIO)) continue
      // Si el token hi cap sencer, la paraula el conté com a arrel
      // ("medicalitzar" ⊃ "mèdic"): ja n'hi ha prou, sense exigir proporció.
      if (shared === token.length) return token
      if (shared >= Math.ceil(variant.length * WORD_RATIO)) return token
    }
  }
  return null
}

// --- Procés --------------------------------------------------------------------

// Una definició escurçada pot quedar massa prima per jugar-hi; reaprofitem el
// mateix mínim de substància que fa servir parse-dump.mjs.
const MIN_DEF_CHARS = 15
const MIN_DEF_WORDS = 3

function isSubstantial(definition) {
  if (definition.length < MIN_DEF_CHARS) return false
  if (definition.split(/\s+/).length < MIN_DEF_WORDS) return false
  // Si encara comença amb parèntesi, no era etiqueta sinó una definició que ja
  // venia trencada del dump ("(establecer relaciones…), o de compararse"):
  // sense l'antecedent no s'entén, i com a pista de joc no serveix.
  if (definition.startsWith('(')) return false
  return true
}

async function processLang(lang) {
  const file = path.resolve('public/dictionaries', `${lang}.json`)
  const data = JSON.parse(await readFile(file, 'utf8'))

  const kept = []
  const droppedSelfRef = []
  const droppedThin = []
  const stripped = []

  for (const entry of data.words) {
    const { definition, changed } = stripLeadingLabel(entry.definition)

    if (!isSubstantial(definition)) {
      droppedThin.push({ ...entry, after: definition })
      continue
    }

    const hit = selfReferenceHit(entry.word, definition)
    if (hit) {
      droppedSelfRef.push({ ...entry, hit })
      continue
    }

    if (changed) stripped.push({ word: entry.word, before: entry.definition, after: definition })
    kept.push({ ...entry, definition })
  }

  console.log(`\n=== ${lang} ===`)
  console.log(`  entrades inicials : ${data.words.length}`)
  console.log(`  etiqueta treta    : ${stripped.length}`)
  console.log(`  fora (autoref.)   : ${droppedSelfRef.length}`)
  console.log(`  fora (massa curta): ${droppedThin.length}`)
  console.log(
    `  → queden          : ${kept.length} (${((100 * kept.length) / data.words.length).toFixed(1)}%)`
  )

  if (REPORT > 0) {
    const show = (title, rows, fmt) => {
      if (!rows.length) return
      console.log(`\n  --- ${title} (${Math.min(REPORT, rows.length)} de ${rows.length}) ---`)
      // Mostra repartida per tot l'abecedari, no només les 'a'.
      const step = Math.max(1, Math.floor(rows.length / REPORT))
      for (let i = 0; i < rows.length && i / step < REPORT; i += step) console.log('  ' + fmt(rows[i]))
    }
    show('etiqueta treta', stripped, (r) => `${r.word}: ${r.before}\n      → ${r.after}`)
    show('fora, autoreferent', droppedSelfRef, (r) => `${r.word} [~${r.hit}]: ${r.definition}`)
    show('fora, massa curta', droppedThin, (r) => `${r.word}: ${r.definition}`)
  }

  if (DRY_RUN) {
    console.log('\n  (--dry-run: no s\'ha escrit res)')
    return
  }

  await writeFile(file, JSON.stringify({ ...data, words: kept }, null, 0), 'utf8')
  console.log(`\n  ✓ Escrit: ${file}`)
}

async function main() {
  for (const lang of LANGS) await processLang(lang)
}

main().catch((e) => {
  console.error('\nError:', e.message)
  process.exit(1)
})
