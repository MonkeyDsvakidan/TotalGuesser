import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Ohne .env läuft das Frontend trotzdem, zeigt aber keine Daten
export const supabase = url && key ? createClient(url, key) : null
