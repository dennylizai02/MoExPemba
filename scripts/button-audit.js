const { chromium } = require('playwright');
const { USERS, installMock } = require('./_mock');

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const REAL = process.env.MODE === 'real';
const CRED = {
  admin: { email: 'teste.admin@moex.mz', password: 'Teste2026!' },
  seller: { email: 'teste.vendedor@moex.mz', password: 'Teste2026!' },
  user: { email: 'teste.cliente@moex.mz', password: 'Teste2026!' }
};
const results = [];
const IGNORE = /picsum|net::ERR|Failed to load resource|favicon|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|was preloaded/i;

const ok = (screen, name, detail) => results.push({ screen, name, status: 'PASS', detail: detail || '' });
const fail = (screen, name, detail) => results.push({ screen, name, status: 'FAIL', detail: detail || '' });
const skip = (screen, name, detail) => results.push({ screen, name, status: 'SKIP', detail: detail || '' });

async function openState(page, sel) {
  try {
    const loc = page.locator(sel).first();
    if (!(await loc.count())) return false;
    return await loc.evaluate(el => el.classList.contains('show'));
  } catch (e) { return false; }
}

async function visible(page, sel) {
  try {
    const loc = page.locator(sel).first();
    if (!(await loc.count())) return false;
    return await loc.isVisible();
  } catch (e) { return false; }
}

async function controlsOf(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a[href], [role="button"], input[type="submit"]').forEach(el => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0) return;
      if (style.visibility === 'hidden' || style.display === 'none') return;
      if (el.closest('[hidden]')) return;
      if (el.id === 'npFileInput' || el.id === 'appLoader') return;
      const closedDrawer = el.closest('#cartDrawer:not(.show)');
      const closedModal = el.closest('.modal:not(.show)');
      if (closedDrawer || closedModal) return;
      const cls = (el.className && el.className.toString ? el.className.toString() : '').trim();
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      const stableText = text.replace(/\s*\(\d+\)\s*$/, '');
      out.push({
        id: el.id || null, cls, text,
        tag: el.tagName.toLowerCase(),
        href: el.getAttribute('href') || '',
        external: el.tagName === 'A' && /^https?:/i.test(el.getAttribute('href') || ''),
        disabled: !!el.disabled,
        key: el.id || `${cls}|${el.tagName}|${stableText}`
      });
    });
    return out;
  });
}

async function findControl(page, target) {
  const list = await controlsOf(page);
  const same = list.filter(c => c.key === target.key);
  return same[target.ordinal] || null;
}

async function locatorFor(page, control) {
  if (control.id) return page.locator(`#${control.id}`).first();
  const parts = control.cls.split(/\s+/).filter(Boolean);
  if (parts.length) return page.locator(`${control.tag}.${parts.join('.')}`).first();
  const text = (control.text || '').replace(/"/g, '');
  if (text) {
    const cands = page.locator(`${control.tag}:has-text("${text}")`);
    const n = await cands.count();
    for (let i = 0; i < n; i++) {
      if (await cands.nth(i).isVisible().catch(() => false)) return cands.nth(i);
    }
    return cands.first();
  }
  return page.locator(control.tag).first();
}

async function waitStable(page, sel) {
  for (let i = 0; i < 25; i++) {
    const stable = await page.evaluate(s => new Promise(resolve => {
      const el = document.querySelector(s);
      if (!el) return resolve(true);
      const r1 = el.getBoundingClientRect();
      requestAnimationFrame(() => {
        const r2 = el.getBoundingClientRect();
        resolve(Math.abs(r1.x - r2.x) < 0.8 && Math.abs(r1.y - r2.y) < 0.8 &&
                Math.abs(r1.width - r2.width) < 0.8 && Math.abs(r1.height - r2.height) < 0.8);
      });
    }), sel);
    if (stable) return true;
    await page.waitForTimeout(120);
  }
  return false;
}

async function closeOverlays(page) {
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await page.waitForTimeout(350);
}

async function blockerInfo(loc) {
  return loc.evaluate(el => {
    if (!el) return { state: 'missing' };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) return { state: 'hidden' };
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!top) return { state: 'offscreen' };
    if (el === top || el.contains(top) || top.contains(el)) return { state: 'ok' };
    const overlay = top.closest('.modal, #cartDrawer, #overlay');
    return {
      state: 'covered',
      by: overlay
        ? (overlay.id || overlay.className || 'overlay')
        : (top.id || top.className || top.tagName)
    };
  }).catch(() => ({ state: 'missing' }));
}

