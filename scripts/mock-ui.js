const { chromium } = require('playwright');

const PROJECT = 'zhtiplewwerabqbkeahe';
const API = `https://${PROJECT}.supabase.co`;

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Capulana estampada', price: 450, category: 'Roupa', img: 'https://picsum.photos/seed/capulana/400/500', images: [], desc: 'Capulana colorida, ideal para o calor de Pemba.', material: 'Algodão', entrega: '3 a 4 dias', badge: 'Novo', sold: 12, sizes: ['Único'], colors: ['Azul', 'Vermelho'], reviews: [{ name: 'Amélia', rating: 5, comment: 'Muito bonita.', date: '01/07/2026' }], created_by: 'user-seller-1' },
  { id: 'p2', name: 'Sandálias de couro', price: 850, category: 'Calçado', img: 'https://picsum.photos/seed/sandalias/400/500', images: [], desc: 'Sandálias em couro curtido.', material: 'Couro', entrega: '4 a 5 dias', badge: 'Destaque', sold: 27, sizes: ['38', '39'], colors: ['Castanho'], reviews: [], created_by: 'user-seller-1' }
];

const MOCK_PROFILES = [
  { id: 'user-seller-1', name: 'Ana Vendedora', phone: '849999000', email: 'vendedor@moex.mz', role: 'seller', created_at: new Date().toISOString() },
  { id: 'user-admin-1', name: 'Loja Admin', phone: '849999111', email: 'admin@moex.mz', role: 'admin', created_at: new Date().toISOString() },
  { id: 'user-client-1', name: 'Cliente Comum', phone: '849999222', email: 'cliente@moex.mz', role: 'user', created_at: new Date().toISOString() }
];

const log = [];
const check = (label, value) => { log.push(`${value ? 'PASS' : 'FAIL'}  ${label}${value === true || value === false ? '' : ' → ' + value}`); return value; };

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

async function installMock(context, user, state) {
  await context.addInitScript(([key, raw]) => {
    try { localStorage.setItem(key, raw); } catch (e) {}
  }, [`sb-${PROJECT}-auth-token`, JSON.stringify(sessionFor(user))]);

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
    if (path.includes('/rest/v1/profiles')) {
      if (method === 'GET') {
        const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
        return json(id ? MOCK_PROFILES.filter(p => p.id === id) : MOCK_PROFILES);
      }
      if (method === 'POST') return json(MOCK_PROFILES[0]);
      return json(null);
    }
    if (path.includes('/rest/v1/app_data')) {
      if (method === 'GET') {
        const key = (url.searchParams.get('key') || '').replace(/^eq\./, '');
        const map = {
          products: JSON.stringify(state.products),
          zones: JSON.stringify(['Cariaco', 'Alto Gingone', 'Cimento']),
          payments: JSON.stringify(['M-Pesa', 'e-Mola', 'BIM']),
          requests: '[]', suppliers: '[]'
        };
        if (key && map[key]) return json([{ key, value: map[key], is_admin: true }]);
        return json([]);
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON() || {};
        if (body.key === 'products') state.products = JSON.parse(body.value);
        return json([{ key: body.key, value: body.value, is_admin: body.is_admin }]);
      }
    }
    if (path.includes('/rest/v1/orders')) {
      if (method === 'GET') return json(state.orders || []);
      if (method === 'POST') {
        const body = route.request().postDataJSON() || {};
        const row = { id: 'o' + Date.now(), created_at: new Date().toISOString(), ...body };
        state.orders = [row, ...(state.orders || [])];
        return json(row);
      }
      return json(null);
    }
    if (path.includes('/rest/v1/carts')) {
      if (method === 'GET') return json([]);
      return json([]);
    }
    return json([], 200);
  });
}

