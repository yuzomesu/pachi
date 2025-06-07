import { supabase } from '/assets/js/supabase-init.js';
const user = (await supabase.auth.getUser()).data.user;
if(!user) location.href = '/login.html';
