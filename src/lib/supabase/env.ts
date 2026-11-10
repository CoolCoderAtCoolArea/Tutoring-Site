/** True when the Supabase keys are set. Before setup, the public site still works with sample content. */
export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL as string;
}

export function supabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
}
