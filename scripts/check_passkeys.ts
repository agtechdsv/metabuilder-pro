import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials')
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  const { data, error } = await supabaseAdmin
    .from('passkey_credentials')
    .select('credential_id, user_id')

  if (error) {
    console.error('Error:', error)
    return
  }

  const counts: Record<string, number> = {}
  data.forEach(row => {
    counts[row.credential_id] = (counts[row.credential_id] || 0) + 1
  })

  console.log('Credenciais no banco:')
  for (const [id, count] of Object.entries(counts)) {
    console.log(`${id}: ${count} ocorrências`)
  }
}

run().catch(console.error)
