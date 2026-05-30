const { Client } = require('pg');

const dbConnectionString = "postgresql://postgres.chmstvtepzmjhpyxjjam:Goeta815617%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  
  try {
    await client.connect();
    console.log('Connected.');

    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.conrelid = 'ui_views'::regclass;
    `);

    console.log('ui_views constraints:');
    console.log(res.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