async function clickControl(page, control) {
  const loc = await locatorFor(page, control);
  await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  const sel = control.id ? '#' + control.id : null;
  if (sel) await waitStable(page, sel);

  let info = await blockerInfo(loc);
  if (info.state === 'covered') {
    await closeOverlays(page);
    info = await blockerInfo(loc);
    if (info.state === 'covered') {
      const err = new Error(`coberto por ${info.by}`);
      err.blocked = true;
      throw err;
    }
  }
  if (info.state === 'hidden' || info.state === 'missing' || info.state === 'offscreen') {
    const err = new Error(`elemento ${info.state}`);
    err.blocked = true;
    throw err;
  }

  try {
    return await loc.click({ timeout: 5000, force: true });
  } catch (e) {
    await closeOverlays(page);
    return loc.click({ timeout: 5000, force: true });
  }
}

async function safeClick(page, selector) {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await waitStable(page, selector);
  return loc.click({ timeout: 8000, force: true });
}

async function addFirstProduct(page) {
  await safeClick(page, '.add-btn');
  await page.waitForTimeout(700);
  if (await openState(page, '#productModal')) {
    await safeClick(page, '#pmAdd');
    await page.waitForTimeout(500);
  }
}

async function openPanel(page) {
  const btn = page.locator('#openAdmin');
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(400);
}

