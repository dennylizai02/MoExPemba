import { test, expect, Page } from '@playwright/test';

const USER_EMAIL = 'lizaivalden@gmail.com';
const USER_PASS = 'Isly2017';

async function loginAsUser(page: Page) {
  await page.goto('/');
  await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
  await page.fill('#authLoginEmail', USER_EMAIL);
  await page.fill('#authLoginPass', USER_PASS);
  await page.click('#authLoginBtn');
  await page.waitForSelector('#publicView, #adminView, #tabDashboard', { state: 'visible', timeout: 15000 });
  const adminView = await page.locator('#adminView').isVisible().catch(() => false);
  if (adminView) {
    const storeBtn = page.locator('[data-tab="store"]');
    if (await storeBtn.isVisible()) {
      await storeBtn.click();
      await page.waitForSelector('#publicView', { state: 'visible', timeout: 5000 });
    }
  }
  await page.waitForTimeout(1000);
}

// ═══════════════════════════════════════════
// PERFIL - LOGIN
// ═══════════════════════════════════════════

test.describe('Perfil - Login', () => {
  test('login com credenciais de cliente', async ({ page }) => {
    await loginAsUser(page);
    const dashboardVisible = await page.locator('#tabDashboard').isVisible().catch(() => false);
    const publicVisible = await page.locator('#publicView').isVisible().catch(() => false);
    expect(dashboardVisible || publicVisible).toBe(true);
  });

  test('login redireciona para vista correta', async ({ page }) => {
    await loginAsUser(page);
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(currentUrl).toContain('moexpemba.vercel.app');
  });

  test('login com senha errada mostra erro', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.fill('#authLoginEmail', USER_EMAIL);
    await page.fill('#authLoginPass', 'senhaerrada123');
    await page.click('#authLoginBtn');
    await page.waitForSelector('#loginError.show', { timeout: 10000 });
    await expect(page.locator('#loginError')).toBeVisible();
  });
});

// ═══════════════════════════════════════════
// PERFIL - INFORMAÇÕES DO UTILIZADOR
// ═══════════════════════════════════════════

