# Pla de modificacions #1 — Ficcionari

> **ESTAT: IMPLEMENTAT** (2026-09-09). Build + lint nets; puntuació configurable
> verificada amb tests (4/4). Pendent: l'usuari ha d'executar la migració SQL
> `0005_configurable_points.sql` al SQL Editor de Supabase abans de provar el
> canvi 5, i fer la verificació visual dels 6 canvis.

## Context

L'app ja està publicada i funcionant a Vercel. L'usuari demana 6 millores de joc i
presentació després de provar-la amb amics. Cap toca l'arquitectura; són canvis de
UI/UX, una lògica de puntuació configurable (que sí afegeix 3 columnes a la BD), i
posar el logo definitiu a la pàgina. Els fitxers de logo i les icones PWA ja els ha
actualitzat l'usuari manualment (el logo bo és `public/favicon.svg`); no cal
regenerar-los.

Decisions preses amb l'usuari:
- Punts configurables: **camp numèric lliure, enters 0–20, default 1/1/1**.
- Icones PWA: **ja actualitzades per l'usuari** → no tocar `generate-icons.mjs`.
- Logo: **`public/favicon.svg`**, col·locat **a sobre** del títol de text a la home.

---

## Els 6 canvis

### 1. Amagar la paraula als jugadors quan el narrador l'anuncia
**Fitxer:** `src/features/game/phases/AnnounceWordPhase.tsx` (vista no-narrador, línies ~18-28).

Actualment la vista dels jugadors mostra `round.word` dins un `Card` sota el
`WaitingScreen`. **Eliminar aquest `Card`** perquè només quedi el `WaitingScreen`
amb el missatge `announce.narratorAnnouncing` (així han d'escoltar el narrador). La
vista del narrador no canvia.

### 2. Quadre de text de definició amb fons blanc i la paraula a la capçalera
**Fitxer:** `src/features/game/phases/WriteDefinitionPhase.tsx` (`PlayerWritingView`, línies ~76-146).

- Eliminar el `wordCard` com a bombolla separada (línies ~99-104) i **integrar la
  paraula com a capçalera del quadre de text**.
- Substituir el `<TextField>` (que és un `<input>`) per un bloc propi amb fons blanc:
  un contenidor arrodonit `bg-white` que conté (a) una **capçalera** amb la paraula
  en el mateix format visual que ara (`text-3xl font-black text-accent`, centrada, amb
  l'etiqueta `write.wordIs`), i (b) a sota un `<textarea>` (millor que input per a
  definicions) amb fons blanc i text fosc (`text-primary-dark`), sense la vora fosca
  actual. Reusar `placeholder`, `maxLength=200`, `autoFocus`, `value`/`onChange`.
- Aplicar el mateix tractament de capçalera+paraula a l'estat "ja enviada" (mostrar
  la paraula a la capçalera del bloc que ensenya el text enviat), per coherència.
- Mantenir el `Button` d'enviar/editar igual.

> Nota: com que `Card` sempre és `bg-primary-dark/40`, aquest bloc blanc **no** usarà
> `Card`; serà un `<div>` propi amb `bg-white rounded-2xl overflow-hidden`.

### 3. Fons accent per a la votació de la més graciosa, amb animació de transició
**Fitxers:** `src/features/game/GamePage.tsx` (contenidor arrel de fase),
`src/features/game/phases/VotingPhase.tsx`, `src/styles/index.css` (keyframes).

Com que el fons blau ve del `body` (`index.css`), la manera neta d'aconseguir el
canvi a accent només durant `voting_funny` és **un overlay de color a l'arrel del
`GamePage`** que s'expandeix/contreu amb animació de bombolla:

- A `GamePage`, afegir darrere del contingut un `<div>` de fons absolut
  (`fixed inset-0 -z-10`) de color accent que es mostra quan `round.phase ===
  'voting_funny'`. L'animació d'entrada: una **bombolla que s'expandeix** des del
  centre (keyframe nou `bubbleIn`: `clip-path: circle(0%)` → `circle(150%)`, o
  `scale(0)`→`scale(1)` d'un cercle gran). En sortir de `voting_funny` (tornar a
  blau), animació de sortida `bubbleOut` (o un fadeout del mateix overlay).
  - Implementació recomanada: mantenir l'overlay muntat i alternar una classe segons
    la fase; per animar la SORTIDA cal un petit estat (p.ex. `useEffect` que detecta
    el canvi `voting_funny → altre` i deixa l'overlay uns 400ms amb `bubbleOut` abans
    de desmuntar-lo). Alternativa més simple si la sortida costa: acceptar transició
    CSS d'opacitat/scale sobre l'overlay sempre muntat (menys codi, encara vistós).
