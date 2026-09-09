import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // No llancem error dur per no trencar la UI durant el desenvolupament sense claus;
  // avisem per consola. Les crides a Supabase fallaran fins que s'omplin les claus a .env.local.
  console.warn(
    '[Ficcionari] Falten VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env.local i omple les claus del teu projecte Supabase.'
  )
}

// Anotem explícitament el tipus del client: en aquesta versió de supabase-js,
// createClient<Database>() no propaga sempre el generic al tipus de retorn.
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Garanteix una sessió anònima de Supabase (sense comptes).
 * Retorna l'user_id anònim, estable per aquest dispositiu/navegador.
 * Propaga el token al canal de Realtime perquè les subscripcions a
 * postgres_changes respectin RLS correctament.
 */
export async function ensureAnonymousSession(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user) {
    supabase.realtime.setAuth(data.session.access_token)
    return data.session.user.id
  }
  const { data: signInData, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  if (signInData.session) {
    supabase.realtime.setAuth(signInData.session.access_token)
  }
  return signInData.user!.id
}
