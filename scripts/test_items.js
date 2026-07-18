const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envLocal.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...value] = line.split('=');
    if (key) {
      env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('itens_pedido').select('*, produtos(*)').limit(1);
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}
run();
