import { createTunnelSupabaseClient } from './src/components/runtime/TunnelSupabaseProxy';
import { createClient } from '@supabase/supabase-js';

const tunnelChannel = {
  on: () => {},
  send: (payload: any) => console.log('TUNNEL SEND:', payload)
};

const supabase = createClient('https://mock.supabase.co', 'mock-key');
const proxy = createTunnelSupabaseClient(tunnelChannel, supabase);

proxy.from('produtos').select('*').then((res: any) => console.log('Proxy res:', res));
