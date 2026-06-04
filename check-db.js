const fs = require('fs')
const envContent = fs.readFileSync('.env.local', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key.trim()] = rest.join('=').trim()
})

const { Client } = require('pg')

async function check() {
  const client = new Client({
    connectionString: env.DATABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgresql://postgres:'+env.SUPABASE_SERVICE_ROLE_KEY+'@')
  })
  await client.connect()
  const { rows } = await client.query(`
    SELECT
      tc.table_schema, 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='project_role_permissions';
  `)
  console.log(rows)
  await client.end()
}

check()
