import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://myunepevhyszscqtyvro.supabase.co',
  'SUA_PUBLISHABLE_KEY_AQUI'
);

export default supabase;