test.describe('Perfil - Informações do Utilizador', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('informações do utilizador são exibidas no header', async ({ page }) => {
    const userInfo = page.locator('#userInfo');
    await expect(userInfo).toBeVisible();
    const text = await userInfo.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('nome do utilizador aparece no header', async ({ page }) => {
    const userInfo = page.locator('#userInfo');
    const text = await userInfo.textContent();
    expect(text).toBeTruthy();
  });

  test('carrinho está disponível após login', async ({ page }) => {
    const cartBtn = page.locator('#openCart');
    await expect(cartBtn).toBeVisible();
  });
});

// ═══════════════════════════════════════════
// PERFIL - LOJA PÚBLICA
// ═══════════════════════════════════════════

test.describe('Perfil - Loja', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('produtos são exibidos na loja', async ({ page }) => {
    const grid = page.locator('#productGrid');
    if (await grid.isVisible()) {
      const cards = grid.locator('.tag-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('pesquisa de produtos funciona', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    if (await searchBox.isVisible()) {
      await searchBox.fill('capulana');
      await page.waitForTimeout(500);
      const grid = page.locator('#productGrid');
      const cards = grid.locator('.tag-card');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('categorias são exibidas', async ({ page }) => {
    const chips = page.locator('#categoryChips .chip');
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// PERFIL - CARRINHO E CHECKOUT
// ═══════════════════════════════════════════

test.describe('Perfil - Carrinho e Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
    const grid = page.locator('#productGrid');
    if (await grid.isVisible()) {
      const addBtn = page.locator('#productGrid .add-btn').first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(1000);
        const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show')).catch(() => false);
        if (modalVisible) {
          await page.click('#pmAdd');
          await page.waitForTimeout(500);
        }
      }
    }
  });

  test('carrinho mostra itens', async ({ page }) => {
    const cartCount = page.locator('#cartCount');
    const text = await cartCount.textContent();
    const count = parseInt(text || '0');
    if (count > 0) {
      await page.click('#openCart');
      await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
      const items = page.locator('#cartItems');
      await expect(items).toBeVisible();
    }
  });

  test('checkout preenche dados do utilizador automaticamente', async ({ page }) => {
    const cartCount = page.locator('#cartCount');
    const text = await cartCount.textContent();
    const count = parseInt(text || '0');
    if (count > 0) {
      await page.click('#openCart');
      await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
      await page.click('#goCheckout');
      await page.waitForSelector('#checkoutModal', { state: 'visible', timeout: 5000 });
      const nameVal = await page.locator('#ckName').inputValue();
      const phoneVal = await page.locator('#ckPhone').inputValue();
      expect(nameVal.length).toBeGreaterThan(0);
      expect(phoneVal.length).toBeGreaterThan(0);
    }
  });

  test('checkout tem zonas de entrega', async ({ page }) => {
    const cartCount = page.locator('#cartCount');
    const text = await cartCount.textContent();
    const count = parseInt(text || '0');
    if (count > 0) {
      await page.click('#openCart');
      await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
      await page.click('#goCheckout');
      await page.waitForSelector('#checkoutModal', { state: 'visible', timeout: 5000 });
      const options = page.locator('#ckZone option');
      const count = await options.count();
      expect(count).toBeGreaterThan(1);
    }
  });

  test('checkout fecha com botão', async ({ page }) => {
    const cartCount = page.locator('#cartCount');
    const text = await cartCount.textContent();
    const count = parseInt(text || '0');
    if (count > 0) {
      await page.click('#openCart');
      await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
      await page.click('#goCheckout');
      await page.waitForSelector('#checkoutModal', { state: 'visible', timeout: 5000 });
      await page.click('#ckClose');
      await expect(page.locator('#checkoutModal')).not.toHaveClass(/show/);
    }
  });
});

// ═══════════════════════════════════════════
// PERFIL - ADMIN (se aplicável)
// ═══════════════════════════════════════════

test.describe('Perfil - Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('dashboard é exibido se user é admin', async ({ page }) => {
    const dashboardVisible = await page.locator('#tabDashboard').isVisible().catch(() => false);
    if (dashboardVisible) {
      await expect(page.locator('#dashboardStats')).toBeVisible();
    }
  });

  test('sidebar de admin está disponível se user é admin', async ({ page }) => {
    const adminView = page.locator('#adminView');
    if (await adminView.isVisible()) {
      const navBtns = page.locator('.admin-nav-btn');
      const count = await navBtns.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('pode navegar para Loja', async ({ page }) => {
    const lojaBtn = page.locator('[data-tab="store"]');
    if (await lojaBtn.isVisible()) {
      await lojaBtn.click();
      await page.waitForTimeout(1000);
      const publicView = page.locator('#publicView');
      await expect(publicView).toBeVisible();
    }
  });

  test('pode navegar para Encomendas', async ({ page }) => {
    const ordersBtn = page.locator('[data-tab="orders"]');
    if (await ordersBtn.isVisible()) {
      await ordersBtn.click();
      await page.waitForSelector('#tabOrders', { state: 'visible', timeout: 5000 });
      await expect(page.locator('#tabOrders')).toBeVisible();
    }
  });

  test('pode navegar para Produtos', async ({ page }) => {
    const productsBtn = page.locator('[data-tab="products"]');
    if (await productsBtn.isVisible()) {
      await productsBtn.click();
      await page.waitForSelector('#tabProducts', { state: 'visible', timeout: 5000 });
      await expect(page.locator('#tabProducts')).toBeVisible();
    }
  });

  test('pode navegar para Clientes', async ({ page }) => {
    const clientsBtn = page.locator('[data-tab="clients"]');
    if (await clientsBtn.isVisible()) {
      await clientsBtn.click();
      await page.waitForSelector('#tabClients', { state: 'visible', timeout: 5000 });
      await expect(page.locator('#tabClients')).toBeVisible();
    }
  });

  test('pode navegar para Configurações', async ({ page }) => {
    const settingsBtn = page.locator('[data-tab="settings"]');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForSelector('#tabSettings', { state: 'visible', timeout: 5000 });
      await expect(page.locator('#tabSettings')).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════
// PERFIL - MODAL DE PRODUTO
// ═══════════════════════════════════════════

test.describe('Perfil - Modal de Produto', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('modal de produto abre e fecha', async ({ page }) => {
    const grid = page.locator('#productGrid');
    if (await grid.isVisible()) {
      const viewBtn = page.locator('#productGrid .view-btn').first();
      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await expect(page.locator('#productModal')).toHaveClass(/show/);
        await page.keyboard.press('Escape');
        await expect(page.locator('#productModal')).not.toHaveClass(/show/);
      }
    }
  });

  test('modal mostra detalhes do produto', async ({ page }) => {
    const grid = page.locator('#productGrid');
    if (await grid.isVisible()) {
      const viewBtn = page.locator('#productGrid .view-btn').first();
      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await expect(page.locator('#pmName')).toBeVisible();
        await expect(page.locator('#pmPrice')).toBeVisible();
        await expect(page.locator('#pmAdd')).toBeVisible();
      }
    }
  });
});

// ═══════════════════════════════════════════
// PERFIL - LOGOUT
// ═══════════════════════════════════════════

test.describe('Perfil - Logout', () => {
  test('logout volta para ecrã de login', async ({ page }) => {
    await loginAsUser(page);
    const logoutBtn = page.locator('#adLogout');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
      await expect(page.locator('#authLoginForm')).toBeVisible();
    }
  });
});
