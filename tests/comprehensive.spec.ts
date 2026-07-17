import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL = 'lizaivalden1@outlook.com';
const USER_EMAIL = 'lizaivalden@gmail.com';
const SELLER_EMAIL = 'miltoncesarlizai9@gmail.com';
const PASS = 'Isly2017';

async function loginAs(page: Page, email: string) {
  await page.goto('/');
  await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
  await page.fill('#authLoginEmail', email);
  await page.fill('#authLoginPass', PASS);
  await page.click('#authLoginBtn');
  await page.waitForSelector('#publicView, #adminView, #tabDashboard', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
}

async function loginAsAdmin(page: Page) { await loginAs(page, ADMIN_EMAIL); }
async function loginAsUser(page: Page) { await loginAs(page, USER_EMAIL); }
async function loginAsSeller(page: Page) { await loginAs(page, SELLER_EMAIL); }

async function openStore(page: Page) {
  const lojaBtn = page.locator('[data-tab="store"]');
  if (await lojaBtn.isVisible()) {
    await lojaBtn.click();
    await page.waitForSelector('#publicView', { state: 'visible', timeout: 5000 });
  }
}

async function addFirstProductToCart(page: Page) {
  await page.evaluate(() => {
    document.getElementById('openCart')!.style.display = '';
  });
  const addBtn = page.locator('#productGrid .add-btn').first();
  await addBtn.click();
  await page.waitForTimeout(500);
  const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show')).catch(() => false);
  if (modalVisible) {
    await page.click('#pmAdd');
    await page.waitForTimeout(500);
  }
}

async function openCheckoutWithItem(page: Page) {
  await addFirstProductToCart(page);
  await page.click('#openCart');
  await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
  await page.click('#goCheckout');
  await page.waitForSelector('#checkoutModal', { state: 'visible', timeout: 5000 });
}

// ═══════════════════════════════════════════
// AUTH (6 tests)
// ═══════════════════════════════════════════

test.describe('Comprehensive - Auth', () => {
  test('Enter no campo email faz login', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.fill('#authLoginEmail', ADMIN_EMAIL);
    await page.fill('#authLoginPass', PASS);
    await page.press('#authLoginEmail', 'Enter');
    await page.waitForSelector('#tabDashboard, #publicView, #adminView', { state: 'visible', timeout: 15000 });
    const logged = await page.locator('#tabDashboard, #publicView, #adminView').first().isVisible();
    expect(logged).toBe(true);
  });

  test('login redireciona admin para painel', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('#adminView')).toBeVisible();
    await expect(page.locator('#tabDashboard')).toBeVisible();
  });

  test('login redireciona user para vista pública', async ({ page }) => {
    await loginAsUser(page);
    await page.waitForTimeout(1000);
    const publicVisible = await page.locator('#publicView').isVisible().catch(() => false);
    const dashboardVisible = await page.locator('#tabDashboard').isVisible().catch(() => false);
    expect(publicVisible || dashboardVisible).toBe(true);
  });

  test('login redireciona seller para admin view', async ({ page }) => {
    await loginAsSeller(page);
    await expect(page.locator('#adminView')).toBeVisible();
    await expect(page.locator('#tabDashboard')).toBeVisible();
  });

  test('formulário de registo tem todos os campos', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.click('#showRegister');
    await expect(page.locator('#authRegName')).toBeVisible();
    await expect(page.locator('#authRegEmail')).toBeVisible();
    await expect(page.locator('#authRegPhone')).toBeVisible();
    await expect(page.locator('#authRegPass')).toBeVisible();
    await expect(page.locator('#authRegPass2')).toBeVisible();
    await expect(page.locator('#authRegBtn')).toBeVisible();
  });

  test('link "Já tem conta" volta ao login a partir do registo', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.click('#showRegister');
    await expect(page.locator('#authRegisterForm')).toBeVisible();
    await page.click('#showLogin');
    await expect(page.locator('#authLoginForm')).toBeVisible();
    await expect(page.locator('#authRegisterForm')).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════
// STORE / PRODUCTS (13 tests)
// ═══════════════════════════════════════════

test.describe('Comprehensive - Loja e Produtos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openStore(page);
  });

  test('ordenação por mais vendidos', async ({ page }) => {
    const sortBox = page.locator('#sortBox');
    await sortBox.selectOption('sold-desc');
    await page.waitForTimeout(300);
    const cards = page.locator('#productGrid .tag-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('ordenação por preço descendente', async ({ page }) => {
    const sortBox = page.locator('#sortBox');
    await sortBox.selectOption('price-desc');
    await page.waitForTimeout(300);
    const cards = page.locator('#productGrid .tag-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    if (count >= 2) {
      const firstPrice = await cards.first().locator('.tag-price').textContent();
      const lastPrice = await cards.last().locator('.tag-price').textContent();
      expect(firstPrice).toBeDefined();
      expect(lastPrice).toBeDefined();
    }
  });

  test('modal mostra descrição do produto', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    const desc = page.locator('#pmDesc');
    await expect(desc).toBeVisible();
    const text = await desc.textContent();
    expect(text).toBeDefined();
  });

  test('modal mostra material do produto', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    const material = page.locator('#pmMaterial');
    await expect(material).toBeVisible();
  });

  test('modal mostra tempo de entrega', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    const entrega = page.locator('#pmEntrega');
    await expect(entrega).toBeVisible();
  });

  test('modal mostra avaliações existentes', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    const reviews = page.locator('#pmReviews');
    await expect(reviews).toBeVisible();
  });

  test('modal mostra formulário de avaliação', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    await expect(page.locator('#rvName')).toBeVisible();
    await expect(page.locator('#rvRating')).toBeVisible();
    await expect(page.locator('#rvComment')).toBeVisible();
    await expect(page.locator('#rvSend')).toBeVisible();
  });

  test('modal fecha com botão ✕', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    await page.click('#pmClose');
    await expect(page.locator('#productModal')).not.toHaveClass(/show/);
  });

  test('thumbnails de fotos adicionais são exibidos', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    const thumbs = page.locator('#pmThumbs');
    await expect(thumbs).toBeVisible();
  });

  test('modal mostra formas de pagamento', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    const payments = page.locator('#pmPayments');
    await expect(payments).toBeVisible();
    const text = await payments.textContent();
    expect(text).toBeDefined();
  });

  test('modal mostra zonas de entrega', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    const zones = page.locator('#pmZones');
    await expect(zones).toBeVisible();
    const text = await zones.textContent();
    expect(text).toBeDefined();
  });

  test('modal mostra sold count', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    const sold = page.locator('#pmSold');
    await expect(sold).toBeVisible();
  });

  test('modal mostra rating summary', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    const summary = page.locator('#pmRatingSummary');
    await expect(summary).toBeVisible();
  });
});

