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

export const cartStorage = {
  async load(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('carts')
      .select('product_id, size, color, qty')
      .eq('user_id', userId);
    if (error || !data) return [];
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
    await supabase.from('carts').delete().eq('user_id', userId);
    if (lines.length > 0) {
      const { error } = await supabase.from('carts').insert(lines);
      if (error) console.error('Cart save error:', error);
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
    if (error) console.error('Cart add error:', error);
  },

  async updateQty(userId, line) {
    if (!userId) return;
    const { error } = await supabase.from('carts')
      .update({ qty: line.qty })
      .eq('user_id', userId)
      .eq('product_id', line.id)
      .eq('size', line.size || '')
      .eq('color', line.color || '');
    if (error) console.error('Cart update error:', error);
  },

  async removeItem(userId, line) {
    if (!userId) return;
    const { error } = await supabase.from('carts')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', line.id)
      .eq('size', line.size || '')
      .eq('color', line.color || '');
    if (error) console.error('Cart remove error:', error);
  },

  async clear(userId) {
    if (!userId) return;
    await supabase.from('carts').delete().eq('user_id', userId);
  }
};
