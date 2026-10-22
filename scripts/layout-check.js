const { chromium } = require('playwright');

const PROJECT = 'zhtiplewwerabqbkeahe';
const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 780 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'desktop-1600', width: 1600, height: 900 }
];

const USER = { id: 'u1', name: 'Ana Vendedora', phone: '849999000', email: 'a@b.c', role: 'seller' };
const session = {
  access_token: 'm', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'm',
  user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'a@b.c', user_metadata: { name: 'Ana Vendedora' }, created_at: new Date().toISOString() }
};

(async () => {
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} }, [`sb-${PROJECT}-auth-token`, JSON.stringify(session)]);
  await context.route(`https://${PROJECT}.supabase.co/**`, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname, method = route.request().method();
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (path.includes('/rest/v1/profiles')) return json([USER]);
    if (path.includes('/rest/v1/app_data')) {
      const key = (url.searchParams.get('key') || '').replace(/^eq\./, '');
      const map = {
        products: JSON.stringify([{ id: 'p1', name: 'Capulana estampada', price: 450, category: 'Roupa', img: 'https://picsum.photos/seed/x/400/500', images: [], desc: 'd', sizes: ['Único'], colors: ['Azul'], reviews: [{ name: 'A', rating: 5, comment: 'c', date: '01/07/2026' }], sold: 3, badge: 'Novo' }]),
        zones: JSON.stringify(['Cariaco', 'Alto Gingone']), payments: JSON.stringify(['M-Pesa', 'e-Mola']), requests: '[]', suppliers: '[]'
      };
      if (key && map[key]) return json([{ key, value: map[key], is_admin: true }]);
      return json([]);
    }
    if (path.includes('/rest/v1/orders')) return json([]);
    if (path.includes('/rest/v1/carts')) return json([]);
    if (path.includes('/auth/v1/user')) return json(session.user);
    if (path.includes('/auth/v1/token')) return json(session);
    return json([]);
  });

  const page = await context.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(700);
    await page.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter(a => a.playState === 'running').map(a => a.finished.catch(() => {}))),
      new Promise(r => setTimeout(r, 1000))
    ]));
    const res = await page.evaluate(() => {
      const de = document.documentElement;
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const overflow = de.scrollWidth - de.clientWidth;
      const drawer = document.getElementById('cartDrawer');
      const drawerOpen = !!(drawer && drawer.classList.contains('show'));
      const clippedOrFixed = el => {
        let n = el;
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n);
          if (cs.position === 'fixed') return true;
          if (n !== el && cs.overflowX !== 'visible') return true;
          if (!drawerOpen && n.id === 'cartDrawer') return true;
          n = n.parentElement;
        }
        return false;
      };
      const wide = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > de.clientWidth + 2 && !clippedOrFixed(el)) {
          const id = el.id ? '#' + el.id : '';
          const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '';
          wide.push(el.tagName.toLowerCase() + id + cls + ' (' + Math.round(r.right) + 'px)');
        }
      });
      return { overflow, wide: wide.slice(0, 5) };
    });
    console.log(`${vp.name}: overflow=${res.overflow}px ${res.wide.length ? '→ ' + res.wide.join(' | ') : ''}`);
  }

  // menu mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const tabbar = await page.locator('#mobileTabbar').isVisible().catch(() => false);
  console.log('tabbar mobile visível:', tabbar);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);
  const tabbarDesktop = await page.locator('#mobileTabbar').isVisible().catch(() => false);
  console.log('tabbar desktop visível:', tabbarDesktop);
  await browser.close();
})();
