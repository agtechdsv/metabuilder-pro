const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'ui_views' })
  if (error) {
    // Fallback search in columns
    const { data: cols, error: err2 } = await supabase
      .from('ui_views')
      .select('*')
      .limit(1)
    
    if (cols && cols.length > 0) {
      console.log('Columns found:', Object.keys(cols[0]))
    } else {
       console.log('Table might be empty or error:', err2)
    }
  } else {
    console.log('Columns:', data)
  }
}

checkColumns()
