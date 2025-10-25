import { createClient } from '@supabase/supabase-js'
import { capacitorStorageAdapter } from './capacitor-storage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and/or Anon Key are missing. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: capacitorStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})