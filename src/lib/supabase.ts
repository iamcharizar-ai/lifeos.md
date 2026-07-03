// Supabase client, env-gated: without VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
// in .env.local the client is null and the app runs pure-local (v0.3 behavior).
// Schema lives in supabase/schema.sql — run it once in the SQL editor.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
// Dev kill-switch: VITE_SUPABASE_DISABLE=1 forces pure-local mode even when
// .env.local has real keys — agent/browser test runs can never touch the
// prod ledger. (PowerShell can't blank a var: $env:X='' deletes it and Vite
// falls back to .env.local, which is how a "sandboxed" run once came up live.)
const disabled = import.meta.env.VITE_SUPABASE_DISABLE === '1'

export const supabase: SupabaseClient | null =
  !disabled && url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: false } })
    : null
