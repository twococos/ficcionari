// =============================================================================
// Ficcionari — Parser de dumps XML del Viccionari/Wikcionario (Fase 6)
//
// Processa un dump pages-articles.xml.bz2 EN STREAMING (sense descomprimir-lo
// sencer a disc), extreu les entrades de l'idioma objectiu amb definició neta i
// filtratge de qualitat, i genera public/dictionaries/<lang>.json.
//
// Ús:  node scripts/parse-dump.mjs ca _dumps/ca.xml.bz2 [maxWords]
//      node scripts/parse-dump.mjs es _dumps/es.xml.bz2 [maxWords]
//
// Requereix `bunzip2` al PATH (descompressió per pipe).
// Llicència de les dades: CC BY-SA (Wikimedia) — atribució inclosa a la sortida.
// =============================================================================

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const LANG = process.argv[2] ?? 'ca'
const DUMP = process.argv[3]
const MAX = parseInt(process.argv[4] ?? '5000', 10)

if (!DUMP) {
  console.error('Ús: node scripts/parse-dump.mjs <ca|es> <dump.xml.bz2> [maxWords]')
  process.exit(1)
}

const CONFIG = {
  ca: {
    // Marcadors de secció d'idioma català dins el wikitext.
    langHeaders: [/==\s*{{-ca-}}\s*==/, /==\s*\{\{lengua\|ca\}\}\s*==/, /==\s*Català\s*==/i],
    // Categories gramaticals acceptades (capçaleres === ... ===) → pos normalitzat.
    pos: [
      { re: /===\s*Nom\s*===/i, pos: 'nom' },
      { re: /===\s*Substantiu\s*===/i, pos: 'nom' },
      { re: /===\s*Adjectiu\s*===/i, pos: 'adjectiu' },
      { re: /===\s*Verb\s*===/i, pos: 'verb' },
      { re: /===\s*Adverbi\s*===/i, pos: 'adverbi' },
    ],
    bad: [
      'forma de', 'plural de', 'femení de', 'flexió', 'gerundi de', 'participi',
      'infinitiu de', 'variant de', 'sigla', 'acrònim', 'malnom', 'cognom',
    ],
    attribution: 'Definicions adaptades del Viccionari (ca.wiktionary.org), CC BY-SA 4.0.',
  },
  es: {
    langHeaders: [/==\s*{{lengua\|es}}\s*==/i, /==\s*\{\{-es-\}\}\s*==/, /==\s*Español\s*==/i],
    pos: [
      { re: /=+\s*{{sustantivo/i, pos: 'nombre' },
      { re: /=+\s*Sustantivo/i, pos: 'nombre' },
      { re: /=+\s*{{adjetivo/i, pos: 'adjetivo' },
      { re: /=+\s*Adjetivo/i, pos: 'adjetivo' },
      { re: /=+\s*{{verbo/i, pos: 'verbo' },
      { re: /=+\s*Verbo/i, pos: 'verbo' },
      { re: /=+\s*{{adverbio/i, pos: 'adverbio' },
    ],
    bad: [
      'forma de', 'plural de', 'femenino de', 'flexión', 'gerundio', 'participio',
      'infinitivo de', 'variante de', 'sigla', 'acrónimo', 'apellido', 'apócope',
    ],
    attribution: 'Definiciones adaptadas del Wikcionario (es.wiktionary.org), CC BY-SA 4.0.',
  },
}

const cfg = CONFIG[LANG]
if (!cfg) {
  console.error(`Idioma no suportat: ${LANG}`)
  process.exit(1)
}

// Desescapa entitats XML del dump (&lt; &gt; &amp; &quot; &#N;).
function unescapeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&')
}

// --- Neteja de wikitext a text pla ---------------------------------------------
function cleanWikitext(s) {
  let t = unescapeXml(s)
  // [[enllaç|text]] → text ; [[enllaç]] → enllaç
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  t = t.replace(/\[\[([^\]]+)\]\]/g, '$1')
  // {{plm|paraula}} → paraula (plantilla d'enllaç del Wikcionario)
  t = t.replace(/\{\{plm\|([^}|]+)\}\}/gi, '$1')
  // {{l|es|paraula}} / {{l+|...}} → últim camp
  t = t.replace(/\{\{l\+?\|[^}]*\|([^}|]+)\}\}/gi, '$1')
  // {{marca|ca|xxx}} o {{q|...}} → deixar el camp útil entre parèntesis
  t = t.replace(/\{\{q\|([^}]+)\}\}/g, '($1)')
  t = t.replace(/\{\{marca\|[^}]*\|([^}|]+)\}\}/g, '($1)')
  t = t.replace(/\{\{csem\|([^}|]+)\}\}/gi, '($1)')
  // Altres plantilles → fora
  t = t.replace(/\{\{[^}]*\}\}/g, '')
  // Negretes/cursives wiki
  t = t.replace(/'''?/g, '')
  // Referències <ref>...</ref> i <ref .../> senceres
  t = t.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
  t = t.replace(/<ref[^>]*\/>/gi, '')
  // Comentaris HTML i etiquetes restants
  t = t.replace(/<!--[\s\S]*?-->/g, '')
  t = t.replace(/<[^>]+>/g, '')
  // Espais
  t = t.replace(/\s+/g, ' ').trim()
  // Treure punt final duplicat
  return t
}

// Extreu la primera definició bona del text d'una secció d'idioma.
function extractDefinition(sectionText) {
  const lines = sectionText.split('\n')
  let inAcceptedPos = false
  let currentPos = null

  for (const line of lines) {
    // Nova capçalera de secció? (=== ... === o ==== ... ====)
    if (/^={3,}/.test(line.trim())) {
      const match = cfg.pos.find((p) => p.re.test(line))
      if (match) {
        inAcceptedPos = true
        currentPos = match.pos
      } else {
        // Qualsevol altra capçalera tanca la categoria acceptada.
        inAcceptedPos = false
      }
      continue
    }
    if (!inAcceptedPos) continue

    const trimmed = line.trim()
    let raw = null

    // Format Viccionari (ca): '# definició' (però no '#*', '#:' que són exemples)
    if (/^#[^*:]/.test(trimmed)) {
      raw = trimmed.replace(/^#+\s*/, '')
    }
    // Format Wikcionario (es): ';N: definició' o ';N {{...}}: definició'
    else if (/^;\s*\d+/.test(trimmed)) {
      const colon = trimmed.indexOf(':')
      if (colon !== -1) raw = trimmed.slice(colon + 1).trim()
    }

    if (raw != null) {
      let def = cleanWikitext(raw)
      // Treu un prefix de context entre parèntesis "(botànica) Definició…"
      // NOMÉS per avaluar la substància; el conservem si la resta és bona.
      const withoutContext = def.replace(/^\([^)]*\)\s*/, '').trim()
      if (withoutContext.length < 15 || withoutContext.length > 160) continue
      // Descarta definicions que són (gairebé) només un nom científic/parèntesi.
      if (/^\([^)]*\)$/.test(def)) continue
      // Ha de tenir prou paraules reals (evita remissions d'una sola paraula).
      if (withoutContext.split(/\s+/).length < 3) continue
      const low = def.toLowerCase()
      if (cfg.bad.some((m) => low.includes(m))) continue
      if (!/[a-zàáäâèéëêìíïîòóöôùúüûçñ]/i.test(withoutContext)) continue
      // Netegem un possible nom científic entre parèntesis enganxat al final.
      def = def.replace(/\s*\([A-Z][a-z]+ [a-z]+\)\s*$/, '').trim()
      if (def.length < 15) continue
      return { pos: currentPos, definition: def }
    }
  }
  return null
}

// Retalla la secció de l'idioma objectiu dins el wikitext complet.
function sliceLangSection(text) {
  for (const re of cfg.langHeaders) {
    const m = text.match(re)
    if (m) {
      const start = m.index + m[0].length
      const rest = text.slice(start)
      // Fins a la següent capçalera d'idioma de nivell 2 ('== ... ==').
      const next = rest.search(/\n==\s*[^=]/)
      return next === -1 ? rest : rest.slice(0, next)
    }
  }
  return null
}

// Paraules massa comunes per al joc del diccionari (tothom les sap). Es
// descarten per prioritzar les "poc conegudes". Llista curta i freqüent.
const COMMON = new Set(
  (LANG === 'ca'
    ? `menjar mirar parlar cantar ballar comprar vendre jugar córrer saltar dormir
       casa taula cadira porta finestra carrer cotxe camí aigua terra foc aire
       home dona nen nena amic pare mare fill filla germà avi net gos gat ocell
       poble ciutat carrer plaça escola feina diner temps dia nit any mes setmana
       gran petit bo dolent bonic lleig alt baix nou vell calent fred sec moll
       menjar beure veure sentir tocar caminar pujar baixar entrar sortir obrir
       tancar donar prendre posar treure portar buscar trobar perdre guanyar
       ciutat poble comarca municipi població parlament flor arbre color`
    : `comer mirar hablar cantar bailar comprar vender jugar correr saltar dormir
       casa mesa silla puerta ventana calle coche camino agua tierra fuego aire
       hombre mujer niño niña amigo padre madre hijo hija hermano abuelo perro gato
       pueblo ciudad calle plaza escuela trabajo dinero tiempo día noche año mes
       grande pequeño bueno malo bonito feo alto bajo nuevo viejo caliente frío
       comer beber ver sentir tocar caminar subir bajar entrar salir abrir cerrar
       dar tomar poner sacar llevar buscar encontrar perder ganar flor árbol color`
  )
    .split(/\s+/)
    .filter(Boolean)
)

function isValidTitle(title) {
  if (title.includes(':')) return false // namespaces (Plantilla:, Categoria:…)
  if (/\s/.test(title)) return false // locucions
  if (title !== title.toLowerCase()) return false // noms propis
  if (!/^[a-zàáäâèéëêìíïîòóöôùúüûçñ·ŀl]+$/i.test(title)) return false
  // Filtre de raresa: descartem paraules molt curtes (sovint comunes) i les
  // de la llista de comunes. Mantenim un rang que afavoreix les poc conegudes.
  if (title.length < 5 || title.length > 16) return false
  if (COMMON.has(title)) return false
  return true
}

async function main() {
  console.log(`\n== Parsejant dump '${LANG}' (${DUMP}), màxim ${MAX} paraules ==\n`)

  const bunzip = spawn('bunzip2', ['-c', DUMP])
  const rl = createInterface({ input: bunzip.stdout, crlfDelay: Infinity })

  const results = []
  const seen = new Set()

  let inPage = false
  let title = null
  let inText = false
  let textBuf = []
  let pages = 0

  for await (const line of rl) {
    if (line.includes('<page>')) {
      inPage = true
      title = null
      textBuf = []
      continue
    }
    if (line.includes('</page>')) {
      inPage = false
      pages++
      if (pages % 20000 === 0) {
        process.stdout.write(`\r  pàgines: ${pages} | vàlides: ${results.length}   `)
      }
      // Processa la pàgina acumulada
      if (title && isValidTitle(title) && !seen.has(title)) {
        const text = textBuf.join('\n')
        const section = sliceLangSection(text)
        if (section) {
          const found = extractDefinition(section)
          if (found) {
            seen.add(title)
            results.push({ word: title, pos: found.pos, definition: found.definition })
            if (results.length >= MAX) break
          }
        }
      }
      continue
    }
    if (!inPage) continue

    // Títol
    const tm = line.match(/<title>([^<]*)<\/title>/)
    if (tm) {
      title = tm[1]
      continue
    }
    // Text (pot ser multilínia)
    if (line.includes('<text')) {
      inText = true
      const after = line.slice(line.indexOf('>') + 1)
      textBuf.push(after.replace(/<\/text>.*/, ''))
      if (line.includes('</text>')) inText = false
      continue
    }
    if (inText) {
      if (line.includes('</text>')) {
        textBuf.push(line.replace(/<\/text>.*/, ''))
        inText = false
      } else {
        textBuf.push(line)
      }
    }
  }

  bunzip.kill()
  console.log(`\n\n✓ ${results.length} paraules vàlides de ${pages} pàgines.`)

  results.sort((a, b) => a.word.localeCompare(b.word, LANG))
  const outDir = path.resolve('public/dictionaries')
  await mkdir(outDir, { recursive: true })
  const outFile = path.join(outDir, `${LANG}.json`)
  await writeFile(
    outFile,
    JSON.stringify({ language: LANG, attribution: cfg.attribution, words: results }, null, 0),
    'utf8'
  )
  console.log(`✓ Escrit: ${outFile}`)

  console.log('\n--- Mostra (12) ---')
  for (const e of results.slice(0, 12)) console.log(`• ${e.word} (${e.pos}): ${e.definition}`)
}

main().catch((e) => {
  console.error('\nError:', e.message)
  process.exit(1)
})
