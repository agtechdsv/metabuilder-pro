require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('ui_views').select('id, name, logic_type').eq('logic_type', 'personalizado').limit(1).single().then(async ({data: view}) => {
  if (view) {
    const { data: comps } = await supabase.from('ui_components').select('*').eq('view_id', view.id);
    console.log('View:', view);
    console.log('Components count:', comps ? comps.length : 0);
  } else {
    console.log('No personalizado view found');
  }
});
