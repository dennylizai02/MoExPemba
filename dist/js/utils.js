export function fmt(n) {
  const value = Number(n) || 0;
  return new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 0 }).format(value) + " MT";
}

export function fmtShort(n) {
  const value = Number(n) || 0;
  return new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 0 }).format(value);
}

export function uid() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const escapeMap = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => escapeMap[c]);
}

let toastTimer = null;
export function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('error', 'success');
  if (type) t.classList.add(type);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function todayLabel() {
  return new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function withTimeout(promise, ms = 9000, message = 'Servidor indisponível') {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(message);
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);
  });
  guard.catch(() => {});
  return Promise.race([Promise.resolve(promise), guard]).finally(() => clearTimeout(timer));
}

export function isOfflineError(err) {
  if (!err) return false;
  if (err.code === 'TIMEOUT') return true;
  const msg = String(err.message || '');
  return /failed to fetch|network|load failed|fetch|timeout|conexão|ligação/i.test(msg);
}

export function isDbMissingError(err) {
  if (!err) return false;
  if (err.code === 'PGRST205' || err.code === '42P01') return true;
  const msg = String(err.message || '');
  return /could not find the table|does not exist|schema cache|relation .* does not exist/i.test(msg);
}

export function dbMissingMessage(catalogSource) {
  const base = 'A base de dados ainda não está configurada.';
  if (catalogSource === 'products') {
    return `${base} O catálogo vem da tabela products e as encomendas ficam guardadas neste dispositivo. Execute sql/setup_completo.sql no Supabase para activar tudo.`;
  }
  return `${base} Execute sql/setup_completo.sql no Supabase para activar a conta, o catálogo e as encomendas.`;
}

export function offlineMessage() {
  return 'Sem ligação ao servidor. Mostramos a cópia local dos dados — tente novamente mais tarde.';
}
