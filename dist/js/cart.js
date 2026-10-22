import { fmt, esc } from './utils.js';
import { getCurrentUser } from './auth.js';
import { cartStorage } from './storage.js';
import { FREE_DELIVERY_THRESHOLD } from './config.js';

let saveTimeout = null;

function debouncedSaveCart(cart) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const user = getCurrentUser();
    if (user) cartStorage.save(user.id, cart).catch(e => console.warn('Cart save error:', e));
  }, 300);
}

function renderFreeShipping(total) {
  const box = document.getElementById('freeShip');
  if (!box) return;
  const label = box.querySelector('.fs-label');
  const fill = box.querySelector('.fs-fill');
  const missing = Math.max(0, FREE_DELIVERY_THRESHOLD - total);
  if (missing <= 0) {
    label.innerHTML = '🎉 <b>Entrega grátis</b> desbloqueada para esta encomenda.';
    fill.style.width = '100%';
  } else {
    label.innerHTML = `Faltam <b class="mono">${fmt(missing)}</b> para entrega grátis`;
    fill.style.width = Math.min(100, (total / FREE_DELIVERY_THRESHOLD) * 100) + '%';
  }
}

export function renderCart(cart, products) {
  const wrap = document.getElementById('cartItems');
  const count = cart.reduce((a, l) => a + l.qty, 0);
  document.getElementById('cartCount').textContent = count;
  const badge = document.getElementById('mtCartBadge');
  if (badge) badge.textContent = count;

  if (cart.length === 0) {
    wrap.innerHTML = `<div class="cart-empty">
      <div class="ce-icon" aria-hidden="true">🧺</div>
      <b>O carrinho está vazio</b>
      <p>Explore os produtos e adicione o que gostar. Guardamos a sua cesta entre visitas.</p>
      <button class="btn-ghost" id="cartContinue">Ver produtos</button>
    </div>`;
    const cont = document.getElementById('cartContinue');
    if (cont) cont.onclick = () => { closeCart(); scrollToShop(); };
    document.getElementById('cartTotal').textContent = fmt(0);
    renderFreeShipping(0);
    return;
  }

  let total = 0;
  wrap.innerHTML = "";
  cart.forEach(l => {
    const p = products.find(pr => pr.id === l.id);
    if (!p) return;
    total += p.price * l.qty;
    const variantLabel = [l.size, l.color].filter(Boolean).join(' · ');
    const row = document.createElement('div');
    row.className = 'cart-line';
    row.innerHTML = `
      <img src="${esc(p.img)}" alt="${esc(p.name)}">
      <div class="info">
        <div class="n">${esc(p.name)}</div>
        ${variantLabel ? `<div class="v">${esc(variantLabel)}</div>` : ''}
        <div class="p">${fmt(p.price)}</div>
        <div class="qty">
          <button data-dec="${esc(l.key)}" aria-label="Diminuir quantidade">−</button>
          <span class="q">${l.qty}</span>
          <button data-inc="${esc(l.key)}" aria-label="Aumentar quantidade">+</button>
          <button class="rm" data-rm="${esc(l.key)}">remover</button>
        </div>
      </div>
      <div class="mono" style="font-size:.85rem;color:var(--ink-soft);">${fmt(p.price * l.qty)}</div>`;
    wrap.appendChild(row);
  });

  document.getElementById('cartTotal').textContent = fmt(total);
  renderFreeShipping(total);

  wrap.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => {
    const l = cart.find(l => l.key === b.dataset.inc);
    if (l) { l.qty++; renderCart(cart, products); debouncedSaveCart(cart); }
  });
  wrap.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
    const l = cart.find(l => l.key === b.dataset.dec);
    if (!l) return;
    l.qty--;
    if (l.qty <= 0) {
      const idx = cart.indexOf(l);
      if (idx !== -1) cart.splice(idx, 1);
    }
    renderCart(cart, products);
    debouncedSaveCart(cart);
  });
  wrap.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
    const idx = cart.findIndex(l => l.key === b.dataset.rm);
    if (idx !== -1) cart.splice(idx, 1);
    renderCart(cart, products);
    debouncedSaveCart(cart);
  });
}

export function cartTotalValue(cart, products) {
  return cart.reduce((a, l) => { const p = products.find(pr => pr.id === l.id); return a + (p ? p.price * l.qty : 0); }, 0);
}

export function openCartDrawer() {
  document.getElementById('cartDrawer').classList.add('show');
  document.getElementById('overlay').classList.add('show');
  document.body.classList.add('no-scroll');
}

export function closeCart() {
  document.getElementById('cartDrawer').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
  document.body.classList.remove('no-scroll');
}

export function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
  if (!document.getElementById('cartDrawer').classList.contains('show')) {
    document.getElementById('overlay').classList.remove('show');
    document.body.classList.remove('no-scroll');
  }
}

export function scrollToShop() {
  const shop = document.getElementById('searchBox');
  if (shop) shop.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
