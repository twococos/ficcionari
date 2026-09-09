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

## `generate-icons.mjs` — Icones PWA

Genera les icones (192/512/apple-touch) des del favicon. `node scripts/generate-icons.mjs`.

## `check-supabase.mjs` — Verificació de Supabase

Comprova connexió + sessió anònima + lectura. `node scripts/check-supabase.mjs`.
