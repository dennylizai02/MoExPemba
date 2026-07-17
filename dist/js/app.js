import { WHATSAPP_NUMBER, supabase } from './config.js';
import { fmt, uid, showToast, esc } from './utils.js';
import {
  registerUser, loginUser, logout, restoreSession, getCurrentUser,
  isCurrentUserAdmin, isCurrentUserSeller, canAccessPanel,
  requestPasswordReset, completePasswordReset, resendConfirmation,
  isRecoverySession
} from './auth.js';
import {
  loadData, saveProducts, createOrder, updateOrderStatus, saveRequests, saveFavorites, saveZones, savePayments, saveSuppliers, loadFavorites, loadUserOrders
} from './data.js';
import { cartStorage } from './storage.js';
import { renderProductCards, renderProductModal, renderReviews, matchesSearch } from './products.js';
import { renderCart, cartTotalValue, openCartDrawer, closeCart, closeAllModals } from './cart.js';
import {
  renderAdminProductList, renderAdminOrderList, renderAdminRequestList,
  renderZonesList, renderPaymentsList, renderSuppliersList, showAuthView, showPublicView,
  showAdminView, updateHeaderUI, showAuthError,
  renderDashboard, renderDashboardRecentOrders, renderAdminClientList
} from './admin.js';

const state = {
  products: [], orders: [], customRequests: [], favorites: [],
  zones: [], payments: [], suppliers: [], cart: [], activeCategory: "Todos",
  currentProductId: null, selectedSize: null, selectedColor: null,
  clients: [], orderFilter: 'all'
};

let searchTimeout = null;
let lastFocusedElement = null;

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
      if (lastFocusedElement) lastFocusedElement.focus();
    }
  });
  first.focus();
}

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
}

