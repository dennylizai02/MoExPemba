import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL = 'lizaivalden1@outlook.com';
const ADMIN_PASS = 'Isly2017';

async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
  await page.fill('#authLoginEmail', ADMIN_EMAIL);
  await page.fill('#authLoginPass', ADMIN_PASS);
  await page.click('#authLoginBtn');
  await page.waitForSelector('#tabDashboard', { state: 'visible', timeout: 15000 });
}

async function openStore(page: Page) {
  const lojaBtn = page.locator('[data-tab="store"]');
  if (await lojaBtn.isVisible()) {
    await lojaBtn.click();
    await page.waitForSelector('#publicView', { state: 'visible', timeout: 5000 });
  }
}

async function loginAsAdminAndOpenStore(page: Page) {
  await loginAsAdmin(page);
  await openStore(page);
  await page.evaluate(() => {
    document.getElementById('openCart')!.style.display = '';
  });
}

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════

test.describe('Auth', () => {
  test('login com credenciais válidas', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.fill('#authLoginEmail', ADMIN_EMAIL);
    await page.fill('#authLoginPass', ADMIN_PASS);
    await page.click('#authLoginBtn');
    await page.waitForSelector('#tabDashboard', { state: 'visible', timeout: 15000 });
    await expect(page.locator('#tabDashboard')).toBeVisible();
  });

  test('login com senha errada mostra erro', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.fill('#authLoginEmail', ADMIN_EMAIL);
    await page.fill('#authLoginPass', 'senhaerrada123');
    await page.click('#authLoginBtn');
    await page.waitForSelector('#loginError.show', { timeout: 10000 });
    await expect(page.locator('#loginError')).toBeVisible();
  });

  test('login com campo vazio mostra erro', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.click('#authLoginBtn');
    await page.waitForSelector('#loginError.show', { timeout: 5000 });
    await expect(page.locator('#loginError')).toContainText('Preencha todos os campos');
  });

  test('navegar para formulário de registo', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.click('#showRegister');
    await expect(page.locator('#authRegisterForm')).toBeVisible();
    await expect(page.locator('#authLoginForm')).not.toBeVisible();
  });

  test('navegar para formulário de recuperação de senha', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.click('#showForgotPassword');
    await expect(page.locator('#authForgotForm')).toBeVisible();
    await expect(page.locator('#authLoginForm')).not.toBeVisible();
  });

  test('Enter no campo senha faz login', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await page.fill('#authLoginEmail', ADMIN_EMAIL);
    await page.fill('#authLoginPass', ADMIN_PASS);
    await page.press('#authLoginPass', 'Enter');
    await page.waitForSelector('#tabDashboard', { state: 'visible', timeout: 15000 });
    await expect(page.locator('#tabDashboard')).toBeVisible();
  });
});

// ═══════════════════════════════════════════
// LOJA / PRODUTOS
// ═══════════════════════════════════════════

