export function fmt(n) {
  return new Intl.NumberFormat('pt-MZ').format(n) + " MT";
}

export function uid() {
  return 'p' + Date.now() + Math.floor(Math.random() * 1000);
}

let toastTimer = null;
export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