function renderFeaturedStrip() {
  const wrap = document.getElementById('featuredStrip');
  const featured = state.products.filter(p => p.badge && p.badge.toLowerCase().includes('destaque'));
  const bestSellers = [...state.products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 4);
  wrap.innerHTML = "";
  if (bestSellers.length && bestSellers.some(p => p.sold > 0)) {
    const h = document.createElement('h2');
    h.className = 'display';
    h.textContent = "Mais vendidos";
    wrap.appendChild(h);
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px;';
    renderProductCards(bestSellers.filter(p => p.sold > 0), row, handleAddToCart, openProductModalHandler, handleToggleFavorite, state.favorites);
    wrap.appendChild(row);
  }
  if (featured.length) {
    const h = document.createElement('h2');
    h.className = 'display';
    h.textContent = "Em destaque";
    wrap.appendChild(h);
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px;';
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

function updateResultCount(count) {
  const el = document.getElementById('resultCount');
  if (!el) return;
  if (count === 0) { el.textContent = ''; return; }
  el.textContent = count + ' produto' + (count !== 1 ? 's' : '') + ' encontrado' + (count !== 1 ? 's' : '');
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('emptyState');
  const search = document.getElementById('searchBox').value.trim().toLowerCase();

  let list = state.products.filter(p =>
    (state.activeCategory === "Todos" || p.category === state.activeCategory) && matchesSearch(p, search)
  );
  list = applySorting(list);

  if (list.length === 0) {
    grid.innerHTML = "";
    updateResultCount(0);
    if (state.products.length === 0) {
      emptyState.style.display = 'block';
      emptyState.innerHTML = 'Ainda não há produtos aqui. Volte em breve.';
      return;
    }
    let related = state.products.filter(p => state.activeCategory === "Todos" || p.category === state.activeCategory);
    if (related.length === 0) related = state.products.slice();
    related = related.slice(0, 4);

    emptyState.style.display = 'block';
    emptyState.innerHTML = `
      <p style="margin-bottom:6px;">Não encontramos exatamente isso, mas talvez goste destes:</p>
      <div style="display:flex;gap:16px;justify-content:center;margin:8px 0;">
        <button class="btn-primary mango" id="openReqModal" style="width:auto;padding:11px 20px;">Descrever o produto que procuro</button>
        <button class="btn-secondary" id="openWhatsAppFallback" style="width:auto;padding:11px 20px;margin-top:0;">Falar com o lojista</button>
      </div>`;
    document.getElementById('openReqModal').onclick = () => {
      lastFocusedElement = document.activeElement;
      document.getElementById('requestModal').classList.add('show');
      trapFocus(document.getElementById('requestModal'));
    };
    document.getElementById('openWhatsAppFallback').onclick = () => {
      window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Olá! Não encontrei na página o produto que procuro, pode me ajudar?'), '_blank');
    };
    renderProductCards(related, grid, handleAddToCart, openProductModalHandler, handleToggleFavorite, state.favorites);
    return;
  }

  emptyState.style.display = 'none';
  updateResultCount(list.length);
  renderProductCards(list, grid, handleAddToCart, openProductModalHandler, handleToggleFavorite, state.favorites);
}

function renderCartState() {
  state.cart = state.cart.filter(l => state.products.find(p => p.id === l.id));
  renderCart(state.cart, state.products);
  const user = getCurrentUser();
  if (user) cartStorage.save(user.id, state.cart).catch(e => console.error('Cart save error:', e));
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
  showToast("Adicionado ao carrinho");
}

async function handleToggleFavorite(id) {
  if (state.favorites.includes(id)) state.favorites = state.favorites.filter(f => f !== id);
  else state.favorites.push(id);
  const user = getCurrentUser();
  if (user) await saveFavorites(user.id, state.favorites);
  render();
}

function openProductModalHandler(id) {
  const p = state.products.find(pr => pr.id === id);
  if (!p) return;
  state.currentProductId = id;
  state.selectedSize = (p.sizes && p.sizes[0]) || null;
  state.selectedColor = (p.colors && p.colors[0]) || null;
  renderProductModal(p, state.payments, state.zones);
  if (document.getElementById('pmSizeSelect')) document.getElementById('pmSizeSelect').onchange = (e) => state.selectedSize = e.target.value;
  if (document.getElementById('pmColorSelect')) document.getElementById('pmColorSelect').onchange = (e) => state.selectedColor = e.target.value;
  const modal = document.getElementById('productModal');
  lastFocusedElement = document.activeElement;
  modal.classList.add('show');
  trapFocus(modal);
}

async function loadClients() {
  const user = getCurrentUser();
  if (!user || (!isCurrentUserAdmin() && !isCurrentUserSeller())) { state.clients = []; return; }
  const { data } = await supabase.from('profiles').select('id, name, phone, email, role, created_at').order('created_at', { ascending: false });
  state.clients = data || [];
}

async function handleOrderStatusChange(orderId, newStatus) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  try {
    await updateOrderStatus(orderId, newStatus);
    order.status = newStatus;
    renderAdminState();
    showToast("Status atualizado");
  } catch (e) {
    console.error('Order status update failed:', e);
    showToast("Erro ao atualizar status");
  }
}

function renderAdminState() {
  if (document.getElementById('adminView').style.display === 'none') return;
  const user = getCurrentUser();
  const isSeller = user && user.role === 'seller';
  const myProducts = isSeller ? state.products.filter(p => p.created_by === user.id) : state.products;
  const myOrders = isSeller ? state.orders.filter(o => o.items && o.items.some(i => myProducts.some(p => p.name === i.name))) : state.orders;
  renderDashboard(myOrders, myProducts, isSeller ? [] : state.customRequests);
  renderDashboardRecentOrders(myOrders);
  renderAdminProductList(myProducts, handleEditProduct, handleDeleteProduct);
  renderAdminOrderList(myOrders, handleOrderStatusChange, state.orderFilter, state.products, state.clients);
  renderAdminRequestList(isSeller ? [] : state.customRequests);
  renderAdminClientList(isSeller ? [] : state.clients);
  renderZonesList(state.zones, handleRemoveZone);
  renderPaymentsList(state.payments, handleRemovePayment);
  renderSuppliersList(state.suppliers || [], handleRemoveSupplier);
  populateSupplierDropdown();
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
  renderFeaturedStrip();
  renderGrid();
  renderCartState();
  renderAdminState();
}

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
  if (!name || !phone) { showToast("Preencha nome e telefone"); return null; }
  if (!addr) { showToast("Selecione uma zona de entrega"); return null; }
  return { name, phone, addr, note };
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
  if (user) cartStorage.clear(user.id).catch(e => console.error('Cart clear error:', e));
  renderCartState();
  document.getElementById('checkoutModal').classList.remove('show');
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

const STATUS_LABELS = { 'novo': 'Novo', 'em curso': 'Em curso', 'entregue': 'Entregue', 'cancelado': 'Cancelado' };
const STATUS_STYLES = {
  'novo': 'background:var(--mango);color:var(--ink);',
  'em curso': 'background:var(--teal);color:var(--paper);',
  'entregue': 'background:#4caf50;color:#fff;',
  'cancelado': 'background:var(--coral);color:#fff;'
};

async function openMyOrders() {
  const user = getCurrentUser();
  if (!user) return;
  const modal = document.getElementById('myOrdersModal');
  const list = document.getElementById('myOrdersList');
  list.innerHTML = '<p style="text-align:center;color:rgba(18,48,46,0.5);">A carregar...</p>';
  modal.classList.add('show');
  try {
    const orders = await loadUserOrders(user.id);
    if (orders.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:rgba(18,48,46,0.5);">Ainda não fez nenhuma encomenda.</p>';
      return;
    }
    list.innerHTML = orders.map(o => {
      const items = (o.items || []).map(i => {
        const variant = [i.size, i.color].filter(Boolean).join(' · ');
        return `<span style="font-size:0.85rem;">${i.qty}x ${esc(i.name)}${variant ? ' (' + esc(variant) + ')' : ''} — ${fmt(i.price * i.qty)}</span>`;
      }).join('<br>');
      return `
        <div style="border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
            <span style="font-size:0.82rem;color:rgba(18,48,46,0.55);">${esc(o.date)}</span>
            <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:600;${STATUS_STYLES[o.status] || ''}">${STATUS_LABELS[o.status] || o.status}</span>
          </div>
          <div style="margin-bottom:6px;">${items}</div>
          <div style="font-size:0.85rem;color:rgba(18,48,46,0.65);">📍 ${esc(o.addr)}${o.note ? ' — ' + esc(o.note) : ''}</div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);font-weight:700;">
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
    showToast("Erro ao guardar encomenda. Tente novamente.");
    return false;
  }
}

function handleEditProduct(id) {
  const p = state.products.find(pr => pr.id === id);
  if (!p) return;
  const user = getCurrentUser();
  if (user && user.role === 'seller' && p.created_by !== user.id) { showToast("Só pode editar os seus próprios produtos"); return; }
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
  document.getElementById('tabProducts').scrollIntoView({ behavior: 'smooth' });
}

async function handleDeleteProduct(id) {
  const p = state.products.find(pr => pr.id === id);
  if (!p) return;
  const user = getCurrentUser();
  if (user && user.role === 'seller' && p.created_by !== user.id) { showToast("Só pode apagar os seus próprios produtos"); return; }
  if (!confirm("Tem a certeza que deseja apagar este produto?")) return;
  state.products = state.products.filter(pr => pr.id !== id);
  await saveProducts(state.products);
  render();
  showToast("Produto apagado");
}

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

function readProductForm() {
  const name = document.getElementById('npName').value.trim();
  const price = parseFloat(document.getElementById('npPrice').value);
  const category = document.getElementById('npCat').value.trim();
  const img = document.getElementById('npImg').value.trim() || 'https://picsum.photos/seed/' + Date.now() + '/400/400';
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
  ['npName','npPrice','npCat','npImg','npImages','npDesc','npMaterial','npEntrega','npSizes','npColors','npBadge'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('npSupplier').value = '';
}

function clearUserState() {
  state.cart = [];
  state.favorites = [];
  state.clients = [];
  state.orders = [];
  renderCartState();
}

function navigateTo(view) {
  if (view === 'auth') { clearUserState(); showAuthView(); }
  else if (view === 'public') showPublicView();
  else if (view === 'admin') showAdminView(getCurrentUser());
  updateHeaderUI(getCurrentUser());
}

async function init() {
  setupEventListeners();
  try {
    const data = await loadData();
    Object.assign(state, data);

    if (isRecoverySession()) {
      window.history.replaceState(null, '', window.location.pathname);
      document.getElementById('authView').style.display = '';
      document.getElementById('authLoginForm').style.display = 'none';
      document.getElementById('authRegisterForm').style.display = 'none';
      document.getElementById('authForgotForm').style.display = 'none';
      document.getElementById('authConfirmForm').style.display = 'none';
      document.getElementById('authResetForm').style.display = '';
    } else if (await restoreSession()) {
      const user = getCurrentUser();
      if (user) {
        try { state.cart = await cartStorage.load(user.id); } catch (e) { console.error('Cart load error:', e); }
        try { state.favorites = await loadFavorites(user.id); } catch (e) { console.error('Favorites load error:', e); }
        try { await loadClients(); } catch (e) { console.error('Load clients error:', e); }
      }
      navigateTo(canAccessPanel() ? 'admin' : 'public');
    } else {
      navigateTo('auth');
    }
    render();
  } catch (e) {
    console.error('Init error:', e);
    navigateTo('auth');
  } finally {
    const loader = document.getElementById('appLoader');
    if (loader) { loader.classList.add('hide'); setTimeout(() => loader.remove(), 400); }
  }
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

  document.getElementById('pmClose').onclick = () => {
    document.getElementById('productModal').classList.remove('show');
    if (lastFocusedElement) lastFocusedElement.focus();
    if (!document.getElementById('cartDrawer').classList.contains('show')) {
      document.getElementById('overlay').classList.remove('show');
    }
  };
  document.getElementById('pmAdd').onclick = () => {
    const p = state.products.find(pr => pr.id === state.currentProductId);
    if (!p) return;
    const lineKey = state.currentProductId + '|' + (state.selectedSize || '') + '|' + (state.selectedColor || '');
    const line = state.cart.find(l => l.key === lineKey);
    if (line) line.qty++;
    else state.cart.push({ key: lineKey, id: state.currentProductId, qty: 1, size: state.selectedSize || null, color: state.selectedColor || null });
    renderCartState();
    showToast("Adicionado ao carrinho");
    document.getElementById('productModal').classList.remove('show');
    if (!document.getElementById('cartDrawer').classList.contains('show')) {
      document.getElementById('overlay').classList.remove('show');
    }
  };

  document.getElementById('rvSend').onclick = async () => {
    const p = state.products.find(pr => pr.id === state.currentProductId);
    if (!p) return;
    const name = document.getElementById('rvName').value.trim();
    const rating = parseInt(document.getElementById('rvRating').value);
    const comment = document.getElementById('rvComment').value.trim();
    if (!name || !comment) { showToast("Preencha nome e comentário"); return; }
    p.reviews = p.reviews || [];
    p.reviews.unshift({ name, rating, comment, date: new Date().toLocaleDateString('pt-PT') });
    try {
      await saveProducts(state.products);
      document.getElementById('rvName').value = '';
      document.getElementById('rvComment').value = '';
      renderReviews(p);
      showToast("Avaliação enviada, obrigado!");
    } catch (e) {
      console.error('Review save failed:', e);
      showToast("Erro ao guardar avaliação. Tente novamente.");
    }
  };

  document.getElementById('pmShare').onclick = () => {
    const p = state.products.find(pr => pr.id === state.currentProductId);
    if (!p) return;
    const text = `Olha isto: ${p.name} — ${fmt(p.price)}. Vê mais na MEP Store!`;
    if (navigator.share) navigator.share({ title: p.name, text }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  document.getElementById('goCheckout').onclick = () => {
    if (state.cart.length === 0) { showToast("O carrinho está vazio"); return; }
    if (!getCurrentUser()) { showToast("Faça login para finalizar a encomenda"); navigateTo('auth'); return; }
    document.getElementById('ckZone').innerHTML = '<option value="">Selecione a zona...</option>' +
      state.zones.map(z => `<option value="${z}">${z}</option>`).join('') +
      '<option value="__other">Outro (especificar)</option>';
    document.getElementById('ckAddrOtherWrap').style.display = 'none';
    document.getElementById('ckName').value = getCurrentUser().name || '';
    document.getElementById('ckPhone').value = getCurrentUser().phone || '';
    const modal = document.getElementById('checkoutModal');
    lastFocusedElement = document.activeElement;
    modal.classList.add('show');
    trapFocus(modal);
  };

  document.getElementById('ckZone').onchange = (e) => {
    document.getElementById('ckAddrOtherWrap').style.display = e.target.value === '__other' ? 'block' : 'none';
  };
  document.getElementById('ckClose').onclick = () => {
    document.getElementById('checkoutModal').classList.remove('show');
    if (lastFocusedElement) lastFocusedElement.focus();
    if (!document.getElementById('cartDrawer').classList.contains('show')) {
      document.getElementById('overlay').classList.remove('show');
    }
  };

  document.getElementById('ckWhats').onclick = async () => {
    const btn = document.getElementById('ckWhats');
    const fields = getCheckoutFields();
    if (!fields) return;
    const { name, phone, addr, note } = fields;
    btn.disabled = true; btn.textContent = 'A registar...';
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
    btn.disabled = true; btn.textContent = 'A registar...';
    const saved = await handleRegisterOrder(name, phone, addr, note);
    btn.disabled = false; btn.textContent = 'Só registar o pedido';
    if (!saved) return;
    showToast("Pedido registado! Vamos entrar em contacto.");
    finishCheckout();
  };

  document.getElementById('searchBox').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderGrid, 200);
  });

  document.getElementById('sortBox').addEventListener('change', renderGrid);

  document.getElementById('reqClose').onclick = () => {
    document.getElementById('requestModal').classList.remove('show');
    if (lastFocusedElement) lastFocusedElement.focus();
    if (!document.getElementById('cartDrawer').classList.contains('show')) {
      document.getElementById('overlay').classList.remove('show');
    }
  };
  document.getElementById('reqSend').onclick = async () => {
    const btn = document.getElementById('reqSend');
    const name = document.getElementById('reqName').value.trim();
    const phone = document.getElementById('reqPhone').value.trim();
    const desc = document.getElementById('reqDesc').value.trim();
    if (!name || !phone || !desc) { showToast("Preencha todos os campos"); return; }
    btn.disabled = true; btn.textContent = 'A enviar...';
    state.customRequests.unshift({ id: uid(), name, phone, desc, date: new Date().toLocaleString('pt-PT') });
    try {
      await saveRequests(state.customRequests);
      btn.disabled = false; btn.textContent = 'Enviar pedido';
      document.getElementById('reqName').value = '';
      document.getElementById('reqPhone').value = '';
      document.getElementById('reqDesc').value = '';
      document.getElementById('requestModal').classList.remove('show');
      showToast("Pedido enviado! Vamos procurar para si.");
    } catch (e) {
      console.error('Request save failed:', e);
      btn.disabled = false; btn.textContent = 'Enviar pedido';
      showToast("Erro ao enviar pedido. Tente novamente.");
    }
  };

  document.getElementById('showRegister').onclick = () => showAuthForm('register');
  document.getElementById('showLogin').onclick = () => showAuthForm('login');
  document.getElementById('showForgotPassword').onclick = () => showAuthForm('forgot');
  document.getElementById('showLoginFromForgot').onclick = () => showAuthForm('login');
  document.getElementById('showLoginFromConfirm').onclick = () => showAuthForm('login');

  document.getElementById('authResendBtn').onclick = async () => {
    const btn = document.getElementById('authResendBtn');
    const email = document.getElementById('confirmEmailAddr').textContent.trim();
    btn.disabled = true; btn.textContent = 'A enviar...';
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
    btn.disabled = true; btn.textContent = 'A entrar...';
    const result = await loginUser(email, pass);
    btn.disabled = false; btn.textContent = 'Entrar';
    if (result.error) {
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
    }
    navigateTo(canAccessPanel() ? 'admin' : 'public');
    render();
  };
  document.getElementById('authLoginPass').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authLoginBtn').click();
  });
  document.getElementById('authLoginEmail').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authLoginBtn').click();
  });

  document.getElementById('authRegBtn').onclick = async () => {
    const btn = document.getElementById('authRegBtn');
    const name = document.getElementById('authRegName').value.trim();
    const email = document.getElementById('authRegEmail').value.trim();
    const phone = document.getElementById('authRegPhone').value.trim();
    const pass = document.getElementById('authRegPass').value;
    const pass2 = document.getElementById('authRegPass2').value;
    if (!name || !email || !phone || !pass || !pass2) { showAuthError('registerError', 'Preencha todos os campos'); return; }
    if (pass !== pass2) { showAuthError('registerError', 'As senhas não coincidem'); return; }
    btn.disabled = true; btn.textContent = 'A criar conta...';
    const result = await registerUser(name, email, phone, pass);
    btn.disabled = false; btn.textContent = 'Criar conta';
    if (result.error) { showAuthError('registerError', result.error); return; }
    if (result.confirmEmail) {
      showAuthForm('confirm');
      document.getElementById('confirmEmailAddr').textContent = result.email;
    } else {
      navigateTo('public');
      render();
      showToast("Conta criada com sucesso!");
    }
  };
  document.getElementById('authRegPass2').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authRegBtn').click();
  });
  document.getElementById('authRegName').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authRegBtn').click();
  });
  document.getElementById('authRegEmail').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authRegBtn').click();
  });
  document.getElementById('authRegPhone').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authRegBtn').click();
  });
  document.getElementById('authRegPass').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authRegBtn').click();
  });

  document.getElementById('authForgotBtn').onclick = async () => {
    const btn = document.getElementById('authForgotBtn');
    const email = document.getElementById('authForgotEmail').value.trim();
    if (!email) { showAuthError('forgotError', 'Insira o seu email'); return; }
    btn.disabled = true; btn.textContent = 'A enviar...';
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
    showToast("Senha redefinida com sucesso!");
    window.location.hash = '';
    navigateTo('public');
    render();
  };
  document.getElementById('authResetPass').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authResetBtn').click();
  });
  document.getElementById('authResetPass2').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authResetBtn').click();
  });

  document.getElementById('openAdmin').onclick = () => {
    if (!getCurrentUser() || !canAccessPanel()) { showToast("Acesso não autorizado"); return; }
    closeAllModals();
    closeCart();
    navigateTo('admin');
    render();
  };

  document.getElementById('openMyOrders').onclick = () => openMyOrders();
  document.getElementById('moClose').onclick = () => {
    document.getElementById('myOrdersModal').classList.remove('show');
  };

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

  document.querySelectorAll('[data-status-filter]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-status-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.orderFilter = btn.dataset.statusFilter;
      const user = getCurrentUser();
      const isSeller = user && user.role === 'seller';
      const myProducts = isSeller ? state.products.filter(p => p.created_by === user.id) : state.products;
      const myOrders = isSeller ? state.orders.filter(o => o.items && o.items.some(i => myProducts.some(p => p.name === i.name))) : state.orders;
      renderAdminOrderList(myOrders, handleOrderStatusChange, state.orderFilter, state.products, state.clients);
    };
  });

  document.getElementById('npAdd').onclick = async () => {
    const eid = document.getElementById('editingId').value;
    const data = readProductForm();
    if (!data.name || !data.price) { showToast("Preencha nome e preço"); return; }

    if (eid) {
      const p = state.products.find(pr => pr.id === eid);
      Object.assign(p, data);
      document.getElementById('editingId').value = '';
      document.getElementById('npAdd').textContent = "Publicar produto";
    } else {
      state.products.push({ id: uid(), ...data, sold: 0, reviews: [], created_by: getCurrentUser()?.id || null });
    }
    try {
      await saveProducts(state.products);
      clearProductForm();
      render();
      showToast("Produto publicado");
    } catch (e) {
      console.error('Product save failed:', e);
      showToast("Erro ao guardar produto. Tente novamente.");
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
    } catch (e) {
      console.error('Zone save failed:', e);
      state.zones.pop();
      showToast("Erro ao guardar zona. Tente novamente.");
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
    } catch (e) {
      console.error('Payment save failed:', e);
      state.payments.pop();
      showToast("Erro ao guardar pagamento. Tente novamente.");
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
    } catch (e) {
      console.error('Supplier save failed:', e);
      state.suppliers.pop();
      showToast("Erro ao guardar fornecedor. Tente novamente.");
    }
  };

}

init();
