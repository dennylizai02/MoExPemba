export const WHATSAPP_NUMBER = "258857085581";
export const FREE_DELIVERY_THRESHOLD = 1500;
export const PRODUCT_IMAGE_BUCKET = "product-images";

const SUPABASE_URL = "__SUPABASE_URL__";
const SUPABASE_ANON_KEY = "__SUPABASE_ANON_KEY__";

const { createClient } = window.supabase;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