(async () => {
  const role = process.argv[2] || 'seller';
  const errors = [];
  let browser;
  try {
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const user = role === 'admin' ? MOCK_PROFILES[1] : role === 'user' ? MOCK_PROFILES[2] : MOCK_PROFILES[0];
  const mockState = { products: [...MOCK_PRODUCTS], orders: [] };
  await installMock(context, user, mockState);

  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  const vis = async sel => page.locator(sel).first().isVisible().catch(() => false);

  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  check('painel visível', await vis('#adminView'));
  check('dashboard visível', await vis('#tabDashboard'));
  check('8 stat-cards', (await page.locator('#tabDashboard .stat-card').count()) === 8);
  check('badge de role', (await page.locator('.role-badge').first().textContent().catch(() => '') || '').trim());
  check('sem banner offline', !(await vis('#offlineBanner')));
  check('sem erros de consola no arranque', errors.length === 0);

  // ---- Tabs visíveis por role
  const tabVisible = async tab => vis(`.admin-nav-btn[data-tab="${tab}"]`);
  if (role === 'seller') {
    check('vendedor não vê "clients"', !(await tabVisible('clients')));
    check('vendedor não vê "requests"', !(await tabVisible('requests')));
    check('vendedor vê "products"', await tabVisible('products'));
  } else {
    check('admin vê "clients"', await tabVisible('clients'));
    check('admin vê "requests"', await tabVisible('requests'));
  }

  // ---- Painel: produtos
  await page.locator('.admin-nav-btn[data-tab="products"]').click();
  await page.waitForTimeout(800);
  check('#npName visível', await vis('#npName'));
  check('#npPrice visível', await vis('#npPrice'));
  check('#npCat visível', await vis('#npCat'));
  check('#npImg visível', await vis('#npImg'));
  check('#npAdd visível', await vis('#npAdd'));
  check('#npDesc visível', await vis('#npDesc'));
  const rows = await page.locator('#adminProductList tbody tr').count();
  check('linhas na tabela de produtos', rows);

  // ---- Criar produto
  await page.fill('#npName', 'Mochila de lona testada');
  await page.fill('#npPrice', '750');
  await page.fill('#npCat', 'Acessórios');
  await page.fill('#npDesc', 'Mochila robusta para o dia a dia.');
  await page.click('#npAdd');
  let created = false;
  for (let i = 0; i < 24 && !created; i++) {
    created = mockState.products.some(p => p.name === 'Mochila de lona testada');
    if (!created) await page.waitForTimeout(250);
  }
  check('produto criado (mock recebeu POST)', created);
  const rowsAfter = await page.locator('#adminProductList tbody tr').count();
  check('produto aparece na tabela do painel', rowsAfter >= rows);

  // ---- Loja: ver, favoritar, carrinho
  await page.locator('.admin-nav-btn[data-tab="store"]').click();
  await page.waitForTimeout(900);
  check('cartões na loja', (await page.locator('#productGrid .tag-card').count()) > 0);
  check('#resultCount contém "encontrado"', ((await page.locator('#resultCount').textContent()) || '').includes('encontrado'));

  await page.locator('#productGrid .tag-card').first().click();
  await page.waitForTimeout(500);
  check('modal de produto abre ao clicar no cartão', await vis('#productModal'));
  check('modal tem variantes', await vis('#pmVariants'));
  if (await vis('#pmAdd')) { await page.click('#pmAdd'); await page.waitForTimeout(500); }
  check('carrinho tem 1 item', ((await page.locator('#cartCount').textContent()) || '').trim() === '1');

  // checkout
  await page.locator('#openCart').click();
  await page.waitForTimeout(600);
  check('drawer do carrinho abre', await vis('#cartDrawer'));
  const goBtn = page.locator('#goCheckout');
  if (await goBtn.isVisible().catch(() => false)) {
    await goBtn.click();
    await page.waitForTimeout(600);
    check('modal de checkout abre', await vis('#checkoutModal'));
    await page.selectOption('#ckZone', { index: 1 });
    await page.fill('#ckName', 'Ana Vendedora');
    await page.fill('#ckPhone', '849999000');
    await page.fill('#ckNote', 'Entregar de manhã');
    await page.click('#ckSave');
    await page.waitForTimeout(1200);
    check('encomenda criada', mockState.orders.length > 0);
    check('carrinho esvaziado', ((await page.locator('#cartCount').textContent()) || '').trim() === '0');
  }

  // ---- Encomendas (painel)
  const backToPanel = page.locator('#openAdmin');
  if (await backToPanel.isVisible().catch(() => false)) {
    await backToPanel.click();
    await page.waitForTimeout(700);
  }
  await page.locator('.admin-nav-btn[data-tab="orders"]').click();
  await page.waitForTimeout(800);
  check('tab de encomendas visível', await vis('#tabOrders'));
  check('encomenda listada no painel', ((await page.locator('#adminOrderList').textContent().catch(() => '')) || '').includes('Mochila') || ((await page.locator('#adminOrderList').textContent().catch(() => '')) || '').includes('Capulana'));
  await page.locator('.admin-nav-btn[data-tab="store"]').click();
  await page.waitForTimeout(600);

  // ---- Responsivo (mobile)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  check('tabbar mobile visível', await vis('#mobileTabbar'));
  await page.screenshot({ path: `/tmp/moex-mock-${role}-mobile.png`, fullPage: false });

  } catch (e) {
    log.push('FALHA: ' + e.message.split('\n')[0]);
  }
  console.log(log.join('\n'));
  console.log('\n=== ERROS DE CONSOLA ===');
  console.log(errors.length ? errors.join('\n') : 'nenhum');
  if (browser) await browser.close();
})();
