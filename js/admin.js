import { fmt, esc } from './utils.js';
import { logout } from './auth.js';

const STATUS_OPTIONS = ['novo', 'em curso', 'entregue', 'cancelado'];

const STATUS_COLORS = {
  'novo': 'background:var(--mango);color:var(--ink);border-color:var(--mango);',
  'em curso': 'background:var(--teal);color:var(--paper);border-color:var(--teal);',
  'entregue': 'background:#3f9d63;color:#fff;border-color:#3f9d63;',
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
  const avgTicket = totalOrders ? revenue / totalOrders : 0;

  const cards = [
    { label: 'Receita total', value: fmt(revenue), icon: '💰', cls: 'accent' },
    { label: 'Encomendas', value: totalOrders, icon: '📦' },
    { label: 'Por entregar', value: pending, icon: '⏳', cls: 'gold' },
    { label: 'Entregues', value: delivered, icon: '✅' },
    { label: 'Ticket médio', value: fmt(Math.round(avgTicket)), icon: '🧾' },
    { label: 'Produtos', value: totalProducts, icon: '🏷️' },
    { label: 'Itens vendidos', value: totalSold, icon: '📈' },
    { label: 'Pedidos de artigos', value: pendingRequests, icon: '🔎', cls: pendingRequests > 0 ? 'gold' : '' }
  ];

  wrap.innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls || ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div>
          <div class="stat-value">${esc(String(c.value))}</div>
          <div class="stat-label">${esc(c.label)}</div>
        </div>
        <span class="stat-icon" aria-hidden="true">${c.icon}</span>
      </div>
    </div>`).join('');
}

export function renderDashboardRecentOrders(orders) {
  const wrap = document.getElementById('dashboardRecentOrders');
  if (!wrap) return;
  const recent = orders.slice(0, 5);
  if (recent.length === 0) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);">Ainda não há encomendas. Assim que receber pedidos, aparecem aqui.</p>';
    return;
  }
  wrap.innerHTML = "";
  recent.forEach(o => {
    const div = document.createElement('div');
    div.className = 'order-item';
    div.innerHTML = `
      <div class="oh"><span>${esc(o.name)} · ${esc(o.phone)}</span><span class="mono">${fmt(o.total)}</span></div>
      <div><span class="info-pill" style="${STATUS_COLORS[o.status] || ''}">${esc(o.status)}</span> ${esc(o.addr)}${o.note ? ' — ' + esc(o.note) : ''}</div>
      <div class="meta">${esc(o.date || '')}</div>`;
    wrap.appendChild(div);
  });
}

export function renderAdminProductList(products, onEdit, onDelete, onDuplicate) {
  const wrap = document.getElementById('adminProductList');
  if (!wrap) return;
  const countEl = document.getElementById('adminProductCount');
  if (countEl) {
    countEl.textContent = products.length === 1 ? '1 produto' : products.length + ' produtos';
  }
  if (products.length === 0) {
    wrap.innerHTML = `<div class="empty-state" style="padding:24px 0;">
      <div class="es-inner">
        <div class="es-icon" aria-hidden="true">🏷️</div>
        <h3>Ainda não tem produtos</h3>
        <p>Preencha o formulário acima para publicar o primeiro produto. Basta o nome, o preço e uma foto.</p>
      </div>
    </div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="product-table">
      <thead>
        <tr>
          <th>Produto</th>
          <th class="hide-sm">Preço</th>
          <th class="hide-sm">Categoria</th>
          <th class="hide-sm">Vendidos</th>
          <th style="text-align:right;">Acções</th>
        </tr>
      </thead>
      <tbody>
        ${products.map(p => `
          <tr>
            <td>
              <div style="display:flex;gap:12px;align-items:center;">
                <img class="pt-img" src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">
                <div>
                  <b>${esc(p.name)}</b>
                  <div style="font-size:.75rem;color:var(--ink-faint);">${p.badge ? `<span class="pill warn">${esc(p.badge)}</span>` : 'Sem etiqueta'}</div>
                </div>
              </div>
            </td>
            <td class="hide-sm mono" style="font-size:.84rem;color:var(--coral);">${fmt(p.price)}</td>
            <td class="hide-sm">${esc(p.category || '—')}</td>
            <td class="hide-sm">${p.sold || 0}</td>
            <td>
              <div class="pt-actions">
                <button data-edit="${p.id}">Editar</button>
                ${onDuplicate ? `<button data-dup="${p.id}">Duplicar</button>` : ''}
                <button class="danger" data-del="${p.id}">Apagar</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  wrap.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => onEdit(b.dataset.edit));
  wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = () => onDelete(b.dataset.del));
  if (onDuplicate) {
    wrap.querySelectorAll('[data-dup]').forEach(b => b.onclick = () => onDuplicate(b.dataset.dup));
  }
}

export function renderAdminOrderList(orders, onStatusChange, statusFilter, products, clients) {
  const wrap = document.getElementById('adminOrderList');
  if (!wrap) return;
  const filtered = statusFilter && statusFilter !== 'all'
    ? orders.filter(o => o.status === statusFilter)
    : orders;
  if (filtered.length === 0) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);">Nenhuma encomenda encontrada.</p>';
    return;
  }
  wrap.innerHTML = "";
  filtered.forEach((o) => {
    const div = document.createElement('div');
    div.className = 'order-item';
    const statusBtns = STATUS_OPTIONS.map(s =>
      `<button class="status-btn${o.status === s ? ' active' : ''}" data-status="${s}" data-id="${o.id}" style="${STATUS_COLORS[s]}">${s}</button>`
    ).join('');
    const itemsHtml = (o.items || []).map(i => {
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
    const waLink = `https://wa.me/${String(o.phone || '').replace(/[^0-9]/g, '')}`;
    div.innerHTML = `
      <div class="oh">
        <span>${esc(o.name)} · ${esc(o.phone)}</span>
        <span class="mono">${fmt(o.total)}</span>
      </div>
      <div class="order-status-row">${statusBtns}</div>
      <div class="items">${itemsHtml}</div>
      <div style="margin:4px 0;font-size:.82rem;">📍 ${esc(o.addr)}${o.note ? ' — ' + esc(o.note) : ''}</div>
      <div class="meta" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <span>${esc(o.date || '')}</span>
        <a href="${waLink}" target="_blank" rel="noopener" style="color:var(--teal);font-weight:600;">Falar com o cliente</a>
      </div>`;
    wrap.appendChild(div);
  });
  wrap.querySelectorAll('.status-btn').forEach(b => {
    b.onclick = () => onStatusChange(b.dataset.id, b.dataset.status);
  });
}

