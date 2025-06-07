import { supabase } from './supabase-init.js';
export async function requireAuth(){
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user){ location.href = '../login.html'; throw new Error('redirect'); }
  return user;
}
