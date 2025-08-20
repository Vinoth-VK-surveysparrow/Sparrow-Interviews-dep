import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

export const createClient = () => createClientComponentClient()

// Create a singleton instance of the Supabase client for Client Components
export const supabase = createClientComponentClient()

// Database types
export interface User {
  id: string
  email: string
  full_name?: string
  created_at: string
  updated_at: string
}

export interface GameSession {
  id: string
  user_id: string
  game_type: "rapid_fire" | "conductor" | "triple_step"
  difficulty_level: number
  session_data: Record<string, any>
  audio_url?: string
  transcript?: string
  ai_analysis: Record<string, any>
  performance_scores: Record<string, any>
  completed_at?: string
  created_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  game_type: "rapid_fire" | "conductor" | "triple_step"
  total_sessions: number
  best_score: number
  average_score: number
  current_streak: number
  longest_streak: number
  skill_levels: Record<string, any>
  achievements: string[]
  updated_at: string
}

export interface VoiceBaseline {
  id: string
  user_id: string
  baseline_data: Record<string, any>
  confidence_level: number
  energy_range: Record<string, any>
  speech_patterns: Record<string, any>
  created_at: string
  updated_at: string
}
