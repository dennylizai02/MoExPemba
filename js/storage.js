import { supabase } from './config.js';

export const storage = {
  async get(key, isAdmin) {
    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .eq('is_admin', isAdmin)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { value: data.value };
  },
  async set(key, value, isAdmin) {
    const { error } = await supabase
      .from('app_data')
      .upsert({ key, value, is_admin: isAdmin, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  }
};

export const cartStorage = {
  async load(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('carts')
      .select('product_id, size, color, qty')
      .eq('user_id', userId);
    if (error) throw error;
    if (!data) return [];
    return data.map(r => ({
      key: r.product_id + '|' + (r.size || '') + '|' + (r.color || ''),
      id: r.product_id,
      qty: r.qty,
      size: r.size,
      color: r.color
    }));
  },

  async save(userId, cart) {
    if (!userId) return;
    const lines = cart.map(l => ({
      user_id: userId,
      product_id: l.id,
      size: l.size || null,
      color: l.color || null,
      qty: l.qty
    }));
    const existingIds = new Set(cart.map(l => l.id + '|' + (l.size || '') + '|' + (l.color || '')));
    const { data: existing, error: fetchErr } = await supabase
      .from('carts')
      .select('product_id, size, color')
      .eq('user_id', userId);
    if (fetchErr) throw fetchErr;
    const toDelete = (existing || []).filter(r => {
      const k = r.product_id + '|' + (r.size || '') + '|' + (r.color || '');
      return !existingIds.has(k);
    });
    for (const d of toDelete) {
      const { error } = await supabase.from('carts')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', d.product_id)
        .eq('size', d.size || '')
        .eq('color', d.color || '');
      if (error) throw error;
    }
    if (lines.length > 0) {
      const { error } = await supabase.from('carts').upsert(lines, { onConflict: 'user_id,product_id,size,color' });
      if (error) throw error;
    }
  },

  async addItem(userId, line) {
    if (!userId) return;
    const { error } = await supabase.from('carts').upsert({
      user_id: userId,
      product_id: line.id,
      size: line.size || null,
      color: line.color || null,
      qty: line.qty
    }, { onConflict: 'user_id,product_id,size,color' });
    if (error) throw error;
  },

  async updateQty(userId, line) {
    if (!userId) return;
    const { error } = await supabase.from('carts')
      .update({ qty: line.qty })
      .eq('user_id', userId)
      .eq('product_id', line.id)
      .eq('size', line.size || '')
      .eq('color', line.color || '');
    if (error) throw error;
  },

  async removeItem(userId, line) {
    if (!userId) return;
    const { error } = await supabase.from('carts')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', line.id)
      .eq('size', line.size || '')
      .eq('color', line.color || '');
    if (error) throw error;
  },

  async clear(userId) {
    if (!userId) return;
    const { error } = await supabase.from('carts').delete().eq('user_id', userId);
    if (error) throw error;
  }
};
