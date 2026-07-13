import { fmt } from './utils.js';

export function renderProductCards(list, container, onAdd, onView, onFav, favorites) {
  container.innerHTML = "";
  list.forEach(p => {
    const isFav = favorites.includes(p.id);
    const card = document.createElement('div');
    card.className = 'tag-card';
    card.innerHTML = `
      ${p.badge ? `<div class="tag-badge">${p.badge}</div>` : ''}
      <button class="fav-btn ${isFav ? 'active' : ''}" data-fav="${p.id}">${isFav ? '♥' : '♡'}</button>
      <img class="tag-img" src="${p.img}" alt="${p.name}">
      <div class="tag-body">
        <div class="tag-cat">${p.category || ''}</div>
        <div class="tag-name">${p.name}</div>
        <div class="tag-price">${fmt(p.price)}</div>
        ${p.entrega ? `<div class="tag-delivery">🚚 Entrega: ${p.entrega}</div>` : ''}
        ${p.sold ? `<div class="tag-sold">${p.sold} vendidos</div>` : ''}
        <div class="add-row">
          <button class="view-btn" data-view="${p.id}">Ver</button>
          <button class="add-btn" data-add="${p.id}">Adicionar</button>
        </div>
      </div>`;
    container.appendChild(card);
  });
  container.querySelectorAll('[data-add]').forEach(b => b.onclick = () => onAdd(b.dataset.add));
  container.querySelectorAll('[data-view]').forEach(b => b.onclick = () => onView(b.dataset.view));
  container.querySelectorAll('[data-fav]').forEach(b => b.onclick = (e) => { e.stopPropagation(); onFav(b.dataset.fav); });
}

export function renderProductModal(p, payments, zones) {
  document.getElementById('pmName').textContent = p.name;
  document.getElementById('pmImg').src = p.img;
  document.getElementById('pmCat').textContent = p.category || '';
  document.getElementById('pmDesc').textContent = p.desc || '';
  document.getElementById('pmMaterial').textContent = p.material ? `Material: ${p.material}` : '';
  document.getElementById('pmEntrega').textContent = p.entrega ? `🚚 Entrega estimada: ${p.entrega}` : '';
  document.getElementById('pmSold').textContent = p.sold ? `${p.sold} pessoas já compraram este produto` : '';
  document.getElementById('pmPrice').textContent = fmt(p.price);
  document.getElementById('pmPayments').innerHTML = payments.map(pay => `<span class="info-pill">${pay}</span>`).join('') || '<span style="font-size:0.8rem;color:rgba(18,48,46,0.5);">A definir</span>';
  document.getElementById('pmZones').innerHTML = zones.map(z => `<span class="info-pill">${z}</span>`).join('') || '<span style="font-size:0.8rem;color:rgba(18,48,46,0.5);">A definir</span>';

  const allImages = [p.img, ...(p.images || [])];
  const thumbsWrap = document.getElementById('pmThumbs');
  thumbsWrap.innerHTML = "";
  if (allImages.length > 1) {
    allImages.forEach((src, i) => {
      const t = document.createElement('img');
      t.src = src; t.className = 'thumb' + (i === 0 ? ' active' : '');
      t.onclick = () => {
        document.getElementById('pmImg').src = src;
        thumbsWrap.querySelectorAll('.thumb').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
      };
      thumbsWrap.appendChild(t);
    });
  }

  const vWrap = document.getElementById('pmVariants');
  vWrap.innerHTML = "";
  if (p.sizes && p.sizes.length) {
    const g = document.createElement('div');
    g.className = 'variant-group';
    g.innerHTML = `<label>Tamanho</label><select id="pmSizeSelect">${p.sizes.map(s => `<option value="${s}">${s}</option>`).join('')}</select>`;
    vWrap.appendChild(g);
  }
  if (p.colors && p.colors.length) {
    const g = document.createElement('div');
    g.className = 'variant-group';
    g.innerHTML = `<label>Cor</label><select id="pmColorSelect">${p.colors.map(c => `<option value="${c}">${c}</option>`).join('')}</select>`;
    vWrap.appendChild(g);
  }

  const reviews = p.reviews || [];
  const ratingWrap = document.getElementById('pmRatingSummary');
  if (reviews.length) {
    const avg = (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1);
    ratingWrap.innerHTML = `<span class="stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))}</span> ${avg} (${reviews.length} avaliações)`;
  } else {
    ratingWrap.innerHTML = `<span style="color:rgba(18,48,46,0.5);">Ainda sem avaliações</span>`;
  }

  renderReviews(p);
}

export function renderReviews(p) {
  const wrap = document.getElementById('pmReviews');
  const reviews = p.reviews || [];
  if (reviews.length === 0) { wrap.innerHTML = '<p style="color:rgba(18,48,46,0.5);font-size:0.85rem;">Seja o primeiro a avaliar este produto.</p>'; return; }
  wrap.innerHTML = reviews.map(r => `
    <div class="review-item">
      <div class="rh"><span>${r.name}</span><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></div>
      <div>${r.comment}</div>
      <div style="font-size:0.72rem;color:rgba(18,48,46,0.5);">${r.date}</div>
    </div>`).join('');
}

export function matchesSearch(p, term) {
  if (!term) return true;
  const hay = `${p.name} ${p.category || ''} ${p.desc || ''} ${p.material || ''}`.toLowerCase();
  return term.split(/\s+/).some(word => word.length > 1 && hay.includes(word)) || hay.includes(term);
}
