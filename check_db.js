import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: view, error: err } = await supabase
    .from('ui_views')
    .select('id, slug, layout_config, draft_config')
    .eq('slug', 'clientes')
    .limit(1)
    .single()

  console.log('VIEW:', JSON.stringify(view, null, 2))

  if (view) {
    const { data: comps, error: err2 } = await supabase
      .from('ui_components')
      .select('*')
      .eq('view_id', view.id)

    console.log('COMPONENTS:', comps?.length)
  }
}

run()
