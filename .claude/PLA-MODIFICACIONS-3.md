# PLA-MODIFICACIONS-3 — canvis post-playtest

> Quan s'aprovi, aquest fitxer es copiarà a `.claude/PLA-MODIFICACIONS-3.md` (historial de plans, §13 del CONTEXT.md).

## Context

Després del primer playtest real amb amics van sortir 8 friccions. Les tres grosses:
**(a)** la paraula triada desapareix de la pantalla just quan més cal (durant l'escriptura,
la lectura del narrador i la votació) i ningú la recordava; **(b)** el reveal s'autoavança
en 20 s i és precisament la part més divertida, així que la gent no tenia temps de
mirar-lo; **(c)** el ritme de la partida depèn massa de l'automatisme — el narrador no
podia tallar una votació si algú es desconnectava.

La resta són opcions noves demanades pels jugadors: amagar les definicions als votants
(perquè les faltes d'ortografia no delatin l'autor), temps límit per escriure, comptar
la durada en **voltes** en comptes de rondes soltes, i poder desar el reveal i el podi
com a imatge per conservar rondes èpiques.

Resultat esperat: una partida on tothom sap sempre quina és la paraula, el narrador
controla el ritme, i les millors rondes es poden guardar.

---

## Resum dels 8 canvis

| #   | Canvi                                                        | Tipus              |
| --- | ------------------------------------------------------------ | ------------------ |
| 1   | Paraula visible des de `writing_definitions` fins a `reveal` | UI                 |
| 2   | "Mostrar la definició en triar" marcada per defecte          | default            |
| 3   | Opció **amagar definicions** (votants només veuen números)   | opció nova (BD)    |
| 4   | Opció **temps límit per escriure** (default 3 min)           | opció nova (BD ×2) |
| 5   | Botó **tancar votació** per al narrador                      | UI                 |
| 6   | Eliminar l'auto-avanç de 20 s del reveal                     | eliminació         |
| 7   | Descarregar reveal i podi com a imatge PNG                   | funció nova + dep  |
| 8   | Durada per **voltes** (1/2/3) en comptes de rondes           | opció nova (BD)    |

Tres columnes noves a `games` → **migració `0007`** (una sola).

---

## Decisions ja preses (respostes de l'usuari)

- **Amagar definicions**: números grans i res més, a **totes dues votacions** (real i graciosa).
- **Voltes**: columna nova `total_laps`; `total_rounds` es **calcula** en començar
  (`laps × nombre de jugadors`) i es manté com a font de veritat del final de partida.
  La capçalera **no canvia** — segueix mostrant "Ronda X de Y".
- **Imatge**: dependència `html-to-image`.
- **Temps límit exhaurit**: cada jugador auto-envia el que tingui escrit **i** el narrador
  passa automàticament a `narrator_reading`.
- **Barra del temps límit**: sota el botó d'enviar (no fixa a baix).
- **Tancar votació**: continua directament, sense confirmació.

---

## 0. Migració `supabase/migrations/0007_playtest_options.sql`

⚠️ **L'ha d'executar l'usuari manualment al SQL Editor de Supabase abans de provar.**

```sql
-- Canvis tanda #3 (post-playtest).

alter table public.games
  add column if not exists hide_definitions_on_vote boolean not null default false,
  add column if not exists write_time_limit_seconds int not null default 0,
  add column if not exists total_laps int not null default 1;
```

`write_time_limit_seconds = 0` ⇒ opció desactivada (evita una segona columna booleana).

---

## 1. Paraula sempre visible (des d'escriure fins als resultats)

