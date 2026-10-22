import { WHATSAPP_NUMBER, FREE_DELIVERY_THRESHOLD, supabase } from './config.js';
import { fmt, uid, showToast, esc, debounce, withTimeout, isOfflineError, isDbMissingError, offlineMessage, dbMissingMessage } from './utils.js';
import {
  registerUser, loginUser, logout, restoreSession, getCurrentUser,
  isCurrentUserAdmin, isCurrentUserSeller, canAccessPanel,
  requestPasswordReset, completePasswordReset, resendConfirmation,
  isRecoverySession, readLocalProfile, saveLocalProfile
} from './auth.js';
import {
  loadData, saveProducts, createOrder, updateOrderStatus, saveRequests, saveFavorites, saveZones, savePayments, saveSuppliers,
  loadFavorites, loadUserOrders, loadSellerRequests as fetchSellerRequests, saveSellerRequests,
  fallbackData
} from './data.js';
import { cartStorage } from './storage.js';
import { renderProductCards, renderProductModal, renderReviews, matchesSearch } from './products.js';
import { renderCart, cartTotalValue, openCartDrawer, closeCart, closeAllModals, scrollToShop } from './cart.js';
import { uploadProductImages } from './upload.js';
import {
  renderAdminProductList, renderAdminOrderList, renderAdminRequestList,
  renderZonesList, renderPaymentsList, renderSuppliersList, showAuthView, showPublicView,
  showAdminView, updateHeaderUI, showAuthError,
  renderDashboard, renderDashboardRecentOrders, renderAdminClientList, renderSellerRequestList,
  setActiveAdminTab
} from './admin.js';

const state = {
  products: [], orders: [], customRequests: [], favorites: [],
  zones: [], payments: [], suppliers: [], cart: [], activeCategory: "Todos",
  currentProductId: null, selectedSize: null, selectedColor: null,
  clients: [], orderFilter: 'all', sellerRequests: [],
  adminProductSearch: '', adminProductCategory: '',
  uploadedImages: [],
  offline: false, guestMode: false
};

let lastFocusedElement = null;
const searchInput = () => document.getElementById('searchBox');

/* ---------------- Auth helpers ---------------- */
function showAuthForm(name) {
  ['login','register','forgot','reset','confirm'].forEach(f => {
    document.getElementById('auth' + f.charAt(0).toUpperCase() + f.slice(1) + 'Form').style.display = f === name ? '' : 'none';
  });
  ['loginError','registerError','forgotError','resetError','confirmError'].forEach(id =>
    document.getElementById(id).classList.remove('show'));
}

function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  modal.addEventListener('keydown', function handler(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === 'Escape') {
      modal.classList.remove('show');
      modal.removeEventListener('keydown', handler);
      document.body.classList.remove('no-scroll');
      if (lastFocusedElement) lastFocusedElement.focus();
    }
  });
  first.focus();
}

function openModal(id) {
  const modal = document.getElementById(id);
  lastFocusedElement = document.activeElement;
  modal.classList.add('show');
  document.body.classList.add('no-scroll');
  trapFocus(modal);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('show');
  if (!document.getElementById('cartDrawer').classList.contains('show')) {
    document.getElementById('overlay').classList.remove('show');
  }
  document.body.classList.remove('no-scroll');
  if (lastFocusedElement) lastFocusedElement.focus();
}

/* ---------------- Store rendering ---------------- */
function renderChips() {
  const cats = ["Todos", ...new Set(state.products.map(p => p.category).filter(Boolean))];
  const wrap = document.getElementById('categoryChips');
  wrap.innerHTML = "";
  cats.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip' + (c === state.activeCategory ? ' active' : '');
    b.textContent = c;
    b.onclick = () => { state.activeCategory = c; render(); };
    wrap.appendChild(b);
  });
  if (state.favorites.length) {
    const fav = document.createElement('button');
    fav.className = 'chip' + (state.activeCategory === '__fav' ? ' active' : '');
    fav.textContent = `♥ Favoritos (${state.favorites.length})`;
    fav.onclick = () => { state.activeCategory = state.activeCategory === '__fav' ? 'Todos' : '__fav'; render(); };
    wrap.appendChild(fav);
  }
}

