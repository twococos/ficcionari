# Pla de modificacions #2 — Ficcionari

Segona tanda de canvis, aplicats directament (l'usuari ho ha autoritzat). 6 punts.

## Canvis

### 1. Opció "mostrar la definició en triar la paraula" (default OFF)
Quan el narrador tria paraula (`PickWordPhase`), ara només veu la paraula. Nova opció de
partida `show_definition_on_pick` (bool, default false) que, si està activa, mostra també la
definició real del diccionari sota la paraula per ajudar-lo a decidir.
- **BD**: migració `0006` → columna `show_definition_on_pick boolean not null default false`.
- `database.types.ts` (camp a `Game`), `lobbyApi.ts` (`CreateGameOptions` + insert),
  `CreateGamePage.tsx` (toggle com el de funnyMode), `PickWordPhase.tsx` (render condicional),
  i18n ca/es.

### 2. Idioma per defecte = català
`i18n/config.ts`: el detector prioritza `localStorage` i després `navigator`. Canvi:
mantenir `fallbackLng: 'ca'` però fer que, sense preferència desada, el default sigui `ca`
(posar `ca` com a primer i únic idioma "fix" quan el navegador no és ni ca ni es).
Solució senzilla i robusta: afegir `lng` per defecte no; millor deixar el detector però
posar `fallbackLng: 'ca'` (ja hi és) i afegir un `load: 'languageOnly'`. El navegador de
molts usuaris serà `es`. L'usuari vol **ca per defecte**, així que forcem: si el detector no
troba res a localStorage, usem `ca`. S'implementa amb un ordre de detecció que acaba en un
detector custom que retorna `ca`.

### 3. Barra de progrés (RevealPhase + ProgressBar)
- **Jugadors**: barra a baix fixa **independent del scroll** → moure-la fora del flux del
  `RevealPhase` (que viu dins un contenidor amb scroll) a un portal/element `fixed` a nivell
  de `GamePage`, o assegurar `position: fixed` real. Progressa **d'esquerra a dreta**
  (omplir-se) en comptes de dreta-esquerra (buidar-se). **Vores arrodonides**.
- **Narrador**: la barra dins el botó ha de tenir **més contrast** (ara `opacity-40`, poc
  visible) → pujar opacitat / canviar estil perquè es distingeixi.

### 4. Botó "Enviar definició" sota el quadre de text
`WriteDefinitionPhase` (`PlayerWritingView`): ara el botó està a `mt-auto` (baix de pantalla).
Amb el teclat mòbil obert costa de clicar. Moure'l **just sota el quadre blanc**.

### 5. Compte enrere per a l'últim jugador que queda per escriure
Amb ≥4 jugadors, quan **tots menys un** han enviat definició, l'últim té 30s de compte enrere
amb barra de progrés sota el quadre. En acabar, s'envia el que hi hagi (o es força el pas).
- Es calcula a `PlayerWritingView`: si sóc no-narrador, no he enviat, i el nombre de
  no-narradors que falten és 1 (jo) amb total ≥3 no-narradors (=≥4 jugadors amb narrador),
  arrenca timer 30s + `ProgressBar`. En expirar: si tinc text, `submit()`; si no, res (el
  narrador ja té "passar igualment"), o millor enviar un placeholder? → NO: només auto-enviar
  si hi ha text. La barra és informativa.

### 6. Podi i classificació final trencats (BUG) — el més important
**Dues causes:**
- **A) Filtre `is_connected`**: `Scoreboard` i `PodiumPage` fan
  `.filter((p) => p.is_connected)`. Al final, la presència fluctua per dispositiu → cada
  telèfon amaga jugadors diferents (i si el 1r surt filtrat, `top` és undefined → no surt
  podi). **Fix**: no filtrar per connexió al **podi final** ni al **scoreboard**; mostrar
  tots els jugadors que han jugat, ordenats per punts. (Desempat estable per `joined_at`.)
- **B) Puntuació amb `base` local (stale)**: `applyRoundScoring` escriu
  `score = base + total` amb `base` del snapshot **local** del store. Com que el narrador
  **rota** cada ronda, cada ronda la puntua un dispositiu diferent amb el seu snapshot; si va
  endarrerit, sobreescriu el total acumulat i es perden punts → ordres/guanyadors diferents.
  **Fix**: increment **atòmic al servidor** via RPC `increment_player_score(player_id, delta)`
  (migració `0006`), de manera que el total sempre sigui `score = score + delta` calculat a la
  BD, mai des d'un snapshot de client. `applyRoundScoring` passa a cridar l'RPC.

## BD (l'usuari executa al SQL Editor)
Migració `0006_show_definition_and_atomic_score.sql`:
```sql
alter table public.games
  add column if not exists show_definition_on_pick boolean not null default false;

create or replace function public.increment_player_score(p_player_id uuid, p_delta int)
returns void language sql as $$
  update public.players set score = score + p_delta where id = p_player_id;
$$;
```

## Verificació
- `npm run build` + `npm run lint` nets.
- Test scoring (ja existent) segueix passant.
- Manual amb 4 finestres: podi igual a tots i amb tots els jugadors; punts correctes acumulats.
