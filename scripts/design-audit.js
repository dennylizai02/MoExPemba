const { chromium } = require('playwright');

const PROJECT = 'zhtiplewwerabqbkeahe';
const API = 'https://zhtiplewwerabqbkeahe.supabase.co';
const USER = { id: 'u1', name: 'Ana Vendedora', phone: '849999000', email: 'a@b.c', role: 'seller' };
const session = {
  access_token: 'm', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'm',
  user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'a@b.c', user_metadata: { name: 'Ana Vendedora' }, created_at: new Date().toISOString() }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} }, [`sb-${PROJECT}-auth-token`, JSON.stringify(session)]);
  await context.route(`${API}/**`, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname, method = route.request().method();
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (path.includes('/rest/v1/profiles')) return json([USER]);
    if (path.includes('/rest/v1/app_data')) {
      const key = (url.searchParams.get('key') || '').replace(/^eq\./, '');
      const map = {
        products: JSON.stringify([
          { id: 'p1', name: 'Capulana estampada', price: 450, category: 'Roupa', img: 'https://picsum.photos/seed/x/400/500', images: ['https://picsum.photos/seed/y/400/500'], desc: 'd', sizes: ['Único'], colors: ['Azul'], reviews: [{ name: 'A', rating: 5, comment: 'c', date: '01/07/2026' }], sold: 3, badge: 'Novo' },
          { id: 'p2', name: 'Sandálias de couro', price: 850, category: 'Calçado', img: 'https://picsum.photos/seed/z/400/500', images: [], desc: 'd', sizes: [], colors: [], reviews: [], sold: 27 }
        ]),
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
  await page.waitForTimeout(2200);
  await page.locator('.admin-nav-btn[data-tab="store"]').click().catch(() => {});
  await page.waitForTimeout(1000);

  const audit = await page.evaluate(() => {
    const out = { buttons: [], headings: [], cards: [], tap: [], contrast: [], contrastSkipped: [] };
    const cs = el => getComputedStyle(el);

    document.querySelectorAll('button:not([hidden])').forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.width === 0) return;
      const s = cs(b);
      out.buttons.push({
        id: b.id || null,
        cls: b.className || '',
        text: (b.textContent || '').trim().slice(0, 22),
        fs: s.fontSize, pad: s.padding, radius: s.borderRadius, weight: s.fontWeight
      });
    });

    document.querySelectorAll('h1,h2,h3,h4').forEach(h => {
      const r = h.getBoundingClientRect();
      if (r.width === 0) return;
      const s = cs(h);
      out.headings.push({ tag: h.tagName, text: (h.textContent || '').trim().slice(0, 30), fs: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, family: s.fontFamily.split(',')[0] });
    });

    document.querySelectorAll('.tag-card, .hero-card, .hs-card, .order-card, .info-pill, .chip, .stat-card, .trust-item, .panel, .card').forEach(c => {
      const r = c.getBoundingClientRect();
      if (r.width === 0) return;
      const s = cs(c);
      out.cards.push({ cls: c.className.split(' ')[0], radius: s.borderRadius, pad: s.padding, shadow: s.boxShadow.slice(0, 40) });
    });

    // alvos de toqueToo small
    document.querySelectorAll('button, a, input, select, textarea').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.height < 32 || r.width < 24) {
        out.tap.push({ id: el.id || null, cls: (el.className || '').toString().split(' ')[0], text: (el.textContent || '').trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) });
      }
    });

    // contraste do texto principal
    const lum = rgb => {
      const [r, g, b] = rgb.match(/\d+/g).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const parseColor = c => {
      const m = String(c || '').match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map(v => parseFloat(v));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const bgOf = el => {
      const stack = [];
      let n = el;
      while (n && n !== document.documentElement) {
        const st = getComputedStyle(n);
        if (st.backgroundImage && st.backgroundImage !== 'none') return null;
        const c = parseColor(st.backgroundColor);
        if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
        n = n.parentElement;
      }
      let base = { r: 244, g: 236, b: 221 };
      for (let i = stack.length - 1; i >= 0; i--) {
        const s = stack[i];
        base = { r: s.r * s.a + base.r * (1 - s.a), g: s.g * s.a + base.g * (1 - s.a), b: s.b * s.a + base.b * (1 - s.a) };
      }
      return `rgb(${Math.round(base.r)}, ${Math.round(base.g)}, ${Math.round(base.b)})`;
    };
    document.querySelectorAll('p, span, a, button, label, h1, h2, h3, li, td, th, small').forEach(el => {
      if (!el.textContent.trim()) return;
      if (el.children.length) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const s = cs(el);
      const bg = bgOf(el);
      if (!bg) { out.contrastSkipped.push({ cls: (el.className || '').toString().split(' ')[0], text: el.textContent.trim().slice(0, 24), fs: s.fontSize }); return; }
      const fg = parseColor(s.color);
      let fgCss = s.color;
      if (fg && fg.a < 1) {
        const b2 = parseColor(bg);
        fgCss = `rgb(${Math.round(fg.r * fg.a + b2.r * (1 - fg.a))}, ${Math.round(fg.g * fg.a + b2.g * (1 - fg.a))}, ${Math.round(fg.b * fg.a + b2.b * (1 - fg.a))})`;
      }
      const l1 = lum(fgCss), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(s.fontSize);
      const bold = parseInt(s.fontWeight) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const min = large ? 3 : 4.5;
      if (ratio < min) out.contrast.push({ text: el.textContent.trim().slice(0, 28), cls: (el.className || '').toString().split(' ')[0], ratio: +ratio.toFixed(2), fs: s.fontSize, min });
    });
    return out;
  });

  console.log('=== BOTÕES (' + audit.buttons.length + ') ===');
  const byStyle = {};
  audit.buttons.forEach(b => {
    const key = `${b.fs}/${b.pad}/${b.radius}/${b.weight}`;
    (byStyle[key] = byStyle[key] || []).push(b);
  });
  Object.entries(byStyle).sort((a, b) => b[1].length - a[1].length).forEach(([k, list]) => {
    console.log(`${list.length}x  fs=${k.split('/')[0]} pad=${k.split('/')[1]} radius=${k.split('/')[2]} weight=${k.split('/')[3]}`);
    console.log('     ex: ' + list.slice(0, 4).map(b => `${b.id || b.cls || b.text}`).join(', '));
  });

  console.log('\n=== TÍTULOS (' + audit.headings.length + ') ===');
  audit.headings.forEach(h => console.log(`${h.tag} ${h.fs}/${h.weight} lh=${h.lh} ${h.family} | ${h.text}`));

  console.log('\n=== CONTENEDORES (' + audit.cards.length + ') ===');
  const cards = {};
  audit.cards.forEach(c => {
    const key = `${c.cls}: r=${c.radius} p=${c.pad}`;
    (cards[key] = cards[key] || []).push(c);
  });
  Object.entries(cards).forEach(([k, l]) => console.log(`${l.length}x ${k}`));

  console.log('\n=== ALVOS DE TOQUE PEQUENOS (' + audit.tap.length + ') ===');
  audit.tap.slice(0, 20).forEach(t => console.log(`${t.h}px ${t.w}px  ${t.id || t.cls} "${t.text}"`));

  console.log('\n=== CONTRASTE NÃO AVALIÁVEL (' + audit.contrastSkipped.length + ') ===');
  audit.contrastSkipped.slice(0, 6).forEach(c => console.log(`  ${c.fs}  ${c.cls} "${c.text}" (fundo em gradiente)`));
  console.log('\n=== CONTRASTE INSUFICIENTE (' + audit.contrast.length + ') ===');
  audit.contrast.slice(0, 25).forEach(c => console.log(`${c.ratio} (min ${c.min}) ${c.fs}  ${c.cls || ''} "${c.text}"`));

  await browser.close();
})();
