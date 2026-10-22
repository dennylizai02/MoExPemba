import { uid, isDbMissingError } from './utils.js';
import { storage, orderStorage } from './storage.js';
import { supabase } from './config.js';

export function fallbackData() {
  return {
    products: getDefaultProducts(),
    orders: [],
    customRequests: [],
    zones: ["Cariaco", "Alto Gingone", "Cimento"],
    payments: ["M-Pesa", "e-Mola", "BIM"],
    suppliers: []
  };
}

function titleCase(str) {
  return String(str || '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function parseSold(value) {
  if (value == null) return 0;
  const str = String(value).trim();
  if (/k$/i.test(str)) return Math.round(parseFloat(str) * 1000);
  const num = parseInt(str, 10);
  return Number.isFinite(num) ? num : 0;
}

export function mapTableProduct(r) {
  const images = Array.isArray(r.images) ? r.images.filter(Boolean) : [];
  return {
    id: 'db' + r.id,
    name: r.title || r.name || 'Artigo',
    price: Number(r.price) || 0,
    category: titleCase(r.category || 'Geral'),
    img: r.image || images[0] || 'https://picsum.photos/seed/fallback/400/500',
    images,
    desc: r.description || '',
    material: r.brand || '',
    entrega: '',
    badge: r.discount ? `-${Math.round(r.discount)}%` : '',
    sold: parseSold(r.sold),
    sizes: [],
    colors: [],
    reviews: [],
    rating: Number(r.rating) || 0,
    reviewsCount: Number(r.reviews) || 0,
    created_by: r.created_by || null
  };
}

async function loadProductsFromTable() {
  const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true }).limit(60);
  if (error) throw error;
  return (data || []).map(mapTableProduct);
}

export async function loadData() {
  const defaults = {
    products: getDefaultProducts(),
    orders: [],
    customRequests: [],
    zones: ["Cariaco", "Alto Gingone", "Cimento"],
    payments: ["M-Pesa", "e-Mola", "BIM"],
    suppliers: []
  };

  const keys = [
    { key: 'products', admin: true, stateKey: 'products' },
    { key: 'requests', admin: true, stateKey: 'customRequests' },
    { key: 'zones', admin: true, stateKey: 'zones' },
    { key: 'payments', admin: true, stateKey: 'payments' },
    { key: 'suppliers', admin: true, stateKey: 'suppliers' }
  ];

  let dbMissing = false;
  const results = await Promise.all(
    keys.map(k => storage.get(k.key, k.admin).catch((e) => {
      if (isDbMissingError(e)) dbMissing = true;
      return null;
    }))
  );

  const state = {};
  keys.forEach((k, i) => {
    const raw = results[i];
    state[k.stateKey] = raw ? JSON.parse(raw.value) : defaults[k.stateKey];
  });

  state.catalogSource = results[0] ? 'app_data' : 'local';
  if (!results[0]) {
    try {
      const fromTable = await loadProductsFromTable();
      if (fromTable.length) {
        state.products = fromTable;
        state.catalogSource = 'products';
      }
    } catch (e) {
      if (!isDbMissingError(e)) console.warn('Catálogo: leitura da tabela products falhou', e);
    }
  }

  try {
    state.orders = await orderStorage.loadAll();
  } catch (e) {
    if (isDbMissingError(e)) dbMissing = true;
    state.orders = defaults.orders;
  }

  try {
    if (!results[0] && state.catalogSource !== 'products') {
      await storage.set('products', JSON.stringify(state.products), true);
    }
    if (!results[2]) await storage.set('zones', JSON.stringify(state.zones), true);
    if (!results[3]) await storage.set('payments', JSON.stringify(state.payments), true);
  } catch (e) {
    console.warn('Could not persist defaults (non-admin or RLS):', e);
  }

  state.dbMissing = dbMissing;
  return state;
}

export async function loadFavorites(userId) {
  if (!userId) return [];
  try {
    const key = 'favorites_' + userId;
    const result = await storage.get(key, false);
    return result ? JSON.parse(result.value) : [];
  } catch {
    return [];
  }
}

export async function saveSellerRequests(requests) {
  await storage.set('seller_requests', JSON.stringify(requests), false);
}

export async function loadSellerRequests() {
  try {
    const result = await storage.get('seller_requests', false);
    return result ? JSON.parse(result.value) : [];
  } catch {
    return [];
  }
}

