// supabase.js - centralized Supabase client
const supabase = window.supabase.createClient(
  window.__ENV.SUPABASE_URL,
  window.__ENV.SUPABASE_ANON_KEY,
);

// Export for use in other modules
window.supabaseClient = supabase;
