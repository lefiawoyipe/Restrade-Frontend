import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(url: string) {
  return url.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Export the connected client for use across the application
export const supabase = createClient(normalizeSupabaseUrl(supabaseUrl), supabaseAnonKey);