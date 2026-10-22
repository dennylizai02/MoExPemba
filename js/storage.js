import { supabase } from './config.js';
import { withTimeout, isDbMissingError } from './utils.js';

const NET_TIMEOUT = 9000;
const CACHE_PREFIX = 'moex_offline:';
const LOCAL_PREFIX = 'moex_local:';

let schemaMissing = false;

export function isSchemaMissing() { return schemaMissing; }

function cacheKey(key, isAdmin) {
  return CACHE_PREFIX + key + (isAdmin ? ':admin' : ':user');
}

function cacheRead(key, isAdmin) {
  try {
    const v = localStorage.getItem(cacheKey(key, isAdmin));
    return v === null ? null : { value: v };
  } catch {
    return null;
  }
}

function cacheWrite(key, value, isAdmin) {
  try { localStorage.setItem(cacheKey(key, isAdmin), value); } catch { /* quota */ }
}

function localKey(key, isAdmin) {
  return LOCAL_PREFIX + key + (isAdmin ? ':admin' : ':user');
}

function localRead(key, isAdmin) {
  try { return localStorage.getItem(localKey(key, isAdmin)); } catch { return null; }
}

function localWrite(key, value, isAdmin) {
  try { localStorage.setItem(localKey(key, isAdmin), value); } catch { /* quota */ }
}

