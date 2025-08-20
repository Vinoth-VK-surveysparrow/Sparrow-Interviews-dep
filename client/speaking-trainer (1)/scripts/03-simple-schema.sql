-- Creating simple schema without foreign key constraints
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_progress CASCADE;
DROP TABLE IF EXISTS voice_baselines CASCADE;

-- Simple game sessions table - no foreign keys, no complications
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL,
  session_data JSONB,
  audio_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS but make it permissive for anonymous users
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations" ON game_sessions FOR ALL USING (true);
