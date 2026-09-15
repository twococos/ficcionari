# CONTEXT.md — Ficcionari

Context complet perquè qualsevol sessió nova pugui entendre l'app i fer-hi canvis amb
seguretat. Si trobes discrepàncies entre aquest fitxer i el codi, **el codi mana**;
actualitza aquest fitxer quan facis canvis estructurals.

---

## 1. Què és

**Ficcionari** és una PWA multijugador del _joc del diccionari_ per jugar en persona amb
amics (cada un al seu mòbil). Un jugador és el **narrador** de la ronda: tria una paraula
poc coneguda i n'anuncia la definició real en veu alta; la resta inventen definicions
falses convincents; després tothom vota quina creu que és la real. Es puntua per encertar
la real, per enganyar altres (que votin la teva mentida) i, opcionalment, per la definició
més graciosa. Rotació de narrador cada ronda; al final, podi.

L'app **ja està publicada** (Vercel) i s'usa de veritat. Els canvis han de tolerar partides
antigues i clients desincronitzats.

---

## 2. Stack i eines

- **Vite 5 + React 18 + TypeScript**, PWA amb `vite-plugin-pwa` (Workbox, `autoUpdate`).
- **Tailwind CSS 3** (config amb la paleta de marca com a tokens). Animacions per
  keyframes a `src/styles/index.css` (NO al tailwind.config).
