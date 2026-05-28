const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env variables
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Has service key:", !!serviceKey);
console.log("Has anon key:", !!anonKey);

const supabaseAdmin = createClient(supabaseUrl, serviceKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function run() {
  console.log("\n--- Checking community_posts table count (Admin) ---");
  const { data: adminPosts, error: adminErr, count } = await supabaseAdmin
    .from('community_posts')
    .select('*', { count: 'exact' });

  if (adminErr) {
    console.error("Admin select error:", adminErr);
  } else {
    console.log("Admin posts count:", count);
    console.log("Admin posts:", adminPosts);
  }

  console.log("\n--- Checking community_posts table count (Anon) ---");
  const { data: anonPosts, error: anonErr } = await supabaseAnon
    .from('community_posts')
    .select('*');

  if (anonErr) {
    console.error("Anon select error:", anonErr);
  } else {
    console.log("Anon posts found:", anonPosts ? anonPosts.length : 0);
  }

  console.log("\n--- Batch lookup of profiles for unique user_ids ---");
  if (adminPosts && adminPosts.length > 0) {
    const userIds = [...new Set(adminPosts.map(p => p.user_id))];
    console.log("User IDs to lookup:", userIds);
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    if (profErr) {
      console.error("Profiles fetch error:", profErr);
    } else {
      console.log("Profiles found:", profiles);
    }
  }
}

run();