function localReadJson(key, fallback) {
  const raw = localRead(key, false);
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function localWriteJson(key, value) {
  try { localStorage.setItem(localKey(key, false), JSON.stringify(value)); } catch { /* quota */ }
}

function q(builder) {
  return withTimeout(builder, NET_TIMEOUT, 'Servidor indisponível');
}

function missingTableError() {
  const err = new Error('Tabela ausente no esquema');
  err.code = 'PGRST205';
  return err;
}

export const storage = {
  async get(key, isAdmin) {
    if (schemaMissing) {
      const local = localRead(key, isAdmin);
      if (local !== null) return { value: local };
      throw missingTableError();
    }
    try {
      const { data, error } = await q(
        supabase.from('app_data').select('value').eq('key', key).eq('is_admin', isAdmin).maybeSingle()
      );
      if (error) throw error;
      if (!data) return cacheRead(key, isAdmin);
      cacheWrite(key, data.value, isAdmin);
      return { value: data.value };
    } catch (e) {
      if (isDbMissingError(e)) {
        schemaMissing = true;
        const local = localRead(key, isAdmin);
        if (local !== null) return { value: local };
      }
      const cached = cacheRead(key, isAdmin);
      if (cached) return cached;
      throw e;
    }
  },
  async set(key, value, isAdmin) {
    if (schemaMissing) { localWrite(key, value, isAdmin); cacheWrite(key, value, isAdmin); return; }
    try {
      const { error } = await q(
        supabase.from('app_data').upsert(
          { key, value, is_admin: isAdmin, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      );
      if (error) throw error;
      cacheWrite(key, value, isAdmin);
    } catch (e) {
      cacheWrite(key, value, isAdmin);
      localWrite(key, value, isAdmin);
      if (isDbMissingError(e)) { schemaMissing = true; return; }
      throw e;
    }
  }
};

function applySizeColorFilter(query, size, color) {
  if (size == null) query = query.is('size', null);
  else query = query.eq('size', size);
  if (color == null) query = query.is('color', null);
  else query = query.eq('color', color);
  return query;
}

function mapOrder(r) {
  return {
    id: r.id,
    date: r.date || new Date(r.created_at || Date.now()).toLocaleString('pt-PT'),
    name: r.name,
    phone: r.phone,
    addr: r.addr,
    note: r.note,
    items: r.items,
    total: r.total,
    status: r.status,
    user_id: r.user_id
  };
}

function localOrders() {
  return localReadJson('orders', []);
}

export const orderStorage = {
  async loadAll() {
    if (schemaMissing) return localOrders();
    try {
      const { data, error } = await q(supabase.from('orders').select('*').order('created_at', { ascending: false }));
      if (error) throw error;
      const list = (data || []).map(mapOrder);
      cacheWrite('orders:all', JSON.stringify(list), true);
      localWriteJson('orders', list);
      return list;
    } catch (e) {
      if (isDbMissingError(e)) { schemaMissing = true; return localOrders(); }
      const cached = cacheRead('orders:all', true);
      if (cached) { try { return JSON.parse(cached.value); } catch { return []; } }
      throw e;
    }
  },

  async loadForUser(userId) {
    if (schemaMissing) return localOrders().filter(o => o.user_id === userId);
    try {
      const { data, error } = await q(supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }));
      if (error) throw error;
      const list = (data || []).map(mapOrder);
      cacheWrite('orders:user:' + userId, JSON.stringify(list), false);
      return list;
    } catch (e) {
      if (isDbMissingError(e)) { schemaMissing = true; return localOrders().filter(o => o.user_id === userId); }
      const cached = cacheRead('orders:user:' + userId, false);
      if (cached) { try { return JSON.parse(cached.value); } catch { return []; } }
      throw e;
    }
  },

  async create(order) {
    const payload = {
      user_id: order.user_id,
      name: order.name,
      phone: order.phone,
      addr: order.addr,
      note: order.note || '',
      items: order.items,
      total: order.total,
      status: order.status || 'novo'
    };
    if (!schemaMissing) {
      try {
        const { data, error } = await q(supabase.from('orders').insert(payload).select().single());
        if (error) throw error;
        return data;
      } catch (e) {
        if (!isDbMissingError(e)) throw e;
        schemaMissing = true;
      }
    }
    const row = { id: 'local-' + Date.now().toString(36), created_at: new Date().toISOString(), ...payload };
    const list = localOrders();
    list.unshift(row);
    localWriteJson('orders', list);
    return row;
  },

  async updateStatus(orderId, status) {
    if (!schemaMissing) {
      try {
        const { error } = await q(supabase.from('orders').update({ status }).eq('id', orderId));
        if (error) throw error;
        return;
      } catch (e) {
        if (!isDbMissingError(e)) throw e;
        schemaMissing = true;
      }
    }
    const list = localOrders().map(o => (String(o.id) === String(orderId) ? { ...o, status } : o));
    localWriteJson('orders', list);
  }
};

function localCart(userId) {
  return localReadJson('cart:' + userId, []);
}

export const cartStorage = {
  async load(userId) {
    if (!userId) return [];
    if (schemaMissing) return localCart(userId);
    try {
      const { data, error } = await q(supabase.from('carts').select('product_id, size, color, qty').eq('user_id', userId));
      if (error) throw error;
      const list = (data || []).map(r => ({
        key: r.product_id + '|' + (r.size || '') + '|' + (r.color || ''),
        id: r.product_id,
        qty: r.qty,
        size: r.size,
        color: r.color
      }));
      cacheWrite('cart:' + userId, JSON.stringify(list), false);
      localWriteJson('cart:' + userId, list);
      return list;
    } catch (e) {
      if (isDbMissingError(e)) { schemaMissing = true; return localCart(userId); }
      const cached = cacheRead('cart:' + userId, false);
      if (cached) { try { return JSON.parse(cached.value); } catch { return []; } }
      throw e;
    }
  },

  async save(userId, cart) {
    if (!userId) return;
    cacheWrite('cart:' + userId, JSON.stringify(cart), false);
    localWriteJson('cart:' + userId, cart);
    if (schemaMissing) return;
    const lines = cart.map(l => ({
      user_id: userId,
      product_id: l.id,
      size: l.size || null,
      color: l.color || null,
      qty: l.qty
    }));
    const existingKeys = new Set(cart.map(l => l.id + '|' + (l.size || '') + '|' + (l.color || '')));
    let existing = [];
    try {
      const res = await q(supabase.from('carts').select('product_id, size, color').eq('user_id', userId));
      if (res.error) throw res.error;
      existing = res.data || [];
    } catch (e) {
      if (isDbMissingError(e)) { schemaMissing = true; return; }
      throw e;
    }
    const toDelete = (existing || []).filter(r => {
      const k = r.product_id + '|' + (r.size || '') + '|' + (r.color || '');
      return !existingKeys.has(k);
    });
    for (const d of toDelete) {
      let query = supabase.from('carts').delete().eq('user_id', userId).eq('product_id', d.product_id);
      query = applySizeColorFilter(query, d.size, d.color);
      const { error } = await q(query);
      if (error) throw error;
    }
    if (lines.length > 0) {
      const { error } = await q(supabase.from('carts').upsert(lines, { onConflict: 'user_id,product_id,size,color' }));
      if (error) throw error;
    }
  },

  async addItem(userId, line) {
    if (!userId) return;
    if (!schemaMissing) {
      try {
        const { error } = await q(supabase.from('carts').upsert({
          user_id: userId,
          product_id: line.id,
          size: line.size || null,
          color: line.color || null,
          qty: line.qty
        }, { onConflict: 'user_id,product_id,size,color' }));
        if (error) throw error;
        return;
      } catch (e) {
        if (!isDbMissingError(e)) throw e;
        schemaMissing = true;
      }
    }
    const cart = localCart(userId);
    const key = line.id + '|' + (line.size || '') + '|' + (line.color || '');
    const found = cart.find(c => c.key === key);
    if (found) found.qty = line.qty;
    else cart.push({ key, id: line.id, qty: line.qty, size: line.size || '', color: line.color || '' });
    localWriteJson('cart:' + userId, cart);
  },

  async updateQty(userId, line) {
    if (!userId) return;
    if (!schemaMissing) {
      try {
        let query = supabase.from('carts').update({ qty: line.qty }).eq('user_id', userId).eq('product_id', line.id);
        query = applySizeColorFilter(query, line.size || null, line.color || null);
        const { error } = await q(query);
        if (error) throw error;
        return;
      } catch (e) {
        if (!isDbMissingError(e)) throw e;
        schemaMissing = true;
      }
    }
    const cart = localCart(userId);
    const key = line.id + '|' + (line.size || '') + '|' + (line.color || '');
    const found = cart.find(c => c.key === key);
    if (found) found.qty = line.qty;
    localWriteJson('cart:' + userId, cart);
  },

  async removeItem(userId, line) {
    if (!userId) return;
    if (!schemaMissing) {
      try {
        let query = supabase.from('carts').delete().eq('user_id', userId).eq('product_id', line.id);
        query = applySizeColorFilter(query, line.size || null, line.color || null);
        const { error } = await q(query);
        if (error) throw error;
        return;
      } catch (e) {
        if (!isDbMissingError(e)) throw e;
        schemaMissing = true;
      }
    }
    const key = line.id + '|' + (line.size || '') + '|' + (line.color || '');
    const cart = localCart(userId).filter(c => c.key !== key);
    localWriteJson('cart:' + userId, cart);
  },

  async clear(userId) {
    if (!userId) return;
    if (!schemaMissing) {
      try {
        const { error } = await q(supabase.from('carts').delete().eq('user_id', userId));
        if (error) throw error;
        return;
      } catch (e) {
        if (!isDbMissingError(e)) throw e;
        schemaMissing = true;
      }
    }
    localWriteJson('cart:' + userId, []);
  }
};
