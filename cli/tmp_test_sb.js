const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('`https://vwbqsahfqvtmqjgafiyu.supabase.co`', 'process.env.SUPABASE_KEY'); // we can just use the actual supabase from env
require('dotenv').config({ path: '../.env.local' });
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await sb.from('models').select('db_table_name, project_id').ilice('db_table_name', '%empresa%');
  console.log(data, error);
}
main();