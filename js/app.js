import { WHATSAPP_NUMBER } from './config.js';
import { fmt, uid, showToast } from './utils.js';
import {
  loadUsers, saveUsers, seedAdmin, registerUser, loginUser,
  logout, restoreSession, getCurrentUser, isCurrentUserAdmin
} from './auth.js';
import {
  loadData, saveProducts, saveOrders, saveRequests, saveFavorites, saveZones, savePayments
} from './data.js';
import { renderProductCards, renderProductModal, renderReviews, matchesSearch } from './products.js';
import { renderCart, cartTotalValue, openCartDrawer, closeCart, closeAllModals } from './cart.js';
import {
  renderAdminProductList, renderAdminOrderList, renderAdminRequestList,
  renderZonesList, renderPaymentsList, showAuthView, showPublicView,
  showAdminView, updateHeaderUI, showAuthError
} from './admin.js';

const state = {
  products: [], orders: [], customRequests: [], favorites: [],
  zones: [], payments: [], cart: [], activeCategory: "Todos",
  currentProductId: null, selectedSize: null, selectedColor: null
};

function fmtPrice(n) { return new Intl.NumberFormat('pt-MZ').format(n) + " MT"; }

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

function renderGrid() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('emptyState');
  const search = document.getElementById('searchBox').value.trim().toLowerCase();

  let list = state.products.filter(p =>
    (state.activeCategory === "Todos" || p.category === state.activeCategory) && matchesSearch(p, search)
  );

  if (list.length === 0) {
    grid.innerHTML = "";
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
        <button class="btn-primary mango" style="width:auto;padding:11px 20px;" onclick="document.getElementById('requestModal').classList.add('show')">Descrever o produto que procuro</button>
        <button class="btn-secondary" style="width:auto;padding:11px 20px;margin-top:0;" onclick="window.open('https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Não encontrei na página o produto que procuro, pode me ajudar?')}', '_blank')">Falar com o lojista</button>
      </div>`;
    renderProductCards(related, grid, handleAddToCart, openProductModalHandler, handleToggleFavorite, state.favorites);
    return;
  }

  emptyState.style.display = 'none';
  renderProductCards(list, grid, handleAddToCart, openProductModalHandler, handleToggleFavorite, state.favorites);
}

function renderCartState() {
  renderCart(state.cart, state.products);
}

function handleAddToCart(id, size, color) {
  const p = state.products.find(pr => pr.id === id);
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
  await saveFavorites(state.favorites);
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
  document.getElementById('productModal').classList.add('show');
}

function renderAdminState() {
  if (document.getElementById('adminView').style.display === 'none') return;
  renderAdminProductList(state.products, handleEditProduct, handleDeleteProduct);
  renderAdminOrderList(state.orders);
  renderAdminRequestList(state.customRequests);
  renderZonesList(state.zones, handleRemoveZone);
  renderPaymentsList(state.payments, handleRemovePayment);
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

function buildOrderSummaryText() {
  return state.cart.map(l => {
    const p = state.products.find(pr => pr.id === l.id);
    const variant = [l.size, l.color].filter(Boolean).join(' · ');
    return `${l.qty}x ${p.name}${variant ? ' (' + variant + ')' : ''} - ${fmtPrice(p.price * l.qty)}`;
  }).join('\n');
}

function finishCheckout() {
  state.cart = [];
  renderCartState();
  document.getElementById('checkoutModal').classList.remove('show');
  closeCart();
  document.getElementById('ckName').value = '';
  document.getElementById('ckPhone').value = '';
  document.getElementById('ckAddr').value = '';
  document.getElementById('ckZone').value = '';
  document.getElementById('ckAddrOtherWrap').style.display = 'none';
  document.getElementById('ckNote').value = '';
}

async function handleRegisterOrder(name, phone, addr, note) {
  state.orders.unshift({
    id: uid(),
    date: new Date().toLocaleString('pt-PT'),
    name, phone, addr, note,
    items: state.cart.map(l => {
      const p = state.products.find(pr => pr.id === l.id);
      return { name: p.name, qty: l.qty, price: p.price, size: l.size, color: l.color };
    }),
    total: cartTotalValue(state.cart, state.products),
    status: "novo"
  });
  state.cart.forEach(l => {
    const p = state.products.find(pr => pr.id === l.id);
    if (p) p.sold = (p.sold || 0) + l.qty;
  });
  await saveOrders(state.orders);
  await saveProducts(state.products);
}

function handleEditProduct(id) {
  const p = state.products.find(pr => pr.id === id);
  if (!p) return;
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
  document.getElementById('editingId').value = p.id;
  document.getElementById('npAdd').textContent = "Guardar alterações";
  document.getElementById('tabProducts').scrollIntoView({ behavior: 'smooth' });
}

async function handleDeleteProduct(id) {
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

function navigateTo(view) {
  if (view === 'auth') showAuthView();
  else if (view === 'public') showPublicView();
  else if (view === 'admin') showAdminView();
  updateHeaderUI(getCurrentUser());
}

async function init() {
  const data = await loadData();
  Object.assign(state, data);
  await loadUsers();
  await seedAdmin();

  if (restoreSession()) {
    navigateTo(isCurrentUserAdmin() ? 'admin' : 'public');
  } else {
    navigateTo('public');
  }
  render();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('openCart').onclick = openCartDrawer;
  document.getElementById('closeCart').onclick = closeCart;
  document.getElementById('overlay').onclick = () => { closeCart(); closeAllModals(); };
  document.getElementById('userInfo').addEventListener('click', (e) => {
    if (e.target.id === 'loginHeaderBtn') navigateTo('auth');
  });

  document.getElementById('pmClose').onclick = () => document.getElementById('productModal').classList.remove('show');
  document.getElementById('pmAdd').onclick = () => {
    const lineKey = state.currentProductId + '|' + (state.selectedSize || '') + '|' + (state.selectedColor || '');
    const line = state.cart.find(l => l.key === lineKey);
    if (line) line.qty++;
    else state.cart.push({ key: lineKey, id: state.currentProductId, qty: 1, size: state.selectedSize || null, color: state.selectedColor || null });
    renderCartState();
    document.getElementById('productModal').classList.remove('show');
    showToast("Adicionado ao carrinho");
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
    await saveProducts(state.products);
    document.getElementById('rvName').value = '';
    document.getElementById('rvComment').value = '';
    renderReviews(p);
    showToast("Avaliação enviada, obrigado!");
  };

  document.getElementById('pmShare').onclick = () => {
    const p = state.products.find(pr => pr.id === state.currentProductId);
    if (!p) return;
    const text = `Olha isto: ${p.name} — ${fmtPrice(p.price)}. Vê mais na MEP Store!`;
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
    document.getElementById('checkoutModal').classList.add('show');
  };

  document.getElementById('ckZone').onchange = (e) => {
    document.getElementById('ckAddrOtherWrap').style.display = e.target.value === '__other' ? 'block' : 'none';
  };
  document.getElementById('ckClose').onclick = () => document.getElementById('checkoutModal').classList.remove('show');

  document.getElementById('ckWhats').onclick = async () => {
    const name = document.getElementById('ckName').value.trim();
    const phone = document.getElementById('ckPhone').value.trim();
    const addr = resolveCheckoutAddress();
    const note = document.getElementById('ckNote').value.trim();
    if (!name || !phone || !addr) { showToast("Preencha nome, telefone e zona"); return; }
    await handleRegisterOrder(name, phone, addr, note);
    const msg = `Olá! Gostaria de fazer uma encomenda:\n\n${buildOrderSummaryText()}\n\nTotal: ${fmtPrice(cartTotalValue(state.cart, state.products))}\n\nNome: ${name}\nTelefone: ${phone}\nLocal: ${addr}${note ? '\nObs: ' + note : ''}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    finishCheckout();
  };

  document.getElementById('ckSave').onclick = async () => {
    const name = document.getElementById('ckName').value.trim();
    const phone = document.getElementById('ckPhone').value.trim();
    const addr = resolveCheckoutAddress();
    const note = document.getElementById('ckNote').value.trim();
    if (!name || !phone || !addr) { showToast("Preencha nome, telefone e zona"); return; }
    await handleRegisterOrder(name, phone, addr, note);
    showToast("Pedido registado! Vamos entrar em contacto.");
    finishCheckout();
  };

  document.getElementById('searchBox').addEventListener('input', renderGrid);

  document.getElementById('reqClose').onclick = () => document.getElementById('requestModal').classList.remove('show');
  document.getElementById('reqSend').onclick = async () => {
    const name = document.getElementById('reqName').value.trim();
    const phone = document.getElementById('reqPhone').value.trim();
    const desc = document.getElementById('reqDesc').value.trim();
    if (!name || !phone || !desc) { showToast("Preencha todos os campos"); return; }
    state.customRequests.unshift({ id: uid(), name, phone, desc, date: new Date().toLocaleString('pt-PT') });
    await saveRequests(state.customRequests);
    document.getElementById('reqName').value = '';
    document.getElementById('reqPhone').value = '';
    document.getElementById('reqDesc').value = '';
    document.getElementById('requestModal').classList.remove('show');
    showToast("Pedido enviado! Vamos procurar para si.");
  };

  document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-auth-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.authTab;
      document.getElementById('authLoginForm').style.display = tab === 'login' ? '' : 'none';
      document.getElementById('authRegisterForm').style.display = tab === 'register' ? '' : 'none';
      document.getElementById('loginError').classList.remove('show');
      document.getElementById('registerError').classList.remove('show');
    };
  });

  document.getElementById('authLoginBtn').onclick = async () => {
    const phone = document.getElementById('authLoginPhone').value.trim();
    const pass = document.getElementById('authLoginPass').value;
    if (!phone || !pass) { showAuthError('loginError', 'Preencha todos os campos'); return; }
    const result = await loginUser(phone, pass);
    if (result.error) { showAuthError('loginError', result.error); return; }
    navigateTo(isCurrentUserAdmin() ? 'admin' : 'public');
    render();
  };
  document.getElementById('authLoginPass').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authLoginBtn').click();
  });

  document.getElementById('authRegBtn').onclick = async () => {
    const name = document.getElementById('authRegName').value.trim();
    const phone = document.getElementById('authRegPhone').value.trim();
    const pass = document.getElementById('authRegPass').value;
    const pass2 = document.getElementById('authRegPass2').value;
    if (!name || !phone || !pass || !pass2) { showAuthError('registerError', 'Preencha todos os campos'); return; }
    if (pass !== pass2) { showAuthError('registerError', 'As senhas não coincidem'); return; }
    const result = await registerUser(name, phone, pass);
    if (result.error) { showAuthError('registerError', result.error); return; }
    navigateTo('public');
    render();
    showToast("Conta criada com sucesso!");
  };
  document.getElementById('authRegPass2').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authRegBtn').click();
  });

  document.getElementById('openAdmin').onclick = () => {
    if (!getCurrentUser() || !isCurrentUserAdmin()) { showToast("Acesso não autorizado"); return; }
    closeAllModals();
    closeCart();
    navigateTo('admin');
    render();
  };

  document.getElementById('adLogout').onclick = () => {
    document.getElementById('adminView').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    logout();
    navigateTo('auth');
    render();
  };

  document.getElementById('userLogoutBtn')?.addEventListener('click', () => {
    logout();
    navigateTo('auth');
    render();
  });

  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('tabProducts').style.display = t.dataset.tab === 'products' ? 'block' : 'none';
      document.getElementById('tabOrders').style.display = t.dataset.tab === 'orders' ? 'block' : 'none';
      document.getElementById('tabRequests').style.display = t.dataset.tab === 'requests' ? 'block' : 'none';
      document.getElementById('tabSettings').style.display = t.dataset.tab === 'settings' ? 'block' : 'none';
    };
  });

  document.getElementById('npAdd').onclick = async () => {
    const eid = document.getElementById('editingId').value;
    const name = document.getElementById('npName').value.trim();
    const price = parseFloat(document.getElementById('npPrice').value);
    const cat = document.getElementById('npCat').value.trim();
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
    if (!name || !price) { showToast("Preencha nome e preço"); return; }

    if (eid) {
      const p = state.products.find(pr => pr.id === eid);
      Object.assign(p, { name, price, category: cat, img, images, desc, material, entrega, sizes, colors, badge });
      document.getElementById('editingId').value = '';
      document.getElementById('npAdd').textContent = "Publicar produto";
    } else {
      state.products.push({ id: uid(), name, price, category: cat, img, images, desc, material, entrega, sizes, colors, badge, sold: 0, reviews: [] });
    }
    await saveProducts(state.products);
    ['npName', 'npPrice', 'npCat', 'npImg', 'npImages', 'npDesc', 'npMaterial', 'npEntrega', 'npSizes', 'npColors', 'npBadge'].forEach(id => document.getElementById(id).value = '');
    render();
    showToast("Produto publicado");
  };

  document.getElementById('addZone').onclick = async () => {
    const val = document.getElementById('newZone').value.trim();
    if (!val) return;
    state.zones.push(val);
    await saveZones(state.zones);
    document.getElementById('newZone').value = '';
    renderZonesList(state.zones, handleRemoveZone);
  };

  document.getElementById('addPayment').onclick = async () => {
    const val = document.getElementById('newPayment').value.trim();
    if (!val) return;
    state.payments.push(val);
    await savePayments(state.payments);
    document.getElementById('newPayment').value = '';
    renderPaymentsList(state.payments, handleRemovePayment);
  };

  document.getElementById('userLogoutBtn')?.addEventListener('click', () => {
    logout();
    navigateTo('auth');
    render();
  });
}

init();