- Dins `VotingPhase`, quan `voteType === 'funny'`, ajustar colors de text/targetes
  perquè contrastin sobre accent (p.ex. targetes amb `bg-primary-dark/20` o text
  `text-primary-dark`), ja que el groc accent necessita text fosc. Afegir keyframes a
  `index.css`.

### 4. Auto-avanç de resultats en 20s amb barra de progrés festiva
**Fitxers:** `src/features/game/phases/RevealPhase.tsx`, `src/styles/index.css`,
possible nou component `src/features/game/ProgressBar.tsx`.

- Afegir un **temporitzador de 20s** a `RevealPhase` que, en esgotar-se, crida la
  mateixa `next()` que el botó — però **només el narrador** l'ha d'executar (per
  evitar que N clients avancin alhora i es dupliquin rondes). La resta de jugadors
  veuen la barra com a indicador, sense disparar res.
  - Implementar amb `useEffect` + `setTimeout(20000)` actiu quan `round.phase ===
    'reveal'`; netejar en desmuntar/canvi de ronda. Guard amb `isNarrator()` abans de
    cridar `next()`. Reusar el patró anti-cursa existent (l'avanç ja el fa el narrador
    a `useRoundOrchestration`/`RevealPhase`).
- **Barra de progrés festiva** (ratlles accent en moviment):
  - Component reutilitzable que rep `durationMs` i mostra una barra que s'omple/buida
    en 20s, amb un patró de ratlles diagonals accent animades (keyframe `stripes` amb
    `background-position` en moviment; keyframe `progressShrink`/`progressGrow` per a
    l'amplada).
  - **Per als jugadors (no narrador):** barra a l'**inferior de la pantalla, amplada
    completa** (`fixed bottom-0 left-0 right-0`). Cal que sobresurti del `max-w-md`
    del `ScreenLayout`, per tant serà `fixed`.
  - **Per al narrador:** la barra va **dins del botó** "Ronda següent" (un
    pseudo-fons animat dins el `Button`, superposant les ratlles que avancen darrere
    el text). El botó segueix sent clicable per avançar manualment abans dels 20s.
- Afegir keyframes a `index.css`: `stripesMove` (moviment de les ratlles) i el de
  progrés temporal (amplada de 100%→0% en 20s, via `animation` amb
  `animation-duration` = 20s).

### 5. Puntuacions configurables al crear la partida (default 1/1/1)
**Fitxers:** migració SQL (nova, a `supabase/migrations/`), `src/lib/database.types.ts`,
`src/game/constants.ts`, `src/game/scoring.ts`, `src/features/lobby/lobbyApi.ts`,
`src/features/lobby/CreateGamePage.tsx`, `src/features/game/RoundPointsBreakdown.tsx`
(ja usa els valors calculats, revisar), i i18n (`ca/ui.json`, `es/ui.json`).

Aquesta és l'única part que toca la **base de dades**.

**a) Migració SQL** (l'usuari l'executarà al SQL Editor de Supabase). Nou fitxer
`supabase/migrations/0005_configurable_points.sql`:
```sql
alter table public.games
  add column if not exists score_guess_real int not null default 1,
  add column if not exists score_deceived  int not null default 1,
  add column if not exists score_funniest  int not null default 1;
```

**b) Tipus** — `src/lib/database.types.ts`: afegir els 3 camps a la interfície `Game`
(int). Els `Insert`/`Update` deriven de `Game` (`Partial<Game>`), així que no cal
tocar-los més enllà d'afegir-los a `Game`.

**c) Formulari** — `CreateGamePage.tsx`: afegir 3 estats numèrics
(`pointsGuessReal`, `pointsDeceived`, `pointsFunniest`, default 1) i 3 camps numèrics
(`<input type="number" min={0} max={20}>`, enters), amb etiquetes i18n. Seguir l'estil
existent (bloc amb `text-sm font-bold text-white/80` + hint). El camp de la més
graciosa es pot mostrar sempre o només quan `funnyMode` està actiu (recomanat:
mostrar-lo sempre però indicar que només compta si el mode graciós és actiu, o
amagar-lo si `!funnyMode`). Passar-los a `createGame(...)`.

**d) API** — `lobbyApi.ts`: estendre `CreateGameOptions` amb els 3 valors i incloure'ls
a l'`insert` de `createGame` (`score_guess_real`, `score_deceived`, `score_funniest`).