**Fitxer nou**: `src/features/game/WordBanner.tsx` — extret del `wordHeader` que ja existeix
a [WriteDefinitionPhase.tsx:138-145](src/features/game/phases/WriteDefinitionPhase.tsx#L138-L145),
per no duplicar el format.

```tsx
/** Banner blanc amb la paraula de la ronda. `compact` per a les fases on
 *  només ha de recordar-la (lectura, votació, resultats). */
export function WordBanner({ word, compact = false }: { word: string; compact?: boolean })
```

- Normal: el bloc actual (`bg-white px-4 py-3 text-center`, label `write.wordIs`,
  paraula `text-3xl font-black text-accent`).
- `compact`: `rounded-2xl bg-white px-4 py-2`, paraula `text-2xl`.

**Renderitzat a `GamePage`**, no dins de cada fase — així es manté fora del contenidor
animat i no parpelleja a cada canvi de fase. A
[GamePage.tsx:115](src/features/game/GamePage.tsx#L115), just sota `<GameHeader />`:

```tsx
{
  round?.word && WORD_VISIBLE_PHASES.has(round.phase) && (
    <div className="mb-4">
      <WordBanner word={round.word} compact />
    </div>
  )
}
```

amb `const WORD_VISIBLE_PHASES = new Set(['writing_definitions','narrator_reading','voting_real','voting_funny','reveal'])`.

**Important**: NO incloure `announcing_word` — la decisió d'amagar la paraula en aquesta
fase és deliberada (CONTEXT §11: els jugadors l'han d'escoltar).

**Neteja**: `WriteDefinitionPhase` deixa de renderitzar el seu `wordHeader` propi (el
banner ja el posa GamePage); el quadre blanc de l'escriptura passa a ser només el
`textarea` amb `rounded-2xl`. Mantenir el `text-3xl` d'aquesta fase via `compact={false}`
si es vol destacar més — recomanat: el mateix `compact` a totes, per coherència.

**Color de text a `voting_funny`**: el fons és accent (`FunnyBackground`); el banner és
blanc amb text accent, que sobre groc es llegeix malament. Al `WordBanner` afegir la
paraula en `text-primary-dark` quan `compact` i el fons és accent — més simple: passar
`tone?: 'default' | 'onAccent'` i a `voting_funny` usar `bg-primary-dark text-accent`.

---

## 2. "Mostrar la definició en triar" per defecte

Tres punts, tots trivials:

1. [CreateGamePage.tsx:19-27](src/features/lobby/CreateGamePage.tsx#L19-L27): `showDefinitionOnPick: true`.
2. Migració 0007: **no** cal canviar el default de la columna (les partides es creen
   sempre amb valor explícit des del client). Opcional però recomanat per coherència:
   `alter table public.games alter column show_definition_on_pick set default true;`
3. Partides antigues mantenen el seu valor — correcte.

---

## 3. Opció "amagar definicions" a la votació

**Columna**: `games.hide_definitions_on_vote` (bool, default false).

**Ruta d'opció** — els 8 touchpoints habituals (CONTEXT §12):
`database.types.ts` (`Game`) → `lobbyApi.ts` (`CreateGameOptions`, `UpdateGameOptions` +
els dos payloads) → `GameOptionsFields.tsx` (`GameOptionsValue` + un `ToggleField` nou,
reutilitzant el component existent a [GameOptionsFields.tsx:118-155](src/features/lobby/GameOptionsFields.tsx#L118-L155))
→ `CreateGamePage` (default `false`) → `LobbyPage.optionsFromGame` + `handleStart` →
i18n `create.hideDefinitions` / `create.hideDefinitionsHint` a ca i es.

**Consum a `VotingPhase`** ([VotingPhase.tsx:81-118](src/features/game/phases/VotingPhase.tsx#L81-L118)):

```tsx
const hideDefs = Boolean(game?.hide_definitions_on_vote)
```

Quan `hideDefs`, cada `<li>` renderitza un botó gran amb només el número:

```tsx
<span className="block py-6 text-center text-5xl font-black">{i + 1}</span>
```

(accent sobre `Card` a la votació real; `text-primary-dark` sobre targeta blanca a la graciosa).

**Coherència de numeració**: el número ha de ser el mateix que veu el narrador a
`ReadingPhase` ([ReadingPhase.tsx:44-51](src/features/game/phases/ReadingPhase.tsx#L44-L51)).
Tots dos ja fan `stableShuffle(definitions)` amb la mateixa llavor (round id), i tots dos
numeren `i + 1` sobre l'array ordenat → **ja coincideixen**, no cal tocar res més.

**Cas límit**: amb `hideDefs` la definició pròpia no es pot reconèixer pel text. Mantenir
el bloqueig `disabled` de la pròpia a `voting_real` ([VotingPhase.tsx:84-85](src/features/game/phases/VotingPhase.tsx#L84-L85))
i afegir la marca `voteReal.ownDefinition` sota el número (petita) — així el jugador sap
quin número és el seu sense revelar-ne el text als altres.

---

## 4. Temps límit per escriure definicions

**Columna**: `games.write_time_limit_seconds` (int, default 0 = desactivat).
**Constants** a `src/game/constants.ts`:

```ts
export const DEFAULT_WRITE_TIME_LIMIT_S = 180 // 3 minuts
export const WRITE_TIME_LIMIT_MIN_S = 30
export const WRITE_TIME_LIMIT_MAX_S = 600
```

**UI al lobby** (`GameOptionsFields`): un `ToggleField` + quan està actiu, un camp numèric
al costat. Reutilitzar el patró de `PointField` ([GameOptionsFields.tsx:157-185](src/features/lobby/GameOptionsFields.tsx#L157-L185))
però en **minuts** (més llegible que segons) — component `MinutesField` germà, amb `step={0.5}`
o bé un camp de minuts enters + separació clara. Recomanat: **minuts enters, 1–10, default 3**,
i guardar `minuts × 60` a la columna.

`GameOptionsValue` guanya dos camps: `writeTimeLimitEnabled: boolean` i `writeTimeLimitMinutes: number`;
el mapatge a la BD és `writeTimeLimitEnabled ? minutes * 60 : 0`, i al revés a `optionsFromGame`.

**Comportament a `WriteDefinitionPhase`** — substitueix el compte enrere de l'últim jugador:

```
si write_time_limit_seconds > 0:
    TOTS els no-narradors veuen la barra des del principi del writing_definitions
    → NO s'aplica el compte enrere de 30 s de l'últim (LAST_ONE_COUNTDOWN_MS)
si write_time_limit_seconds == 0:
    comportament actual (30 s per a l'últim que queda, amb 4+ jugadors)
```

**Origen del temps**: la barra i el timeout s'han d'ancorar a `round.created_at` (ja
existeix a la taula `rounds`), **no** al muntatge del component — si algú recarrega la
pàgina a mig escriure, ha de veure el temps restant real, no reiniciar-lo. Com que
`ProgressBar` és 100 % CSS i sempre comença a 0 %, cal ampliar-la:

```tsx
// ProgressBar.tsx — nova prop opcional
elapsedMs?: number   // temps ja transcorregut; desplaça l'inici de l'animació
```

implementat amb `animation-delay: -${elapsedMs}ms` sobre el mateix keyframe `progressGrow`
(negatiu = comença ja avançada). Zero canvis als tres call sites existents.

⚠️ El temps de referència hauria de ser l'inici de la **fase**, no de la ronda.
`rounds` no té una columna d'entrada de fase. Dues opcions:

- **(a) Recomanada**: afegir `rounds.phase_started_at timestamptz` a la migració 0007 i
  actualitzar-la dins `setRoundPhase` ([roundApi.ts:77](src/features/game/roundApi.ts#L77))
  amb `phase_started_at: new Date().toISOString()`. Serveix per a qualsevol timer futur.
- (b) Usar `round.created_at` i acceptar que el temps inclou la tria de paraula i l'anunci
  — inacceptable, poden ser minuts.

→ **La migració 0007 inclou també aquesta columna** i `database.types.ts` (`Round`) l'afegeix.

**Auto-envia + auto-avança** en expirar:

- Jugador: `setTimeout` al restant real → `submitRef.current()` (ja existeix a
  [WriteDefinitionPhase.tsx:102-103](src/features/game/phases/WriteDefinitionPhase.tsx#L102-L103)).
  Nota coneguda: `submit()` retorna aviat si el text és buit, així que no envia res si no
  s'ha escrit — correcte, però llavors la fase quedaria bloquejada; per això cal l'auto-avanç
  del narrador (següent punt).
- Narrador: nou bloc a `useRoundOrchestration` ([useRoundOrchestration.ts:39-53](src/features/game/useRoundOrchestration.ts#L39-L53)),
  dins la branca `writing_definitions`: si `write_time_limit_seconds > 0` i el temps ha
  expirat, fer la mateixa acció que `allWritten` (`ensureRealDefinition` + `setRoundPhase('narrator_reading')`),
  amb la mateixa `lastActionRef` key per no duplicar. Com que el hook no té timers, cal un
  `setTimeout` que forci un re-render en el moment d'expirar (un `useState` de tick, o
  simplement un `setTimeout` que cridi l'acció directament amb guard de `lastActionRef`).
  **Recomanat**: `setTimeout` directe al hook, net i coherent amb l'antiracing (només narrador).

---

## 5. Botó "tancar votació" per al narrador

Actualment a `voting_real`/`voting_funny` el narrador només veu un `WaitingScreen`
([VotingPhase.tsx:29-33](src/features/game/phases/VotingPhase.tsx#L29-L33)).

Substituir-lo per una vista narrador amb:

- El comptatge de vots rebuts (`{{done}} de {{total}} han votat`) — mirall de
  `write.submittedCount` a la vista narrador de l'escriptura
  ([WriteDefinitionPhase.tsx:51-53](src/features/game/phases/WriteDefinitionPhase.tsx#L51-L53)).
- Un `Button variant="ghost"` **Tancar votació** que faci
  `setRoundPhase(round.id, game.score_funny_enabled && voteType === 'real' ? 'voting_funny' : 'reveal')`
  — exactament la mateixa decisió que fa l'orquestrador a
  [useRoundOrchestration.ts:63](src/features/game/useRoundOrchestration.ts#L63).
  **Extreure-la a un helper** `nextPhaseAfterVote(voteType, funnyEnabled)` a `roundApi.ts`
  i usar-lo als dos llocs, perquè no divergeixin.

Sense confirmació (decisió presa). El scoring no es veu afectat: `computeRoundScores`
treballa amb els vots que hi ha a la BD.

---

## 6. Eliminar l'auto-avanç dels resultats

A [RevealPhase.tsx](src/features/game/phases/RevealPhase.tsx):

- Esborrar `AUTO_ADVANCE_MS` (línia 14), el `useEffect` del timer (58-62), l'`advanceRef`
  (52-53) i el `<ProgressBar variant="fill">` de dins el botó (131).
- El botó del narrador es queda igual, sense fons animat.

A [GamePage.tsx:123-130](src/features/game/GamePage.tsx#L123-L130): esborrar el bloc de la
barra fixa del reveal i l'import `AUTO_ADVANCE_MS` de la línia 23.

Els jugadors no narradors mantenen el text `reveal.waitingNarratorNext` — ara sí que
esperen de veritat el narrador.

`ProgressBar` segueix viva (l'usen el temps límit d'escriure i el compte enrere de l'últim).

---

## 7. Descarregar resultats i podi com a imatge

**Dependència nova**: `html-to-image` (`npm i html-to-image`).

**Fitxer nou**: `src/features/game/useDownloadImage.ts`

```ts
/** Captura un node DOM a PNG i el descarrega. Retorna { ref, download, busy }. */
export function useDownloadImage(filename: () => string)
```

Implementació:

```ts
const dataUrl = await toPng(node, {
  pixelRatio: 2,
  backgroundColor: '#0060f4', // primary; el body és transparent
  cacheBust: true,
})
const a = document.createElement('a')
a.href = dataUrl
a.download = filename()
a.click()
```

**Reveal**: embolcallar el contingut capturable (títol + llista de definicions +
`RoundPointsBreakdown` + `Scoreboard`, [RevealPhase.tsx:79-120](src/features/game/phases/RevealPhase.tsx#L79-L120))
en un `<div ref={captureRef}>`, i afegir un `Button variant="ghost"` **Desar imatge** sota
(a tots els jugadors, no només el narrador). Nom del fitxer:
`ficcionari-ronda-{round_number}-{word}.png`.

**Podi**: mateix patró sobre el bloc títol + `PodiumTop` + llista de la 4a plaça endavant
([PodiumPage.tsx:88-112](src/features/game/PodiumPage.tsx#L88-L112)); botó al footer, al
costat de `podium.exit`. Nom: `ficcionari-podi-{code}.png`.

**Riscos coneguts** i com mitigar-los:

- `html-to-image` **no captura** elements amb `position: fixed` fora del node ni
  `backdrop-filter`. `Card` usa translucidesa — comprovar visualment; si surt malament,
  passar `style: { }` amb un fons sòlid al node capturat via una classe
  `ficc-capture` que forci `background-color: #001048` als `Card` descendents.
- Les animacions `animate-[fadeIn...]` amb `animationDelay` poden capturar-se a mig camí
  (opacitat 0). Mitigació: al node capturat, aplicar temporalment una classe que posi
  `animation: none !important` abans de `toPng` i treure-la després.
- `Confetti` al podi: excloure'l del node capturat (ja està fora del bloc de contingut).
- Cal excloure el propi botó de descàrrega del node capturat.

---

## 8. Durada per voltes

**Columna**: `games.total_laps` (int, default 1). Es manté `total_rounds` com a valor
efectiu (font de veritat del final de partida, ja usat a
[roundApi.ts:223](src/features/game/roundApi.ts#L223) i [RevealPhase.tsx:66](src/features/game/phases/RevealPhase.tsx#L66)).

**Constants** (`src/game/constants.ts`): substituir `ROUND_OPTIONS`/`DEFAULT_ROUNDS` per

```ts
export const LAP_OPTIONS = [1, 2, 3] as const
export const DEFAULT_LAPS = 1
```

`ROUND_OPTIONS` té un únic consumidor ([GameOptionsFields.tsx:40](src/features/lobby/GameOptionsFields.tsx#L40)),
així que es pot eliminar net.

**UI**: el mateix selector segmentat de rondes, ara amb `LAP_OPTIONS` i etiqueta
`create.laps` ("Voltes"), amb hint `create.lapsHint` ("Una volta = tothom fa de narrador un cop").
Mostrar el total calculat sota: `create.lapsRoundsHint` → "{{rounds}} rondes amb {{players}} jugadors".
Al lobby el nombre de jugadors es coneix; a `CreateGamePage` encara no (només el host) →
mostrar la nota només si `players.length >= MIN_PLAYERS`, o ometre-la a la creació.

**Càlcul de `total_rounds`**: en començar la partida, a `startGame`
([lobbyApi.ts:205-212](src/features/lobby/lobbyApi.ts#L205-L212)):

```ts
export async function startGame(gameId: string, totalRounds: number): Promise<void> {
  await supabase
    .from('games')
    .update({ status: 'in_round', current_round: 1, total_rounds: totalRounds })
    .eq('id', gameId)
}
```

i a `LobbyPage.handleStart` ([LobbyPage.tsx:111-133](src/features/lobby/LobbyPage.tsx#L111-L133)),
després de `updateGameOptions`:

```ts
const laps = draft?.laps ?? game.total_laps
const playing = players.filter((p) => p.is_connected).length
await startGame(game.id, laps * playing)
```

**"Tornar a jugar"**: `restartGame` ([roundApi.ts:254-265](src/features/game/roundApi.ts#L254-L265))
torna al lobby, i `handleStart` recalcula `total_rounds` amb els jugadors d'aleshores →
funciona sol si algú entra o marxa entre partides. ✔

**Nota sobre desconnexions a mig joc**: si un jugador marxa, `total_rounds` ja està fixat i
algú farà de narrador dues vegades. És acceptable i no cal corregir-ho (canviar
`total_rounds` a mig joc desincronitzaria la capçalera entre dispositius).

**Capçalera**: sense canvis (decisió presa) — segueix "Ronda X de Y".

---

## Fitxers que es toquen

**Nous**

- `supabase/migrations/0007_playtest_options.sql`
- `src/features/game/WordBanner.tsx`
- `src/features/game/useDownloadImage.ts`

**Modificats**

- `src/lib/database.types.ts` — `Game` (+3 camps), `Round` (+`phase_started_at`)
- `src/game/constants.ts` — `LAP_OPTIONS`/`DEFAULT_LAPS`, límits del temps límit
- `src/features/lobby/GameOptionsFields.tsx` — 3 controls nous, selector de voltes
- `src/features/lobby/CreateGamePage.tsx` — defaults + mapatge
- `src/features/lobby/LobbyPage.tsx` — `optionsFromGame`, `handleStart`
- `src/features/lobby/lobbyApi.ts` — `Create/UpdateGameOptions`, payloads, `startGame`
- `src/features/game/GamePage.tsx` — `WordBanner`, treure barra del reveal
- `src/features/game/useRoundOrchestration.ts` — expiració del temps límit
- `src/features/game/roundApi.ts` — `phase_started_at` a `setRoundPhase`, `nextPhaseAfterVote`
- `src/features/game/ProgressBar.tsx` — prop `elapsedMs`
- `src/features/game/phases/WriteDefinitionPhase.tsx` — temps límit, treure `wordHeader`
- `src/features/game/phases/VotingPhase.tsx` — amagar definicions, vista narrador amb botó
- `src/features/game/phases/RevealPhase.tsx` — treure auto-avanç, afegir descàrrega
- `src/features/game/PodiumPage.tsx` — descàrrega
- `src/i18n/locales/ca/ui.json` + `src/i18n/locales/es/ui.json` — **sempre els dos**
- `package.json` — `html-to-image`
- `.claude/CONTEXT.md` — actualitzar §5, §7, §11, §13

---

## Ordre d'execució suggerit

1. **Migració 0007** + `database.types.ts` + `constants.ts` (base de tot)
2. Canvis 6 i 2 (eliminacions/defaults, ràpids i independents)
3. Canvi 1 (`WordBanner`) — millora visible de seguida
4. Canvi 8 (voltes) — toca la ruta d'opcions sencera; un cop feta, 3 i 4 la segueixen
5. Canvis 3 i 4 (opcions noves)
6. Canvi 5 (tancar votació)
7. Canvi 7 (descàrrega d'imatges) — l'únic amb dependència nova i risc visual

---

## Verificació

**Abans de res**: recordar a l'usuari **executar la migració 0007** al SQL Editor de Supabase.

**Estàtica**: `npm run build` (`tsc -b && vite build`) i `npm run lint` han de quedar nets.

**Partida de prova** (`npm run dev`, 3-4 pestanyes/dispositius, mínim 3 jugadors):

| Comprovació           | Com                                                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paraula visible       | Seguir una ronda sencera: la paraula apareix des d'escriure fins als resultats, i **no** apareix a `announcing_word` per als no narradors                                                                                        |
| Definició per defecte | Crear partida nova → el toggle "Mostrar la definició" ja ve marcat                                                                                                                                                               |
| Amagar definicions    | Activar l'opció → a la votació els jugadors veuen només 1, 2, 3…; el narrador veu els mateixos números amb el text a `narrator_reading`                                                                                          |
| Temps límit           | Activar amb 1 minut → tots veuen la barra des del començament; **recarregar una pestanya a mig escriure** i comprovar que la barra continua on tocava, no des de zero; en expirar, s'envia el text i es passa a lectura          |
| Sense temps límit     | Desactivat → torna el compte enrere de 30 s només a l'últim jugador (4+ jugadors)                                                                                                                                                |
| Tancar votació        | Tancar una pestanya sense votar → el narrador prem "Tancar votació" i la partida continua; comprovar que els punts quadren amb els vots emesos                                                                                   |
| Reveal sense presses  | Els resultats es queden fins que el narrador prem el botó; cap barra de progrés                                                                                                                                                  |
| Descàrrega            | Prémer "Desar imatge" al reveal i al podi en **mòbil real** (iOS Safari i Android Chrome, no només escriptori): el PNG ha de tenir el fons blau i tot el contingut, sense targetes transparents ni text invisible per animacions |
| Voltes                | Crear amb 2 voltes i 3 jugadors → capçalera "Ronda 1 de 6"; la partida acaba a la 6a; "Tornar a jugar" amb un jugador més recalcula a 8                                                                                          |
| Podi coherent         | Comparar el podi als 3-4 dispositius: mateix ordre i mateixos punts (regressió de la RPC atòmica)                                                                                                                                |

**Scoring**: si es toca `scoring.ts` (no està previst), verificar amb un `.mjs` al scratchpad
segons CONTEXT §8.
