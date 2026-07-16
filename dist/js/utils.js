export function fmt(n) {
  return new Intl.NumberFormat('pt-MZ').format(n) + " MT";
}

export function uid() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const escapeMap = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
export function esc(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => escapeMap[c]);
}

let toastTimer = null;
export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