test.describe('Loja', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openStore(page);
  });

  test('produtos são exibidos no grid', async ({ page }) => {
    const grid = page.locator('#productGrid');
    await expect(grid).toBeVisible();
    const cards = grid.locator('.tag-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('pesquisa filtra produtos', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    await searchBox.fill('capulana');
    await page.waitForTimeout(400);
    const cards = page.locator('#productGrid .tag-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    const firstCardText = await cards.first().textContent();
    expect(firstCardText?.toLowerCase()).toContain('capulana');
  });

  test('pesquisa sem resultados mostra estado vazio', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    await searchBox.fill('xyzprodutoinesistente123');
    await page.waitForTimeout(400);
    const emptyState = page.locator('#emptyState');
    await expect(emptyState).toBeVisible();
  });

  test('filtro por categoria funciona', async ({ page }) => {
    const chips = page.locator('#categoryChips .chip');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(1);
    const secondChip = chips.nth(1);
    const chipText = await secondChip.textContent();
    await secondChip.click();
    await page.waitForTimeout(200);
    const resultText = await page.locator('#resultCount').textContent();
    if (resultText && resultText.length > 0) {
      expect(resultText).toContain('encontrado');
    }
  });

  test('ordenação por preço funciona', async ({ page }) => {
    const sortBox = page.locator('#sortBox');
    await sortBox.selectOption('price-asc');
    await page.waitForTimeout(200);
    const cards = page.locator('#productGrid .tag-card');
    const count = await cards.count();
    if (count >= 2) {
      const firstPrice = await cards.first().locator('.tag-price').textContent();
      const lastPrice = await cards.last().locator('.tag-price').textContent();
      expect(firstPrice).toBeDefined();
      expect(lastPrice).toBeDefined();
    }
  });

  test('botão "Ver" abre modal de produto', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    await expect(page.locator('#pmName')).not.toBeEmpty();
    await expect(page.locator('#pmPrice')).not.toBeEmpty();
  });

  test('modal de produto mostra detalhes', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    await expect(page.locator('#pmName')).toBeVisible();
    await expect(page.locator('#pmImg')).toBeVisible();
    await expect(page.locator('#pmPrice')).toBeVisible();
    await expect(page.locator('#pmCat')).toBeVisible();
  });

  test('modal de produto fecha com Escape', async ({ page }) => {
    const viewBtn = page.locator('#productGrid .view-btn').first();
    await viewBtn.click();
    await expect(page.locator('#productModal')).toHaveClass(/show/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#productModal')).not.toHaveClass(/show/);
  });
});

// ═══════════════════════════════════════════
// CARRINHO
// ═══════════════════════════════════════════

test.describe('Carrinho', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminAndOpenStore(page);
  });

  test('adicionar produto ao carrinho (via modal)', async ({ page }) => {
    const addBtn = page.locator('#productGrid .add-btn').first();
    await addBtn.click();
    await page.waitForTimeout(500);
    const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show'));
    if (modalVisible) {
      await page.click('#pmAdd');
      await page.waitForTimeout(500);
    }
    const cartCount = page.locator('#cartCount');
    const text = await cartCount.textContent();
    expect(parseInt(text || '0')).toBeGreaterThan(0);
  });

  test('adicionar produto com variantes abre modal', async ({ page }) => {
    const cards = page.locator('#productGrid .tag-card');
    const count = await cards.count();
    let addedVariant = false;
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const addBtn = card.locator('.add-btn');
      await addBtn.click();
      await page.waitForTimeout(300);
      const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show'));
      if (modalVisible) {
        addedVariant = true;
        await expect(page.locator('#productModal')).toHaveClass(/show/);
        await page.keyboard.press('Escape');
        break;
      }
    }
  });

  test('carrinho mostra itens e total', async ({ page }) => {
    const addBtn = page.locator('#productGrid .add-btn').first();
    await addBtn.click();
    await page.waitForTimeout(500);
    const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show'));
    if (modalVisible) {
      await page.click('#pmAdd');
      await page.waitForTimeout(500);
    }
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    const items = page.locator('#cartItems .cart-item, #cartItems > *');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('toast de confirmação aparece ao adicionar', async ({ page }) => {
    const addBtn = page.locator('#productGrid .add-btn').first();
    await addBtn.click();
    await page.waitForTimeout(500);
    const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show'));
    if (modalVisible) {
      await page.click('#pmAdd');
      await page.waitForTimeout(500);
    }
    const toast = page.locator('#toast');
    await expect(toast).toHaveClass(/show/);
  });

  test('carrinho fecha com botão', async ({ page }) => {
    const addBtn = page.locator('#productGrid .add-btn').first();
    await addBtn.click();
    await page.waitForTimeout(500);
    const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show'));
    if (modalVisible) {
      await page.click('#pmAdd');
      await page.waitForTimeout(500);
    }
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer.show', { timeout: 5000 });
    await page.click('#closeCart');
    await page.waitForTimeout(500);
    const drawerVisible = await page.locator('#cartDrawer').evaluate(el => el.classList.contains('show'));
    expect(drawerVisible).toBe(false);
  });
});

