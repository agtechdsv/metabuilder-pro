const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: workspaces, error: wsError } = await supabase.from('workspaces').select('id, name').limit(1);
  if (wsError) {
    console.error('Error fetching workspaces:', wsError);
    return;
  }
  if (!workspaces || workspaces.length === 0) {
    console.log('No workspaces found.');
    return;
  }
  const workspaceId = workspaces[0].id;
  console.log('Using workspace:', workspaces[0].name, '(', workspaceId, ')');

  // Try insert with is_active
  console.log('Attempting insert with is_active: true...');
  const { data: insData, error: insError } = await supabase.from('projects').insert({
    name: 'Test Project',
    slug: 'test-project-' + Math.random().toString(36).substring(7),
    description: 'Test description',
    icon: 'Box',
    workspace_id: workspaceId,
    is_active: true
  }).select();

  if (insError) {
    console.log('Insertion failed:', insError);
  } else {
    console.log('Insertion succeeded!', insData);
    // clean up
    await supabase.from('projects').delete().eq('id', insData[0].id);
  }
}

test();