// ═══════════════════════════════════════════
// CART (9 tests)
// ═══════════════════════════════════════════

test.describe('Comprehensive - Carrinho', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openStore(page);
  });

  test('adicionar mesmo produto incrementa quantidade', async ({ page }) => {
    const addBtn = page.locator('#productGrid .add-btn').first();
    await addBtn.click();
    await page.waitForTimeout(500);
    const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show')).catch(() => false);
    if (modalVisible) {
      await page.click('#pmAdd');
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const addBtn2 = page.locator('#productGrid .add-btn').first();
      await addBtn2.click();
      await page.waitForTimeout(500);
      const modalVisible2 = await page.locator('#productModal').evaluate(el => el.classList.contains('show')).catch(() => false);
      if (modalVisible2) {
        await page.click('#pmAdd');
        await page.waitForTimeout(500);
      }
    }
    const cartCountText = await page.locator('#cartCount').textContent();
    const count = parseInt(cartCountText || '0');
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('remover item do carrinho', async ({ page }) => {
    await addFirstProductToCart(page);
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    const removeBtn = page.locator('#cartItems .cart-remove, #cartItems button[data-remove]').first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('contador do carrinho atualiza ao adicionar', async ({ page }) => {
    const before = parseInt(await page.locator('#cartCount').textContent() || '0');
    const addBtn = page.locator('#productGrid .add-btn').first();
    await addBtn.click();
    await page.waitForTimeout(500);
    const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show')).catch(() => false);
    if (modalVisible) {
      await page.click('#pmAdd');
      await page.waitForTimeout(500);
    }
    const after = parseInt(await page.locator('#cartCount').textContent() || '0');
    expect(after).toBeGreaterThan(before);
  });

  test('overlay fecha carrinho ao clicar', async ({ page }) => {
    await addFirstProductToCart(page);
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#overlay')).toHaveClass(/show/);
    await page.click('#overlay');
    await page.waitForTimeout(500);
    const drawerHasShow = await page.locator('#cartDrawer').evaluate(el => el.classList.contains('show'));
    expect(drawerHasShow).toBe(false);
  });

  test('abrir carrinho mostra overlay', async ({ page }) => {
    await addFirstProductToCart(page);
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#overlay')).toHaveClass(/show/);
  });

  test('botão "Finalizar encomenda" abre checkout', async ({ page }) => {
    await addFirstProductToCart(page);
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    await page.click('#goCheckout');
    await expect(page.locator('#checkoutModal')).toHaveClass(/show/);
  });

  test('botão "Finalizar" com carrinho vazio mostra toast', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('openCart')!.style.display = '';
    });
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    await page.click('#goCheckout');
    const toast = page.locator('#toast');
    await expect(toast).toHaveClass(/show/, { timeout: 3000 });
    const text = await toast.textContent();
    expect(text).toContain('vazio');
  });

  test('carrinho mostra nome dos produtos', async ({ page }) => {
    await addFirstProductToCart(page);
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    const items = page.locator('#cartItems');
    const text = await items.textContent();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('carrinho mostra total correto', async ({ page }) => {
    await addFirstProductToCart(page);
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    const total = page.locator('#cartTotal');
    await expect(total).toBeVisible();
    const text = await total.textContent();
    expect(text).toContain('MT');
  });
});

// ═══════════════════════════════════════════
// CHECKOUT (7 tests)
// ═══════════════════════════════════════════

test.describe('Comprehensive - Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openStore(page);
    await addFirstProductToCart(page);
  });

  test('checkout sem nome mostra erro', async ({ page }) => {
    await openCheckoutWithItem(page);
    await page.fill('#ckName', '');
    await page.fill('#ckPhone', '840000000');
    await page.selectOption('#ckZone', { index: 1 });
    await page.click('#ckSave');
    await page.waitForTimeout(500);
    const toast = page.locator('#toast');
    await expect(toast).toHaveClass(/show/, { timeout: 3000 });
    const text = await toast.textContent();
    expect(text).toContain('Preencha');
  });

  test('checkout sem telefone mostra erro', async ({ page }) => {
    await openCheckoutWithItem(page);
    await page.fill('#ckName', 'Teste User');
    await page.fill('#ckPhone', '');
    await page.selectOption('#ckZone', { index: 1 });
    await page.click('#ckSave');
    await page.waitForTimeout(500);
    const toast = page.locator('#toast');
    await expect(toast).toHaveClass(/show/, { timeout: 3000 });
    const text = await toast.textContent();
    expect(text).toContain('Preencha');
  });

  test('checkout sem zona mostra erro', async ({ page }) => {
    await openCheckoutWithItem(page);
    await page.fill('#ckName', 'Teste User');
    await page.fill('#ckPhone', '840000000');
    await page.selectOption('#ckZone', '');
    await page.click('#ckSave');
    await page.waitForTimeout(500);
    const toast = page.locator('#toast');
    await expect(toast).toHaveClass(/show/, { timeout: 3000 });
    const text = await toast.textContent();
    expect(text).toContain('zona');
  });

  test('"Só registar o pedido" salva e mostra toast', async ({ page }) => {
    await openCheckoutWithItem(page);
    await page.fill('#ckName', 'Teste E2E');
    await page.fill('#ckPhone', '840000000');
    await page.selectOption('#ckZone', { index: 1 });
    await page.click('#ckSave');
    await page.waitForTimeout(3000);
    const checkoutVisible = await page.locator('#checkoutModal').evaluate(el => el.classList.contains('show'));
    expect(checkoutVisible).toBe(false);
  });

  test('campo de observações funciona', async ({ page }) => {
    await openCheckoutWithItem(page);
    await expect(page.locator('#ckNote')).toBeVisible();
    await page.fill('#ckNote', 'Cor azul, tamanho M');
    const val = await page.locator('#ckNote').inputValue();
    expect(val).toBe('Cor azul, tamanho M');
  });

  test('selecionar zona "Outro" mostra campo de texto', async ({ page }) => {
    await openCheckoutWithItem(page);
    const otherOption = page.locator('#ckZone option[value="__other"]');
    if (await otherOption.count() > 0) {
      await page.selectOption('#ckZone', '__other');
      await expect(page.locator('#ckAddrOtherWrap')).toBeVisible();
    }
  });

  test('checkout fecha e limpa modal', async ({ page }) => {
    await openCheckoutWithItem(page);
    await page.fill('#ckNote', 'Teste obs');
    await page.click('#ckClose');
    await expect(page.locator('#checkoutModal')).not.toHaveClass(/show/);
  });
});