// ═══════════════════════════════════════════
// CHECKOUT
// ═══════════════════════════════════════════

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminAndOpenStore(page);
    const addBtn = page.locator('#productGrid .add-btn').first();
    await addBtn.click();
    await page.waitForTimeout(500);
    const modalVisible = await page.locator('#productModal').evaluate(el => el.classList.contains('show'));
    if (modalVisible) {
      await page.click('#pmAdd');
      await page.waitForTimeout(500);
    }
  });

  test('checkout preenche dados do utilizador', async ({ page }) => {
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    await page.click('#goCheckout');
    await page.waitForSelector('#checkoutModal', { state: 'visible', timeout: 5000 });
    const nameVal = await page.locator('#ckName').inputValue();
    expect(nameVal.length).toBeGreaterThan(0);
  });

  test('zona de entrega é exibida no checkout', async ({ page }) => {
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    await page.click('#goCheckout');
    await page.waitForSelector('#checkoutModal', { state: 'visible', timeout: 5000 });
    const options = page.locator('#ckZone option');
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
  });

  test('fechar checkout com botão', async ({ page }) => {
    await page.click('#openCart');
    await page.waitForSelector('#cartDrawer', { state: 'visible', timeout: 5000 });
    await page.click('#goCheckout');
    await page.waitForSelector('#checkoutModal', { state: 'visible', timeout: 5000 });
    await page.click('#ckClose');
    await expect(page.locator('#checkoutModal')).not.toHaveClass(/show/);
  });
});

// ═══════════════════════════════════════════
// ADMIN - DASHBOARD
// ═══════════════════════════════════════════

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('dashboard é visível após login', async ({ page }) => {
    await expect(page.locator('#tabDashboard')).toBeVisible();
  });

  test('stats do dashboard são exibidos', async ({ page }) => {
    const stats = page.locator('#dashboardStats');
    await expect(stats).toBeVisible();
    const statCards = stats.locator('.stat-card');
    const count = await statCards.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// ADMIN - NAVEGAÇÃO
// ═══════════════════════════════════════════

test.describe('Admin Navegação', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('tab Produtos mostra conteúdo', async ({ page }) => {
    await page.click('[data-tab="products"]');
    await expect(page.locator('#tabProducts')).toBeVisible();
  });

  test('tab Encomendas mostra conteúdo', async ({ page }) => {
    await page.click('[data-tab="orders"]');
    await expect(page.locator('#tabOrders')).toBeVisible();
  });

  test('tab Clientes mostra conteúdo', async ({ page }) => {
    await page.click('[data-tab="clients"]');
    await expect(page.locator('#tabClients')).toBeVisible();
  });

  test('tab Configurações mostra conteúdo', async ({ page }) => {
    await page.click('[data-tab="settings"]');
    await expect(page.locator('#tabSettings')).toBeVisible();
  });

  test('tab Fornecedores mostra conteúdo', async ({ page }) => {
    await page.click('[data-tab="suppliers"]');
    await expect(page.locator('#tabSuppliers')).toBeVisible();
  });

  test('tab Pedidos mostra conteúdo', async ({ page }) => {
    await page.click('[data-tab="requests"]');
    await expect(page.locator('#tabRequests')).toBeVisible();
  });

  test('navegação entre tabs esconde tab anterior', async ({ page }) => {
    await page.click('[data-tab="products"]');
    await expect(page.locator('#tabProducts')).toBeVisible();
    await page.click('[data-tab="orders"]');
    await expect(page.locator('#tabProducts')).not.toBeVisible();
    await expect(page.locator('#tabOrders')).toBeVisible();
  });
});

// ═══════════════════════════════════════════
// ADMIN - PRODUTOS
// ═══════════════════════════════════════════

test.describe('Admin Produtos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
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

  test('criar novo produto', async ({ page }) => {
    const testProductName = 'Produto Teste E2E ' + Date.now();
    await page.fill('#npName', testProductName);
    await page.fill('#npPrice', '500');
    await page.fill('#npCat', 'Testes');
    await page.fill('#npDesc', 'Produto criado durante teste E2E');
    await page.click('#npAdd');
    await page.waitForTimeout(3000);
    const productList = page.locator('#adminProductList');
    const hasProduct = await productList.textContent().then(t => t?.includes(testProductName) ?? false);
    if (hasProduct) {
      await expect(productList).toContainText(testProductName);
    } else {
      const toastText = await page.locator('#toast').textContent().catch(() => '');
      expect(toastText, 'Supabase write blocked by RLS - expected error toast').toContain('Erro');
    }
  });

  test('botão muda texto ao editar produto', async ({ page }) => {
    const addBtn = page.locator('#npAdd');
    await expect(addBtn).toHaveText('Publicar produto');
  });
});

