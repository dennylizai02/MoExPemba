const { chromium } = require('playwright');

const log = [];
const check = (label, value) => { log.push(`${value ? 'PASS' : 'FAIL'}  ${label}${value === true || value === false ? '' : ' → ' + value}`); return value; };

(async () => {
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('**://zhtiplewwerabqbkeahe.supabase.co/**', route => route.abort());
  await context.route('**://picsum.photos/**', route => route.abort());
  await context.route('**://images.unsplash.com/**', route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  const vis = async sel => page.locator(sel).first().isVisible().catch(() => false);

  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  check('form de login visível de imediato', await vis('#authLoginForm'));
  check('loader removido', !(await vis('#appLoader')));

  // erro de login em modo offline (força o estado offline)
  await page.fill('#authLoginEmail', 'teste@moex.mz');
  await page.fill('#authLoginPass', 'senha12345');
  await page.click('#authLoginBtn');
  await page.waitForTimeout(10000);
  check('erro de login visível', await vis('#loginError.show'));
  const errTxt = (await page.locator('#loginError').textContent().catch(() => '')) || '';
  check('mensagem de serviço indisponível', /indispon|ligaç|servidor/i.test(errTxt));
  check('banner offline visível', await vis('#offlineBanner'));
  check('link "explorar catálogo" visível', await vis('#browseOffline'));

  // browsing offline
  await page.click('#browseOffline');
  await page.waitForTimeout(1200);
  check('loja visível em modo offline', await vis('#publicView'));
  check('catálogo local com produtos', (await page.locator('#productGrid .tag-card').count()) > 0);
  check('result count ok', ((await page.locator('#resultCount').textContent()) || '').includes('encontrado'));
  await page.screenshot({ path: '/tmp/moex-offline.png', fullPage: false });

  console.log(log.join('\n'));
  console.log('\nERROS:', errors.length ? errors.join('\n') : 'nenhum');
  await browser.close();
})();
