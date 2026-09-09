# Supabase — Ficcionari

Backend del joc: Postgres + Realtime + Auth anònima.

## 1. Crear el projecte

1. Vés a [supabase.com](https://supabase.com) → **New project** (free tier).
2. Nom: `ficcionari`. Regió: la més propera (p.ex. *West EU (Frankfurt)*).
3. Guarda la contrasenya de la base de dades (no cal per al frontend).

## 2. Obtenir les claus

**Project Settings → API**:

- **Project URL** → `VITE_SUPABASE_URL`
- **Project API keys → anon / public** → `VITE_SUPABASE_ANON_KEY`

Copia-les a `.env.local` a l'arrel del projecte (pots partir de `.env.example`):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 3. Activar l'autenticació anònima

**Authentication → Sign In / Providers → Anonymous** → activa-ho.
(Sense això, `signInAnonymously()` fallarà.)

## 4. Aplicar les migracions

Opció A — **SQL Editor** (ràpid, recomanat per començar):
Obre **SQL Editor** al panell de Supabase i executa, en aquest ordre, el contingut de:

1. `migrations/0001_initial_schema.sql`
2. `migrations/0002_rls_policies.sql`

Opció B — **Supabase CLI** (si el tens instal·lat):

```bash
supabase link --project-ref <ref>
supabase db push
```

## 5. Verificar

Amb `.env.local` omplert, executa:

```bash
node scripts/check-supabase.mjs
```

Ha de dir que la connexió, la sessió anònima i la lectura de `games` funcionen.

## Notes

- Les polítiques RLS de la Fase 1 són permissives a propòsit (joc entre amics, sense
  comptes). La protecció anti-trampes forta es fa a la Fase 4 amb Edge Functions.
- Realtime ja queda activat a `0001_initial_schema.sql` (les taules s'afegeixen a
  la publicació `supabase_realtime`).
