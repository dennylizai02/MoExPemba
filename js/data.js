import { uid } from './utils.js';
import { storage } from './storage.js';

export async function loadData() {
  const state = { products: [], orders: [], customRequests: [], favorites: [], zones: [], payments: [] };

  try {
    const p = await storage.get('products', true);
    state.products = p ? JSON.parse(p.value) : getDefaultProducts();
  } catch (e) { state.products = getDefaultProducts(); await storage.set('products', JSON.stringify(state.products), true); }

  try {
    const o = await storage.get('orders', true);
    state.orders = o ? JSON.parse(o.value) : [];
  } catch (e) { state.orders = []; }

  try {
    const r = await storage.get('requests', true);
    state.customRequests = r ? JSON.parse(r.value) : [];
  } catch (e) { state.customRequests = []; }

  try {
    const f = await storage.get('favorites', false);
    state.favorites = f ? JSON.parse(f.value) : [];
  } catch (e) { state.favorites = []; }

  try {
    const z = await storage.get('zones', true);
    state.zones = z ? JSON.parse(z.value) : ["Cariaco", "Alto Gingone", "Cimento"];
    if (!z) await storage.set('zones', JSON.stringify(state.zones), true);
  } catch (e) { state.zones = ["Cariaco", "Alto Gingone", "Cimento"]; }

  try {
    const pay = await storage.get('payments', true);
    state.payments = pay ? JSON.parse(pay.value) : ["M-Pesa", "e-Mola", "BIM"];
    if (!pay) await storage.set('payments', JSON.stringify(state.payments), true);
  } catch (e) { state.payments = ["M-Pesa", "e-Mola", "BIM"]; }

  return state;
}

export async function saveProducts(products) {
  await storage.set('products', JSON.stringify(products), true);
}
export async function saveOrders(orders) {
  await storage.set('orders', JSON.stringify(orders), true);
}
export async function saveRequests(customRequests) {
  await storage.set('requests', JSON.stringify(customRequests), true);
}
export async function saveFavorites(favorites) {
  await storage.set('favorites', JSON.stringify(favorites), false);
}
export async function saveZones(zones) {
  await storage.set('zones', JSON.stringify(zones), true);
}
export async function savePayments(payments) {
  await storage.set('payments', JSON.stringify(payments), true);
}

function getDefaultProducts() {
  return [
    { id: uid(), name: "Capulana estampada", price: 450, category: "Roupa", img: "https://picsum.photos/seed/capulana/400/400",
      images: ["https://picsum.photos/seed/capulana2/400/400", "https://picsum.photos/seed/capulana3/400/400"],
      desc: "Capulana colorida, tecido leve, ideal para o calor de Pemba.", material: "Algodão", entrega: "3 a 4 dias", badge: "Novo", sold: 12,
      sizes: ["Único"], colors: ["Azul", "Vermelho", "Verde"],
      reviews: [{ name: "Amélia", rating: 5, comment: "Muito bonita e chegou rápido.", date: "01/07/2026" }] },
    { id: uid(), name: "Sandálias de couro", price: 850, category: "Calçado", img: "https://picsum.photos/seed/sandalias/400/400",
      images: ["https://picsum.photos/seed/sandalias2/400/400"],
      desc: "Sandálias artesanais em couro, confortáveis para o dia a dia.", material: "Couro natural", entrega: "4 a 5 dias", badge: "", sold: 27,
      sizes: ["38", "39", "40", "41", "42"], colors: ["Castanho", "Preto"],
      reviews: [{ name: "João", rating: 4, comment: "Boa qualidade, um pouco justo no tamanho.", date: "28/06/2026" }] },
    { id: uid(), name: "Colar de conchas", price: 320, category: "Acessórios", img: "https://picsum.photos/seed/colar/400/400",
      images: [],
      desc: "Colar feito à mão com conchas da baía de Pemba.", material: "Conchas e fio encerado", entrega: "3 dias", badge: "Últimas peças", sold: 6,
      sizes: [], colors: [], reviews: [] },
    { id: uid(), name: "Boné bordado", price: 280, category: "Acessórios", img: "https://picsum.photos/seed/bone/400/400",
      images: [],
      desc: "Boné leve, bordado, protege do sol.", material: "Algodão", entrega: "3 a 5 dias", badge: "", sold: 3,
      sizes: ["Único"], colors: ["Bege", "Preto"], reviews: [] }
  ];
}
