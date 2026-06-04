import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: project } = await supabase.from('projects').select('id, slug').eq('slug', 'erp').single()
  console.log("Project ID:", project?.id)

  const { data: authConfig } = await supabase.from('project_auth_config').select('*').eq('project_id', project?.id).single()
  console.log("Auth Config:", JSON.stringify(authConfig, null, 2))

}

run().catch(console.error)
