export const WHATSAPP_NUMBER = "258857085581";

const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

const { createClient } = window.supabase;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
