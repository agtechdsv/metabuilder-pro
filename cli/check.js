const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('models')
    .select('db_table_name')
    .eq('project_id', 'f9a5f29d-a19b-4778-9778-fed7e7bcbcaa');
    
  if (error) console.error(error);
  console.log('Modelos no banco:', data);
}

check();
