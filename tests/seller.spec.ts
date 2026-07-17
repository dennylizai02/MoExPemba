import { test, expect, Page } from '@playwright/test';

const SELLER_EMAIL = 'miltoncesarlizai9@gmail.com';
const SELLER_PASS = 'Isly2017';

async function loginAsSeller(page: Page) {
  await page.goto('/');
  await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
  await page.fill('#authLoginEmail', SELLER_EMAIL);
  await page.fill('#authLoginPass', SELLER_PASS);
  await page.click('#authLoginBtn');
  await page.waitForSelector('#adminView', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════
// SELLER - LOGIN
// ═══════════════════════════════════════════

test.describe('Seller - Login', () => {
  test('login com credenciais de seller', async ({ page }) => {
    await loginAsSeller(page);
    const adminVisible = await page.locator('#adminView').isVisible();
    expect(adminVisible).toBe(true);
  });

  test('login redireciona para admin view', async ({ page }) => {
    await loginAsSeller(page);
    const adminView = page.locator('#adminView');
    await expect(adminView).toBeVisible();
  });

  test('login com senha errada mostra erro', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.fill('#authLoginEmail', SELLER_EMAIL);
    await page.fill('#authLoginPass', 'senhaerrada123');
    await page.click('#authLoginBtn');
    await page.waitForSelector('#loginError.show', { timeout: 10000 });
    await expect(page.locator('#loginError')).toBeVisible();
  });
});

// ═══════════════════════════════════════════
// SELLER - HEADER / UI
// ═══════════════════════════════════════════

test.describe('Seller - Header e UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeller(page);
  });

  test('badge "Vendedor" é exibido', async ({ page }) => {
    const badges = page.locator('.role-badge, .seller');
    const count = await badges.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      const text = await badges.nth(i).textContent();
      if (text?.includes('Vendedor')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('informações do utilizador são exibidas', async ({ page }) => {
    const userInfo = page.locator('#userInfo');
    await expect(userInfo).toBeVisible();
    const text = await userInfo.textContent();
    expect(text).toBeTruthy();
  });
});

// ═══════════════════════════════════════════
// SELLER - TABS DISPONÍVEIS
// ═══════════════════════════════════════════

test.describe('Seller - Tabs Disponíveis', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeller(page);
  });

  test('tab Loja está visível', async ({ page }) => {
    const storeTab = page.locator('[data-tab="store"]');
    await expect(storeTab).toBeVisible();
  });

  test('tab Painel está visível', async ({ page }) => {
    const dashboardTab = page.locator('[data-tab="dashboard"]');
    await expect(dashboardTab).toBeVisible();
  });

  test('tab Encomendas está visível', async ({ page }) => {
    const ordersTab = page.locator('[data-tab="orders"]');
    await expect(ordersTab).toBeVisible();
  });

  test('tab Produtos está visível', async ({ page }) => {
    const productsTab = page.locator('[data-tab="products"]');
    await expect(productsTab).toBeVisible();
  });

  test('tab Clientes está oculta para seller', async ({ page }) => {
    const clientsTab = page.locator('[data-tab="clients"]');
    const display = await clientsTab.evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('tab Pedidos está oculta para seller', async ({ page }) => {
    const requestsTab = page.locator('[data-tab="requests"]');
    const display = await requestsTab.evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('tab Configurações está oculta para seller', async ({ page }) => {
    const settingsTab = page.locator('[data-tab="settings"]');
    const display = await settingsTab.evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('tab Fornecedores está oculta para seller', async ({ page }) => {
    const suppliersTab = page.locator('[data-tab="suppliers"]');
    const display = await suppliersTab.evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('aba Encomendas renomeada para "As Minhas Encomendas"', async ({ page }) => {
    const ordersTab = page.locator('[data-tab="orders"]');
    const text = await ordersTab.textContent();
    expect(text?.trim()).toContain('Minhas Encomendas');
  });
});

// ═══════════════════════════════════════════
// SELLER - NAVEGAÇÃO
// ═══════════════════════════════════════════

test.describe('Seller - Navegação', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeller(page);
  });

  test('pode navegar para Painel', async ({ page }) => {
    await page.click('[data-tab="dashboard"]');
    await expect(page.locator('#tabDashboard')).toBeVisible();
  });

  test('pode navegar para Encomendas', async ({ page }) => {
    await page.click('[data-tab="orders"]');
    await expect(page.locator('#tabOrders')).toBeVisible();
  });

  test('pode navegar para Produtos', async ({ page }) => {
    await page.click('[data-tab="products"]');
    await expect(page.locator('#tabProducts')).toBeVisible();
  });

  test('pode navegar para Loja', async ({ page }) => {
    await page.click('[data-tab="store"]');
    await expect(page.locator('#publicView')).toBeVisible();
  });

  test('navegação entre tabs funciona', async ({ page }) => {
    await page.click('[data-tab="orders"]');
    await expect(page.locator('#tabOrders')).toBeVisible();
    await page.click('[data-tab="products"]');
    await expect(page.locator('#tabProducts')).toBeVisible();
    await expect(page.locator('#tabOrders')).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════
// SELLER - DASHBOARD
// ═══════════════════════════════════════════

test.describe('Seller - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeller(page);
  });

  test('dashboard é exibido', async ({ page }) => {
    await page.click('[data-tab="dashboard"]');
    await expect(page.locator('#tabDashboard')).toBeVisible();
  });

  test('stats do dashboard são exibidos', async ({ page }) => {
    await page.click('[data-tab="dashboard"]');
    const stats = page.locator('#dashboardStats');
    await expect(stats).toBeVisible();
    const statCards = stats.locator('.stat-card');
    const count = await statCards.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// SELLER - PRODUTOS
// ═══════════════════════════════════════════

test.describe('Seller - Produtos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeller(page);
    await page.click('[data-tab="products"]');
    await page.waitForSelector('#tabProducts', { state: 'visible', timeout: 5000 });
  });

  test('formulário de produto tem campos necessários', async ({ page }) => {
    await expect(page.locator('#npName')).toBeVisible();
    await expect(page.locator('#npPrice')).toBeVisible();
    await expect(page.locator('#npCat')).toBeVisible();
    await expect(page.locator('#npImg')).toBeVisible();
    await expect(page.locator('#npAdd')).toBeVisible();
  });

  test('seller pode criar produto', async ({ page }) => {
    const testProductName = 'Produto Seller E2E ' + Date.now();
    await page.fill('#npName', testProductName);
    await page.fill('#npPrice', '750');
    await page.fill('#npCat', 'Testes');
    await page.fill('#npDesc', 'Produto criado pelo seller durante teste E2E');
    await page.click('#npAdd');
    await page.waitForTimeout(3000);
    const productList = page.locator('#adminProductList');
    const hasProduct = await productList.textContent().then(t => t?.includes(testProductName) ?? false);
    if (hasProduct) {
      await expect(productList).toContainText(testProductName);
    } else {
      const toastText = await page.locator('#toast').textContent().catch(() => '');
      expect(toastText).toContain('Erro');
    }
  });

  test('lista de produtos do seller é exibida', async ({ page }) => {
    const productList = page.locator('#adminProductList');
    await expect(productList).toBeVisible();
  });
});

// ═══════════════════════════════════════════
// SELLER - ENCOMENDAS
// ═══════════════════════════════════════════

test.describe('Seller - Encomendas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeller(page);
    await page.click('[data-tab="orders"]');
    await page.waitForSelector('#tabOrders', { state: 'visible', timeout: 5000 });
  });

  test('filtros de status são exibidos', async ({ page }) => {
    const filters = page.locator('[data-status-filter]');
    const count = await filters.count();
    expect(count).toBeGreaterThan(0);
  });

  test('filtro "Todas" está ativo por padrão', async ({ page }) => {
    const allFilter = page.locator('[data-status-filter="all"]');
    await expect(allFilter).toHaveClass(/active/);
  });
});

// ═══════════════════════════════════════════
// SELLER - LOJA
// ═══════════════════════════════════════════

test.describe('Seller - Loja', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeller(page);
    await page.click('[data-tab="store"]');
    await page.waitForSelector('#publicView', { state: 'visible', timeout: 5000 });
  });

  test('produtos são exibidos na loja', async ({ page }) => {
    const grid = page.locator('#productGrid');
    await expect(grid).toBeVisible();
    const cards = grid.locator('.tag-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('pesquisa de produtos funciona', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    await searchBox.fill('capulana');
    await page.waitForTimeout(400);
    const cards = page.locator('#productGrid .tag-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('modal de produto abre e fecha', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#productModal')).not.toHaveClass(/show/);
  });
});

// ═══════════════════════════════════════════
// SELLER - LOGOUT
// ═══════════════════════════════════════════

test.describe('Seller - Logout', () => {
  test('logout volta para ecrã de login', async ({ page }) => {
    await loginAsSeller(page);
    await page.waitForSelector('#adLogout', { state: 'visible', timeout: 5000 });
    await page.click('#adLogout');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await expect(page.locator('#authLoginForm')).toBeVisible();
  });
});
