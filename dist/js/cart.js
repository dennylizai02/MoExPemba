import { fmt, esc } from './utils.js';
import { getCurrentUser } from './auth.js';
import { cartStorage } from './storage.js';

let saveTimeout = null;

function debouncedSaveCart(cart) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const user = getCurrentUser();
    if (user) cartStorage.save(user.id, cart).catch(e => console.error('Cart save error:', e));
  }, 300);
}

export function renderCart(cart, products) {
  const wrap = document.getElementById('cartItems');
  const count = cart.reduce((a, l) => a + l.qty, 0);
  document.getElementById('cartCount').textContent = count;
  if (cart.length === 0) {
    wrap.innerHTML = `<div class="cart-empty">O carrinho está vazio.<br>Explore os produtos e adicione o que gostar.</div>`;
    document.getElementById('cartTotal').textContent = fmt(0);
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
        ${variantLabel ? `<div style="font-size:0.75rem;color:rgba(18,48,46,0.6);">${esc(variantLabel)}</div>` : ''}
        <div class="p">${fmt(p.price)}</div>
        <div class="qty">
          <button data-dec="${l.key}">−</button>
          <span>${l.qty}</span>
          <button data-inc="${l.key}">+</button>
          <button class="rm" data-rm="${l.key}">remover</button>
        </div>
      </div>`;
    wrap.appendChild(row);
  });
  document.getElementById('cartTotal').textContent = fmt(total);
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
}

export function closeCart() {
  document.getElementById('cartDrawer').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
}

export function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
  if (!document.getElementById('cartDrawer').classList.contains('show')) {
    document.getElementById('overlay').classList.remove('show');
  }
}
