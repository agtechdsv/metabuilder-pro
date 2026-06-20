import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'agtechtrade@gmail.com',
    options: {
      redirectTo: 'https://metabuilderpro.com/auth/callback'
    }
  })
  
  console.log('Error:', error)
  console.log('Action Link:', data?.properties?.action_link)
}

run()
