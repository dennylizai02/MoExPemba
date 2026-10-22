const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const PROJECT = 'zhtiplewwerabqbkeahe';

const CLASSES_PANEL = [
  'stat-card', 'role-badge', 'seller', 'product-table', 'zone-row', 'pay-row',
  'admin-nav-btn', 'wizard-step', 'form-step', 'btn-primary', 'info-pill'
];
const CLASSES_STORE = [
  'tag-card', 'view-btn', 'add-btn', 'chip', 'tag-name', 'tag-price', 'fav-btn',
  'variant-pill', 'order-card'
];

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

async function makeContext(browser, user) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} },
    [`sb-${PROJECT}-auth-token`, JSON.stringify(sessionFor(user))]);

  await context.route(`https://${PROJECT}.supabase.co/**`, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = body => route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body)
    });
    if (path.includes('/rest/v1/profiles')) {
      return json([{ id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role }]);
    }
    if (path.includes('/rest/v1/app_data')) {
      const key = (url.searchParams.get('key') || '').replace(/^eq\./, '');
      const map = {
        products: JSON.stringify([{
          id: 'p1', name: 'Capulana', price: 450, category: 'Roupa',
          img: 'https://picsum.photos/seed/x/400/500', images: [], desc: 'Capulana de Pemba.',
          sizes: ['Único'], colors: ['Azul'], sold: 3, created_by: 'user-seller-1',
          reviews: [{ name: 'A', rating: 5, comment: 'Muito bonita', date: '01/07/2026' }]
        }]),
        zones: JSON.stringify(['Cariaco']),
        payments: JSON.stringify(['M-Pesa']),
        requests: '[]',
        suppliers: '[]'
      };
      if (key && map[key]) return json([{ key, value: map[key], is_admin: true }]);
      return json([]);
    }
    if (path.includes('/rest/v1/orders')) {
      return json([{
        id: 'o1', date: '12/10/2026 14:00', addr: 'Cariaco', note: '',
        items: [{ name: 'Capulana', qty: 1, price: 450 }], total: 450,
        status: 'novo', user_id: user.id, created_at: new Date().toISOString()
      }]);
    }
    if (path.includes('/rest/v1/carts')) return json([]);
    if (path.includes('/auth/v1/user')) return json(sessionFor(user).user);
    if (path.includes('/auth/v1/token')) return json(sessionFor(user));
    return json([]);
  });
  return context;
}

(async () => {
  const ids = fs.existsSync('/tmp/ids.txt')
    ? fs.readFileSync('/tmp/ids.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
    : [];

  const browser = await chromium.launch({ headless: true });
  const missingIds = new Set();
  const foundClasses = new Set();
  const ALL_CLASSES = [...CLASSES_PANEL, ...CLASSES_STORE];

  // --- vendedor: painel ---
  const seller = { id: 'user-seller-1', name: 'Ana', phone: '84', email: 'a@b.c', role: 'seller' };
  const ctxSeller = await makeContext(browser, seller);
  const p1 = await ctxSeller.newPage();
  await p1.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(2200);

  const tabs = ['dashboard', 'orders', 'products', 'clients', 'requests', 'settings', 'suppliers'];
  for (const tab of tabs) {
    await p1.locator(`.admin-nav-btn[data-tab="${tab}"]`).click({ force: true }).catch(() => {});
    await p1.waitForTimeout(600);
  }
  for (const c of CLASSES_PANEL) {
    if (await p1.evaluate(cl => !!document.querySelector('.' + cl), c)) foundClasses.add(c);
  }
  for (const id of ids) {
    if (!(await p1.evaluate(i => !!document.getElementById(i), id))) missingIds.add(id);
  }
  const dataAttrs = ['data-tab', 'data-add', 'data-view', 'data-fav', 'data-step', 'data-wstep', 'data-toggle-step'];
  const counts = {};
  for (const a of dataAttrs) {
    counts[a] = await p1.evaluate(attr => document.querySelectorAll('[' + attr + ']').length, a);
  }
  await ctxSeller.close();

  // --- cliente: loja, modal de produto, encomendas ---
  const client = { id: 'user-client-1', name: 'Cliente', phone: '84', email: 'c@b.c', role: 'user' };
  const ctxClient = await makeContext(browser, client);
  const p2 = await ctxClient.newPage();
  await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(2200);

  await p2.locator('#productGrid .tag-card').first().click({ force: true }).catch(() => {});
  await p2.waitForTimeout(800);
  for (const c of CLASSES_STORE) {
    if (await p2.evaluate(cl => !!document.querySelector('.' + cl), c)) foundClasses.add(c);
  }
  for (const id of ids) {
    if (!(await p2.evaluate(i => !!document.getElementById(i), id))) missingIds.add(id);
  }
  await p2.locator('#pmClose').click({ force: true }).catch(() => {});
  await p2.waitForTimeout(400);
  const ordersVisible = await p2.locator('#openMyOrders').isVisible().catch(() => false);
  const ordersErr = await p2.locator('#openMyOrders').click({ force: true }).then(() => '').catch(e => e.message.split('\n')[0]);
  await p2.waitForTimeout(1500);
  if (process.env.DEBUG) {
    console.log('myOrders visível:', ordersVisible, '| erro:', ordersErr || 'nenhum');
    console.log('myOrdersList:', (await p2.evaluate(() => document.getElementById('myOrdersList').innerHTML)).slice(0, 120));
  }
  for (const c of CLASSES_STORE) {
    if (await p2.evaluate(cl => !!document.querySelector('.' + cl), c)) foundClasses.add(c);
  }
  const missingClasses = ALL_CLASSES.filter(c => !foundClasses.has(c));

  console.log('IDs em falta:', missingIds.size ? [...missingIds].join(', ') : 'nenhum');
  console.log('Classes em falta:', missingClasses.length ? missingClasses.join(', ') : 'nenhum');
  for (const a of dataAttrs) console.log(`${a}: ${counts[a]} elementos`);

  await browser.close();
  process.exit(missingIds.size || missingClasses.length ? 1 : 0);
})();
