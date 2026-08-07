const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

fetch(supabaseUrl + '/rest/v1/projects?slug=eq.crm&select=id', {
  headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey }
})
.then(res => res.json())
.then(data => {
  const projectId = data[0].id;
  return fetch(supabaseUrl + '/rest/v1/ui_views?project_id=eq.' + projectId + '&slug=eq.clientes&select=ui_components(label,order_index,is_visible,config,field:fields(*))', {
    headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey }
  });
})
.then(res => res.json())
.then(views => {
  const allComponents = views[0].ui_components || [];
  const displayFields = allComponents.filter(c => {
    const p1 = c.is_visible !== false;
    const p2 = (c.config?.zones?.includes('grid') || !c.config?.zones);
    const p3 = c.field?.is_visible_in_list !== false;
    console.log((c.field ? c.field.db_column_name : 'null'), 'p1:', p1, 'p2:', p2, 'p3:', p3, 'field:', !!c.field);
    return p1 && p2 && p3;
  });
  console.log('Final count:', displayFields.length);
})
.catch(console.error);
