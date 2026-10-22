const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const WIDTHS = (process.env.WIDTHS || '320,360,390,414,480,640,768,1024,1280,1440,1920').split(',').map(Number);
const CREDS = {
  client: { email: 'teste.cliente@moex.mz', password: 'Teste2026!' },
  admin: { email: 'teste.admin@moex.mz', password: 'Teste2026!' }
};

const issues = [];
const note = (w, view, kind, detail) => issues.push({ w, view, kind, detail });

async function inspect(page, width, view) {
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter(a => a.playState === 'running').map(a => a.finished.catch(() => {}))),
    new Promise(r => setTimeout(r, 1200))
  ]));
  const report = await page.evaluate(() => {
    const out = { overflow: null, offenders: [], small: [], brokenImg: [], tiny: [] };

    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const docW = document.documentElement.clientWidth;
    const scrollW = document.documentElement.scrollWidth;
    out.overflow = scrollW - docW;

    const drawer = document.getElementById('cartDrawer');
    const drawerOpen = !!(drawer && drawer.classList.contains('show'));

    const inScroller = el => {
      let node = el.parentElement;
      while (node && node !== document.body) {
        if (getComputedStyle(node).overflowX !== 'visible') return true;
        node = node.parentElement;
      }
      return false;
    };

    const visible = el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.position === 'fixed') return false;
      if (el.closest('.skip-link') || el.classList.contains('skip-link')) return false;
      if (!drawerOpen && el.closest('#cartDrawer')) return false;
      const modal = el.closest('.modal');
      if (modal && !modal.classList.contains('show')) return false;
      return true;
    };

    const desc = el => el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      (el.className && el.className.toString ? '.' + el.className.toString().trim().split(/\s+/).slice(0, 2).join('.') : '');

    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (inScroller(el)) continue;
      if (r.right > docW + 1 || r.left < -1) {
        out.offenders.push({ sel: desc(el), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
      }
    }

    document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]').forEach(el => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (st.pointerEvents === 'none') return;
      const interactive = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
      if (interactive && (r.height < 30 || r.width < 22)) {
        out.small.push({ sel: desc(el), w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 20) });
      }
      if (interactive && parseFloat(st.fontSize) < 11 && (el.textContent || '').trim()) {
        out.tiny.push({ sel: desc(el), fs: st.fontSize, text: (el.textContent || '').trim().slice(0, 20) });
      }
    });

    document.querySelectorAll('img').forEach(img => {
      if (!visible(img)) return;
      if (img.complete && img.naturalWidth === 0) {
        out.brokenImg.push({ src: (img.src || '').slice(0, 70), alt: img.alt });
      }
    });

    return out;
  });

  if (report.overflow > 1) note(width, view, 'overflow', `scrollWidth excede em ${report.overflow}px`);
  const uniqueOffenders = [...new Map(report.offenders.map(o => [o.sel, o])).values()].slice(0, 6);
  uniqueOffenders.forEach(o => note(width, view, 'elemento-fora', `${o.sel} (left ${o.left}, right ${o.right}, w ${o.w})`));
  [...new Map(report.small.map(o => [o.sel + o.text, o])).values()].slice(0, 8).forEach(o =>
    note(width, view, 'alvo-pequeno', `${o.sel} ${o.w}x${o.h}px "${o.text}"`));
  [...new Map(report.tiny.map(o => [o.sel + o.text, o])).values()].slice(0, 5).forEach(o =>
    note(width, view, 'texto-minusculo', `${o.sel} ${o.fs} "${o.text}"`));
  report.brokenImg.slice(0, 4).forEach(o => note(width, view, 'imagem-quebrada', `${o.alt || o.src}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  // entrar como cliente
  if (await page.locator('#authLoginEmail').count()) {
    await page.locator('#authLoginEmail').fill(CREDS.client.email);
    await page.locator('#authLoginPass').fill(CREDS.client.password);
    await page.locator('#authLoginBtn').click();
    await page.waitForTimeout(3000);
  }

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(600);

    // loja
    await inspect(page, width, 'loja');

    // modal de produto
    const card = page.locator('#productGrid .tag-card').first();
    if (await card.count()) {
      await card.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
      await inspect(page, width, 'modal-produto');
      await page.keyboard.press('Escape').catch(() => {});
      await page.locator('#pmClose').click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }

    // carrinho
    await page.locator('#openCart').click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    await inspect(page, width, 'carrinho');
    await page.locator('#closeCart').click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);

    // checkout
    await page.locator('.add-btn').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('#openCart').click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('#goCheckout').click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    await inspect(page, width, 'checkout');
    await page.locator('#ckClose').click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);

    // painel (se tiver acesso)
    const openAdmin = page.locator('#openAdmin');
    if (await openAdmin.isVisible().catch(() => false)) {
      await openAdmin.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1400);
      await inspect(page, width, 'painel');
      await page.locator('.admin-nav-btn[data-tab="products"]').click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
      await inspect(page, width, 'painel-produtos');
    }
  }

  await browser.close();

  if (!issues.length) {
    console.log('RESPONSIVIDADE: nenhum problema em ' + WIDTHS.length + ' larguras (' + WIDTHS.join(', ') + ').');
  } else {
    let last = null;
    issues.forEach(i => {
      if (i.w !== last) { console.log(`\n=== ${i.w}px ===`); last = i.w; }
      console.log(`  [${i.kind}] ${i.view}: ${i.detail}`);
    });
    console.log(`\nTOTAL de avisos: ${issues.length}`);
  }
})();
