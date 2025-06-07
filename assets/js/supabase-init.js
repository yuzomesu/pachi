import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export const supabase = createClient(
  '__SUPABASE_URL__',
  '__SUPABASE_ANON__'
);
