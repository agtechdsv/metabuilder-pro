import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data } = await supabase.from('ui_views').select('layout_config').eq('slug', 'automations');
  console.log(JSON.stringify(data?.[0]?.layout_config?.nodes, null, 2));
}

run();
