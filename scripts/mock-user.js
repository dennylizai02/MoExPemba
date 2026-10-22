const { chromium } = require('playwright');

const PROJECT = 'zhtiplewwerabqbkeahe';
const API = `https://${PROJECT}.supabase.co`;
const log = [];
const check = (label, value) => { log.push(`${value ? 'PASS' : 'FAIL'}  ${label}${value === true || value === false ? '' : ' → ' + value}`); return value; };

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Capulana estampada', price: 450, category: 'Roupa', img: 'https://picsum.photos/seed/capulana/400/500', images: [], desc: 'Capulana colorida.', material: 'Algodão', entrega: '3 a 4 dias', badge: 'Novo', sold: 12, sizes: ['Único'], colors: ['Azul'], reviews: [], created_by: 'user-seller-1' },
  { id: 'p2', name: 'Sandálias de couro', price: 850, category: 'Calçado', img: 'https://picsum.photos/seed/sandalias/400/500', images: [], desc: 'Sandálias em couro.', material: 'Couro', entrega: '4 a 5 dias', badge: 'Destaque', sold: 27, sizes: [], colors: [], reviews: [], created_by: 'user-seller-1' }
];
const USER = { id: 'user-client-1', name: 'Cliente Comum', phone: '849999222', email: 'cliente@moex.mz', role: 'user' };

function sessionFor(user) {
  return {
    access_token: 'mock', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'mock',
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, phone: user.phone, app_metadata: { role: user.role }, user_metadata: { name: user.name, phone: user.phone }, created_at: new Date().toISOString() }
  };
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const state = { orders: [] };
  await context.addInitScript(([key, raw]) => { try { localStorage.setItem(key, raw); } catch (e) {} },
    [`sb-${PROJECT}-auth-token`, JSON.stringify(sessionFor(USER))]);

  await context.route(`${API}/**`, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname, method = route.request().method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (path.includes('/auth/v1/token')) return json(sessionFor(USER));
    if (path.includes('/auth/v1/user')) return json(sessionFor(USER).user);
    if (path.includes('/rest/v1/profiles')) {
      const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
      return json(id ? [USER] : [USER]);
    }
    if (path.includes('/rest/v1/app_data')) {
      if (method === 'GET') {
        const key = (url.searchParams.get('key') || '').replace(/^eq\./, '');
        const map = { products: JSON.stringify(MOCK_PRODUCTS), zones: JSON.stringify(['Cariaco', 'Cimento']), payments: JSON.stringify(['M-Pesa']), requests: '[]', suppliers: '[]' };
        if (key && map[key]) return json([{ key, value: map[key], is_admin: true }]);
        return json([]);
      }
      return json([{}]);
    }
    if (path.includes('/rest/v1/orders')) {
      if (method === 'GET') return json(state.orders);
      if (method === 'POST') {
        const body = route.request().postDataJSON() || {};
        const row = { id: 'o' + Date.now(), created_at: new Date().toISOString(), status: 'novo', ...body };
        state.orders = [row, ...state.orders];
        return json(row);
      }
      return json(null);
    }
    if (path.includes('/rest/v1/carts')) return json([]);
    return json([]);
  });

  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  const vis = async sel => page.locator(sel).first().isVisible().catch(() => false);

  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  check('loja visível para cliente', await vis('#publicView'));
  check('sidebar do painel escondida para cliente', !(await vis('#adminView .admin-sidebar')));
  check('sem tabs de painel para cliente', !(await vis('[data-tab="products"]')));
  check('botão carrinho visível', await vis('#openCart'));
  check('botão "os meus pedidos" visível', await vis('#openMyOrders'));
  check('botão painel escondido', !(await vis('#openAdmin')));
  check('cartões de produto', (await page.locator('#productGrid .tag-card').count()) === 2);

  // favorito
  await page.locator('#productGrid .fav-btn').first().click();
  await page.waitForTimeout(600);
  check('favorito marcado', (await page.locator('#productGrid .fav-btn.active').count()) === 1);

  // adicionar ao carrinho
  await page.locator('#productGrid [data-add]').first().click();
  await page.waitForTimeout(600);
  if (await vis('#productModal')) {
    check('modal aberto para escolher variante', true);
    await page.locator('#pmAdd').click();
    await page.waitForTimeout(600);
  }
  check('carrinho com 1 item', ((await page.locator('#cartCount').textContent()) || '').trim() === '1');

  // checkout
  await page.locator('#openCart').click();
  await page.waitForTimeout(500);
  await page.locator('#goCheckout').click();
  await page.waitForTimeout(600);
  check('checkout abre', await vis('#checkoutModal'));
  await page.selectOption('#ckZone', { index: 1 });
  await page.fill('#ckName', 'Cliente Comum');
  await page.fill('#ckPhone', '849999222');
  await page.click('#ckSave');
  await page.waitForTimeout(1200);
  check('encomenda registada', state.orders.length === 1);
  check('carrinho vazio', ((await page.locator('#cartCount').textContent()) || '').trim() === '0');

  // os meus pedidos
  await page.locator('#openMyOrders').click();
  await page.waitForTimeout(1000);
  check('modal "os meus pedidos" abre', await vis('#myOrdersModal'));
  const ordersTxt = (await page.locator('#myOrdersModal').textContent().catch(() => '')) || '';
  check('mostra a encomenda (produto + total)', ordersTxt.includes('Capulana') && ordersTxt.includes('MT'));
  check('mostra timeline de estados', (await page.locator('#myOrdersModal .order-steps, #myOrdersModal .step, #myOrdersModal [class*=step]').count()) > 0);

  check('sem erros de consola', errors.length === 0);
  console.log(log.join('\n'));
  console.log('\nERROS:', errors.length ? errors.join('\n') : 'nenhum');
  await browser.close();
})();
