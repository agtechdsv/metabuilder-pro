const { createTunnelSupabaseClient } = require('./src/components/runtime/TunnelSupabaseProxy.ts');
const { createClient } = require('@supabase/supabase-js');

// Mock tunnel
const tunnelChannel = {
  send: (payload) => console.log('TUNNEL SEND:', payload)
};

const supabase = createClient('https://mock.supabase.co', 'mock-key');

const proxy = createTunnelSupabaseClient(tunnelChannel, supabase);

proxy.from('produtos').select('*').then(res => console.log('Proxy res:', res));
