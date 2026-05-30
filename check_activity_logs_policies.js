const { Client } = require('pg');

const dbConnectionString = "postgresql://postgres.chmstvtepzmjhpyxjjam:Goeta815617%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL.');

    const res = await client.query(`
      SELECT policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'activity_logs' AND schemaname = 'public';
    `);

    console.log('Current RLS policies on public.activity_logs:');
    console.log(JSON.stringify(res.rows, null, 2));

    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'activity_logs' AND table_schema = 'public';
    `);
    console.log('activity_logs columns:');
    console.log(cols.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
