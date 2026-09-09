// Verifica la connexió amb Supabase via API REST (sense el client realtime,
// que requereix WebSocket natiu no disponible a Node < 22).
// Ús: node scripts/check-supabase.mjs
// Requereix .env.local amb VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY.
import { readFileSync } from 'node:fs'

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    console.error("✗ No s'ha trobat .env.local. Copia .env.example i omple les claus.")
    process.exit(1)
  }
}

loadEnv()
const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('✗ Falten VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY a .env.local')
  process.exit(1)
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

// 1) Sessió anònima — el mateix que fa supabase.auth.signInAnonymously()
console.log('→ Provant sessió anònima…')
const anon = await fetch(`${url}/auth/v1/signup`, { method: 'POST', headers, body: '{}' })
if (!anon.ok) {
  const body = await anon.text()
  console.error('✗ Sessió anònima ha fallat:', anon.status, body)
  console.error('  Comprova que has activat Authentication → Anonymous al panell.')
  process.exit(1)
}
const anonBody = await anon.json()
console.log('✓ Sessió anònima OK. user_id:', anonBody.user?.id ?? anonBody.id ?? '(creada)')

// 2) Lectura de la taula games
console.log('→ Provant lectura de la taula games…')
const read = await fetch(`${url}/rest/v1/games?select=id&limit=1`, { headers })
if (!read.ok) {
  const body = await read.text()
  console.error('✗ Lectura de games ha fallat:', read.status, body)
  console.error('  Has aplicat les migracions (0001, 0002)?')
  process.exit(1)
}
console.log('✓ Lectura de games OK.')

console.log('\n✅ Supabase configurat correctament.')
