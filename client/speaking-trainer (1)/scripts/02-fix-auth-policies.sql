-- Add policies for anonymous users and fix RLS issues
-- Allow anonymous users to create sessions
CREATE POLICY "Allow anonymous game sessions" ON public.game_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous session updates" ON public.game_sessions
  FOR UPDATE USING (true);

-- Allow anonymous progress tracking
CREATE POLICY "Allow anonymous progress" ON public.user_progress
  FOR ALL USING (true);

-- Create users automatically when needed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
