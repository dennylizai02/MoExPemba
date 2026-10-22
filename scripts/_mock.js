const PROJECT = 'zhtiplewwerabqbkeahe';
const API = `https://${PROJECT}.supabase.co`;

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Capulana estampada', price: 450, category: 'Roupa', img: 'https://picsum.photos/seed/capulana/400/500', images: [], desc: 'Capulana colorida, ideal para o calor de Pemba.', material: 'Algodão', entrega: '3 a 4 dias', badge: 'Novo', sold: 12, sizes: ['Único'], colors: ['Azul', 'Vermelho'], reviews: [{ name: 'Amélia', rating: 5, comment: 'Muito bonita.', date: '01/07/2026' }], created_by: 'user-seller-1' },
  { id: 'p2', name: 'Sandálias de couro', price: 850, category: 'Calçado', img: 'https://picsum.photos/seed/sandalias/400/500', images: [], desc: 'Sandálias em couro curtido.', material: 'Couro', entrega: '4 a 5 dias', badge: 'Destaque', sold: 27, sizes: ['38', '39'], colors: ['Castanho'], reviews: [], created_by: 'user-seller-1' },
  { id: 'p3', name: 'Cesto de palha', price: 300, category: 'Artesanato', img: 'https://picsum.photos/seed/cesto/400/500', images: [], desc: 'Cesto feito à mão.', material: 'Palha', entrega: '2 dias', badge: '', sold: 5, sizes: [], colors: [], reviews: [], created_by: 'user-seller-1' }
];

const USERS = {
  seller: { id: 'user-seller-1', name: 'Ana Vendedora', phone: '849999000', email: 'vendedor@moex.mz', role: 'seller' },
  admin: { id: 'user-admin-1', name: 'Loja Admin', phone: '849999111', email: 'admin@moex.mz', role: 'admin' },
  user: { id: 'user-client-1', name: 'Cliente Comum', phone: '849999222', email: 'cliente@moex.mz', role: 'user' }
};

function sessionFor(user) {
  return {
    access_token: 'mock-access-token', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'mock-refresh-token',
    user: {
      id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, phone: user.phone,
      app_metadata: { role: user.role }, user_metadata: { name: user.name, phone: user.phone },
      created_at: new Date().toISOString()
    }
  };
}

async function installMock(context, user, state = {}) {
  if (user) {
    await context.addInitScript(([key, raw]) => {
      try { localStorage.setItem(key, raw); } catch (e) {}
    }, [`sb-${PROJECT}-auth-token`, JSON.stringify(sessionFor(user))]);
  }

  await context.route(`${API}/**`, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body, status = 200) => route.fulfill({
      status, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body)
    });

    if (path.includes('/auth/v1/token')) return json(sessionFor(user));
    if (path.includes('/auth/v1/user')) return json(sessionFor(user).user);
    if (path.includes('/auth/v1/logout')) return json({});
    if (path.includes('/auth/v1/signup')) {
      return json({ id: 'new-user', email: 'novo@moex.mz', confirmation_sent_at: new Date().toISOString() });
    }
    if (path.includes('/rest/v1/profiles')) {
      if (method === 'GET') {
        const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
        const list = Object.values(USERS).map(u => ({ ...u, created_at: new Date().toISOString() }));
        return json(id ? list.filter(p => p.id === id) : list);
      }
      if (method === 'POST') return json([USERS[user ? user.role : 'user']]);
      if (method === 'PATCH') return json([{ ...USERS[user ? user.role : 'user'], ...(route.request().postDataJSON() || {}) }]);
      return json([]);
    }
    if (path.includes('/rest/v1/app_data')) {
      if (method === 'GET') {
        const key = (url.searchParams.get('key') || '').replace(/^eq\./, '');
        const map = {
          products: JSON.stringify(state.products || MOCK_PRODUCTS),
          zones: JSON.stringify(['Cariaco', 'Alto Gingone', 'Cimento']),
          payments: JSON.stringify(['M-Pesa', 'e-Mola', 'BIM']),
          requests: JSON.stringify(state.requests || []),
          suppliers: JSON.stringify(state.suppliers || [])
        };
        if (key && map[key]) return json([{ key, value: map[key], is_admin: true }]);
        return json([]);
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON() || {};
        if (body.key === 'products') state.products = JSON.parse(body.value);
        if (body.key === 'requests') state.requests = JSON.parse(body.value);
        if (body.key === 'suppliers') state.suppliers = JSON.parse(body.value);
        return json([{ key: body.key, value: body.value, is_admin: body.is_admin }]);
      }
      if (method === 'PATCH') {
        const body = route.request().postDataJSON() || {};
        return json([{ key: body.key, value: body.value, is_admin: body.is_admin }]);
      }
      return json([]);
    }
    if (path.includes('/rest/v1/orders')) {
      if (method === 'GET') return json(state.orders || []);
      if (method === 'POST') {
        const body = route.request().postDataJSON() || {};
        const row = { id: 'o' + Date.now(), created_at: new Date().toISOString(), ...body };
        state.orders = [row, ...(state.orders || [])];
        return json([row]);
      }
      if (method === 'PATCH') return json([{ id: 'o1', status: 'enviado' }]);
      return json([]);
    }
    if (path.includes('/rest/v1/carts')) {
      if (method === 'GET') return json([]);
      if (method === 'POST') return json([{ id: 'c1', created_at: new Date().toISOString() }]);
      return json([]);
    }
    if (path.includes('/storage/v1/object')) return json({ Key: 'product-images/mock.png' });
    if (path.includes('/auth/v1/settings')) return json({});
    return json([]);
  });
}

module.exports = { PROJECT, API, MOCK_PRODUCTS, USERS, sessionFor, installMock };
