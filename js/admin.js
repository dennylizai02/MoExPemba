import { fmt } from './utils.js';

export function renderAdminProductList(products, onEdit, onDelete) {
  const wrap = document.getElementById('adminProductList');
  if (!wrap) return;
  wrap.innerHTML = "";
  if (products.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Nenhum produto publicado.</p>'; return; }
  products.forEach(p => {
    const row = document.createElement('div');
    row.className = 'admin-list-item';
    row.innerHTML = `
      <img src="${p.img}">
      <div class="info"><b>${p.name}</b><br><span class="mono">${fmt(p.price)}</span> · ${p.category || '—'} · ${p.sold || 0} vendidos</div>
      <div class="actions">
        <button data-edit="${p.id}">Editar</button>
        <button class="danger" data-del="${p.id}">Apagar</button>
      </div>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => onEdit(b.dataset.edit));
  wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = () => onDelete(b.dataset.del));
}

export function renderAdminOrderList(orders) {
  const wrap = document.getElementById('adminOrderList');
  if (!wrap) return;
  if (orders.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.55);">Ainda não há encomendas.</p>'; return; }
  wrap.innerHTML = "";
  orders.forEach(o => {
    const div = document.createElement('div');
    div.className = 'order-item';
    div.innerHTML = `
      <div class="oh"><span>${o.name} · ${o.phone}</span><span class="mono">${fmt(o.total)}</span></div>
      <div><span class="info-pill" style="background:var(--mango);color:var(--ink);border-color:var(--mango);">${o.status}</span> ${o.addr}${o.note ? ' — ' + o.note : ''}</div>
      <div class="items">${o.items.map(i => `${i.qty}x ${i.name}${i.size ? ' (' + i.size + ')' : ''}${i.color ? ' · ' + i.color : ''}`).join(', ')}</div>
      <div class="meta">${o.date}</div>`;
    wrap.appendChild(div);
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
      <div class="oh"><span>${r.name} · ${r.phone}</span></div>
      <div>${r.desc}</div>
      <div class="meta">${r.date}</div>`;
    wrap.appendChild(div);
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
    row.innerHTML = `<span class="info-pill" style="flex:1;">${z}</span><button data-rmzone="${i}">Remover</button>`;
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
    row.innerHTML = `<span class="info-pill" style="flex:1;">${p}</span><button data-rmpay="${i}">Remover</button>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('[data-rmpay]').forEach(b => b.onclick = () => onChange(parseInt(b.dataset.rmpay)));
}

export function showAuthView() {
  document.getElementById('authView').style.display = '';
  document.getElementById('publicView').style.display = 'none';
  document.getElementById('adminView').style.display = 'none';
  document.getElementById('authLoginForm').style.display = '';
  document.getElementById('authRegisterForm').style.display = 'none';
  document.getElementById('authForgotForm').style.display = 'none';
  document.getElementById('authResetForm').style.display = 'none';
  document.getElementById('loginError').classList.remove('show');
  document.getElementById('registerError').classList.remove('show');
}

export function showPublicView() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('publicView').style.display = '';
  document.getElementById('adminView').style.display = 'none';
}

export function showAdminView() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('publicView').style.display = '';
  document.getElementById('adminView').style.display = '';
  document.getElementById('adminPanel').style.display = 'block';
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
  wrap.style.display = 'flex';
  wrap.innerHTML = `
    <div class="user-badge">
      <span class="user-name">${user.name}</span>
      ${isAdmin ? '<span class="user-role">Lojista</span>' : ''}
    </div>
    <button class="logout-btn" id="userLogoutBtn">Sair</button>
  `;
  openAdminBtn.style.display = isAdmin ? '' : 'none';
  cartBtn.style.display = '';
}

export function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}
