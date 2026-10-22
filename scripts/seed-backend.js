/*
  Semeadura do backend real (novo projeto Supabase).
  Usa a service_role (apenas no servidor/CI) para inserir o catálogo na tabela
  `products` e criar utilizadores de teste já confirmados.
  Uso: node scripts/seed-backend.js
*/
const fs = require('fs');
const path = require('path');

const env = {};
try {
  const raw = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  raw.split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { console.warn('.env.local não encontrado:', e.message); }

const URL = env.SUPABASE_URL || 'https://zhtiplewwerabqbkeahe.supabase.co';
const ANON = env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const IMG = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=700&q=80`;

const CATALOG = [
  {
    title: 'Capulana estampada', category: 'Roupa', price: 450, originalprice: 600, discount: 25,
    description: 'Capulana colorida em algodão leve e fresco, ideal para o calor de Pemba. Use na cabeça, nos ombros ou como pano de praia.',
    brand: 'Artesanato Pemba', rating: 4.8, reviews: 36, sold: '120', image: IMG('photo-1594633312681-425c7b97ccd1'),
    images: [IMG('photo-1594633312681-425c7b97ccd1'), IMG('photo-1584030373081-f37b7bb4fa8e')]
  },
  {
    title: 'Sandálias de couro curtido', category: 'Calçado', price: 850, originalprice: 1100, discount: 23,
    description: 'Sandálias artesanais em couro curtido, com sola resistente e tiras ajustáveis. Confortáveis para o dia a dia.',
    brand: 'Couro de Pemba', rating: 4.6, reviews: 54, sold: '210', image: IMG('photo-1543163521-1bf539c55dd2'),
    images: [IMG('photo-1543163521-1bf539c55dd2'), IMG('photo-1542291026-7eec264c27ff')]
  },
  {
    title: 'Colar de conchas da baía', category: 'Acessórios', price: 320, originalprice: 400, discount: 20,
    description: 'Colar feito à mão com conchas da baía de Pemba e fio encerado. Cada peça é única.',
    brand: 'Conchas de Pemba', rating: 5.0, reviews: 18, sold: '64', image: IMG('photo-1515562141207-7a88fb7ce338'),
    images: [IMG('photo-1515562141207-7a88fb7ce338')]
  },
  {
    title: 'Boné bordado à mão', category: 'Acessórios', price: 280, originalprice: 350, discount: 20,
    description: 'Boné leve, bordado à mão, protege do sol e combina com tudo.',
    brand: 'Bordado Pemba', rating: 4.4, reviews: 27, sold: '88', image: IMG('photo-1588850561407-ed78c282e89b'),
    images: [IMG('photo-1588850561407-ed78c282e89b')]
  },
  {
    title: 'Chapéu de palha entrançada', category: 'Acessórios', price: 380, originalprice: 500, discount: 24,
    description: 'Chapéu de palha entrançada à mão, com fita para ajustar. O companheiro dos dias de calor.',
    brand: 'Palha de Pemba', rating: 4.9, reviews: 41, sold: '145', image: IMG('photo-1529958030586-3aae4ca485ff'),
    images: [IMG('photo-1529958030586-3aae4ca485ff'), IMG('photo-1592085187054-8f8e1e4d4a0f')]
  },
  {
    title: 'Pano da costa em lona', category: 'Roupa', price: 520, originalprice: 650, discount: 20,
    description: 'Pano em lona e algodão resistente, ideal para a praia, para a carrinha ou como pano de mesa. Tecido grosso que dura anos.',
    brand: 'Tecidos de Pemba', rating: 4.5, reviews: 23, sold: '76', image: IMG('photo-1601924994987-69e26d50dc26'),
    images: [IMG('photo-1601924994987-69e26d50dc26')]
  },
  {
    title: 'Carteira compacta de couro', category: 'Acessórios', price: 260, originalprice: 330, discount: 21,
    description: 'Carteira compacta em couro com seis compartimentos e bolso para notas.',
    brand: 'Couro de Pemba', rating: 4.3, reviews: 31, sold: '160', image: IMG('photo-1627123424574-724758594e93'),
    images: [IMG('photo-1627123424574-724758594e93')]
  },
  {
    title: 'Brincos de palha trançada', category: 'Acessórios', price: 180, originalprice: 240, discount: 25,
    description: 'Brincos leves feitos com palha entrançada. Perfeitos para o verão.',
    brand: 'Palha de Pemba', rating: 4.7, reviews: 12, sold: '52', image: IMG('photo-1535632066927-ab7c9ab60908'),
    images: [IMG('photo-1535632066927-ab7c9ab60908')]
  }
];

const USERS = [
  { email: 'teste.admin@moex.mz', name: 'Administrador Teste', phone: '840000010', role: 'admin' },
  { email: 'teste.vendedor@moex.mz', name: 'Vendedor Teste', phone: '840000002', role: 'seller' },
  { email: 'teste.cliente@moex.mz', name: 'Cliente Teste', phone: '840000003', role: 'user' }
];
const PASSWORD = 'Teste2026!';

async function req(path, options = {}) {
  const res = await fetch(URL + path, {
    ...options,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

(async () => {
  if (!SERVICE) {
    console.error('SUPABASE_SERVICE_ROLE_KEY ausente em .env.local — nada a semear.');
    process.exit(1);
  }

  console.log('→ a limpar catálogo de demonstração');
  await req('/rest/v1/products?id=gt.0', { method: 'DELETE' });

  console.log('→ a inserir catálogo MoEx');
  const payload = CATALOG.map(p => ({
    title: p.title, description: p.description, price: p.price, originalprice: p.originalprice,
    currency: 'MZN', discount: p.discount, rating: p.rating, reviews: p.reviews, sold: p.sold,
    image: p.image, images: p.images, brand: p.brand, category: p.category
  }));
  const ins = await req('/rest/v1/products', { method: 'POST', body: JSON.stringify(payload) });
  console.log('  inseridos:', ins.status, Array.isArray(ins.body) ? ins.body.length : ins.body);

  console.log('→ a criar utilizadores de teste');
  for (const u of USERS) {
    const existing = await req(`/auth/v1/admin/users?per_page=200`);
    const found = (existing.body?.users || []).find(x => x.email === u.email);
    if (found) {
      await req(`/auth/v1/admin/users/${found.id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: PASSWORD, email_confirm: true, user_metadata: { name: u.name, phone: u.phone }, app_metadata: { role: u.role } })
      });
      console.log(`  ${u.email}: actualizado (${u.role})`);
      continue;
    }
    const created = await req('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: u.email, password: PASSWORD, email_confirm: true,
        user_metadata: { name: u.name, phone: u.phone }, app_metadata: { role: u.role }
      })
    });
    console.log(`  ${u.email}: ${created.status} (${u.role})`);
  }

  console.log('→ a sincronizar profiles de teste');
  const allUsers = (await req('/auth/v1/admin/users?per_page=200')).body?.users || [];
  const rows = USERS.map(u => {
    const found = allUsers.find(x => x.email === u.email);
    return found && {
      id: found.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      role: u.role
    };
  }).filter(Boolean);
  if (rows.length) {
    const up = await req('/rest/v1/profiles?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(rows)
    });
    console.log('  profiles:', up.status, Array.isArray(up.body) ? up.body.length : up.body);
  }

  const check = await req('/rest/v1/products?select=id,title,price&order=id');
  console.log(`\nCatálogo final: ${Array.isArray(check.body) ? check.body.length : 0} artigos`);
  if (Array.isArray(check.body)) check.body.forEach(p => console.log(`  #${p.id} ${p.title} — ${p.price} MZN`));
})();
