import { supabase } from './supabase-init.js';
export async function requireAuth(){
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user){ location.href = new URL('login.html', location.origin + location.pathname).href; throw new Error('redirect'); }
  return user;
}
