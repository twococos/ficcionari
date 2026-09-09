// Tipus del model de dades de Ficcionari.
// Escrits a mà per ara; més endavant es poden regenerar amb
// `supabase gen types typescript` un cop el projecte estigui vinculat.

export type GameStatus = 'lobby' | 'in_round' | 'round_results' | 'finished'

export type RoundPhase =
  | 'narrator_picking_word'
  | 'announcing_word'
  | 'writing_definitions'
  | 'narrator_reading'
  | 'voting_real'
  | 'voting_funny'
  | 'reveal'

export type VoteType = 'real' | 'funny'

export interface Game {
  id: string
  code: string
  host_player_id: string | null
  language: string
  total_rounds: number
  score_funny_enabled: boolean
  // Punts configurables per partida (default 1/1/1).
  score_guess_real: number
  score_deceived: number
  score_funniest: number
  // Si el narrador veu la definició del diccionari mentre tria paraula.
  show_definition_on_pick: boolean
  status: GameStatus
  current_round: number
  created_at: string
}

export interface Player {
  id: string
  game_id: string
  device_id: string
  auth_user_id: string | null
  nickname: string
  score: number
  is_host: boolean
  is_connected: boolean
  joined_at: string
}

export interface Round {
  id: string
  game_id: string
  round_number: number
  narrator_player_id: string | null
  word: string | null
  real_definition: string | null
  phase: RoundPhase
  scored: boolean
  created_at: string
}

export interface Definition {
  id: string
  round_id: string
  author_player_id: string | null
  text: string
  is_real: boolean
  created_at: string
}

export interface Vote {
  id: string
  round_id: string
  voter_player_id: string
  definition_id: string
  vote_type: VoteType
  created_at: string
}

// Estructura que espera el client de Supabase per tipar les taules.
// Cal definir Row/Insert/Update de forma explícita (no genèrica) perquè la
// inferència de supabase-js resolgui bé els tipus d'insert/update.
export interface Database {
  public: {
    Tables: {
      games: {
        Row: Game
        Insert: Partial<Game> & Pick<Game, 'code'>
        Update: Partial<Game>
        Relationships: []
      }
      players: {
        Row: Player
        Insert: Partial<Player> & Pick<Player, 'game_id' | 'device_id' | 'nickname'>
        Update: Partial<Player>
        Relationships: []
      }
      rounds: {
        Row: Round
        Insert: Partial<Round> & Pick<Round, 'game_id' | 'round_number'>
        Update: Partial<Round>
        Relationships: []
      }
      definitions: {
        Row: Definition
        Insert: Partial<Definition> & Pick<Definition, 'round_id' | 'text'>
        Update: Partial<Definition>
        Relationships: []
      }
      votes: {
        Row: Vote
        Insert: Partial<Vote> & Pick<Vote, 'round_id' | 'voter_player_id' | 'definition_id'>
        Update: Partial<Vote>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      increment_player_score: {
        Args: { p_player_id: string; p_delta: number }
        Returns: void
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
