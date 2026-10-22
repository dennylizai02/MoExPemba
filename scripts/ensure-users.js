const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const env = {};
for (const f of ['.env.local', '.env']) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const URL = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

if (!URL || !KEY) {
  console.error('Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local');
  process.exit(1);
}

const USERS = [
  { email: 'lizaivalden1@outlook.com', password: 'Isly2017', role: 'admin', name: 'Loja Admin', phone: '840000000' },
  { email: 'miltoncesarlizai9@gmail.com', password: 'Isly2017', role: 'seller', name: 'Ana Vendedora', phone: '840000001' },
  { email: 'teste.admin@moex.mz', password: 'Teste2026!', role: 'admin', name: 'Administrador Teste', phone: '840000010' },
  { email: 'teste.vendedor@moex.mz', password: 'Teste2026!', role: 'seller', name: 'Vendedor Teste', phone: '840000002' },
  { email: 'teste.cliente@moex.mz', password: 'Teste2026!', role: 'user', name: 'Cliente Teste', phone: '840000003' }
];

const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function listUsers() {
  const r = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: H });
  if (!r.ok) throw new Error('list users: ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const j = await r.json();
  return j.users || j;
}

async function main() {
  const existing = await listUsers();
  const byEmail = new Map(existing.map(u => [(u.email || '').toLowerCase(), u]));

  for (const u of USERS) {
    const body = {
      email: u.email,
      password: u.password,
      email_confirm: true,
      app_metadata: { role: u.role },
      user_metadata: { name: u.name, phone: u.phone }
    };
    const found = byEmail.get(u.email.toLowerCase());
    let res;
    if (found) {
      res = await fetch(`${URL}/auth/v1/admin/users/${found.id}`, { method: 'PUT', headers: H, body: JSON.stringify(body) });
    } else {
      res = await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    }
    if (!res.ok) {
      console.log(`FALHOU ${u.email}: ${res.status} ${(await res.text()).slice(0, 160)}`);
      continue;
    }
    const data = await res.json();
    console.log(`${found ? 'atualizado' : 'criado'}: ${u.email}  (${u.role}, id ${data.id})`);
  }

  // garante o profile correspondente (se a tabela já existir)
  const rows = [];
  const all = await listUsers();
  for (const u of USERS) {
    const found = all.find(x => (x.email || '').toLowerCase() === u.email.toLowerCase());
    if (!found) continue;
    rows.push({
      id: found.id,
      name: (found.user_metadata && found.user_metadata.name) || u.name,
      phone: (found.user_metadata && found.user_metadata.phone) || u.phone,
      email: u.email,
      role: (found.app_metadata && found.app_metadata.role) || u.role
    });
  }
  if (rows.length) {
    const r = await fetch(`${URL}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(rows)
    });
    if (r.ok) console.log('profiles sincronizados:', rows.length);
    else {
      const txt = (await r.text()).slice(0, 160);
      console.log(/PGRST205|does not exist|Could not find the table/i.test(txt)
        ? 'profiles: tabela ainda não existe (correr o setup_completo.sql primeiro)'
        : 'profiles: ' + r.status + ' ' + txt);
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
