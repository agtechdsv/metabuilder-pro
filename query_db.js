const fs = require('fs'); 
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').forEach(line => { 
  const [k, v] = line.split('='); 
  if(k && v) process.env[k.trim()] = v.trim(); 
}); 
const { createClient } = require('@supabase/supabase-js'); 
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); 
supabase.from('profiles').select('id, email, is_super_admin').then(res => { 
  console.log('PROFILES:', res.data); 
  return supabase.from('workspaces').select('id, name, owner_id'); 
}).then(res => console.log('WORKSPACES:', res.data));
