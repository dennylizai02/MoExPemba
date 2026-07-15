import { fmt, esc } from './utils.js';
import { logout } from './auth.js';

const STATUS_OPTIONS = ['novo', 'em curso', 'entregue', 'cancelado'];

const STATUS_COLORS = {
  'novo': 'background:var(--mango);color:var(--ink);border-color:var(--mango);',
  'em curso': 'background:var(--teal);color:var(--paper);border-color:var(--teal);',
  'entregue': 'background:#4caf50;color:#fff;border-color:#4caf50;',
  'cancelado': 'background:var(--coral);color:#fff;border-color:var(--coral);'
};

export function renderDashboard(orders, products, customRequests) {
  const wrap = document.getElementById('dashboardStats');
  if (!wrap) return;

  const totalOrders = orders.length;
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const pending = orders.filter(o => o.status === 'novo' || o.status === 'em curso').length;
  const delivered = orders.filter(o => o.status === 'entregue').length;
  const totalProducts = products.length;
  const totalSold = products.reduce((s, p) => s + (p.sold || 0), 0);
  const pendingRequests = customRequests.length;

  wrap.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${fmt(revenue)}</div>
      <div class="stat-label">Receita total</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalOrders}</div>
      <div class="stat-label">Encomendas</div>
    </div>
    <div class="stat-card accent">
      <div class="stat-value">${pending}</div>
      <div class="stat-label">Pendentes</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${delivered}</div>
      <div class="stat-label">Entregues</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalProducts}</div>
      <div class="stat-label">Produtos</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalSold}</div>
      <div class="stat-label">Itens vendidos</div>
    </div>
    <div class="stat-card${pendingRequests > 0 ? ' accent' : ''}">
      <div class="stat-value">${pendingRequests}</div>
      <div class="stat-label">Pedidos personalizados</div>
    </div>
  `;
}

export function renderDashboardRecentOrders(orders) {
  const wrap = document.getElementById('dashboardRecentOrders');
  if (!wrap) return;
  const recent = orders.slice(0, 5);
  if (recent.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Ainda não há encomendas.</p>'; return; }
  wrap.innerHTML = "";
  recent.forEach(o => {
    const div = document.createElement('div');
    div.className = 'order-item';
    div.innerHTML = `
      <div class="oh"><span>${esc(o.name)} · ${esc(o.phone)}</span><span class="mono">${fmt(o.total)}</span></div>
      <div><span class="info-pill" style="${STATUS_COLORS[o.status] || ''}">${esc(o.status)}</span> ${esc(o.addr)}${o.note ? ' — ' + esc(o.note) : ''}</div>
      <div class="meta">${o.date}</div>`;
    wrap.appendChild(div);
  });
}

export function renderAdminProductList(products, onEdit, onDelete) {
  const wrap = document.getElementById('adminProductList');
  if (!wrap) return;
  wrap.innerHTML = "";
  if (products.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Nenhum produto publicado.</p>'; return; }
  products.forEach(p => {
    const row = document.createElement('div');
    row.className = 'admin-list-item';
    row.innerHTML = `
      <img src="${esc(p.img)}" loading="lazy">
      <div class="info"><b>${esc(p.name)}</b><br><span class="mono">${fmt(p.price)}</span> · ${esc(p.category) || '—'} · ${p.sold || 0} vendidos</div>
      <div class="actions">
        <button data-edit="${p.id}">Editar</button>
        <button class="danger" data-del="${p.id}">Apagar</button>
      </div>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => onEdit(b.dataset.edit));
  wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = () => onDelete(b.dataset.del));
}

