const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('projects').select('id, name, slug').eq('slug', 'crm').single();
  console.log('Project:', data, error);
  if (data) {
    const { data: models, error: modelsError } = await supabase.from('models').select('id, name, db_table_name').eq('project_id', data.id);
    console.log('Models error:', modelsError);
    console.log('Models count:', models?.length);
    console.log('Models sample:', models?.slice(0, 2));
  }
}
run();
