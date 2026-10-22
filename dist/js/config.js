export const WHATSAPP_NUMBER = "258857085581";
export const FREE_DELIVERY_THRESHOLD = 1500;
export const PRODUCT_IMAGE_BUCKET = "product-images";

const SUPABASE_URL = "https://zhtiplewwerabqbkeahe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpodGlwbGV3d2VyYWJxYmtlYWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzgxOTEsImV4cCI6MjA5MDA1NDE5MX0.69w9OFPjsW9Af5JP3YW4dXwQhTl5qxHA1HuhNk1e6HI";

const { createClient } = window.supabase;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