- **Supabase**: Postgres + Realtime (postgres_changes) + **auth anònima**. Project ref
  `lmytzouivbthxsabryrm`. Claus via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  (`.env.local`; a Vercel, variables d'entorn).
- **Zustand** per a l'estat de joc (`useGameStore`).
- **react-router-dom 6** (rutes a `src/app/App.tsx`).
- **i18next + react-i18next** (idiomes `ca` i `es`, un sol namespace `ui` per idioma).
- **Desplegament**: Vercel. **Hosting SPA**: cal rewrite de totes les rutes a `/index.html`
  (rutes com `/lobby/ABCD` han de servir l'app).

Scripts: `npm run dev`, `npm run build` (`tsc -b && vite build`), `npm run lint`,
`npm run format`. **Sempre deixa `build` + `lint` nets abans de tancar un canvi.**

---

## 3. Paleta i estil

Tokens (a `:root` de `src/styles/index.css` i al tailwind.config):

- `primary` `#0060f4` (blau; fons per defecte del `body`)
- `primary-dark` `#001048` (blau fosc; text sobre clar, fons de targetes translúcides)
- `accent` `#f8c800` (groc; acció principal, destacats)
- `white` `#ffffff`

Convencions:

- Fons general blau; targetes `Card` translúcides fosques; botó d'acció `accent`.
- **Sobre fons accent (groc) el text ha de ser fosc** (`text-primary-dark`), mai blanc.
- Tipografia: Nunito (Google Fonts). Inputs a 16px per evitar el zoom d'iOS.
- Components base a `src/components/`: `Button` (variants `accent`/`ghost`), `Card`,
  `TextField`, `ScreenLayout` (capçalera + selector d'idioma opcional), `QRCode`,
  `Confetti`, `CheckIcon`.

---

## 4. Arquitectura del codi

```
src/
  app/App.tsx                 rutes (BrowserRouter)
  components/                 UI reutilitzable (Button, Card, CheckIcon, …)
  features/
    home/HomePage.tsx         portada (logo + crear/unir-se)
    lobby/
      CreateGamePage.tsx      crear partida (nom + GameOptionsFields)
      JoinGamePage.tsx        unir-se per codi
      LobbyPage.tsx           sala d'espera; el host edita opcions i comença
      GameOptionsFields.tsx   controls d'opcions compartits (crear + editar al lobby)
      lobbyApi.ts             CRUD de partides/jugadors (createGame, joinGame, startGame,
                              updateGameOptions, kickPlayer, promoteToHost, restartGame…)
      useGameRealtime.ts      subscripció realtime → refresca store
    game/
      GamePage.tsx            router de fases + barra d'auto-avanç + FunnyBackground
      phases/                 una vista per fase (veure §5)
      roundApi.ts             lògica de ronda (crear ronda, definicions, vots, scoring…)
      useRoundOrchestration.ts transicions AUTOMÀTIQUES de fase (només el narrador)
      usePresence.ts          presència Supabase (marca connectat/desconnectat)
      useTransfers.ts         traspàs de narrador/host quan algú marxa
      useKickRedirect.ts      redirigeix si t'expulsen
      Scoreboard.tsx          classificació acumulada
      PodiumPage.tsx          podi final + "tornar a jugar" (host)
      ProgressBar.tsx         barra festiva de progrés (ratlles accent)
      FunnyBackground.tsx     overlay accent animat a la votació graciosa
      RoundPointsBreakdown.tsx  detall de punts de la ronda
  game/
    constants.ts              MIN/MAX jugadors, ROUND_OPTIONS, POINTS, límits, codis
    scoring.ts                computeRoundScores (PUR i testejable) + pointsFromGame
    shuffle.ts                stableShuffle (ordre estable per id de ronda)
    dictionary.ts             loadDictionary / pickRandomWord (fetch /dictionaries/<lang>.json)
  i18n/
    config.ts                 init i18next + detector propi (safeStorage)
    locales/{ca,es}/ui.json   traduccions (un sol namespace 'ui')
  lib/
    supabase.ts               client + ensureAnonymousSession
    realtime.ts               subscribeToGame (games/players/rounds + definitions/votes)
    database.types.ts         tipus del model + Database (Row/Insert/Update + Functions)
    device.ts                 device_id persistent (via safeStorage)
    safeStorage.ts            localStorage a prova de fallades (cau a memòria)
supabase/migrations/          SQL (executar MANUALMENT al SQL Editor de Supabase)
public/dictionaries/          diccionaris JSON (ca.json, es.json) — grans, no precache
```

---

## 5. Màquina d'estats del joc

`games.status`: `lobby` → `in_round` → `finished` (i tornar a `lobby` amb "tornar a jugar").
Cada ronda (`rounds.phase`) passa per:

1. `narrator_picking_word` — el narrador tira daus i tria paraula (`PickWordPhase`).
2. `announcing_word` — el narrador veu paraula+definició real i les diu en veu alta; **els
   altres NO veuen la paraula** (l'han d'escoltar) (`AnnounceWordPhase`).
3. `writing_definitions` — els no-narradors escriuen la seva definició falsa
   (`WriteDefinitionPhase`).
4. `narrator_reading` — el narrador llegeix totes les definicions barrejades (`ReadingPhase`).
5. `voting_real` — tothom vota quina és la real (`VotingPhase voteType="real"`).
6. `voting_funny` — (opcional) vota la més graciosa (`VotingPhase voteType="funny"`).
7. `reveal` — resultats: es revela la real, l'autoria, vots i punts. **NO auto-avança**:
   el narrador prem "Ronda següent" quan tothom ha mirat els resultats (`RevealPhase`).

Des de `writing_definitions` fins a `reveal`, la **paraula de la ronda és visible per a
tothom** en un banner (`WordBanner`, renderitzat a `GamePage` fora del contenidor animat).
A `announcing_word` segueix amagada a posta: l'han d'escoltar del narrador.

A les dues votacions el narrador pot **tancar la votació a mà** (útil si algú es
desconnecta i la transició automàtica no arribaria mai).

Rutes: `/` `/create` `/join[/:code]` `/lobby/:code` `/game/:code` `/podium/:code`.

---

## 6. Sincronització i patrons anti-cursa (IMPORTANT)

Diversos clients comparteixen l'estat via la BD i Realtime. Regles clau:

- **Realtime → refresca l'store.** `subscribeToGame` escolta `games`/`players`/`rounds`
  (filtrats per game_id) i `definitions`/`votes` (sense filtre). El callback recarrega
  partida+jugadors o ronda+definicions+vots (`useGameRealtime`). L'store és el mirall de la
  BD; **la BD és la font de veritat**, no els snapshots locals.
- **Només el NARRADOR dispara transicions automàtiques** (`useRoundOrchestration`): ell no
  escriu ni vota, sempre és present i únic → evita que N clients disparin la mateixa
  transició. Fa servir un `lastActionRef` (`${round.id}:${phase}`) per no repetir.
- **Escriure/votar és idempotent** (`submitDefinition`, `submitVote`, `ensureRealDefinition`):
  comproven existència abans d'inserir; un vot per (ronda, votant, tipus).
- **Puntuació una sola vegada per ronda**: `applyRoundScoring` reclama la ronda amb un update
  condicional `update({scored:true}).eq('scored', false)`; només qui guanya la reclamació
  suma punts.
- **Suma de punts ATÒMICA al servidor**: es fa via la funció RPC `increment_player_score`
  (`score = score + delta` a la BD), **mai** `score = base_local + delta`. Aquest va ser un
  bug real: com que el narrador rota, cada ronda la puntuava un dispositiu diferent amb un
  snapshot possiblement endarrerit i el podi divergia entre dispositius.
- **Podi i classificació mostren TOTS els jugadors** (no filtren per `is_connected`), amb
  desempat estable per `joined_at`, perquè l'ordre sigui idèntic a tots els dispositius.
  (Filtrar per connexió feia que cada telèfon amagués jugadors diferents.)
- **Ordre estable de les definicions**: `stableShuffle(definitions)` barreja de forma
  determinista (sembra pel round id) perquè votació i reveal coincideixin a tots els clients.
- **Presència i traspassos**: `usePresence` marca connectat/desconnectat; `useTransfers`
  reassigna narrador/host si el titular marxa (un "supervisor" determinista — el jugador amb
  id més baix — fa el traspàs per evitar curses).

---

## 7. Model de dades (Supabase)

Taules: `games`, `players`, `rounds`, `definitions`, `votes` (esquema a
`supabase/migrations/0001_initial_schema.sql`). Totes publicades a `supabase_realtime`.
RLS activa (migració 0002); polítiques de delete a 0004.

Columnes rellevants afegides després de l'esquema inicial:

- `games.score_funny_enabled` (bool) — mode de votar la més graciosa.
- `games.score_guess_real` / `score_deceived` / `score_funniest` (int, default 1) — punts
  configurables (migració 0005).
- `games.show_definition_on_pick` (bool) — el narrador veu la definició del diccionari
  mentre tria paraula (migració 0006; default canviat a **true** a la 0007).
- `games.hide_definitions_on_vote` (bool, default false) — els votants només veuen números
  (migració 0007).
- `games.write_time_limit_seconds` (int, default 0 = desactivat) — temps límit per escriure
  definicions (migració 0007).
- `games.total_laps` (int, default 1) — **voltes**; `total_rounds` es calcula en començar la
  partida (`voltes × jugadors`) i segueix sent la font de veritat del final (migració 0007).
- `rounds.scored` (bool) — marca de puntuació aplicada (migració 0003).
- `rounds.phase_started_at` (timestamptz) — quan s'ha entrat a la fase actual; l'escriuen
  `setRoundPhase`/`chooseWord`/`reassignNarrator`. **Ancora els comptes enrere al rellotge
  compartit**, no al muntatge del component, perquè una recàrrega no els reiniciï
  (migració 0007).
- Funció `increment_player_score(p_player_id uuid, p_delta int)` (migració 0006, **executada**).

**Totes les migracions (0001–0007) estan aplicades a la BD de producció.** La propera columna
o funció nova serà la 0008.

**Migracions = SQL manual.** No hi ha CLI de Supabase vinculada; cada fitxer a
`supabase/migrations/` s'executa a mà al **SQL Editor** del dashboard. Escriu-les
idempotents (`add column if not exists`, `create or replace function`). Quan un canvi de codi
depengui d'una columna/funció nova, **recorda a l'usuari que executi la migració** abans de
provar; i mantén `pointsFromGame`/defaults perquè partides antigues no petin.

Els tipus del model són **a mà** a `src/lib/database.types.ts` (interfaces `Game`, `Player`,
`Round`, `Definition`, `Vote` + `Database` amb Row/Insert/Update i `Functions`). Si afegeixes
una columna o RPC, actualitza aquest fitxer també.

---

## 8. Puntuació (scoring.ts)

`computeRoundScores(definitions, votes, funnyEnabled, points)` és **pura i testejable**:

- +`points.guessReal` a qui vota la definició real.
- +`points.deceived` a l'autor per cada vot 'real' rebut per la seva definició inventada.
- +`points.funniest` a l'autor de la més graciosa **només si el guanyador és únic**: en
  **empat, ningú puntua ni es corona** (`funniestDefinitionIds` queda buit).
- `points` ve de `pointsFromGame(game)` (llegeix les columnes de la partida amb fallback a
  1/1/1 per a partides antigues). Defaults també a `constants.ts` (`DEFAULT_POINTS`,
  `POINTS`, `POINTS_MIN=0`, `POINTS_MAX=20`).

Per verificar la lògica de scoring, fes un petit script `.mjs` al scratchpad que en repliqui
la funció (no hi ha suite de tests al repo).

---

## 9. i18n

- Un sol namespace `ui` per idioma; claus a `locales/{ca,es}/ui.json`. **Afegeix la clau a
  TOTS DOS idiomes** sempre.
- **Idioma per defecte: català.** El detector és propi (`config.ts`): llegeix la preferència
  desada via `safeStorage`; si no n'hi ha, cau a `fallbackLng: 'ca'` (encara que el navegador
  sigui en castellà). `changeLanguage` persisteix la tria.
- Textos de punts al reveal usen interpolació `{{points}}`/`{{count}}` (plurals `_one`/`_other`).

---

## 10. Robustesa d'emmagatzematge (safeStorage)

Firefox per Android (protecció de seguiment, mode privat) pot llançar només d'**accedir** a
`localStorage`. Si això passa durant la càrrega inicial → pàgina en blanc. Per això:

- **Tot accés a localStorage passa per `src/lib/safeStorage.ts`** (getItem/setItem/removeItem),
  que captura errors i cau a un magatzem en memòria. `device.ts` i el detector d'i18n el fan
  servir. **No facis `localStorage.*` directe enlloc nou** — fes servir `safeStorage`.
- Nota: el "blank a Vercel amb Firefox Android" que vam investigar va resultar ser un
  **service worker antic en cau** (es va resoldre esborrant dades del lloc); `autoUpdate` del
  PWA hauria d'evitar-ho en desplegaments futurs. Si torna a passar només en un navegador
  concret, sospita del SW: desregistra'l / esborra dades del lloc.

---

## 11. Decisions preses (per no reobrir-les)

- Punts: **camp numèric lliure, enters 0–20, default 1/1/1**.
- Logo: `public/favicon.svg`, a **sobre** del títol a la home. Icones PWA ja generades per
  l'usuari (no tocar `scripts/generate-icons.mjs` sense demanar-ho).
- Amagar la paraula als jugadors en `announcing_word` (l'han d'escoltar).
- Quadre d'escriure definició: fons blanc amb la paraula a la capçalera; botó "Enviar" **just
  sota el quadre** (no a baix de tot) per accessibilitat amb el teclat mòbil.
- **El reveal NO auto-avança** (es va eliminar el compte enrere de 20s): mirar els resultats
  és la part més divertida i passaven massa ràpid. Avança el narrador amb el botó.
- Últim jugador que queda per escriure (amb 4+ jugadors): compte enrere de **30s** amb barra
  sota el botó; en expirar auto-envia el text si n'hi ha. **Només s'aplica si la partida no
  té temps límit configurat**; si en té, la barra corre per a tothom des del principi.
- La durada es mesura en **voltes**, no en rondes soltes, perquè tothom narri el mateix
  nombre de cops. Si algú marxa a mig joc, `total_rounds` ja està fixat i algú narrarà dos
  cops: és acceptable (recalcular-lo desincronitzaria la capçalera entre dispositius).
- Descàrrega d'imatges (reveal i podi) amb `html-to-image`; durant la captura s'afegeix la
  classe `ficc-capturing` al node per aturar les animacions d'entrada (si no, els elements
  amb `animationDelay` es capturen invisibles). `data-capture-hide` amaga elements a la
  imatge; `data-capture-only` els mostra **només** a la imatge.
- Votació més graciosa: fons **accent** amb animació de bombolla (`FunnyBackground`,
  clip-path circle); tornada a blau també animada.
- El **host pot editar les opcions al lobby**; es desen **automàticament en clicar "Començar
  partida"** (sense botó de desar). Controls compartits amb la creació via `GameOptionsFields`.
- Confirmació de "fet" (definició enviada / has votat): icona `CheckIcon` (check en cercle
  accent), **no** l'emoji `✅`.

---

## 12. Com afegir un canvi típic

- **Nova opció de partida**: columna a `games` (migració idempotent) → `database.types.ts` →
  `CreateGameOptions`/`createGame` i `UpdateGameOptions`/`updateGameOptions` a `lobbyApi.ts`
  → `GameOptionsValue` + `defaultGameOptions`/`gameOptionsToApi`/`gameOptionsFromGame` a
  `features/lobby/gameOptions.ts` (mapatge camelCase ↔ snake_case, amb fallback perquè les
  partides antigues no petin) → control a `GameOptionsFields.tsx` (`ToggleField`,
  `NumberField`/`PointField` o selector segmentat) → consumir-la on toqui → claus i18n ca/es
  → avisar l'usuari d'executar la migració.
  Els helpers viuen en un fitxer **a part** del component per la regla `react-refresh`.
- **Nova fase o canvi de flux**: afegir a l'enum `RoundPhase` (types + comentari a l'esquema),
  a `PhaseContent` de `GamePage`, i a `useRoundOrchestration` si la transició és automàtica
  (recorda: **només el narrador** la dispara). Manté l'ordre estable amb `stableShuffle`.