export function renderAdminRequestList(requests) {
  const wrap = document.getElementById('adminRequestList');
  if (!wrap) return;
  if (!requests || requests.length === 0) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);">Ainda não há pedidos personalizados.</p>';
    return;
  }
  wrap.innerHTML = "";
  requests.forEach(r => {
    const div = document.createElement('div');
    div.className = 'order-item';
    const waLink = `https://wa.me/${String(r.phone || '').replace(/[^0-9]/g, '')}`;
    div.innerHTML = `
      <div class="oh"><span>${esc(r.name)} · ${esc(r.phone)}</span></div>
      <div>${esc(r.desc)}</div>
      <div class="meta" style="display:flex;gap:12px;">
        <span>${esc(r.date || '')}</span>
        <a href="${waLink}" target="_blank" rel="noopener" style="color:var(--teal);font-weight:600;">Contactar</a>
      </div>`;
    wrap.appendChild(div);
  });
}

export function renderAdminClientList(clients, onRoleChange, canManage) {
  const wrap = document.getElementById('adminClientList');
  if (!wrap) return;
  if (!clients || clients.length === 0) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);">Nenhum cliente registado.</p>';
    return;
  }
  wrap.innerHTML = "";
  clients.forEach(c => {
    const row = document.createElement('div');
    row.className = 'admin-list-item';
    const roleBadge = c.role === 'admin'
      ? '<span class="role-badge admin">Lojista</span>'
      : c.role === 'seller'
        ? '<span class="role-badge seller">Vendedor</span>'
        : '<span class="role-badge" style="background:rgba(18,48,46,.08);color:var(--ink-faint);">Cliente</span>';
    const roleSelect = canManage
      ? `<select class="input" data-role-for="${c.id}" style="width:auto;min-width:120px;font-size:.78rem;padding:7px 10px;">
           ${['user', 'seller', 'admin'].map(r =>
             `<option value="${r}"${c.role === r ? ' selected' : ''}>${r === 'user' ? 'Cliente' : r === 'seller' ? 'Vendedor' : 'Lojista'}</option>`).join('')}
         </select>`
      : '';
    row.innerHTML = `
      <div class="client-avatar">${esc((c.name || '?')[0].toUpperCase())}</div>
      <div class="info">
        <b>${esc(c.name) || 'Sem nome'}</b>${roleBadge}<br>
        <span style="font-size:.8rem;color:var(--ink-faint);">${esc(c.email) || '—'} · ${esc(c.phone) || '—'}</span>
      </div>
      ${roleSelect}
      <div class="meta" style="font-size:.72rem;color:var(--ink-faint);">${c.created_at ? new Date(c.created_at).toLocaleDateString('pt-PT') : ''}</div>`;
    wrap.appendChild(row);
  });
  if (canManage && onRoleChange) {
    wrap.querySelectorAll('[data-role-for]').forEach(sel => {
      sel.onchange = () => onRoleChange(sel.dataset.roleFor, sel.value);
    });
  }
}

