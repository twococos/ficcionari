# Pla de desenvolupament — Ficcionari (el joc del diccionari, PWA)

## Context

Volem construir una PWA multijugador per jugar al **joc del diccionari** amb amics: un jugador (el narrador del torn) presenta una paraula poc coneguda, la resta inventen definicions falses, i tothom vota quina creu que és la real. Es guanyen punts encertant la definició real i aconseguint que altres votin la teva definició inventada. Opcionalment es puntua també la definició "més graciosa".

Dos modes de joc:
- **En directe** (mode principal, el que desenvolupem primer): cada jugador amb el seu mòbil, sincronitzats en temps real.
- **Passa i juga** (posterior): un sol dispositiu que va passant de mà en mà.

L'objectiu d'aquest document és fixar l'stack, l'arquitectura de sincronització, la màquina d'estats del joc, i un pla per fases per desenvolupar l'MVP jugable i créixer des d'allà.

> **Nota d'espai de treball:** La carpeta `w:\VSC\ficcionari\.claude\` és l'espai de treball de Claude per a aquest projecte. Aquí hi va aquest pla i qualsevol fitxer auxiliar que es generi (notes, esborranys, scripts de suport, etc.).

### Decisions ja preses (via preguntes a l'usuari)

| Àrea | Decisió |
|---|---|
| Frontend | **Vite + React + TypeScript** |
| Format app | **PWA** instal·lable |
| i18n | Tot el text en fitxers de traducció (sense text hardcoded), preparat per multi-idioma |
| Idiomes inicials | **Català i Castellà** (interfície + diccionari de joc) |
| Font de paraules | **Diccionari propi empaquetat** (JSON curat per idioma) |
| Origen de les dades | **Extracció de Viccionari (ca) / Wikcionario (es)** via script + filtratge |
| Backend / realtime | **Supabase** (Postgres + Realtime + opcionalment Edge Functions) |
| Comptes | **Sense compte** — només àlies, sessió anònima |
| Reconnexió | **Automàtica** (persistència d'identitat al dispositiu via localStorage) |
| Hosting frontend | **Vercel** |
| Disseny | Proposta pròpia: **joguinós, net, arrodonit**, colors vius de la paleta |

### Paleta de colors

| Nom | Hex | Ús |
|---|---|---|
| Primary & background | `#0058F8` | Fons principal, botons primaris |
| Primary Dark | `#001048` | Fons foscos, text sobre clar, contrast |
| Accent | `#F8C800` | Elements destacats, guanyador, CTA secundari |
| White | `#FFFFFF` | Text sobre fons blau, superfícies |

---

## Stack tècnic (resum)

- **Frontend:** Vite + React 18 + TypeScript
- **Estat local:** Zustand (lleuger, ideal per estat de joc). Supabase gestiona fetch/realtime, no cal React Query.
- **Routing:** React Router
- **Estils:** **Tailwind CSS** amb la paleta com a design tokens (`primary`, `primary-dark`, `accent`, `white`)
- **PWA:** `vite-plugin-pwa` (manifest + service worker + instal·lable)
- **i18n:** `i18next` + `react-i18next` amb fitxers JSON per idioma (`ca`, `es`) i namespaces separats per UI vs. contingut de joc
- **Backend:** Supabase (Postgres + Realtime + Row Level Security + Edge Functions per lògica sensible)
- **QR:** `qrcode` (generació) al client del host
- **Hosting frontend:** Vercel
- **Diccionari:** JSON empaquetats generats per un script Node de build separat (no s'executa en runtime)

### Per què aquesta combinació

- Supabase Realtime ens dona subscripcions a canvis de Postgres sense muntar servidor de WebSockets propi. Escrivim a taules, tots els dispositius subscrits reben els canvis. Zero infra de servidor.
- Sense comptes → usem sessions anònimes de Supabase Auth (`signInAnonymously`) per obtenir un `user_id` estable i poder aplicar RLS.
- El diccionari empaquetat fa el joc ràpid, offline-capable i amb qualitat controlada, i evita dependre d'APIs externes inconsistents entre idiomes.

---

## Arquitectura de sincronització i màquina d'estats (el punt clau)

### Model d'autoritat

No tenim servidor de lògica propi, així que definim l'autoritat així:

- **La base de dades (Postgres) és la font de veritat.** L'estat del joc viu en taules; tots els dispositius el llegeixen via Realtime.
- **Al LOBBY mana el HOST** (qui crea la partida): configura les opcions i decideix quan començar la partida. També manté, durant tota la partida, poders globals de **pausar / avortar / expulsar** jugadors.
- **Durant el torn mana el NARRADOR d'aquell torn.** El narrador és qui avança manualment les pantalles del seu torn. La resta de jugadors veuen en tot moment què està fent el narrador ("X està seleccionant la paraula", "X anuncia la paraula", etc.).
- **Excepció — avanç automàtic quan l'acció depèn dels jugadors:** quan la pantalla requereix que TOTS els jugadors (no narrador) facin una acció, la fase avança **automàticament** quan l'últim jugador acaba. Concretament:
  - **Escriptura de definicions:** el narrador va veient en temps real les definicions que arriben a mesura que cada jugador les envia; quan **tots** han enviat, es passa automàticament (o el narrador pot forçar el pas si algú es queda penjat).
  - **Votació (real i graciosa):** es passa automàticament quan **tots** han votat.
  - En canvi, les pantalles que depenen del narrador (seleccionar paraula, anunciar-la, llegir definicions en veu alta, iniciar votació, passar a resultats, iniciar la ronda següent) les avança **el narrador manualment**.
- **Les Edge Functions de Supabase** gestionen les operacions sensibles que no volem confiar al client: barrejar/assignar la paraula real amb les definicions inventades (perquè el client no pugui saber quina és la real abans de votar), i el càlcul de puntuacions. Això és **crític per anti-trampes**: si el client sabés quina definició és la real, es podria fer trampa.

> Nota de seguretat: la definició real NO s'ha d'enviar mai al client durant la fase de votació amb un flag identificable. Les definicions es serveixen barrejades i anònimes; la revelació de quina era la real la fa el servidor (Edge Function) en calcular resultats.

### Màquina d'estats de la partida (`game.status`)

```
lobby → in_round → round_results → (repeteix N rondes) → finished
```

I dins de cada ronda, una sub-fase (`round.phase`). Entre parèntesi, **qui** avança a la fase següent:

```
narrator_picking_word   (avança NARRADOR — tria/re-tira paraula i la selecciona)
 → announcing_word       (avança NARRADOR — llegeix la paraula i la definició en veu alta; la resta veuen "X anuncia la paraula")
 → writing_definitions   (avança AUTO quan TOTS han enviat; narrador veu arribar les definicions en directe i pot forçar)
 → narrator_reading      (avança NARRADOR — llegeix totes les definicions barrejades i anònimes en veu alta)
 → voting_real           (avança AUTO quan TOTS han votat)
 → voting_funny          (opcional; avança AUTO quan TOTS han votat)
 → reveal / round_results (avança NARRADOR — revela real + autories + punts; d'aquí inicia la ronda següent)
```

Les transicions escriuen a la DB i es propaguen a tots via Realtime. La lògica de "qui pot avançar" es valida (idealment a servidor/RLS) perquè un jugador no pugui forçar transicions que no li toquen.

### Puntuació (per defecte, configurable)

- +3 punts si encertes la definició real.
- +1 punt per cada jugador que voti la teva definició inventada (creure-la real).
- +X punts a la definició més votada com a "graciosa" (si el mode està actiu).
- Cas especial: escriure literalment la definició real (o molt semblant) → tractat com encert o punts extra (a decidir).

---

## Model de dades (Supabase / Postgres)

```
games
  id (uuid, pk)
  code (text, únic, curt, per unir-se)   -- p.ex. "ABCD"
  host_player_id (uuid)
  language (text)                        -- 'ca' | 'es'
  total_rounds (int)
  score_funny_enabled (bool)
  status (text)                          -- lobby | in_round | round_results | finished
  current_round (int)
  created_at

players
  id (uuid, pk)
  game_id (fk → games)
  device_id (text)                       -- persistit a localStorage per reconnexió
  nickname (text)
  score (int, default 0)
  is_host (bool)
  is_connected (bool)
  joined_at

rounds
  id (uuid, pk)
  game_id (fk)
  round_number (int)
  narrator_player_id (fk → players)
  word (text)
  real_definition (text)                 -- NOMÉS accessible via server/RLS, no exposat als jugadors
  phase (text)                           -- narrator_picking_word | announcing_word | writing_definitions | ...
  created_at

definitions
  id (uuid, pk)
  round_id (fk)
  author_player_id (fk → players, nullable per la "real")
  text (text)
  is_real (bool)                         -- protegit per RLS fins a fase reveal
  created_at

votes
  id (uuid, pk)
  round_id (fk)
  voter_player_id (fk)
  definition_id (fk)
  vote_type (text)                       -- 'real' | 'funny'
  created_at
```

**Row Level Security (RLS):** clau per evitar trampes. Els jugadors poden llegir definicions del seu torn però NO els camps `is_real` / `real_definition` fins que `round.phase = 'reveal'`. Es resol amb vistes o Edge Functions que filtren, o amb polítiques RLS que amaguen columnes sensibles. Les transicions de fase també es validen per rol (narrador vs. host vs. jugador).

---

## Diccionari propi — pipeline de dades

Script de build (Node, `scripts/build-dictionary.ts`), executat manualment fora de runtime:

1. Descarregar dumps oberts de **Viccionari (ca)** i **Wikcionario (es)** (llicència CC BY-SA — cal atribució).
2. Parsejar l'wikitext per extreure entrades: paraula + definició(ns) principals + categoria gramatical.
3. **Filtrar per "poc conegudes":** excloure paraules molt freqüents (usar llistes de freqüència), preferir paraules amb definicions curtes i clares, longitud raonable, evitar noms propis, sigles, formes flexionades, i contingut ofensiu.
4. Netejar el wikitext (treure marques, enllaços, plantilles) a text pla.
5. Generar `public/dictionaries/ca.json` i `public/dictionaries/es.json` amb estructura `[{ word, definition, pos }]`.
6. Afegir un fitxer d'atribució/llicència.

> **Nota:** L'MVP pot començar amb un subconjunt petit (unes centenes de paraules) per validar el joc, i escalar el dataset després. El pla inclou l'script complet però la Fase corresponent pot lliurar primer un dataset reduït.

---

## i18n — arquitectura de text

- `src/i18n/locales/ca/ui.json`, `src/i18n/locales/es/ui.json` — tot el text d'interfície.
- Namespace separat per possibles textos de contingut/regles.
- Cap string literal a components: sempre `t('clau')`.
- Selector d'idioma d'interfície independent de l'idioma del **diccionari de joc** (que es fixa en crear la partida).
- Configuració amb detecció d'idioma del navegador + override manual, persistit a localStorage.

---

## Estructura de carpetes proposada

```
ficcionari/
  .claude/                   # espai de treball de Claude (pla, notes, esborranys)
  public/
    dictionaries/            # ca.json, es.json (generats)
    icons/                   # icones PWA
  scripts/
    build-dictionary.ts      # pipeline de dades (offline)
  src/
    app/                     # entry, router, providers
    components/              # UI reutilitzable (botons, layout...)
    features/
      lobby/                 # crear/unir-se, QR, llista jugadors
      game/                  # màquina d'estats, fases del torn
      results/               # resultats de ronda i podi final
    game/
      machine.ts             # lògica de transicions de fase (qui avança cada fase)
      scoring.ts             # càlcul de punts (mirror del server)
      types.ts
    lib/
      supabase.ts            # client Supabase
      realtime.ts            # helpers de subscripció
      device.ts              # device_id persistent, reconnexió
    i18n/
      config.ts
      locales/ca/*.json
      locales/es/*.json
    store/                   # Zustand stores
    styles/                  # tokens de color, tema
    theme.ts                 # paleta com a tokens
  supabase/
    migrations/              # SQL de taules + RLS
    functions/               # Edge Functions (shuffle, scoring, reveal)
  index.html
  vite.config.ts
```

---

## Pla per fases

### Fase 0 — Bootstrap del projecte
- Inicialitzar Vite + React + TS a `ficcionari/`.
- Configurar Tailwind amb la paleta com a tokens (`primary`, `primary-dark`, `accent`, `white`).
- Configurar `vite-plugin-pwa` (manifest bàsic, icones, instal·lable).
- Configurar `i18next` amb `ca` i `es`, i un component de selecció d'idioma. Zero text hardcoded des del minut u.
- Configurar ESLint + Prettier + estructura de carpetes.
- **Entregable:** app buida instal·lable com a PWA, amb i18n funcionant i tema aplicat.

### Fase 1 — Supabase i model de dades
- Crear projecte Supabase, connectar client (`src/lib/supabase.ts`).
- Migracions SQL: taules `games`, `players`, `rounds`, `definitions`, `votes`.
- Activar Realtime a les taules necessàries.
- Auth anònima (`signInAnonymously`) + `device_id` persistent a localStorage.
- Polítiques RLS bàsiques (accés per pertinença a la partida) — la protecció de `is_real` es reforça a Fase 4.
- **Entregable:** es pot crear un registre de partida i llegir-lo en realtime des de dos navegadors.

### Fase 2 — Lobby (crear i unir-se)
- Pantalla de creació de partida: opcions (nombre de rondes, mode graciós on/off, idioma del diccionari).
- Generació de `code` curt + link + **codi QR** (`qrcode`).
- Pantalla d'unir-se via link/QR o codi manual: introduir àlies → entrar al lobby.
- Lobby en temps real: llista de jugadors que s'actualitza sola; **el host** veu botó "Començar".
- Reconnexió: si tornes amb el mateix `device_id`, recuperes el teu lloc.
- **Entregable:** diversos dispositius entren a un lobby compartit i el veuen sincronitzat.

### Fase 3 — Cicle del torn (mode En directe) — el cor del joc
- Selecció de narrador (rotació justa).
- **Narrador:** "tirar daus" per obtenir paraula del diccionari, opció de re-tirar, seleccionar-la, i anunciar-la. La resta veuen l'estat del narrador en directe.
- **Escriptura:** la resta de jugadors escriuen la seva definició; el narrador veu arribar les definicions en directe; **avanç automàtic** quan tots han enviat (amb opció de forçar).
- **Lectura:** el narrador veu totes les definicions (barrejades i anònimes) per llegir-les i avança quan acaba.
- **Votació** real (i graciosa si està activada): **avanç automàtic** quan tots han votat.
- **Resultats → ronda següent:** el narrador avança.
- Transicions propagades via Realtime, amb validació de qui pot avançar cada fase.
- **Entregable:** una ronda completa jugable de punta a punta entre diversos dispositius, amb el model d'autoritat narrador/jugadors correcte.

### Fase 4 — Puntuació, revelació i anti-trampes
- Edge Function per **barrejar** definicions i servir-les sense revelar la real.
- Edge Function per **calcular puntuacions** i executar la **revelació** (qui va escriure què, quina era la real).
- Reforçar RLS perquè `is_real`/`real_definition` no siguin accessibles abans de `reveal`, i perquè les transicions de fase respectin el rol.
- Pantalla de resultats de ronda amb puntuació acumulada.
- **Entregable:** ronda amb puntuació correcta i sense possibilitat de trampa des del client.

### Fase 5 — Multi-ronda i final de partida
- Encadenar rondes fins a `total_rounds`, rotant narrador.
- Pantalla de **podi** final amb classificació i animació.
- Gestió de fi de partida i opció de "tornar a jugar" amb els mateixos jugadors.
- **Entregable:** partida completa de N rondes amb podi final.

### Fase 6 — Diccionari de qualitat (pipeline complet)
- Script `build-dictionary.ts` complet: descàrrega, parseig, filtratge de paraules poc conegudes, neteja, generació de JSON.
- Substituir el dataset reduït de proves per un dataset ampli i curat (ca + es).
- Atribució de llicència CC BY-SA.
- **Entregable:** diccionaris rics per a català i castellà.

### Fase 7 — Poliment, reconnexió robusta i desplegament
- Millores UX/animacions dins la línia de disseny (joguinós, arrodonit, colors vius).
- Reconnexió robusta i gestió de desconnexions/timeouts (jugador que no escriu → el narrador força; narrador que marxa → traspàs de narrador; host que marxa → traspàs d'host).
- Poders d'host durant la partida: pausar / avortar / expulsar.
- Estats d'error, càrrega, i buits.
- Desplegament a **Vercel** + configuració de variables d'entorn de Supabase.
- Auditoria PWA (Lighthouse), icones, splash.
- **Entregable:** app publicada i jugable amb amics.

### Fase 8 (posterior) — Mode "Passa i juga"
- Adaptar el flux a un sol dispositiu: pantalles de "passa el mòbil a X", ocultació d'informació entre jugadors.
- Reutilitzar la mateixa màquina d'estats sense la capa de Realtime (tot local).
- **Entregable:** segon mode de joc jugable.

---

## Verificació (com provar cada fase)

- **Local realtime:** obrir l'app en 2–3 finestres/navegadors (o mòbil + escriptori) i comprovar que els canvis d'estat es propaguen instantàniament, i que l'avanç automàtic (quan tots acaben) i el manual (narrador) funcionen com toca.
- **PWA:** Lighthouse (instal·labilitat, offline shell), provar "Afegir a la pantalla d'inici" en mòbil real.
- **Anti-trampes:** inspeccionar el tràfic de xarxa i el payload durant la votació per confirmar que la definició real NO és identificable pel client.
- **Puntuació:** partida de prova amb resultats coneguts i verificar els punts calculats.
- **i18n:** canviar d'idioma i confirmar que no queda cap text hardcoded (revisió + cerca de literals).
- **Reconnexió:** tancar i reobrir el navegador enmig d'una partida i comprovar que es recupera el lloc.

---

## Riscos i notes obertes

- **Qualitat del diccionari:** el filtratge de "paraules poc conegudes" és la part més artesanal; caldrà iterar sobre els criteris. Mitigació: començar amb dataset petit curat.
- **Amagar la definició real amb RLS/columnes:** requereix disseny acurat de polítiques o vistes; per això es delega a Edge Functions a Fase 4.
- **Traspàs de narrador/host:** si el narrador (àrbitre del torn) o el host marxen, cal promoure un altre jugador. Es tracta a Fase 7.
- **Jugador que no acaba (bloqueja l'avanç automàtic):** el narrador pot forçar el pas; a Fase 7 s'afegeixen timeouts.
- **Límits del free tier de Supabase:** suficients per a ús entre amics; a vigilar si escala.
- **Llicència de dades:** Viccionari/Wikcionario són CC BY-SA → cal atribució visible a l'app.
