import { supabase } from './config.js';

export const storage = {
  async get(key, isAdmin) {
    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .eq('is_admin', isAdmin)
      .maybeSingle();
    if (error || !data) return null;
    return { value: data.value };
  },
  async set(key, value, isAdmin) {
    const { error } = await supabase
      .from('app_data')
      .upsert({ key, value, is_admin: isAdmin }, { onConflict: 'key' });
    if (error) console.error('Supabase error:', error);
  }
};
