# Scripts

## `parse-dump.mjs` — Generació dels diccionaris

Genera `public/dictionaries/<lang>.json` a partir dels dumps XML del
Viccionari (ca) / Wikcionario (es), amb filtratge de qualitat per obtenir
paraules poc conegudes jugables.

### Regenerar els diccionaris

1. Descarrega els dumps (a `_dumps/`, ignorat per git):

   ```bash
   mkdir -p _dumps
   curl -o _dumps/ca.xml.bz2 https://dumps.wikimedia.org/cawiktionary/latest/cawiktionary-latest-pages-articles.xml.bz2
   curl -o _dumps/es.xml.bz2 https://dumps.wikimedia.org/eswiktionary/latest/eswiktionary-latest-pages-articles.xml.bz2
   ```

2. Genera (requereix `bunzip2` al PATH; processa en streaming, no descomprimeix a disc):

   ```bash
   node scripts/parse-dump.mjs ca _dumps/ca.xml.bz2
   node scripts/parse-dump.mjs es _dumps/es.xml.bz2
   ```

El filtratge descarta noms propis, flexions, locucions i definicions dolentes,
i prioritza paraules poc conegudes (llista de comunes + longitud mínima).

**Llicència de les dades:** CC BY-SA 4.0 (Wikimedia). L'atribució s'inclou dins
cada fitxer JSON generat i s'ha de mostrar a l'app.

> Després de regenerar, **passa sempre `clean-dictionary.mjs`** (sota): el parser
> deixa passar coses que només es veuen jugant.

## `clean-dictionary.mjs` — Neteja de jugabilitat

Post-procés de `public/dictionaries/<lang>.json` amb dues correccions sortides
d'un playtest amb gent de veritat:

1. **Treu l'etiqueta de camp inicial** entre parèntesis: `(botànica) Qualitat
   d'un sistema…` → `Qualitat d'un sistema…`. Ningú escriu «(botànica)» en una
   definició inventada, així que l'etiqueta delatava la real. També compta com a
   etiqueta el nom científic (`(Capsicum spp.)`), encara que sigui llarg.
2. **Descarta les definicions autoreferents**, les que expliquen la paraula amb
   una altra de la mateixa família (`sorneguerament: d'una manera sorneguera`,
   `empetitir: tornar o fer semblar més petit`, `insalubre: que no és salubre`).
   Qui les sent ja té la resposta.

```bash
node scripts/clean-dictionary.mjs --dry-run   # informe, sense escriure
node scripts/clean-dictionary.mjs             # aplica a ca + es
node scripts/clean-dictionary.mjs ca --report 40
```

És **idempotent**: tornar-lo a passar sobre un fitxer ja netejat no hi fa canvis.

### Com detecta l'autoreferència

Compara l'arrel de la paraula amb cada mot de la definició (sense accents, `ll`→`l`)
i la descarta si comparteixen un prefix prou llarg: ≥4 lletres que cobreixin ≥75%
del mot de la definició i ≥50% de la paraula, o bé que el continguin sencer
(`medicalitzar` ⊃ `mèdic`). També prova la paraula sense prefix derivatiu, perquè
la definició sol fer servir l'arrel nua (`empetitir` → `petit`).

Dos ajustos calibrats sobre els dos diccionaris, amb el perquè:

- **Preposicions excloses** (`entre`, `sobre`, `para`…): són prefixos de composició
  sense ser-ne l'arrel. Sense això perdíem paraules boníssimes com `entrepà`
  («menjar servit entre dos trossos de pa») o `paraigües`.
- **Arrels de veritat NO excloses** (`forma`, `general`, `cent`): aquestes sí que
  delaten `formal`, `generalitat` o `centenar`, i han de caure.

Retalla aproximadament un 31% del diccionari català i un 27% del castellà. El que
queda (≈14.900 ca / ≈36.450 es) és de sobres per jugar.

## `generate-icons.mjs` — Icones PWA

Genera les icones (192/512/apple-touch) des del favicon. `node scripts/generate-icons.mjs`.

## `check-supabase.mjs` — Verificació de Supabase

Comprova connexió + sessió anònima + lectura. `node scripts/check-supabase.mjs`.
