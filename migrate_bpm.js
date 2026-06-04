const fs = require('fs')
const envContent = fs.readFileSync('.env.local', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key.trim()] = rest.join('=').trim()
})

const { Client } = require('pg')

async function migrate() {
  const client = new Client({
    connectionString: env.DATABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgresql://postgres:'+env.SUPABASE_SERVICE_ROLE_KEY+'@')
  })
  
  await client.connect()
  try {
    await client.query(`
      ALTER TABLE bpm_workflows ADD COLUMN IF NOT EXISTS draft_flow_data JSONB;
    `)
    console.log("Migration successful!")
  } catch (err) {
    console.error("Migration failed:", err)
  } finally {
    await client.end()
  }
}

migrate()