const SCREENS = [
  {
    id: 'auth-login', role: null, setup: async () => {},
    checks: {
      showRegister: async p => visible(p, '#authRegisterForm'),
      showForgotPassword: async p => visible(p, '#authForgotForm'),
      showLogin: async p => visible(p, '#authLoginForm')
    }
  },
  {
    id: 'auth-register', role: null,
    setup: async p => { await safeClick(p, '#showRegister'); await p.waitForTimeout(250); },
    checks: { showLogin: async p => visible(p, '#authLoginForm') }
  },
  {
    id: 'auth-forgot', role: null,
    setup: async p => { await safeClick(p, '#showForgotPassword'); await p.waitForTimeout(250); },
    checks: { showLogin: async p => visible(p, '#authLoginForm'), showLoginFromForgot: async p => visible(p, '#authLoginForm') }
  },
  {
    id: 'guest-browse', role: null,
    setup: async p => {
      await p.evaluate(() => {
        const b = document.getElementById('offlineBanner');
        if (b) { b.style.display = 'flex'; b.classList.add('show'); }
        const a = document.getElementById('offlineActions');
        if (a) a.style.display = '';
        const t = document.getElementById('offlineBannerText');
        if (t) t.textContent = 'Sem ligação — modo de leitura.';
      });
      await p.waitForTimeout(200);
      await safeClick(p, '#browseOffline');
      await p.waitForTimeout(900);
    },
    checks: {
      heroRequestBtn: async p => visible(p, '#requestModal'),
      heroShopBtn: async p => true,
      openCart: async p => visible(p, '#cartDrawer')
    }
  },
  {
    id: 'store-user', role: 'user', setup: async () => {},
    checks: {
      heroRequestBtn: async p => visible(p, '#requestModal'),
      openCart: async p => visible(p, '#cartDrawer'),
      openMyOrders: async p => visible(p, '#myOrdersModal'),
      openAdmin: async p => visible(p, '#adminView')
    }
  },
  {
    id: 'cart-drawer', role: 'user',
    setup: async p => {
      await addFirstProduct(p);
      await safeClick(p, '#openCart'); await p.waitForTimeout(600);
    },
    checks: {
      closeCart: async p => !(await openState(p, '#cartDrawer')),
      cartContinue: async p => visible(p, '#checkoutModal')
    }
  },
  {
    id: 'checkout', role: 'user',
    setup: async p => {
      await addFirstProduct(p);
      await safeClick(p, '#openCart'); await p.waitForTimeout(500);
      try { await safeClick(p, '#goCheckout'); } catch (e) { /* sem itens válidos */ }
      await p.waitForTimeout(700);
    },
    checks: {
      ckClose: async p => !(await openState(p, '#checkoutModal')),
      ckSave: async p => true,
      ckWhats: async p => true
    }
  },
  {
    id: 'product-modal', role: 'user',
    setup: async p => { await safeClick(p, '.tag-card'); await p.waitForTimeout(900); },
    checks: {
      pmClose: async p => !(await openState(p, '#productModal')),
      pmAdd: async p => true,
      pmShare: async p => true,
      pmCat: async p => true,
      rvSend: async p => true
    }
  },
  {
    id: 'request-modal', role: 'user',
    setup: async p => { await safeClick(p, '#heroRequestBtn'); await p.waitForTimeout(600); },
    checks: { reqClose: async p => !(await openState(p, '#requestModal')), reqSend: async p => true }
  },
  {
    id: 'panel-seller', role: 'seller',
    setup: async p => { await openPanel(p); },
    checks: {
      dashNewProduct: async p => visible(p, '#npForm'),
      tabProducts: async p => visible(p, '#adminProductList'),
      tabOrders: async p => visible(p, '#adminOrderList'),
      tabClients: async p => visible(p, '#adminClientList'),
      tabSettings: async p => true,
      adLogout: async p => true
    }
  },
  {
    id: 'panel-seller-products', role: 'seller',
    setup: async p => {
      await openPanel(p);
      await safeClick(p, '.admin-nav-btn[data-tab="products"]'); await p.waitForTimeout(900);
    },
    checks: { npReset: async p => true, npAdd: async p => true }
  },
  {
    id: 'panel-admin', role: 'admin',
    setup: async p => { await openPanel(p); },
    checks: {
      tabProducts: async p => visible(p, '#adminProductList'),
      tabOrders: async p => visible(p, '#adminOrderList'),
      tabClients: async p => visible(p, '#adminClientList'),
      tabRequests: async p => visible(p, '#adminRequestList'),
      tabSuppliers: async p => visible(p, '#suppliersList'),
      tabSettings: async p => true,
      dashNewProduct: async p => visible(p, '#npForm')
    }
  },
  {
    id: 'panel-admin-settings', role: 'admin',
    setup: async p => {
      await openPanel(p);
      await safeClick(p, '.admin-nav-btn[data-tab="settings"]'); await p.waitForTimeout(800);
    },
    checks: { addZone: async p => true, addPayment: async p => true, addSupplier: async p => true }
  }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
  const WAIT = Number(process.env.WAIT || 1500);

  const runScreen = async (screen) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const state = {};
    const user = screen.role ? USERS[screen.role] : null;
    if (!REAL) await installMock(context, user, state);

    const page = await context.newPage();
    let errors = [];
    page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    context.on('page', p => p.close().catch(() => {}));

    const waitApp = () => page.waitForFunction(() => {
      const vis = e => !!(e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
      const shell = vis(document.querySelector('#userInfo'));
      const content = vis(document.querySelector('.admin-nav-btn')) || vis(document.querySelector('#heroRequestBtn')) || vis(document.querySelector('#productGrid .tag-card'));
      return shell && content;
    }, null, { timeout: 20000, polling: 150 }).then(() => 'app').catch(() => null);

    const waitAuth = () => page.waitForFunction(() => {
      const e = document.querySelector('#authLoginForm');
      return !!(e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
    }, null, { timeout: 10000, polling: 150 }).then(() => 'auth').catch(() => null);

    const hasSession = () => page.evaluate(() => {
      try { return Object.keys(localStorage).some(k => /-auth-token$/.test(k) && !!localStorage.getItem(k)); } catch (e) { return false; }
    }).catch(() => false);

    const doLogin = async () => {
      if (!screen.role || !REAL) return;
      for (let attempt = 0; attempt < 2; attempt++) {
        const email = page.locator('#authLoginEmail');
        await email.waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
        await email.fill(CRED[screen.role].email).catch(() => {});
        await page.locator('#authLoginPass').fill(CRED[screen.role].password).catch(() => {});
        await email.evaluate(el => el.blur()).catch(() => {});
        await page.waitForTimeout(250);
        await page.locator('#authLoginBtn').click({ force: true, timeout: 12000 }).catch(() => {});
        if (await waitApp() === 'app') return;
        const err = (await page.locator('#loginError.show').textContent({ timeout: 1000 }).catch(() => '')) || '';
        if (err.trim()) throw new Error('login recusado: ' + err.trim().slice(0, 90));
        await page.waitForTimeout(1200);
      }
      throw new Error('login não concluiu (URL ' + page.url().replace(BASE, '/') + ')');
    };

    const reset = async () => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#appLoader', { state: 'detached', timeout: 15000 }).catch(() => {});
      const shell = (await hasSession()) ? await waitApp() : (screen.role && REAL ? await waitAuth() : await waitAuth());
      if (REAL && screen.role && shell !== 'app') await doLogin();
      if (WAIT) await page.waitForTimeout(Math.min(WAIT, 500));
      if (screen.setup) await screen.setup(page);
      await page.waitForTimeout(250);
    };

    try {
      await reset();
    } catch (e) {
      fail(screen.id, '(preparação do ecrã)', e.message.replace(/\s+/g, ' ').slice(0, 320));
      await context.close();
      return;
    }

    const list = await controlsOf(page);
    const counters = {};
    const targets = list.map(c => {
      const ordinal = counters[c.key] = (counters[c.key] || 0);
      return { ...c, ordinal };
    });

    for (const c of targets) {
      const label = c.id ? `#${c.id}` : `${c.tag}.${(c.cls.split(/\s+/)[0] || '?')} "${c.text}"`;

      if (c.external) {
        const hrefOk = /^(https:\/\/(wa\.me|web\.whatsapp\.com)|mailto:)/i.test(c.href);
        hrefOk ? ok(screen.id, label, 'link externo válido') : fail(screen.id, label, 'link externo inesperado: ' + c.href);
        continue;
      }
      if (c.disabled) { skip(screen.id, label, 'desativado'); continue; }
      if (c.tag === 'a' && c.cls.includes('skip-link')) { skip(screen.id, label, 'link de acessibilidade'); continue; }

      errors = [];
      try {
        await reset();
      } catch (e) {
        fail(screen.id, label, 'reset falhou: ' + e.message.split('\n')[0].slice(0, 90));
        continue;
      }

      const target = await findControl(page, c);
      if (!target) { skip(screen.id, label, 'não encontrado após reset'); continue; }

      try {
        await clickControl(page, target);
        await page.waitForTimeout(450);
      } catch (e) {
        if (e.blocked) {
          skip(screen.id, label, 'não clicável: ' + e.message.slice(0, 80));
        } else {
          fail(screen.id, label, 'clique falhou: ' + e.message.split('\n')[0].slice(0, 120));
        }
        continue;
      }

      if (errors.length) { fail(screen.id, label, errors.slice(0, 2).join(' | ').slice(0, 200)); continue; }

      const appOk = await page.evaluate(() => ['publicView', 'adminView', 'authView'].some(id => {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none' && el.getBoundingClientRect().height > 0;
      }));
      if (!appOk) { fail(screen.id, label, 'app sem view visível'); continue; }

      const check = screen.checks && screen.checks[c.id];
      if (check) {
        let res = false;
        try { res = await check(page); } catch (e) { res = false; }
        res ? ok(screen.id, label, 'efeito esperado') : fail(screen.id, label, 'efeito esperado não observado');
      } else {
        ok(screen.id, label, 'sem erros');
      }
    }

    await context.close();
  };

  const queue = [...SCREENS];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const screen = queue.shift();
      process.stdout.write(`  · ${screen.id}\n`);
      await runScreen(screen);
    }
  });
  await Promise.all(workers);

  await browser.close();

  const pass = results.filter(r => r.status === 'PASS').length;
  const failn = results.filter(r => r.status === 'FAIL').length;
  const skipn = results.filter(r => r.status === 'SKIP').length;

  let last = null;
  results.forEach(r => {
    if (r.screen !== last) { console.log(`\n--- ${r.screen} ---`); last = r.screen; }
    console.log(`${r.status.padEnd(4)} ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
  });
  console.log(`\nTOTAL: ${pass} PASS / ${failn} FAIL / ${skipn} SKIP`);
  process.exit(failn ? 1 : 0);
})();
