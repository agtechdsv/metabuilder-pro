require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const sql = `
    CREATE POLICY "Allow anonymous read if user_id is zero" ON public.download_jobs
    FOR SELECT USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);
    
    CREATE POLICY "Allow anonymous delete if user_id is zero" ON public.download_jobs
    FOR DELETE USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);
  `;
  const { error } = await supabase.rpc('execute_sql', { sql });
  if (error) console.error(error);
  else console.log('Policies added');
}
run();
