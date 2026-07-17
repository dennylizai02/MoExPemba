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

function applySizeColorFilter(query, size, color) {
  if (size == null) query = query.is('size', null);
  else query = query.eq('size', size);
  if (color == null) query = query.is('color', null);
  else query = query.eq('color', color);
  return query;
}

export const orderStorage = {
  async loadAll() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      date: new Date(r.created_at).toLocaleString('pt-PT'),
      name: r.name,
      phone: r.phone,
      addr: r.addr,
      note: r.note,
      items: r.items,
      total: r.total,
      status: r.status,
      user_id: r.user_id
    }));
  },

  async create(order) {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: order.user_id,
        name: order.name,
        phone: order.phone,
        addr: order.addr,
        note: order.note || '',
        items: order.items,
        total: order.total,
        status: order.status || 'novo'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStatus(orderId, status) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
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
    const existingKeys = new Set(cart.map(l => l.id + '|' + (l.size || '') + '|' + (l.color || '')));
    const { data: existing, error: fetchErr } = await supabase
      .from('carts')
      .select('product_id, size, color')
      .eq('user_id', userId);
    if (fetchErr) throw fetchErr;
    const toDelete = (existing || []).filter(r => {
      const k = r.product_id + '|' + (r.size || '') + '|' + (r.color || '');
      return !existingKeys.has(k);
    });
    for (const d of toDelete) {
      let q = supabase.from('carts').delete().eq('user_id', userId).eq('product_id', d.product_id);
      q = applySizeColorFilter(q, d.size, d.color);
      const { error } = await q;
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
    let q = supabase.from('carts')
      .update({ qty: line.qty })
      .eq('user_id', userId)
      .eq('product_id', line.id);
    q = applySizeColorFilter(q, line.size || null, line.color || null);
    const { error } = await q;
    if (error) throw error;
  },

  async removeItem(userId, line) {
    if (!userId) return;
    let q = supabase.from('carts')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', line.id);
    q = applySizeColorFilter(q, line.size || null, line.color || null);
    const { error } = await q;
    if (error) throw error;
  },

  async clear(userId) {
    if (!userId) return;
    const { error } = await supabase.from('carts').delete().eq('user_id', userId);
    if (error) throw error;
  }
};