- **Canvi de puntuació**: només a `scoring.ts` (funció pura) + textos i18n del reveal.
  Verifica amb un script `.mjs` al scratchpad.
- **Animacions**: keyframes a `src/styles/index.css` (+ classe si es reutilitza, com
  `.ficc-stripes`), no al tailwind.config.

---

## 13. Historial de treball (plans)

- `.claude/PLA-DESENVOLUPAMENT.md` — pla de desenvolupament original (fases del producte).
- `.claude/PLA-MODIFICACIONS-1.md` — 1a tanda post-llançament (6 canvis: amagar paraula,
  quadre blanc, fons graciós animat, auto-avanç, punts configurables, logo).
- `.claude/PLA-MODIFICACIONS-2.md` — 2a tanda (mostrar-definició, català per defecte, barra
  de progrés, botó sota el quadre, compte enrere de l'últim, **fix del podi** + RPC atòmica).
- `.claude/PLA-MODIFICACIONS-3.md` — 3a tanda, post-playtest amb amics (8 canvis: paraula
  sempre visible, definició per defecte, amagar definicions, temps límit d'escriptura,
  tancar votació a mà, treure l'auto-avanç del reveal, descàrrega d'imatges, voltes).
- Tandes intermèdies sense fitxer de pla: editar opcions al lobby, `CheckIcon`, empat graciós
  sense punts, retocs de la barra flush, `safeStorage`.

**Estat de la BD**: totes les migracions (0001–0007) estan **aplicades** a producció, inclosa
la 0007 (amagar definicions, temps límit, voltes, `phase_started_at`). Els canvis de codi
poden no estar committejats/desplegats encara — comprova `git status` i pregunta abans de
fer commit.