function renderHeroShowcase() {
  const wrap = document.getElementById('heroShowcase');
  if (!wrap) return;
  const picks = state.products.slice(0, 3);
  if (!picks.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = picks.map((p, i) => `
    <div class="hs-card">
      <img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">
      <div class="hs-meta">
        <span>${esc(p.name)}</span>
        <span class="mono">${fmt(p.price)}</span>
      </div>
    </div>`).join('');
}

function renderFeaturedStrip() {
  const wrap = document.getElementById('featuredStrip');
  if (!wrap) return;
  const featured = state.products.filter(p => p.badge && p.badge.toLowerCase().includes('destaque'));
  const bestSellers = [...state.products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 4);
  wrap.innerHTML = "";
  if (bestSellers.length && bestSellers.some(p => p.sold > 0)) {
    const h = document.createElement('h2');
    h.className = 'display';
    h.textContent = "Mais procurados";
    wrap.appendChild(h);
    const row = document.createElement('div');
    row.className = 'featured-grid';
    renderProductCards(bestSellers.filter(p => p.sold > 0), row, handleAddToCart, openProductModalHandler, handleToggleFavorite, state.favorites);
    wrap.appendChild(row);
  }
  if (featured.length) {
    const h = document.createElement('h2');
    h.className = 'display';
    h.textContent = "Em destaque";
    wrap.appendChild(h);
    const row = document.createElement('div');
    row.className = 'featured-grid';
    renderProductCards(featured, row, handleAddToCart, openProductModalHandler, handleToggleFavorite, state.favorites);
    wrap.appendChild(row);
  }
}

function applySorting(list) {
  const sortVal = document.getElementById('sortBox').value;
  if (!sortVal) return list;
  const sorted = [...list];
  switch (sortVal) {
    case 'price-asc': sorted.sort((a, b) => a.price - b.price); break;
    case 'price-desc': sorted.sort((a, b) => b.price - a.price); break;
    case 'sold-desc': sorted.sort((a, b) => (b.sold || 0) - (a.sold || 0)); break;
    case 'newest': sorted.sort((a, b) => (parseInt(b.id.slice(1), 36) || 0) - (parseInt(a.id.slice(1), 36) || 0)); break;
  }
  return sorted;
}

function updateResultCount(count, hasFilters) {
  const el = document.getElementById('resultCount');
  if (!el) return;
  if (count === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <span><b>${count}</b> produto${count !== 1 ? 's' : ''} encontrado${count !== 1 ? 's' : ''}${hasFilters ? ' para a sua pesquisa' : ' na loja'}</span>
    ${hasFilters ? '<button class="btn-ghost" id="clearFilters">Limpar filtros</button>' : ''}`;
  const clearBtn = document.getElementById('clearFilters');
  if (clearBtn) clearBtn.onclick = () => {
    state.activeCategory = 'Todos';
    searchInput().value = '';
    document.getElementById('sortBox').value = '';
    document.getElementById('clearSearch').classList.remove('show');
    render();
  };
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('emptyState');
  const search = searchInput().value.trim().toLowerCase();
  const favOnly = state.activeCategory === '__fav';

  let list = state.products.filter(p => {
    const catOk = favOnly ? state.favorites.includes(p.id)
      : (state.activeCategory === "Todos" || p.category === state.activeCategory);
    return catOk && matchesSearch(p, search);
  });
  list = applySorting(list);

  const hasFilters = !!search || state.activeCategory !== 'Todos' || favOnly;

  if (list.length === 0) {
    grid.innerHTML = "";
    const head0 = document.getElementById('catalogHead');
    if (head0) head0.style.display = 'none';
    updateResultCount(0, hasFilters);
    emptyState.style.display = 'block';
    if (state.products.length === 0) {
      emptyState.innerHTML = `
        <div class="es-inner">
        <div class="es-icon" aria-hidden="true">🛍️</div>
        <h3>A loja está a ser montada</h3>
        <p>Estamos a escolher os artigos mais bonitos nas lojas de Pemba. Volte em breve — ou fale connosco ajudamos por si.</p>
        <div class="es-actions">
          <button class="btn-primary mango" id="openReqModal">Procurar um artigo</button>
          <button class="btn-secondary" id="openWhatsAppFallback">Falar com o lojista</button>
        </div>
        </div>`;
    } else if (favOnly && !state.favorites.length) {
      emptyState.innerHTML = `
        <div class="es-inner">
        <div class="es-icon" aria-hidden="true">♡</div>
        <h3>Ainda não tem favoritos</h3>
        <p>Toque no coração de qualquer produto para o guardar aqui e encontrá-lo rapidamente.</p>
        <div class="es-actions"><button class="btn-primary" id="backToShop">Ver produtos</button></div>
        </div>`;
    } else {
      emptyState.innerHTML = `
        <div class="es-inner">
        <div class="es-icon" aria-hidden="true">🔎</div>
        <h3>Não encontramos exactamente isso</h3>
        <p>Mas talvez goste destes artigos. Ou descreva o que procura e nós tratamos disso.</p>
        <div class="es-actions">
          <button class="btn-primary mango" id="openReqModal">Descrever o produto que procuro</button>
          <button class="btn-secondary" id="openWhatsAppFallback">Falar com o lojista</button>
        </div>
        </div>`;
    }
    const reqBtn = document.getElementById('openReqModal');
    if (reqBtn) reqBtn.onclick = () => openModal('requestModal');
    const waBtn = document.getElementById('openWhatsAppFallback');
    if (waBtn) waBtn.onclick = () => {
      window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Olá! Não encontrei na página o produto que procuro, pode me ajudar?'), '_blank');
    };
    const backBtn = document.getElementById('backToShop');
    if (backBtn) backBtn.onclick = () => { state.activeCategory = 'Todos'; render(); };
    if (state.products.length) {
      let related = state.products.filter(p => state.activeCategory === "Todos" || p.category === state.activeCategory);
      if (related.length === 0) related = state.products.slice();
      related = related.slice(0, 4);
      renderProductCards(related, grid, handleAddToCart, openProductModalHandler, handleToggleFavorite, state.favorites);
    }
    return;
  }

  emptyState.style.display = 'none';
  const catalogHead = document.getElementById('catalogHead');
  if (catalogHead) catalogHead.style.display = 'flex';
  updateResultCount(list.length, hasFilters);
  renderProductCards(list, grid, handleAddToCart, openProductModalHandler, handleToggleFavorite, state.favorites);
}

function renderCartState() {
  state.cart = state.cart.filter(l => state.products.find(p => p.id === l.id));
  renderCart(state.cart, state.products);
  const user = getCurrentUser();
  if (user) cartStorage.save(user.id, state.cart).catch(e => console.warn('Cart save error:', e));
}

function handleAddToCart(id, size, color) {
  const p = state.products.find(pr => pr.id === id);
  if (!p) return;
  if ((p.sizes && p.sizes.length) || (p.colors && p.colors.length)) {
    openProductModalHandler(id);
    return;
  }
  const lineKey = id + '|' + (size || '') + '|' + (color || '');
  const line = state.cart.find(l => l.key === lineKey);
  if (line) line.qty++;
  else state.cart.push({ key: lineKey, id, qty: 1, size: size || null, color: color || null });
  renderCartState();
  showToast("Adicionado ao carrinho", 'success');
}

async function handleToggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter(f => f !== id);
    showToast("Removido dos favoritos");
  } else {
    state.favorites.push(id);
    showToast("Guardado nos favoritos", 'success');
  }
  const user = getCurrentUser();
  if (user) await saveFavorites(user.id, state.favorites).catch(e => console.warn('Favorites save error:', e));
  render();
}

function openProductModalHandler(id) {
  const p = state.products.find(pr => pr.id === id);
  if (!p) return;
  state.currentProductId = id;
  state.selectedSize = (p.sizes && p.sizes[0]) || null;
  state.selectedColor = (p.colors && p.colors[0]) || null;
  renderProductModal(p, state.payments, state.zones, {
    onSize: v => state.selectedSize = v,
    onColor: v => state.selectedColor = v
  });
  openModal('productModal');
}

/* ---------------- Admin ---------------- */
async function loadClients() {
  const user = getCurrentUser();
  if (!user || (!isCurrentUserAdmin() && !isCurrentUserSeller())) { state.clients = []; return; }
  try {
    const { data, error } = await supabase
      .from('profiles').select('id, name, phone, email, role, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    state.clients = data || [];
  } catch (e) {
    console.warn('Lista de clientes indisponível:', e);
    state.clients = state.clients || [];
  }
}

async function refreshSellerRequests() {
  if (!isCurrentUserAdmin()) { state.sellerRequests = []; return; }
  try {
    state.sellerRequests = await fetchSellerRequests();
  } catch (e) {
    console.warn('Seller requests unavailable:', e);
    state.sellerRequests = [];
  }
}

async function handleOrderStatusChange(orderId, newStatus) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  try {
    await updateOrderStatus(orderId, newStatus);
    order.status = newStatus;
    renderAdminState();
    showToast("Estado da encomenda actualizado", 'success');
  } catch (e) {
    console.error('Order status update failed:', e);
    showToast("Erro ao actualizar estado", 'error');
  }
}

function sellerScopedProducts() {
  const user = getCurrentUser();
  if (user && user.role === 'seller') return state.products.filter(p => p.created_by === user.id);
  return state.products;
}

function sellerScopedOrders(products) {
  const user = getCurrentUser();
  if (user && user.role === 'seller') {
    return state.orders.filter(o => o.items && o.items.some(i => products.some(p => p.name === i.name)));
  }
  return state.orders;
}

function renderAdminState() {
  if (document.getElementById('adminView').style.display === 'none') return;
  const isSeller = getCurrentUser() && getCurrentUser().role === 'seller';
  const myProducts = sellerScopedProducts();
  const myOrders = sellerScopedOrders(myProducts);

  renderDashboard(myOrders, myProducts, isSeller ? [] : state.customRequests);
  renderDashboardRecentOrders(myOrders);

  const searchTerm = state.adminProductSearch.trim().toLowerCase();
  const filtered = myProducts.filter(p => {
    const okSearch = !searchTerm || `${p.name} ${p.category || ''}`.toLowerCase().includes(searchTerm);
    const okCat = !state.adminProductCategory || p.category === state.adminProductCategory;
    return okSearch && okCat;
  });
  renderAdminProductList(filtered, handleEditProduct, handleDeleteProduct, handleDuplicateProduct);
  renderAdminOrderList(myOrders, handleOrderStatusChange, state.orderFilter, state.products, state.clients);
  renderAdminRequestList(isSeller ? [] : state.customRequests);
  renderAdminClientList(isSeller ? [] : state.clients, handleRoleChange, isCurrentUserAdmin());
  renderSellerRequestList(state.sellerRequests, handleApproveSeller, handleRejectSeller);
  renderZonesList(state.zones, handleRemoveZone);
  renderPaymentsList(state.payments, handleRemovePayment);
  renderSuppliersList(state.suppliers || [], handleRemoveSupplier);
  populateSupplierDropdown();
  populateCategoryFilters();
  updateDashboardGreeting();
}

function populateCategoryFilters() {
  const sel = document.getElementById('adminProductCat');
  if (!sel) return;
  const cats = [...new Set(state.products.map(p => p.category).filter(Boolean))].sort();
  const current = state.adminProductCategory;
  sel.innerHTML = '<option value="">Todas as categorias</option>' +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value = current;

  const dl = document.getElementById('npCategoryList');
  if (dl) {
    dl.innerHTML = cats.map(c => `<option value="${esc(c)}"></option>`).join('');
  }
}

function updateDashboardGreeting() {
  const el = document.getElementById('dashboardGreeting');
  if (!el) return;
  const user = getCurrentUser();
  const name = user && user.name ? user.name.split(' ')[0] : '';
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite';
  el.textContent = name ? `${part}, ${name}. Aqui tem o resumo da sua loja.` : 'Resumo da sua loja hoje.';
}

function populateSupplierDropdown() {
  const sel = document.getElementById('npSupplier');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Sem fornecedor</option>';
  (state.suppliers || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name + (s.contact ? ' · ' + s.contact : '');
    sel.appendChild(opt);
  });
  sel.value = current;
}

function render() {
  renderChips();
  renderHeroShowcase();
  renderFeaturedStrip();
  renderGrid();
  renderCartState();
  renderAdminState();
}

/* ---------------- Checkout ---------------- */
function resolveCheckoutAddress() {
  const zoneVal = document.getElementById('ckZone').value;
  if (zoneVal === '__other') return document.getElementById('ckAddr').value.trim();
  return zoneVal;
}

function getCheckoutFields() {
  const name = document.getElementById('ckName').value.trim();
  const phone = document.getElementById('ckPhone').value.trim();
  const addr = resolveCheckoutAddress();
  const note = document.getElementById('ckNote').value.trim();
  if (!name || !phone) { showToast("Preencha nome e telefone", 'error'); return null; }
  if (!addr) { showToast("Selecione uma zona de entrega", 'error'); return null; }
  return { name, phone, addr, note };
}

function renderCheckoutSummary() {
  const wrap = document.getElementById('ckSummary');
  if (!wrap) return;
  const total = cartTotalValue(state.cart, state.products);
  const lines = state.cart.map(l => {
    const p = state.products.find(pr => pr.id === l.id);
    if (!p) return '';
    const variant = [l.size, l.color].filter(Boolean).join(' · ');
    return `<div class="ck-row"><span>${l.qty}× ${esc(p.name)}${variant ? ' <span style="color:var(--ink-faint)">(' + esc(variant) + ')</span>' : ''}</span><span class="mono">${fmt(p.price * l.qty)}</span></div>`;
  }).join('');
  wrap.innerHTML = `
    ${lines}
    <div class="ck-row total"><span>Total</span><span class="mono">${fmt(total)}</span></div>
    ${total >= FREE_DELIVERY_THRESHOLD ? '<div class="ck-row" style="color:var(--ok);font-size:.78rem;">🎉 Entrega grátis aplicada</div>' : ''}`;
}

function renderZonePills() {
  const wrap = document.getElementById('ckZonePills');
  const sel = document.getElementById('ckZone');
  if (!wrap || !sel) return;
  wrap.innerHTML = '';
  state.zones.forEach(z => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zone-pill' + (sel.value === z ? ' active' : '');
    b.textContent = z;
    b.onclick = () => {
      sel.value = z;
      document.getElementById('ckAddrOtherWrap').style.display = 'none';
      renderZonePills();
    };
    wrap.appendChild(b);
  });
}

function buildOrderSummaryText() {
  return state.cart.map(l => {
    const p = state.products.find(pr => pr.id === l.id);
    if (!p) return `${l.qty}x [produto indisponível]`;
    const variant = [l.size, l.color].filter(Boolean).join(' · ');
    return `${l.qty}x ${p.name}${variant ? ' (' + variant + ')' : ''} - ${fmt(p.price * l.qty)}`;
  }).join('\n');
}

function finishCheckout() {
  const user = getCurrentUser();
  state.cart = [];
  if (user) cartStorage.clear(user.id).catch(e => console.warn('Cart clear error:', e));
  renderCartState();
  closeModal('checkoutModal');
  closeCart();
  document.getElementById('ckName').value = '';
  document.getElementById('ckPhone').value = '';
  document.getElementById('ckAddr').value = '';
  document.getElementById('ckZone').value = '';
  document.getElementById('ckAddrOtherWrap').style.display = 'none';
  document.getElementById('ckNote').value = '';
  renderGrid();
  renderFeaturedStrip();
}

/* ---------------- Orders ---------------- */
const STATUS_LABELS = { 'novo': 'Novo', 'em curso': 'Em curso', 'entregue': 'Entregue', 'cancelado': 'Cancelado' };
const STATUS_STYLES = {
  'novo': 'background:var(--mango);color:var(--ink);',
  'em curso': 'background:var(--teal);color:var(--paper);',
  'entregue': 'background:#3f9d63;color:#fff;',
  'cancelado': 'background:var(--coral);color:#fff;'
};
const ORDER_STEPS = [
  { key: 'novo', label: 'Novo' },
  { key: 'em curso', label: 'Em curso' },
  { key: 'entregue', label: 'Entregue' }
];

function orderStepsHtml(status) {
  if (status === 'cancelado') {
    return '<div style="font-size:.82rem;color:var(--coral);font-weight:600;">Encomenda cancelada</div>';
  }
  const currentIndex = ORDER_STEPS.findIndex(s => s.key === status);
  return '<div class="order-steps">' + ORDER_STEPS.map((s, i) => {
    const cls = i < currentIndex ? 'done' : (i === currentIndex ? 'current' : '');
    return `<div class="order-step ${cls}"><div class="os-dot">${i < currentIndex ? '✓' : i + 1}</div><div class="os-label">${s.label}</div></div>`;
  }).join('') + '</div>';
}

async function openMyOrders() {
  const user = getCurrentUser();
  if (!user) return;
  const list = document.getElementById('myOrdersList');
  list.innerHTML = '<p style="text-align:center;color:var(--ink-faint);">A carregar…</p>';
  openModal('myOrdersModal');
  try {
    const orders = await loadUserOrders(user.id);
    if (orders.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:40px 10px;">
        <div class="es-icon" aria-hidden="true">📋</div>
        <h3>Ainda não fez encomendas</h3>
        <p>Quando finalizar uma compra, o estado da encomenda aparece aqui.</p>
      </div>`;
      return;
    }
    list.innerHTML = orders.map(o => {
      const items = (o.items || []).map(i => {
        const variant = [i.size, i.color].filter(Boolean).join(' · ');
        return `<div class="order-line"><span>${i.qty}× ${esc(i.name)}${variant ? ' <span style="color:var(--ink-faint)">(' + esc(variant) + ')</span>' : ''}</span><span class="mono">${fmt(i.price * i.qty)}</span></div>`;
      }).join('');
      return `
        <div class="order-card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <span style="font-size:.8rem;color:var(--ink-faint);">${esc(o.date)}</span>
            <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:.75rem;font-weight:700;${STATUS_STYLES[o.status] || ''}">${STATUS_LABELS[o.status] || o.status}</span>
          </div>
          ${orderStepsHtml(o.status)}
          <div style="margin-bottom:8px;">${items}</div>
          <div style="font-size:.84rem;color:var(--ink-soft);">📍 ${esc(o.addr)}${o.note ? ' — ' + esc(o.note) : ''}</div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--line-soft);font-weight:700;">
            <span>Total</span><span class="mono">${fmt(o.total)}</span>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    console.error('Failed to load user orders:', e);
    list.innerHTML = '<p style="text-align:center;color:var(--coral);">Erro ao carregar encomendas.</p>';
  }
}

async function handleRegisterOrder(name, phone, addr, note) {
  const user = getCurrentUser();
  const order = {
    user_id: user?.id,
    name, phone, addr, note,
    items: state.cart.map(l => {
      const p = state.products.find(pr => pr.id === l.id);
      return { name: p ? p.name : '[produto indisponível]', qty: l.qty, price: p ? p.price : 0, size: l.size, color: l.color };
    }),
    total: cartTotalValue(state.cart, state.products),
    status: "novo"
  };
  try {
    const created = await createOrder(order);
    state.cart.forEach(l => {
      const p = state.products.find(pr => pr.id === l.id);
      if (p) p.sold = (p.sold || 0) + l.qty;
    });
    const orderId = created ? created.id : uid();
    state.orders.unshift({ ...order, id: orderId, date: new Date(created?.created_at || Date.now()).toLocaleString('pt-PT') });
    saveProducts(state.products).catch(e => console.warn('Product stats save skipped:', e));
    return true;
  } catch (e) {
    console.error('Order save failed:', e);
    showToast("Erro ao guardar encomenda. Tente novamente.", 'error');
    return false;
  }
}

/* ---------------- Product management ---------------- */
function handleEditProduct(id) {
  const p = state.products.find(pr => pr.id === id);
  if (!p) return;
  const user = getCurrentUser();
  if (user && user.role === 'seller' && p.created_by !== user.id) { showToast("Só pode editar os seus próprios produtos", 'error'); return; }
  document.getElementById('npName').value = p.name;
  document.getElementById('npPrice').value = p.price;
  document.getElementById('npCat').value = p.category || '';
  document.getElementById('npImg').value = p.img;
  document.getElementById('npImages').value = (p.images || []).join('\n');
  document.getElementById('npDesc').value = p.desc || '';
  document.getElementById('npMaterial').value = p.material || '';
  document.getElementById('npEntrega').value = p.entrega || '';
  document.getElementById('npSizes').value = (p.sizes || []).join(', ');
  document.getElementById('npColors').value = (p.colors || []).join(', ');
  document.getElementById('npBadge').value = p.badge || '';
  document.getElementById('npSupplier').value = p.supplier || '';
  document.getElementById('editingId').value = p.id;
  document.getElementById('npAdd').textContent = "Guardar alterações";
  document.getElementById('productFormTitle').textContent = 'Editar produto';
  state.uploadedImages = [];
  renderUploadThumbs();
  renderPreview();
  document.getElementById('tabProducts').scrollIntoView({ behavior: 'smooth' });
  showToast('A editar produto');
}

function handleDuplicateProduct(id) {
  const p = state.products.find(pr => pr.id === id);
  if (!p) return;
  const copy = JSON.parse(JSON.stringify(p));
  copy.id = uid();
  copy.name = p.name + ' (cópia)';
  copy.sold = 0;
  copy.reviews = [];
  copy.created_by = getCurrentUser()?.id || null;
  state.products.push(copy);
  saveProducts(state.products)
    .then(() => { render(); showToast('Produto duplicado — edite e publique', 'success'); })
    .catch(e => { console.error(e); showToast('Erro ao duplicar produto', 'error'); });
}

async function handleDeleteProduct(id) {
  const p = state.products.find(pr => pr.id === id);
  if (!p) return;
  const user = getCurrentUser();
  if (user && user.role === 'seller' && p.created_by !== user.id) { showToast("Só pode apagar os seus próprios produtos", 'error'); return; }
  if (!confirm(`Apagar "${p.name}"? Esta acção não pode ser desfeita.`)) return;
  state.products = state.products.filter(pr => pr.id !== id);
  await saveProducts(state.products);
  render();
  showToast("Produto apagado");
}

function readProductForm() {
  const name = document.getElementById('npName').value.trim();
  const price = parseFloat(document.getElementById('npPrice').value);
  const category = document.getElementById('npCat').value.trim();
  const img = document.getElementById('npImg').value.trim() || 'https://picsum.photos/seed/' + Date.now() + '/400/500';
  const imagesRaw = document.getElementById('npImages').value.trim();
  const images = imagesRaw ? imagesRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];
  const desc = document.getElementById('npDesc').value.trim();
  const material = document.getElementById('npMaterial').value.trim();
  const entrega = document.getElementById('npEntrega').value.trim();
  const sizesRaw = document.getElementById('npSizes').value.trim();
  const sizes = sizesRaw ? sizesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const colorsRaw = document.getElementById('npColors').value.trim();
  const colors = colorsRaw ? colorsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const badge = document.getElementById('npBadge').value.trim();
  const supplier = document.getElementById('npSupplier').value;
  return { name, price, category, img, images, desc, material, entrega, sizes, colors, badge, supplier };
}

function clearProductForm() {
  ['npName','npPrice','npCat','npImg','npImages','npDesc','npMaterial','npEntrega','npSizes','npColors','npBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('npSupplier').value = '';
  document.getElementById('editingId').value = '';
  document.getElementById('npAdd').textContent = "Publicar produto";
  document.getElementById('productFormTitle').textContent = 'Adicionar produto';
  state.uploadedImages = [];
  renderUploadThumbs();
  renderPreview();
}

function renderPreview() {
  const wrap = document.getElementById('npPreview');
  if (!wrap) return;
  const data = readProductForm();
  if (!data.name) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);font-size:.86rem;">Preencha o nome e o preço para ver a pré-visualização.</p>';
    return;
  }
  wrap.innerHTML = `
    <div class="preview-card">
      <img src="${esc(data.img)}" alt="" onerror="this.src='https://picsum.photos/seed/fallback/400/500'">
      <div>
        <div class="pv-name">${esc(data.name)}</div>
        <div class="pv-price">${fmt(data.price || 0)}</div>
        <div class="pv-meta">
          ${data.category ? esc(data.category) + ' · ' : ''}
          ${data.entrega ? '🚚 ' + esc(data.entrega) : 'sem tempo de entrega definido'}
          ${data.badge ? ' · <span class="pill warn">' + esc(data.badge) + '</span>' : ''}
        </div>
        ${data.sizes.length ? '<div class="pv-meta">Tamanhos: ' + esc(data.sizes.join(', ')) + '</div>' : ''}
        ${data.colors.length ? '<div class="pv-meta">Cores: ' + esc(data.colors.join(', ')) + '</div>' : ''}
      </div>
    </div>`;
}

function renderUploadThumbs() {
  const wrap = document.getElementById('npThumbs');
  if (!wrap) return;
  const images = state.uploadedImages;
  wrap.innerHTML = images.map((src, i) => `
    <div class="thumb-item">
      <img src="${esc(src)}" alt="Foto ${i + 1}">
      ${i === 0 ? '<span class="ti-cover">Capa</span>' : ''}
      <button type="button" data-rmimg="${i}" aria-label="Remover foto">✕</button>
    </div>`).join('');
  wrap.querySelectorAll('[data-rmimg]').forEach(b => b.onclick = () => {
    const idx = parseInt(b.dataset.rmimg);
    state.uploadedImages.splice(idx, 1);
    syncUploadedImagesToForm();
    renderUploadThumbs();
    renderPreview();
  });
}

function syncUploadedImagesToForm() {
  const imgs = state.uploadedImages;
  const main = document.getElementById('npImg');
  const extra = document.getElementById('npImages');
  if (imgs.length) {
    main.value = imgs[0];
    extra.value = imgs.slice(1).join('\n');
  } else {
    main.value = '';
    extra.value = '';
  }
}

async function handleFilesSelected(files) {
  if (!files || !files.length) return;
  const user = getCurrentUser();
  const dz = document.getElementById('npDropzone');
  dz.querySelector('b').textContent = 'A carregar fotos…';
  try {
    const urls = await uploadProductImages(files, user?.id, (i, total) => {
      dz.querySelector('b').textContent = `A carregar ${i} de ${total}…`;
    });
    state.uploadedImages = state.uploadedImages.concat(urls);
    syncUploadedImagesToForm();
    renderUploadThumbs();
    renderPreview();
    showToast(`${urls.length} foto${urls.length !== 1 ? 's' : ''} carregada${urls.length !== 1 ? 's' : ''}`, 'success');
  } catch (e) {
    console.error('Upload error:', e);
    showToast('Não foi possível carregar as fotos. Use um endereço de URL.', 'error');
  } finally {
    dz.querySelector('b').textContent = 'Arraste as fotos para aqui';
    document.getElementById('npFileInput').value = '';
  }
}

/* ---------------- Seller onboarding ---------------- */
async function submitSellerRequest(name, phone, email, note) {
  try {
    const requests = await fetchSellerRequests();
    requests.unshift({ id: uid(), name, phone, email, note, date: new Date().toLocaleString('pt-PT') });
    await saveSellerRequests(requests);
    return true;
  } catch (e) {
    console.error('Seller request failed:', e);
    return false;
  }
}

async function handleApproveSeller(requestId) {
  const req = state.sellerRequests.find(r => r.id === requestId);
  if (!req) return;
  try {
    const { error } = await supabase.from('profiles').update({ role: 'seller' }).eq('phone', req.phone);
    if (error) throw error;
    state.sellerRequests = state.sellerRequests.filter(r => r.id !== requestId);
    await saveSellerRequests(state.sellerRequests);
    await loadClients();
    renderAdminState();
    showToast(`${req.name} é agora vendedor`, 'success');
  } catch (e) {
    if (isDbMissingError(e)) {
      state.sellerRequests = state.sellerRequests.filter(r => r.id !== requestId);
      await saveSellerRequests(state.sellerRequests);
      renderAdminState();
      showToast(`${req.name} é agora vendedor (guardado localmente)`, 'success');
      return;
    }
    console.error('Approve seller failed:', e);
    showToast('Erro ao activar vendedor', 'error');
  }
}

async function handleRejectSeller(requestId) {
  state.sellerRequests = state.sellerRequests.filter(r => r.id !== requestId);
  try {
    await saveSellerRequests(state.sellerRequests);
  } catch (e) { console.warn(e); }
  renderAdminState();
  showToast('Pedido recusado');
}

async function handleRoleChange(userId, role) {
  try {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
    await loadClients();
    renderAdminState();
    showToast('Perfil actualizado', 'success');
  } catch (e) {
    if (isDbMissingError(e)) {
      const profile = readLocalProfile(userId);
      if (profile) saveLocalProfile({ ...profile, role });
      await loadClients();
      renderAdminState();
      showToast('Perfil actualizado (guardado localmente)', 'success');
      return;
    }
    console.error('Role change failed:', e);
    showToast('Erro ao actualizar perfil', 'error');
  }
}

/* ---------------- Misc handlers ---------------- */
async function handleRemoveZone(index) {
  state.zones.splice(index, 1);
  await saveZones(state.zones);
  renderZonesList(state.zones, handleRemoveZone);
}

async function handleRemovePayment(index) {
  state.payments.splice(index, 1);
  await savePayments(state.payments);
  renderPaymentsList(state.payments, handleRemovePayment);
}

async function handleRemoveSupplier(index) {
  state.suppliers.splice(index, 1);
  await saveSuppliers(state.suppliers);
  renderSuppliersList(state.suppliers, handleRemoveSupplier);
}

function clearUserState() {
  state.cart = [];
  state.favorites = [];
  state.clients = [];
  state.orders = [];
  state.sellerRequests = [];
  renderCartState();
}

function navigateTo(view) {
  if (view === 'auth') { clearUserState(); showAuthView(); }
  else if (view === 'public') showPublicView();
  else if (view === 'admin') showAdminView(getCurrentUser());
  updateHeaderUI(getCurrentUser());
}

function setOffline(value, message) {
  state.offline = !!value;
  const dbMissing = !!(state.dbMissing && value);
  state.dbMissing = dbMissing;
  const banner = document.getElementById('offlineBanner');
  if (banner) {
    banner.style.display = state.offline ? '' : 'none';
    const txt = document.getElementById('offlineBannerText');
    if (txt) txt.textContent = (dbMissing ? dbMissingMessage(state.catalogSource) : message) || offlineMessage();
  }
  const offlineActions = document.getElementById('offlineActions');
  if (offlineActions) offlineActions.style.display = state.offline ? '' : 'none';
  document.body.classList.toggle('is-offline', state.offline);
}

function hideLoader() {
  const loader = document.getElementById('appLoader');
  if (loader) { loader.classList.add('hide'); setTimeout(() => loader.remove(), 400); }
}

async function init() {
  setupEventListeners();
  navigateTo('auth');
  render();
  hideLoader();

  try {
    const data = await withTimeout(loadData(), 6000, 'Sem ligação ao servidor');
    Object.assign(state, data);
    if (state.dbMissing) setOffline(true);
  } catch (e) {
    console.warn('Load data failed:', e);
    Object.assign(state, fallbackData());
    setOffline(true);
  }

  try {
    if (isRecoverySession()) {
      window.history.replaceState(null, '', window.location.pathname);
      document.getElementById('authView').style.display = '';
      document.getElementById('authLoginForm').style.display = 'none';
      document.getElementById('authRegisterForm').style.display = 'none';
      document.getElementById('authForgotForm').style.display = 'none';
      document.getElementById('authConfirmForm').style.display = 'none';
      document.getElementById('authResetForm').style.display = '';
    } else {
      const restored = await withTimeout(restoreSession(), 6000, 'Sem ligação ao servidor');
      if (restored) {
        const user = getCurrentUser();
        if (user) {
          try { state.cart = await cartStorage.load(user.id); } catch (e) { console.error('Cart load error:', e); }
          try { state.favorites = await loadFavorites(user.id); } catch (e) { console.error('Favorites load error:', e); }
          try { await loadClients(); } catch (e) { console.error('Load clients error:', e); }
          try { await refreshSellerRequests(); } catch (e) { console.error('Load seller requests error:', e); }
        }
        navigateTo(canAccessPanel() ? 'admin' : 'public');
      }
    }
  } catch (e) {
    console.warn('Session restore failed:', e);
    setOffline(true);
  }

  render();
  hideLoader();
}

function setupProductForm() {
  const wizard = document.getElementById('npWizard');
  if (wizard) {
    wizard.querySelectorAll('[data-wstep]').forEach(btn => {
      btn.onclick = () => {
        const step = btn.dataset.wstep;
        const section = document.querySelector(`.form-step[data-step="${step}"]`);
        if (!section) return;
        section.classList.remove('collapsed');
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        wizard.querySelectorAll('[data-wstep]').forEach(b => b.classList.toggle('active', b === btn));
      };
    });
  }
  document.querySelectorAll('[data-toggle-step]').forEach(btn => {
    btn.onclick = () => {
      const section = document.querySelector(`.form-step[data-step="${btn.dataset.toggleStep}"]`);
      if (!section) return;
      const collapsed = section.classList.toggle('collapsed');
      btn.textContent = collapsed ? '+' : '−';
      btn.setAttribute('aria-label', collapsed ? 'Expandir secção' : 'Minimizar secção');
      document.getElementById('npWizard').querySelectorAll('[data-wstep]').forEach(b => {
        b.classList.toggle('active', b.dataset.wstep === btn.dataset.toggleStep);
      });
    };
  });

  const dropzone = document.getElementById('npDropzone');
  const fileInput = document.getElementById('npFileInput');
  if (dropzone && fileInput) {
    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = () => handleFilesSelected(fileInput.files);
    ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => {
      e.preventDefault(); dropzone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => {
      e.preventDefault(); dropzone.classList.remove('dragover');
    }));
    dropzone.addEventListener('drop', e => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) handleFilesSelected(files);
    });
  }

  const reset = document.getElementById('npReset');
  if (reset) reset.onclick = () => { clearProductForm(); showToast('Formulário limpo'); };

  ['npName','npPrice','npCat','npImg','npDesc','npMaterial','npEntrega','npSizes','npColors','npBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', debounce(renderPreview, 200));
  });

  const adminSearch = document.getElementById('adminProductSearch');
  if (adminSearch) {
    adminSearch.addEventListener('input', debounce(() => {
      state.adminProductSearch = adminSearch.value;
      renderAdminState();
    }, 200));
  }
  const adminCat = document.getElementById('adminProductCat');
  if (adminCat) {
    adminCat.addEventListener('change', () => {
      state.adminProductCategory = adminCat.value;
      renderAdminState();
    });
  }
}

function setupMobileTabbar() {
  const bar = document.getElementById('mobileTabbar');
  if (!bar) return;
  bar.querySelectorAll('.mt-item').forEach(btn => {
    btn.onclick = () => {
      const target = btn.dataset.mt;
      bar.querySelectorAll('.mt-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (target === 'store') {
        const publicView = document.getElementById('publicView');
        if (publicView && publicView.style.display === 'none') {
          navigateTo('public');
          render();
        } else {
          scrollToShop();
        }
      } else if (target === 'search') {
        scrollToShop();
        const s = searchInput();
        if (s) setTimeout(() => s.focus(), 300);
      } else if (target === 'cart') {
        openCartDrawer();
      } else if (target === 'orders') {
        openMyOrders();
      } else if (target === 'panel') {
        if (getCurrentUser() && canAccessPanel()) {
          navigateTo('admin');
          render();
        } else {
          showToast('Faça login para aceder ao painel', 'error');
          navigateTo('auth');
        }
      }
    };
  });
}

function setupEventListeners() {
  document.getElementById('openCart').onclick = openCartDrawer;
  document.getElementById('closeCart').onclick = closeCart;
  document.getElementById('overlay').onclick = () => {
    closeAllModals();
    closeCart();
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAllModals(); closeCart(); }
  });

  document.getElementById('pmClose').onclick = () => closeModal('productModal');

  document.getElementById('pmAdd').onclick = () => {
    const p = state.products.find(pr => pr.id === state.currentProductId);
    if (!p) return;
    const lineKey = state.currentProductId + '|' + (state.selectedSize || '') + '|' + (state.selectedColor || '');
    const line = state.cart.find(l => l.key === lineKey);
    if (line) line.qty++;
    else state.cart.push({ key: lineKey, id: state.currentProductId, qty: 1, size: state.selectedSize || null, color: state.selectedColor || null });
    renderCartState();
    showToast("Adicionado ao carrinho", 'success');
    closeModal('productModal');
  };

  document.getElementById('rvSend').onclick = async () => {
    const p = state.products.find(pr => pr.id === state.currentProductId);
    if (!p) return;
    const name = document.getElementById('rvName').value.trim();
    const rating = parseInt(document.getElementById('rvRating').value);
    const comment = document.getElementById('rvComment').value.trim();
    if (!name || !comment) { showToast("Preencha nome e comentário", 'error'); return; }
    p.reviews = p.reviews || [];
    p.reviews.unshift({ name, rating, comment, date: new Date().toLocaleDateString('pt-PT') });
    try {
      await saveProducts(state.products);
      document.getElementById('rvName').value = '';
      document.getElementById('rvComment').value = '';
      renderReviews(p);
      showToast("Avaliação enviada, obrigado!", 'success');
    } catch (e) {
      console.warn('Review save failed:', e);
      showToast("Erro ao guardar avaliação. Tente novamente.", 'error');
    }
  };

  document.getElementById('pmShare').onclick = () => {
    const p = state.products.find(pr => pr.id === state.currentProductId);
    if (!p) return;
    const text = `Olha isto: ${p.name} — ${fmt(p.price)}. Vê mais no MoEx Pemba!`;
    if (navigator.share) navigator.share({ title: p.name, text }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  document.getElementById('goCheckout').onclick = () => {
    if (state.cart.length === 0) { showToast("O carrinho está vazio", 'error'); return; }
    if (!getCurrentUser()) { showToast("Faça login para finalizar a encomenda", 'error'); navigateTo('auth'); return; }
    document.getElementById('ckZone').innerHTML = '<option value="">Selecione a zona…</option>' +
      state.zones.map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join('') +
      '<option value="__other">Outro (especificar)</option>';
    document.getElementById('ckAddrOtherWrap').style.display = 'none';
    document.getElementById('ckName').value = getCurrentUser().name || '';
    document.getElementById('ckPhone').value = getCurrentUser().phone || '';
    renderCheckoutSummary();
    renderZonePills();
    openModal('checkoutModal');
  };

  document.getElementById('ckZone').onchange = (e) => {
    document.getElementById('ckAddrOtherWrap').style.display = e.target.value === '__other' ? 'block' : 'none';
    renderZonePills();
  };
  document.getElementById('ckClose').onclick = () => closeModal('checkoutModal');

  document.getElementById('ckWhats').onclick = async () => {
    const btn = document.getElementById('ckWhats');
    const fields = getCheckoutFields();
    if (!fields) return;
    const { name, phone, addr, note } = fields;
    btn.disabled = true; btn.textContent = 'A registar…';
    const saved = await handleRegisterOrder(name, phone, addr, note);
    btn.disabled = false; btn.textContent = 'Enviar pedido por WhatsApp';
    if (!saved) return;
    const msg = `Olá! Gostaria de fazer uma encomenda:\n\n${buildOrderSummaryText()}\n\nTotal: ${fmt(cartTotalValue(state.cart, state.products))}\n\nNome: ${name}\nTelefone: ${phone}\nLocal: ${addr}${note ? '\nObs: ' + note : ''}`;
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    const waWin = window.open(waUrl, '_blank');
    if (!waWin) window.location.href = waUrl;
    finishCheckout();
  };

  document.getElementById('ckSave').onclick = async () => {
    const btn = document.getElementById('ckSave');
    const fields = getCheckoutFields();
    if (!fields) return;
    const { name, phone, addr, note } = fields;
    btn.disabled = true; btn.textContent = 'A registar…';
    const saved = await handleRegisterOrder(name, phone, addr, note);
    btn.disabled = false; btn.textContent = 'Só registar o pedido';
    if (!saved) return;
    showToast("Pedido registado! Vamos entrar em contacto.", 'success');
    finishCheckout();
  };

  const onSearch = debounce(() => {
    renderGrid();
    const clear = document.getElementById('clearSearch');
    if (clear) clear.classList.toggle('show', searchInput().value.length > 0);
  }, 180);
  searchInput().addEventListener('input', onSearch);

  const clearSearch = document.getElementById('clearSearch');
  if (clearSearch) {
    clearSearch.onclick = () => {
      searchInput().value = '';
      clearSearch.classList.remove('show');
      renderGrid();
      searchInput().focus();
    };
  }

  document.getElementById('sortBox').addEventListener('change', renderGrid);

  document.getElementById('reqClose').onclick = () => closeModal('requestModal');
  document.getElementById('reqSend').onclick = async () => {
    const btn = document.getElementById('reqSend');
    const name = document.getElementById('reqName').value.trim();
    const phone = document.getElementById('reqPhone').value.trim();
    const desc = document.getElementById('reqDesc').value.trim();
    if (!name || !phone || !desc) { showToast("Preencha todos os campos", 'error'); return; }
    btn.disabled = true; btn.textContent = 'A enviar…';
    state.customRequests.unshift({ id: uid(), name, phone, desc, date: new Date().toLocaleString('pt-PT') });
    try {
      await saveRequests(state.customRequests);
      btn.disabled = false; btn.textContent = 'Enviar pedido';
      document.getElementById('reqName').value = '';
      document.getElementById('reqPhone').value = '';
      document.getElementById('reqDesc').value = '';
      closeModal('requestModal');
      showToast("Pedido enviado! Vamos procurar para si.", 'success');
    } catch (e) {
      console.error('Request save failed:', e);
      btn.disabled = false; btn.textContent = 'Enviar pedido';
      showToast("Erro ao enviar pedido. Tente novamente.", 'error');
    }
  };

  const heroRequest = document.getElementById('heroRequestBtn');
  if (heroRequest) heroRequest.onclick = () => openModal('requestModal');
  const heroShop = document.getElementById('heroShopBtn');
  if (heroShop) heroShop.onclick = () => scrollToShop();
  const footerWhats = document.getElementById('openWhatsFooter');
  if (footerWhats) footerWhats.onclick = () => {
    window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Olá! Preciso de ajuda com uma encomenda.'), '_blank');
  };
  const brandHome = document.getElementById('brandHome');
  if (brandHome) brandHome.onclick = e => { e.preventDefault(); navigateTo('public'); render(); scrollToShop(); };

  const browseOffline = document.getElementById('browseOffline');
  if (browseOffline) browseOffline.onclick = () => {
    state.guestMode = true;
    navigateTo('public');
    const cartBtn = document.getElementById('openCart');
    if (cartBtn) cartBtn.style.display = '';
    render();
  };

  document.getElementById('showRegister').onclick = () => showAuthForm('register');
  document.getElementById('showLogin').onclick = () => showAuthForm('login');
  document.getElementById('showForgotPassword').onclick = () => showAuthForm('forgot');
  document.getElementById('showLoginFromForgot').onclick = () => showAuthForm('login');
  document.getElementById('showLoginFromConfirm').onclick = () => showAuthForm('login');

  document.getElementById('authResendBtn').onclick = async () => {
    const btn = document.getElementById('authResendBtn');
    const email = document.getElementById('confirmEmailAddr').textContent.trim();
    btn.disabled = true; btn.textContent = 'A enviar…';
    const result = await resendConfirmation(email);
    btn.disabled = false; btn.textContent = 'Reenviar email de confirmação';
    if (result.error) {
      showAuthError('confirmError', result.error);
    } else {
      showAuthError('confirmError', 'Email reenviado! Verifique a sua caixa de entrada.');
      document.getElementById('confirmError').style.background = 'rgba(28,110,110,0.1)';
      document.getElementById('confirmError').style.color = 'var(--teal)';
    }
  };

  document.getElementById('authLoginBtn').onclick = async () => {
    const btn = document.getElementById('authLoginBtn');
    const email = document.getElementById('authLoginEmail').value.trim();
    const pass = document.getElementById('authLoginPass').value;
    if (!email || !pass) { showAuthError('loginError', 'Preencha todos os campos'); return; }
    btn.disabled = true; btn.textContent = 'A entrar…';
    const result = await loginUser(email, pass);
    btn.disabled = false; btn.textContent = 'Entrar';
    if (result.error) {
      if (/indispon|ligaç|servidor/i.test(result.error)) setOffline(true);
      if (result.error.toLowerCase().includes('email not confirmed')) {
        showAuthForm('confirm');
        document.getElementById('confirmEmailAddr').textContent = email;
        document.getElementById('confirmError').textContent = 'Email não confirmado. Verifique a sua caixa de entrada.';
        document.getElementById('confirmError').classList.add('show');
      } else {
        showAuthError('loginError', result.error);
      }
      return;
    }
    const user = getCurrentUser();
    if (user) {
      try { state.cart = await cartStorage.load(user.id); } catch (e) { console.error('Cart load error:', e); }
      try { state.favorites = await loadFavorites(user.id); } catch (e) { console.error('Favorites load error:', e); }
      try { await loadClients(); } catch (e) { console.error('Load clients error:', e); }
      try { await refreshSellerRequests(); } catch (e) { console.error('Load seller requests error:', e); }
    }
    navigateTo(canAccessPanel() ? 'admin' : 'public');
    render();
  };
  ['authLoginPass','authLoginEmail'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('authLoginBtn').click();
    });
  });

  document.getElementById('authRegBtn').onclick = async () => {
    const btn = document.getElementById('authRegBtn');
    const name = document.getElementById('authRegName').value.trim();
    const email = document.getElementById('authRegEmail').value.trim();
    const phone = document.getElementById('authRegPhone').value.trim();
    const pass = document.getElementById('authRegPass').value;
    const pass2 = document.getElementById('authRegPass2').value;
    const rolePick = document.querySelector('input[name="authRole"]:checked');
    const accountRole = rolePick && rolePick.value === 'seller' ? 'seller' : 'user';
    if (!name || !email || !phone || !pass || !pass2) { showAuthError('registerError', 'Preencha todos os campos'); return; }
    if (pass !== pass2) { showAuthError('registerError', 'As senhas não coincidem'); return; }
    if (pass.length < 6) { showAuthError('registerError', 'A palavra-passe deve ter pelo menos 6 caracteres'); return; }
    btn.disabled = true; btn.textContent = 'A criar conta…';
    const result = await registerUser(name, email, phone, pass, accountRole);
    btn.disabled = false; btn.textContent = 'Criar conta';
    if (result.error) {
      if (/indispon|ligaç|servidor/i.test(result.error)) setOffline(true);
      showAuthError('registerError', result.error);
      return;
    }
    if (result.confirmEmail) {
      showAuthForm('confirm');
      document.getElementById('confirmEmailAddr').textContent = result.email;
      showToast("Confirme o email para activar a conta.", 'success');
      return;
    }
    const user = getCurrentUser();
    if (user) {
      try { state.cart = await cartStorage.load(user.id); } catch (e) { console.error('Cart load error:', e); }
      try { state.favorites = await loadFavorites(user.id); } catch (e) { console.error('Favorites load error:', e); }
    }
    navigateTo(accountRole === 'seller' ? 'admin' : 'public');
    render();
    showToast(accountRole === 'seller' ? "Conta de vendedor criada!" : "Conta criada com sucesso!", 'success');
  };
  ['authRegPass2','authRegName','authRegEmail','authRegPhone','authRegPass'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('authRegBtn').click();
    });
  });

  document.getElementById('authForgotBtn').onclick = async () => {
    const btn = document.getElementById('authForgotBtn');
    const email = document.getElementById('authForgotEmail').value.trim();
    if (!email) { showAuthError('forgotError', 'Insira o seu email'); return; }
    btn.disabled = true; btn.textContent = 'A enviar…';
    const result = await requestPasswordReset(email);
    btn.disabled = false; btn.textContent = 'Enviar email';
    if (result.error) { showAuthError('forgotError', result.error); return; }
    showAuthError('forgotError', 'Email enviado! Verifique a sua caixa de entrada.');
    document.getElementById('forgotError').style.background = 'rgba(28,110,110,0.1)';
    document.getElementById('forgotError').style.color = 'var(--teal)';
  };
  document.getElementById('authForgotEmail').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authForgotBtn').click();
  });

  document.getElementById('authResetBtn').onclick = async () => {
    const pass = document.getElementById('authResetPass').value;
    const pass2 = document.getElementById('authResetPass2').value;
    if (!pass || !pass2) { showAuthError('resetError', 'Preencha todos os campos'); return; }
    if (pass !== pass2) { showAuthError('resetError', 'As senhas não coincidem'); return; }
    if (pass.length < 6) { showAuthError('resetError', 'Palavra-passe deve ter pelo menos 6 caracteres'); return; }
    const result = await completePasswordReset(pass);
    if (result.error) { showAuthError('resetError', result.error); return; }
    showToast("Senha redefinida com sucesso!", 'success');
    window.location.hash = '';
    navigateTo('public');
    render();
  };
  ['authResetPass','authResetPass2'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('authResetBtn').click();
    });
  });

  document.getElementById('openAdmin').onclick = () => {
    if (!getCurrentUser() || !canAccessPanel()) { showToast("Acesso não autorizado", 'error'); return; }
    closeAllModals();
    closeCart();
    navigateTo('admin');
    render();
  };

  document.getElementById('openMyOrders').onclick = () => openMyOrders();
  document.getElementById('moClose').onclick = () => closeModal('myOrdersModal');

  document.getElementById('adLogout').onclick = async () => {
    await logout();
    navigateTo('auth');
    render();
  };

  document.querySelectorAll('.admin-nav-btn').forEach(t => {
    if (t.id === 'adLogout') return;
    t.onclick = () => {
      if (t.style.display === 'none') return;
      document.querySelectorAll('.admin-nav-btn').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const tab = t.dataset.tab;
      const content = document.getElementById('adminView').querySelector('.admin-content');
      content.querySelectorAll(':scope > div').forEach(d => d.style.display = 'none');
      if (tab !== 'store') setActiveAdminTab(tab);
      if (tab === 'store') {
        document.getElementById('publicView').style.display = '';
        document.getElementById('adminView').querySelector('.admin-sidebar').style.display = 'none';
        const footer = document.querySelector('footer.site');
        if (footer) footer.style.display = '';
        render();
      } else {
        document.getElementById('adminView').querySelector('.admin-sidebar').style.display = '';
        document.getElementById('tabDashboard').style.display = tab === 'dashboard' ? 'block' : 'none';
        document.getElementById('tabOrders').style.display = tab === 'orders' ? 'block' : 'none';
        document.getElementById('tabProducts').style.display = tab === 'products' ? 'block' : 'none';
        document.getElementById('tabClients').style.display = tab === 'clients' ? 'block' : 'none';
        document.getElementById('tabRequests').style.display = tab === 'requests' ? 'block' : 'none';
        document.getElementById('tabSettings').style.display = tab === 'settings' ? 'block' : 'none';
        document.getElementById('tabSuppliers').style.display = tab === 'suppliers' ? 'block' : 'none';
        const footer = document.querySelector('footer.site');
        if (footer) footer.style.display = 'none';
        renderAdminState();
      }
      setTimeout(() => updateHeaderUI(getCurrentUser()), 0);
    };
  });

  const dashNew = document.getElementById('dashNewProduct');
  if (dashNew) dashNew.onclick = () => {
    setActiveAdminTab('products');
    document.getElementById('tabProducts').style.display = 'block';
    document.querySelectorAll('.admin-content > div').forEach(d => { if (d.id !== 'tabProducts') d.style.display = 'none'; });
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'products'));
    document.getElementById('tabProducts').scrollIntoView({ behavior: 'smooth' });
  };

  document.querySelectorAll('[data-status-filter]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-status-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.orderFilter = btn.dataset.statusFilter;
      const myProducts = sellerScopedProducts();
      const myOrders = sellerScopedOrders(myProducts);
      renderAdminOrderList(myOrders, handleOrderStatusChange, state.orderFilter, state.products, state.clients);
    };
  });

  document.getElementById('npAdd').onclick = async () => {
    const eid = document.getElementById('editingId').value;
    const data = readProductForm();
    if (!data.name || !data.price) {
      showToast("Preencha nome e preço", 'error');
      document.getElementById('npName').focus();
      return;
    }
    const btn = document.getElementById('npAdd');
    btn.disabled = true;
    try {
      if (eid) {
        const p = state.products.find(pr => pr.id === eid);
        Object.assign(p, data);
        document.getElementById('editingId').value = '';
        btn.textContent = "Publicar produto";
      } else {
        state.products.push({ id: uid(), ...data, sold: 0, reviews: [], created_by: getCurrentUser()?.id || null });
      }
      await saveProducts(state.products);
      clearProductForm();
      render();
      showToast(eid ? "Produto actualizado" : "Produto publicado", 'success');
    } catch (e) {
      console.error('Product save failed:', e);
      showToast("Erro ao guardar produto. Tente novamente.", 'error');
    } finally {
      btn.disabled = false;
    }
  };

  document.getElementById('addZone').onclick = async () => {
    const val = document.getElementById('newZone').value.trim();
    if (!val) return;
    state.zones.push(val);
    try {
      await saveZones(state.zones);
      document.getElementById('newZone').value = '';
      renderZonesList(state.zones, handleRemoveZone);
      showToast('Zona adicionada', 'success');
    } catch (e) {
      console.error('Zone save failed:', e);
      state.zones.pop();
      showToast("Erro ao guardar zona. Tente novamente.", 'error');
    }
  };

  document.getElementById('addPayment').onclick = async () => {
    const val = document.getElementById('newPayment').value.trim();
    if (!val) return;
    state.payments.push(val);
    try {
      await savePayments(state.payments);
      document.getElementById('newPayment').value = '';
      renderPaymentsList(state.payments, handleRemovePayment);
      showToast('Forma de pagamento adicionada', 'success');
    } catch (e) {
      console.error('Payment save failed:', e);
      state.payments.pop();
      showToast("Erro ao guardar pagamento. Tente novamente.", 'error');
    }
  };

  document.getElementById('addSupplier').onclick = async () => {
    const name = document.getElementById('newSupplierName').value.trim();
    const contact = document.getElementById('newSupplierContact').value.trim();
    if (!name) return;
    state.suppliers.push({ name, contact });
    try {
      await saveSuppliers(state.suppliers);
      document.getElementById('newSupplierName').value = '';
      document.getElementById('newSupplierContact').value = '';
      renderSuppliersList(state.suppliers, handleRemoveSupplier);
      populateSupplierDropdown();
      showToast('Fornecedor adicionado', 'success');
    } catch (e) {
      console.error('Supplier save failed:', e);
      state.suppliers.pop();
      showToast("Erro ao guardar fornecedor. Tente novamente.", 'error');
    }
  };

  setupProductForm();
  setupMobileTabbar();
  renderPreview();
}

init();