export function renderAdminOrderList(orders, onStatusChange, statusFilter, products, clients) {
  const wrap = document.getElementById('adminOrderList');
  if (!wrap) return;
  const filtered = statusFilter && statusFilter !== 'all'
    ? orders.filter(o => o.status === statusFilter)
    : orders;
  if (filtered.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Nenhuma encomenda encontrada.</p>'; return; }
  wrap.innerHTML = "";
  filtered.forEach((o) => {
    const div = document.createElement('div');
    div.className = 'order-item';
    const statusBtns = STATUS_OPTIONS.map(s =>
      `<button class="status-btn${o.status === s ? ' active' : ''}" data-status="${s}" data-id="${o.id}" style="${STATUS_COLORS[s]}">${s}</button>`
    ).join('');
    const itemsHtml = o.items.map(i => {
      let sellerTag = '';
      if (products && clients) {
        const product = products.find(p => p.name === i.name);
        if (product && product.created_by) {
          const seller = clients.find(c => c.id === product.created_by);
          if (seller) sellerTag = `<span class="order-seller">${esc(seller.name)}</span>`;
        }
      }
      return `${i.qty}x ${esc(i.name)}${sellerTag}${i.size ? ' (' + esc(i.size) + ')' : ''}${i.color ? ' · ' + esc(i.color) : ''}`;
    }).join(', ');
    div.innerHTML = `
      <div class="oh"><span>${esc(o.name)} · ${esc(o.phone)}</span><span class="mono">${fmt(o.total)}</span></div>
      <div class="order-status-row">${statusBtns}</div>
      <div class="items">${itemsHtml}</div>
      <div style="margin:4px 0;font-size:0.82rem;">${esc(o.addr)}${o.note ? ' — ' + esc(o.note) : ''}</div>
      <div class="meta">${o.date}</div>`;
    wrap.appendChild(div);
  });
  wrap.querySelectorAll('.status-btn').forEach(b => {
    b.onclick = () => onStatusChange(b.dataset.id, b.dataset.status);
  });
}

export function renderAdminRequestList(requests) {
  const wrap = document.getElementById('adminRequestList');
  if (!wrap) return;
  if (requests.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Ainda não há pedidos personalizados.</p>'; return; }
  wrap.innerHTML = "";
  requests.forEach(r => {
    const div = document.createElement('div');
    div.className = 'order-item';
    div.innerHTML = `
      <div class="oh"><span>${esc(r.name)} · ${esc(r.phone)}</span></div>
      <div>${esc(r.desc)}</div>
      <div class="meta">${r.date}</div>`;
    wrap.appendChild(div);
  });
}

export function renderAdminClientList(clients) {
  const wrap = document.getElementById('adminClientList');
  if (!wrap) return;
  if (clients.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Nenhum cliente registado.</p>'; return; }
  wrap.innerHTML = "";
  clients.forEach(c => {
    const row = document.createElement('div');
    row.className = 'admin-list-item';
    const roleBadge = c.role === 'admin'
      ? '<span class="user-role" style="font-size:0.6rem;">Admin</span>'
      : c.role === 'seller'
      ? '<span class="user-role seller" style="font-size:0.6rem;">Vendedor</span>'
      : '';
    row.innerHTML = `
      <div class="client-avatar">${esc((c.name || '?')[0].toUpperCase())}</div>
      <div class="info">
        <b>${esc(c.name) || 'Sem nome'}</b> ${roleBadge}<br>
        <span style="font-size:0.8rem;color:rgba(18,48,46,0.6);">${esc(c.email) || '—'} · ${esc(c.phone) || '—'}</span>
      </div>
      <div class="meta" style="font-size:0.72rem;color:rgba(18,48,46,0.4);">${c.created_at ? new Date(c.created_at).toLocaleDateString('pt-PT') : ''}</div>`;
    wrap.appendChild(row);
  });
}

export function renderZonesList(zones, onChange) {
  const wrap = document.getElementById('zonesList');
  if (!wrap) return;
  wrap.innerHTML = "";
  if (zones.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Nenhuma zona definida.</p>'; return; }
  zones.forEach((z, i) => {
    const row = document.createElement('div');
    row.className = 'zone-row';
    row.innerHTML = `<span class="info-pill" style="flex:1;">${esc(z)}</span><button data-rmzone="${i}">Remover</button>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-rmzone]').forEach(b => b.onclick = () => onChange(parseInt(b.dataset.rmzone)));
}

export function renderPaymentsList(payments, onChange) {
  const wrap = document.getElementById('paymentsList');
  if (!wrap) return;
  wrap.innerHTML = "";
  if (payments.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Nenhuma forma de pagamento definida.</p>'; return; }
  payments.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'pay-row';
    row.innerHTML = `<span class="info-pill" style="flex:1;">${esc(p)}</span><button data-rmpay="${i}">Remover</button>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-rmpay]').forEach(b => b.onclick = () => onChange(parseInt(b.dataset.rmpay)));
}

export function renderSuppliersList(suppliers, onChange) {
  const wrap = document.getElementById('suppliersList');
  if (!wrap) return;
  wrap.innerHTML = "";
  if (suppliers.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Nenhum fornecedor registado.</p>'; return; }
  suppliers.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'zone-row';
    row.innerHTML = `<span class="info-pill" style="flex:1;">${esc(s.name)}${s.contact ? ' · ' + esc(s.contact) : ''}</span><button data-rmsupplier="${i}">Remover</button>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-rmsupplier]').forEach(b => b.onclick = () => onChange(parseInt(b.dataset.rmsupplier)));
}

export function showAuthView() {
  document.getElementById('authView').style.display = '';
  document.getElementById('publicView').style.display = 'none';
  document.getElementById('adminView').style.display = 'none';
  document.querySelector('footer.site').style.display = '';
  document.getElementById('authLoginForm').style.display = '';
  document.getElementById('authRegisterForm').style.display = 'none';
  document.getElementById('authForgotForm').style.display = 'none';
  document.getElementById('authResetForm').style.display = 'none';
  document.getElementById('loginError').classList.remove('show');
  document.getElementById('registerError').classList.remove('show');
  const userInfo = document.getElementById('userInfo');
  if (userInfo) { userInfo.style.display = 'none'; userInfo.innerHTML = ''; }
  const openAdminBtn = document.getElementById('openAdmin');
  if (openAdminBtn) openAdminBtn.style.display = 'none';
  const cartBtn = document.getElementById('openCart');
  if (cartBtn) cartBtn.style.display = 'none';
}

export function showPublicView() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('adminView').style.display = '';
  document.getElementById('adminView').querySelector('.admin-sidebar').style.display = 'none';
  const content = document.getElementById('adminView').querySelector('.admin-content');
  content.style.display = '';
  content.querySelectorAll(':scope > div').forEach(d => d.style.display = 'none');
  document.getElementById('publicView').style.display = '';
  document.querySelector('footer.site').style.display = '';
}

export function showAdminView() {
  const user = arguments.length > 0 ? arguments[0] : null;
  const isSeller = user && user.role === 'seller';
  document.getElementById('authView').style.display = 'none';
  document.getElementById('adminView').style.display = '';
  document.getElementById('adminView').querySelector('.admin-sidebar').style.display = '';
  const content = document.getElementById('adminView').querySelector('.admin-content');
  content.style.display = '';
  content.querySelectorAll(':scope > div').forEach(d => d.style.display = 'none');
  document.getElementById('publicView').style.display = 'none';
  document.querySelector('footer.site').style.display = 'none';

  document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));

  const adminOnlyTabs = ['clients', 'requests', 'settings', 'suppliers'];
  document.querySelectorAll('.admin-nav-btn[data-tab]').forEach(btn => {
    const tab = btn.dataset.tab;
    if (isSeller && adminOnlyTabs.includes(tab)) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
      if (isSeller && tab === 'orders') btn.textContent = 'As Minhas Encomendas';
      else if (!isSeller && tab === 'orders') btn.textContent = 'Encomendas';
    }
  });

  const dashboardBtn = document.querySelector('[data-tab="dashboard"]');
  if (dashboardBtn) dashboardBtn.classList.add('active');
  document.getElementById('tabDashboard').style.display = 'block';
}

export function updateHeaderUI(user) {
  const wrap = document.getElementById('userInfo');
  const openAdminBtn = document.getElementById('openAdmin');
  const cartBtn = document.getElementById('openCart');
  if (!user) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    openAdminBtn.style.display = 'none';
    cartBtn.style.display = 'none';
    return;
  }
  const isAdmin = user.role === 'admin';
  const isSeller = user.role === 'seller';
  const hasPanel = isAdmin || isSeller;
  const roleBadge = isAdmin ? 'Lojista' : isSeller ? 'Vendedor' : '';
  wrap.style.display = 'flex';
  wrap.innerHTML = `
    <div class="user-badge">
      <span class="user-name">${user.name}</span>
      ${roleBadge ? `<span class="user-role ${isSeller ? 'seller' : ''}">${roleBadge}</span>` : ''}
    </div>
    ${!hasPanel ? '<button class="logout-btn" id="userLogout">Sair</button>' : ''}
  `;
  if (!hasPanel) {
    document.getElementById('userLogout').onclick = async () => {
      await logout();
      document.getElementById('adminView').style.display = 'none';
      document.getElementById('publicView').style.display = 'none';
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      cartBtn.style.display = 'none';
      document.getElementById('authView').style.display = '';
    };
  }
  openAdminBtn.style.display = hasPanel ? '' : 'none';
  cartBtn.style.display = hasPanel ? 'none' : '';
}

export function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}
