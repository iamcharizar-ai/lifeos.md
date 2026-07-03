// Supabase client, env-gated: without VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
// in .env.local the client is null and the app runs pure-local (v0.3 behavior).
// Schema lives in supabase/schema.sql — run it once in the SQL editor.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null
