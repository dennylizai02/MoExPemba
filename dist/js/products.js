import { fmt, esc } from './utils.js';

export function ratingOf(p) {
  const reviews = p.reviews || [];
  if (reviews.length) {
    const avg = reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length;
    return { avg, count: reviews.length, stars: Math.round(avg) };
  }
  if (typeof p.rating === 'number' && p.rating > 0) {
    return { avg: p.rating, count: p.reviewsCount || 0, stars: Math.round(p.rating) };
  }
  return null;
}

function starsHtml(stars) {
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

export function renderProductCards(list, container, onAdd, onView, onFav, favorites) {
  container.innerHTML = "";
  list.forEach(p => {
    const isFav = favorites.includes(p.id);
    const rating = ratingOf(p);
    const card = document.createElement('article');
    card.className = 'tag-card';
    card.dataset.id = p.id;
    card.tabIndex = 0;
    card.setAttribute('aria-label', 'Ver detalhes de ' + p.name);
    card.innerHTML = `
      <div class="tag-media">
        <img class="tag-img" src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/fallback/400/500'">
        ${p.badge ? `<div class="tag-badge">${esc(p.badge)}</div>` : ''}
        <button class="fav-btn ${isFav ? 'active' : ''}" data-fav="${p.id}" aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">${isFav ? '♥' : '♡'}</button>
      </div>
      <div class="tag-body">
        <div class="tag-cat">${esc(p.category || 'Geral')}</div>
        <div class="tag-name">${esc(p.name)}</div>
        ${rating ? `<div class="tag-rating"><span class="stars">${starsHtml(rating.stars)}</span> ${rating.avg.toFixed(1)} (${rating.count})</div>` : ''}
        <div class="tag-price">${fmt(p.price)}</div>
        ${p.entrega ? `<div class="tag-delivery">🚚 ${esc(p.entrega)}</div>` : ''}
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
  container.querySelectorAll('.tag-card').forEach(card => {
    card.onclick = (e) => { if (e.target.closest('button')) return; onView(card.dataset.id); };
    card.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('button')) return;
      e.preventDefault();
      onView(card.dataset.id);
    };
  });
}

export function renderProductModal(p, payments, zones, handlers = {}) {
  document.getElementById('pmName').textContent = p.name;
  const img = document.getElementById('pmImg');
  img.src = p.img;
  img.alt = p.name;
  document.getElementById('pmTitle').textContent = p.name;
  document.getElementById('pmCat').textContent = p.category || '';
  document.getElementById('pmDesc').textContent = p.desc || 'Descrição breve deste artigo.';
  document.getElementById('pmMaterial').innerHTML = p.material
    ? `<span class="pmi" aria-hidden="true">◈</span><span>Material: ${esc(p.material)}</span>` : '';
  const entregaTxt = p.entrega ? `Entrega estimada: ${esc(p.entrega)}` : 'Entrega em Pemba, combinada com o vendedor';
  document.getElementById('pmEntrega').innerHTML = `<span class="pmi" aria-hidden="true">🚚</span><span>${entregaTxt}</span>`;
  document.getElementById('pmSold').innerHTML = p.sold
    ? `<span class="pmi" aria-hidden="true">★</span><span>${p.sold} pessoas já compraram este produto</span>` : '';
  document.getElementById('pmPrice').textContent = fmt(p.price);
  document.getElementById('pmPayments').innerHTML = payments.map(pay => `<span class="info-pill">${esc(pay)}</span>`).join('')
    || '<span style="font-size:0.8rem;color:var(--ink-faint);">A definir</span>';
  document.getElementById('pmZones').innerHTML = zones.map(z => `<span class="info-pill">${esc(z)}</span>`).join('')
    || '<span style="font-size:0.8rem;color:var(--ink-faint);">A definir</span>';

  const allImages = [p.img, ...(p.images || [])].filter(Boolean);
  const thumbsWrap = document.getElementById('pmThumbs');
  thumbsWrap.innerHTML = "";
  if (allImages.length > 1) {
    allImages.forEach((src, i) => {
      const t = document.createElement('img');
      t.src = src; t.alt = `${p.name} — foto ${i + 1}`;
      t.className = 'thumb' + (i === 0 ? ' active' : '');
      t.onclick = () => {
        img.src = src;
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
    g.innerHTML = `<label>Tamanho</label><div class="variant-pills">${p.sizes.map((s, i) =>
      `<button type="button" class="variant-pill${i === 0 ? ' active' : ''}" data-kind="size" data-value="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
    vWrap.appendChild(g);
  }
  if (p.colors && p.colors.length) {
    const g = document.createElement('div');
    g.className = 'variant-group';
    g.innerHTML = `<label>Cor</label><div class="variant-pills">${p.colors.map((c, i) =>
      `<button type="button" class="variant-pill${i === 0 ? ' active' : ''}" data-kind="color" data-value="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    vWrap.appendChild(g);
  }
  vWrap.querySelectorAll('.variant-pill').forEach(btn => {
    btn.onclick = () => {
      btn.parentElement.querySelectorAll('.variant-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const value = btn.dataset.value;
      if (btn.dataset.kind === 'size' && handlers.onSize) handlers.onSize(value);
      if (btn.dataset.kind === 'color' && handlers.onColor) handlers.onColor(value);
    };
  });

  const rating = ratingOf(p);
  const ratingWrap = document.getElementById('pmRatingSummary');
  if (rating) {
    const label = rating.count === 1 ? 'avaliação' : 'avaliações';
    ratingWrap.innerHTML = `<span class="stars">${starsHtml(rating.stars)}</span> ${rating.avg.toFixed(1)} · ${rating.count} ${label}`;
  } else {
    ratingWrap.innerHTML = '<span style="color:var(--ink-faint);">Ainda sem avaliações</span>';
  }

  renderReviews(p);
}

export function renderReviews(p) {
  const wrap = document.getElementById('pmReviews');
  const reviews = p.reviews || [];
  if (reviews.length === 0) {
    wrap.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;">Seja o primeiro a avaliar este produto.</p>';
    return;
  }
  wrap.innerHTML = reviews.map(r => `
    <div class="review-item">
      <div class="rh"><span>${esc(r.name)}</span><span class="stars">${starsHtml(r.rating || 0)}</span></div>
      <div>${esc(r.comment)}</div>
      <div style="font-size:.72rem;color:var(--ink-faint);">${esc(r.date || '')}</div>
    </div>`).join('');
}

export function matchesSearch(p, term) {
  if (!term) return true;
  const hay = `${p.name} ${p.category || ''} ${p.desc || ''} ${p.material || ''} ${p.badge || ''}`.toLowerCase();
  return term.split(/\s+/).every(word => word.length >= 1 && hay.includes(word));
}