**e) Scoring** — `scoring.ts`: `computeRoundScores` ha de rebre els valors de punts
en lloc de llegir la constant global `POINTS`. Opció recomanada: afegir un paràmetre
`points: { guessReal; deceived; funniest }`. Actualitzar les 3 crides internes
(línies ~55, 65, 84). Els cridants (`RevealPhase.tsx`, `useRoundOrchestration.ts` si
escau, `roundApi.ts::applyRoundScoring`) han de passar els valors del `game`
(`game.score_guess_real`, etc.). Mantenir `POINTS` a `constants.ts` com a **defaults**
(1/1/1) per a fallback.

**f) i18n** — afegir claus a `create` (labels + hints dels 3 camps) en ca i es. Els
textos de `reveal` (`pointGuessed`/`pointDeceived`/`pointFunniest`) ja usen
`{{points}}` dinàmic; només cal assegurar que reben els valors configurats.

> Nota: `POINTS` per defecte passa d'actual 3/1/2 a **1/1/1** perquè és el nou default
> demanat. Les partides ja creades no tenen les columnes → el default SQL (1) i el
> fallback de codi cobreixen el cas.

### 6. Logo a la pàgina d'inici
**Fitxer:** `src/features/home/HomePage.tsx`.

Afegir un `<img src="/favicon.svg" alt={t('app.name')} />` **a sobre** de l'`<h1>`
del títol (línia ~18), amb una mida raonable (p.ex. `w-32 h-32` o `w-40`, centrat) i
`mb-4`. Es manté el títol de text i el tagline. No cal import (és a `public/`).

---

## Fitxers a modificar (resum)

| Canvi | Fitxers |
|---|---|
| 1 Amagar paraula | `AnnounceWordPhase.tsx` |
| 2 Quadre blanc + capçalera | `WriteDefinitionPhase.tsx` |
| 3 Fons accent funny | `GamePage.tsx`, `VotingPhase.tsx`, `index.css` |
| 4 Auto-avanç + barra | `RevealPhase.tsx`, `index.css`, (nou) `ProgressBar.tsx` |
| 5 Punts configurables | migració SQL, `database.types.ts`, `constants.ts`, `scoring.ts`, `lobbyApi.ts`, `CreateGamePage.tsx`, i18n ca/es |
| 6 Logo | `HomePage.tsx` |

---

## Verificació

Executar `npm run build` i `npm run lint` (han de quedar nets) després dels canvis.
Després, provar amb `npm run dev` (amb 2-3 finestres/mòbil) el flux end-to-end:

1. **Canvi 5 primer** (necessita la migració SQL aplicada): crear partida i comprovar
   que es poden posar valors de punts (p.ex. 2/1/3), que es desen, i que al reveal els
   punts calculats coincideixen amb la configuració.
2. **Canvi 1:** en anunciar, confirmar que als jugadors NO els surt la paraula.
3. **Canvi 2:** el quadre d'escriure definició té fons blanc amb la paraula a la
   capçalera; escriure i enviar funciona.
4. **Canvi 3:** en passar a votar la més graciosa, el fons canvia a accent amb la
   bombolla expansiva, i en tornar a blau també s'anima; el text es llegeix bé sobre
   accent.
5. **Canvi 4:** a resultats, si el narrador no clica, en 20s passa sol; la barra de
   progrés festiva es veu (a baix per als jugadors, dins el botó per al narrador) i el
   clic manual segueix funcionant.
6. **Canvi 6:** el logo es veu a la home sobre el títol.

Test unitari opcional de `scoring.ts` amb valors configurats (reutilitzar l'enfocament
del test previ que va donar 6/6) per confirmar que els punts configurables es
calculen bé.

## Riscos / notes

- **Auto-avanç (canvi 4):** cal garantir que només el narrador dispari `next()` per no
  duplicar rondes (mateix patró anti-cursa ja usat). La barra dels jugadors és només
  visual.
- **Fons accent (canvi 3):** l'animació de sortida (tornar a blau) requereix mantenir
  l'overlay muntat una estona; si es complica, acceptar una transició CSS d'opacitat
  com a fallback (menys codi, encara vistós).
- **Migració SQL (canvi 5):** l'usuari l'ha d'executar al SQL Editor abans de provar;
  el codi ha de tolerar partides antigues sense les columnes (defaults/fallback).
- Contrast: sobre accent (groc) el text ha de ser fosc (`text-primary-dark`).
