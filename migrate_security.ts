import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const { data: workspaces } = await supabase.from('workspaces').select('*').limit(1)
  console.log('Workspaces:', Object.keys(workspaces?.[0] || {}))

  const { data: projects } = await supabase.from('projects').select('*').limit(1)
  console.log('Projects:', Object.keys(projects?.[0] || {}))
}

run()