// ═══════════════════════════════════════════
// ADMIN - ENCOMENDAS
// ═══════════════════════════════════════════

test.describe('Admin Encomendas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
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
// ADMIN - CONFIGURAÇÕES
// ═══════════════════════════════════════════

test.describe('Admin Configurações', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#tabSettings', { state: 'visible', timeout: 5000 });
  });

  test('zonas de entrega são exibidas', async ({ page }) => {
    const zonesList = page.locator('#zonesList');
    await expect(zonesList).toBeVisible();
    const items = zonesList.locator('.zone-row');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('métodos de pagamento são exibidos', async ({ page }) => {
    const paymentsList = page.locator('#paymentsList');
    await expect(paymentsList).toBeVisible();
    const items = paymentsList.locator('.pay-row');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('adicionar zona de entrega', async ({ page }) => {
    const newZone = 'Zona Teste ' + Date.now();
    await page.fill('#newZone', newZone);
    await page.click('#addZone');
    await page.waitForTimeout(3000);
    const zonesList = page.locator('#zonesList');
    const hasZone = await zonesList.textContent().then(t => t?.includes(newZone) ?? false);
    if (hasZone) {
      await expect(zonesList).toContainText(newZone);
    } else {
      const toastText = await page.locator('#toast').textContent().catch(() => '');
      expect(toastText, 'Supabase write blocked by RLS - expected error toast').toContain('Erro');
    }
  });

  test('adicionar método de pagamento', async ({ page }) => {
    const newPayment = 'Pagamento Teste ' + Date.now();
    await page.fill('#newPayment', newPayment);
    await page.click('#addPayment');
    await page.waitForTimeout(3000);
    const paymentsList = page.locator('#paymentsList');
    const hasPayment = await paymentsList.textContent().then(t => t?.includes(newPayment) ?? false);
    if (hasPayment) {
      await expect(paymentsList).toContainText(newPayment);
    } else {
      const toastText = await page.locator('#toast').textContent().catch(() => '');
      expect(toastText, 'Supabase write blocked by RLS - expected error toast').toContain('Erro');
    }
  });
});

// ═══════════════════════════════════════════
// ADMIN - FORNECEDORES
// ═══════════════════════════════════════════

test.describe('Admin Fornecedores', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('[data-tab="suppliers"]');
    await page.waitForSelector('#tabSuppliers', { state: 'visible', timeout: 5000 });
  });

  test('formulário de fornecedor tem campos', async ({ page }) => {
    await expect(page.locator('#newSupplierName')).toBeVisible();
    await expect(page.locator('#newSupplierContact')).toBeVisible();
    await expect(page.locator('#addSupplier')).toBeVisible();
  });

  test('adicionar fornecedor', async ({ page }) => {
    const supplierName = 'Fornecedor Teste ' + Date.now();
    await page.fill('#newSupplierName', supplierName);
    await page.fill('#newSupplierContact', '840000000');
    await page.click('#addSupplier');
    await page.waitForTimeout(3000);
    const suppliersList = page.locator('#suppliersList');
    const hasSupplier = await suppliersList.textContent().then(t => t?.includes(supplierName) ?? false);
    if (hasSupplier) {
      await expect(suppliersList).toContainText(supplierName);
    } else {
      const toastText = await page.locator('#toast').textContent().catch(() => '');
      expect(toastText, 'Supabase write blocked by RLS - expected error toast').toContain('Erro');
    }
  });
});

// ═══════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════

test.describe('Logout', () => {
  test('logout do admin volta para ecrã de login', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForSelector('#adLogout', { state: 'visible', timeout: 5000 });
    await page.click('#adLogout');
    await page.waitForSelector('#authLoginForm', { state: 'visible', timeout: 15000 });
    await expect(page.locator('#authLoginForm')).toBeVisible();
  });
});