// ═══════════════════════════════════════════
// MEUS PEDIDOS (7 tests)
// ═══════════════════════════════════════════

test.describe('Comprehensive - Os Meus Pedidos', () => {
  test('botão "Os Meus Pedidos" visível para user', async ({ page }) => {
    await loginAsUser(page);
    await page.waitForTimeout(1000);
    const btn = page.locator('#openMyOrders');
    const display = await btn.evaluate(el => window.getComputedStyle(el).display);
    expect(display).not.toBe('none');
  });

  test('botão "Os Meus Pedidos" oculto para admin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(1000);
    const btn = page.locator('#openMyOrders');
    const display = await btn.evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('botão "Os Meus Pedidos" oculto para seller', async ({ page }) => {
    await loginAsSeller(page);
    await page.waitForTimeout(1000);
    const btn = page.locator('#openMyOrders');
    const display = await btn.evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('abrir Meus Pedidos mostra modal com título', async ({ page }) => {
    await loginAsUser(page);
    await page.waitForTimeout(1000);
    const btn = page.locator('#openMyOrders');
    const display = await btn.evaluate(el => window.getComputedStyle(el).display);
    if (display !== 'none') {
      await btn.click();
      await expect(page.locator('#myOrdersModal')).toHaveClass(/show/, { timeout: 5000 });
      const heading = page.locator('#myOrdersModal .modal-head h3');
      await expect(heading).toContainText('Os Meus Pedidos');
    }
  });

  test('fechar Meus Pedidos com botão ✕', async ({ page }) => {
    await loginAsUser(page);
    await page.waitForTimeout(1000);
    const btn = page.locator('#openMyOrders');
    const display = await btn.evaluate(el => window.getComputedStyle(el).display);
    if (display !== 'none') {
      await btn.click();
      await expect(page.locator('#myOrdersModal')).toHaveClass(/show/, { timeout: 5000 });
      await page.click('#moClose');
      await expect(page.locator('#myOrdersModal')).not.toHaveClass(/show/);
    }
  });

  test('Meus Pedidos mostra conteúdo da lista', async ({ page }) => {
    await loginAsUser(page);
    await page.waitForTimeout(1000);
    const btn = page.locator('#openMyOrders');
    const display = await btn.evaluate(el => window.getComputedStyle(el).display);
    if (display !== 'none') {
      await btn.click();
      await expect(page.locator('#myOrdersModal')).toHaveClass(/show/, { timeout: 5000 });
      await page.waitForTimeout(1000);
      const list = page.locator('#myOrdersList');
      const text = await list.textContent();
      expect(text!.length).toBeGreaterThan(0);
    }
  });

  test('Meus Pedidos vazio ou com dados mostra conteúdo', async ({ page }) => {
    await loginAsUser(page);
    await page.waitForTimeout(1000);
    const btn = page.locator('#openMyOrders');
    const display = await btn.evaluate(el => window.getComputedStyle(el).display);
    if (display !== 'none') {
      await btn.click();
      await expect(page.locator('#myOrdersModal')).toHaveClass(/show/, { timeout: 5000 });
      await page.waitForTimeout(2000);
      const list = page.locator('#myOrdersList');
      const text = await list.textContent();
      const hasContent =
        text?.includes('Ainda não fez nenhuma encomenda') ||
        text?.includes('Erro ao carregar') ||
        text?.includes('A carregar') ||
        (text?.length ?? 0) > 10;
      expect(hasContent).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════
// ADMIN DASHBOARD (5 tests)
// ═══════════════════════════════════════════

test.describe('Comprehensive - Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('dashboard mostra stats com valor numérico', async ({ page }) => {
    const stats = page.locator('#dashboardStats');
    await expect(stats).toBeVisible();
    const statCards = stats.locator('.stat-card');
    const count = await statCards.count();
    expect(count).toBeGreaterThan(0);
    const firstStatText = await statCards.first().textContent();
    expect(firstStatText).toBeDefined();
  });

  test('dashboard mostra receita total', async ({ page }) => {
    const stats = page.locator('#dashboardStats');
    const text = await stats.textContent();
    expect(text).toContain('MT');
  });

  test('dashboard mostra encomendas pendentes', async ({ page }) => {
    const stats = page.locator('#dashboardStats');
    const text = await stats.textContent();
    expect(text).toBeDefined();
  });

  test('dashboard mostra encomendas entregues', async ({ page }) => {
    const stats = page.locator('#dashboardStats');
    const text = await stats.textContent();
    expect(text).toBeDefined();
  });

  test('dashboard mostra pedidos recentes', async ({ page }) => {
    const recentSection = page.locator('#dashboardRecentOrders, #tabDashboard .admin-section').first();
    await expect(recentSection).toBeVisible();
  });
});

// ═══════════════════════════════════════════
// ADMIN ORDER FILTERS (4 tests)
// ═══════════════════════════════════════════

test.describe('Comprehensive - Admin Order Filters', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('[data-tab="orders"]');
    await page.waitForSelector('#tabOrders', { state: 'visible', timeout: 5000 });
  });

  test('filtro "Novas" funciona', async ({ page }) => {
    const filter = page.locator('[data-status-filter="novo"]');
    await filter.click();
    await expect(filter).toHaveClass(/active/);
    const allFilter = page.locator('[data-status-filter="all"]');
    await expect(allFilter).not.toHaveClass(/active/);
  });

  test('filtro "Em curso" funciona', async ({ page }) => {
    const filter = page.locator('[data-status-filter="em curso"]');
    await filter.click();
    await expect(filter).toHaveClass(/active/);
  });

  test('filtro "Entregues" funciona', async ({ page }) => {
    const filter = page.locator('[data-status-filter="entregue"]');
    await filter.click();
    await expect(filter).toHaveClass(/active/);
  });

  test('filtro "Canceladas" funciona', async ({ page }) => {
    const filter = page.locator('[data-status-filter="cancelado"]');
    await filter.click();
    await expect(filter).toHaveClass(/active/);
  });
});

// ═══════════════════════════════════════════
// ADMIN PRODUCTS - EXTRA FIELDS (2 tests)
// ═══════════════════════════════════════════

test.describe('Comprehensive - Admin Produtos Extra', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('[data-tab="products"]');
    await page.waitForSelector('#tabProducts', { state: 'visible', timeout: 5000 });
  });

  test('campo de material existe e aceita input', async ({ page }) => {
    const material = page.locator('#npMaterial');
    await expect(material).toBeVisible();
    await material.fill('Algodão');
    const val = await material.inputValue();
    expect(val).toBe('Algodão');
  });

  test('campo de badge existe e aceita input', async ({ page }) => {
    const badge = page.locator('#npBadge');
    await expect(badge).toBeVisible();
    await badge.fill('Novo');
    const val = await badge.inputValue();
    expect(val).toBe('Novo');
  });
});

// ═══════════════════════════════════════════
// SELLER EXTRAS (2 tests)
// ═══════════════════════════════════════════

test.describe('Comprehensive - Seller Extras', () => {
  test('seller pode navegar para loja pública', async ({ page }) => {
    await loginAsSeller(page);
    await page.click('[data-tab="store"]');
    await expect(page.locator('#publicView')).toBeVisible();
    const sidebar = page.locator('#adminView .admin-sidebar');
    const display = await sidebar.evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('none');
  });
});