export async function saveProducts(products) {
  await storage.set('products', JSON.stringify(products), true);
}
export async function loadUserOrders(userId) {
  return await orderStorage.loadForUser(userId);
}
export async function createOrder(order) {
  return await orderStorage.create(order);
}
export async function updateOrderStatus(orderId, status) {
  await orderStorage.updateStatus(orderId, status);
}
export async function saveRequests(customRequests) {
  await storage.set('requests', JSON.stringify(customRequests), true);
}
export async function saveFavorites(userId, favorites) {
  if (!userId) return;
  await storage.set('favorites_' + userId, JSON.stringify(favorites), false);
}
export async function saveZones(zones) {
  await storage.set('zones', JSON.stringify(zones), true);
}
export async function savePayments(payments) {
  await storage.set('payments', JSON.stringify(payments), true);
}
export async function saveSuppliers(suppliers) {
  await storage.set('suppliers', JSON.stringify(suppliers), true);
}

export function getDefaultProducts() {
  return [
    { id: uid(), name: "Capulana estampada", price: 450, category: "Roupa", img: "https://picsum.photos/seed/capulana/400/500",
      images: ["https://picsum.photos/seed/capulana2/400/500", "https://picsum.photos/seed/capulana3/400/500"],
      desc: "Capulana colorida, tecido leve e fresco, ideal para o calor de Pemba. Pode usar na cabeça, nos ombros ou como pano de praia.",
      material: "Algodão", entrega: "3 a 4 dias", badge: "Novo", sold: 12,
      sizes: ["Único"], colors: ["Azul", "Vermelho", "Verde"],
      reviews: [{ name: "Amélia", rating: 5, comment: "Muito bonita e chegou rápido.", date: "01/07/2026" }] },
    { id: uid(), name: "Sandálias de couro", price: 850, category: "Calçado", img: "https://picsum.photos/seed/sandalias/400/500",
      images: ["https://picsum.photos/seed/sandalias2/400/500"],
      desc: "Sandálias artesanais em couro curtido, com sola resistente e tiras ajustáveis. Confortáveis para o dia a dia.",
      material: "Couro natural", entrega: "4 a 5 dias", badge: "Destaque", sold: 27,
      sizes: ["38", "39", "40", "41", "42"], colors: ["Castanho", "Preto"],
      reviews: [{ name: "João", rating: 4, comment: "Boa qualidade, um pouco justo no tamanho.", date: "28/06/2026" }] },
    { id: uid(), name: "Colar de conchas", price: 320, category: "Acessórios", img: "https://picsum.photos/seed/colar/400/500",
      images: [],
      desc: "Colar feito à mão com conchas da baía de Pemba e fio encerado. Cada peça é única.",
      material: "Conchas e fio encerado", entrega: "3 dias", badge: "Últimas peças", sold: 6,
      sizes: [], colors: [], reviews: [] },
    { id: uid(), name: "Boné bordado", price: 280, category: "Acessórios", img: "https://picsum.photos/seed/bone/400/500",
      images: [],
      desc: "Boné leve, bordado à mão, protege do sol e combina com tudo.",
      material: "Algodão", entrega: "3 a 5 dias", badge: "", sold: 3,
      sizes: ["Único"], colors: ["Bege", "Preto"], reviews: [] },
    { id: uid(), name: "Chapéu de palha", price: 380, category: "Acessórios", img: "https://picsum.photos/seed/chapeu/400/500",
      images: ["https://picsum.photos/seed/chapeu2/400/500"],
      desc: "Chapéu de palha entrançada à mão, com fita para ajustar. O companheiro dos dias de calor.",
      material: "Palha e fita de algodão", entrega: "2 a 4 dias", badge: "", sold: 15,
      sizes: ["M"], colors: ["Natural"], reviews: [{ name: "Neide", rating: 5, comment: "Muito bonito e bem feito.", date: "12/07/2026" }] },
    { id: uid(), name: "Pano da costa", price: 520, category: "Roupa", img: "https://picsum.photos/seed/pano/400/500",
      images: [],
      desc: "Pano de lona e algodão resistente, ideal para a praia, para a carrinha ou como pano de mesa. Tecido grosso que dura anos.",
      material: "Algodão e linho", entrega: "3 a 5 dias", badge: "", sold: 9,
      sizes: ["150x200", "180x250"], colors: ["Azul e branco"], reviews: [] },
    { id: uid(), name: "Carteira de couro", price: 260, category: "Acessórios", img: "https://picsum.photos/seed/carteira/400/500",
      images: [],
      desc: "Carteira compacta em couro com seis compartimentos e bolso para notas.",
      material: "Couro", entrega: "2 a 3 dias", badge: "", sold: 21,
      sizes: [], colors: ["Castanho", "Preto"], reviews: [] },
    { id: uid(), name: "Brincos de palha", price: 180, category: "Acessórios", img: "https://picsum.photos/seed/brincos/400/500",
      images: [],
      desc: "Brincos leves feitos com palha entrançada. Perfeitos para o verão.",
      material: "Palha", entrega: "2 dias", badge: "", sold: 4,
      sizes: [], colors: ["Natural"], reviews: [] }
  ];
}