export function renderSellerRequestList(requests, onApprove, onReject) {
  const wrap = document.getElementById('sellerRequestList');
  const section = document.getElementById('sellerRequestsSection');
  if (!wrap) return;
  const list = requests || [];
  if (section) section.style.display = list.length ? '' : 'none';
  if (list.length === 0) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);">Sem pedidos para vender.</p>';
    return;
  }
  wrap.innerHTML = "";
  list.forEach(r => {
    const row = document.createElement('div');
    row.className = 'admin-list-item';
    row.innerHTML = `
      <div class="client-avatar">${esc((r.name || '?')[0].toUpperCase())}</div>
      <div class="info">
        <b>${esc(r.name || 'Sem nome')}</b><br>
        <span style="font-size:.8rem;color:var(--ink-faint);">${esc(r.phone || '—')} · ${esc(r.email || '—')}</span>
        <div style="font-size:.8rem;color:var(--ink-soft);margin-top:4px;">${esc(r.note || '')}</div>
      </div>
      <div class="actions">
        <button data-approve="${r.id}">Aprovar</button>
        <button class="danger" data-reject="${r.id}">Recusar</button>
      </div>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => onApprove(b.dataset.approve));
  wrap.querySelectorAll('[data-reject]').forEach(b => b.onclick = () => onReject(b.dataset.reject));
}

export function renderZonesList(zones, onChange) {
  const wrap = document.getElementById('zonesList');
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!zones || zones.length === 0) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);">Nenhuma zona definida.</p>';
    return;
  }
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
  if (!payments || payments.length === 0) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);">Nenhuma forma de pagamento definida.</p>';
    return;
  }
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
  if (!suppliers || suppliers.length === 0) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);">Nenhum fornecedor registado.</p>';
    return;
  }
  suppliers.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'zone-row';
    row.innerHTML = `<span class="info-pill" style="flex:1;">${esc(s.name)}${s.contact ? ' · ' + esc(s.contact) : ''}</span><button data-rmsupplier="${i}">Remover</button>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-rmsupplier]').forEach(b => b.onclick = () => onChange(parseInt(b.dataset.rmsupplier)));
}

const TAB_IDS = {
  dashboard: 'tabDashboard', orders: 'tabOrders', products: 'tabProducts',
  clients: 'tabClients', requests: 'tabRequests', settings: 'tabSettings', suppliers: 'tabSuppliers'
};
let activeAdminTab = 'dashboard';
export function setActiveAdminTab(tab) { if (tab) activeAdminTab = tab; }

