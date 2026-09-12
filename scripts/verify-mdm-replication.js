const fs = require('fs');
const path = require('path');
const envLocal = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envLocal.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...value] = line.split('=');
    if (key) env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  const mdmId = 'ee840323-6f9f-42bd-a651-75e1a911c40e';

  const { data: views } = await supabase.from('ui_views').select('id, name, slug, logic_type, model_id').eq('project_id', mdmId);
  console.log(`✓ MDM possui ${views.length} UI Views.`);

  const { data: comps } = await supabase.from('ui_components').select('id, view_id, field_id').in('view_id', views.map(v => v.id));
  console.log(`✓ MDM possui ${comps.length} UI Components vinculados.`);

  const { data: byoc } = await supabase.from('ui_custom_components').select('name').eq('project_id', mdmId);
  console.log(`✓ MDM possui ${byoc.length} BYOC:`, byoc.map(b => b.name));

  const { data: enums } = await supabase.from('project_enumerations').select('name').eq('project_id', mdmId);
  console.log(`✓ MDM possui ${enums.length} Enumerations:`, enums.map(e => e.name));

  const { data: proj } = await supabase.from('projects').select('navigation').eq('id', mdmId).single();
  console.log(`✓ MDM possui ${proj.navigation?.length || 0} itens de Navegação no menu.`);

  // Testar se algum component aponta para field de outro projeto
  const { data: mdmModels } = await supabase.from('models').select('id, fields(id)').eq('project_id', mdmId);
  const mdmFieldIds = new Set(mdmModels.flatMap(m => m.fields.map(f => f.id)));

  let foreignFields = 0;
  for (const c of comps) {
    if (!mdmFieldIds.has(c.field_id)) {
      foreignFields++;
    }
  }
  console.log(`✓ Verificação de integridade referencial dos campos: ${foreignFields === 0 ? 'PERFEITA (0 campos externos)' : foreignFields + ' campos errados!'}`);
}

verify().catch(console.error);