export function showAuthView() {
  activeAdminTab = 'dashboard';
  document.getElementById('authView').style.display = '';
  document.getElementById('publicView').style.display = 'none';
  document.getElementById('adminView').style.display = 'none';
  const footer = document.querySelector('footer.site');
  if (footer) footer.style.display = '';
  document.getElementById('authLoginForm').style.display = '';
  document.getElementById('authRegisterForm').style.display = 'none';
  document.getElementById('authForgotForm').style.display = 'none';
  document.getElementById('authResetForm').style.display = 'none';
  document.getElementById('authConfirmForm').style.display = 'none';
  document.getElementById('loginError').classList.remove('show');
  document.getElementById('registerError').classList.remove('show');
  const userInfo = document.getElementById('userInfo');
  if (userInfo) { userInfo.style.display = 'none'; userInfo.innerHTML = ''; }
  const openAdminBtn = document.getElementById('openAdmin');
  if (openAdminBtn) openAdminBtn.style.display = 'none';
  const cartBtn = document.getElementById('openCart');
  if (cartBtn) cartBtn.style.display = 'none';
  const myOrdersBtn = document.getElementById('openMyOrders');
  if (myOrdersBtn) myOrdersBtn.style.display = 'none';
  ['authLoginEmail','authLoginPass','authRegName','authRegEmail','authRegPhone','authRegPass','authRegPass2','authForgotEmail','authResetPass','authResetPass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

export function showPublicView() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('adminView').style.display = '';
  document.getElementById('adminView').querySelector('.admin-sidebar').style.display = 'none';
  const content = document.getElementById('adminView').querySelector('.admin-content');
  content.style.display = '';
  content.classList.add('store-mode');
  content.querySelectorAll(':scope > div').forEach(d => d.style.display = 'none');
  document.getElementById('publicView').style.display = '';
  const footer = document.querySelector('footer.site');
  if (footer) footer.style.display = '';
  const cartBtn = document.getElementById('openCart');
  if (cartBtn) cartBtn.style.display = '';
}

export function showAdminView(user) {
  const isSeller = user && user.role === 'seller';
  document.getElementById('authView').style.display = 'none';
  document.getElementById('adminView').style.display = '';
  document.getElementById('adminView').querySelector('.admin-sidebar').style.display = '';
  const content = document.getElementById('adminView').querySelector('.admin-content');
  content.style.display = '';
  content.classList.remove('store-mode');
  content.querySelectorAll(':scope > div').forEach(d => d.style.display = 'none');
  document.getElementById('publicView').style.display = 'none';
  const footer = document.querySelector('footer.site');
  if (footer) footer.style.display = 'none';
  const cartBtn = document.getElementById('openCart');
  if (cartBtn) cartBtn.style.display = 'none';

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

  const wanted = TAB_IDS[activeAdminTab] && !(isSeller && adminOnlyTabs.includes(activeAdminTab))
    ? activeAdminTab : 'dashboard';
  const activeTabEl = document.getElementById(TAB_IDS[wanted]) || document.getElementById('tabDashboard');
  activeTabEl.style.display = 'block';
  const activeBtn = document.querySelector(`.admin-nav-btn[data-tab="${wanted}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

export function updateHeaderUI(user) {
  const wrap = document.getElementById('userInfo');
  const openAdminBtn = document.getElementById('openAdmin');
  const cartBtn = document.getElementById('openCart');
  const myOrdersBtn = document.getElementById('openMyOrders');
  if (!user) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    openAdminBtn.style.display = 'none';
    cartBtn.style.display = 'none';
    if (myOrdersBtn) myOrdersBtn.style.display = 'none';
    return;
  }
  const isAdmin = user.role === 'admin';
  const isSeller = user.role === 'seller';
  const hasPanel = isAdmin || isSeller;
  const roleBadge = isAdmin ? 'Lojista' : isSeller ? 'Vendedor' : '';
  const adminViewVisible = document.getElementById('adminView').style.display !== 'none';
  const sidebarVisible = adminViewVisible && document.getElementById('adminView').querySelector('.admin-sidebar').style.display !== 'none';
  const onStore = adminViewVisible && !sidebarVisible;
  const showCart = !hasPanel || onStore;
  wrap.style.display = 'flex';
  wrap.innerHTML = `
    <div class="user-badge">
      <span class="user-name">${esc(user.name || 'Cliente')}</span>
      ${roleBadge ? `<span class="user-role role-badge ${isSeller ? 'seller' : 'admin'}">${roleBadge}</span>` : ''}
    </div>
    <button class="logout-btn" id="userLogout">Sair</button>
  `;
  document.getElementById('userLogout').onclick = async () => {
    await logout();
    showAuthView();
  };
  openAdminBtn.style.display = hasPanel && onStore ? '' : 'none';
  cartBtn.style.display = showCart ? '' : 'none';
  if (myOrdersBtn) myOrdersBtn.style.display = !hasPanel ? '' : 'none';
}

export function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}
