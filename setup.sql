-- =============================================================
-- MoEx Pemba — Supabase Auth + profiles
-- Execute este script no Supabase Dashboard > SQL Editor
-- =============================================================

-- 1. Criar tabela profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT UNIQUE NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Permitir lookup por phone (para login com telefone)
CREATE POLICY "Allow phone lookup for login"
  ON profiles FOR SELECT
  USING (true);

-- 3. Trigger — criar profile automaticamente ao registar
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 4. Criar admin / vendedor
-- Primeiro: crie a conta normalmente pela app
-- Depois: execute este UPDATE para tornar o utilizador admin ou vendedor
-- UPDATE profiles SET role = 'admin' WHERE phone = '840000000';
-- UPDATE profiles SET role = 'seller' WHERE phone = '840000000';

-- =============================================================
-- 5. Tabela app_data — armazenamento chave-valor da aplicação
-- =============================================================

CREATE TABLE IF NOT EXISTS app_data (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- Dados públicos (is_admin=false): qualquer utilizador autenticado pode ler
CREATE POLICY "Authenticated users can read public data"
  ON app_data FOR SELECT
  TO authenticated
  USING (is_admin = false);

-- Dados de admin (is_admin=true): apenas admins e vendedores podem ler
CREATE POLICY "Admins and sellers can read admin data"
  ON app_data FOR SELECT
  TO authenticated
  USING (
    is_admin = true
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'seller'))
  );

-- Dados públicos: qualquer utilizador autenticado pode escrever (ex: favoritos)
CREATE POLICY "Authenticated users can upsert public data"
  ON app_data FOR INSERT
  TO authenticated
  WITH CHECK (is_admin = false);

CREATE POLICY "Authenticated users can update public data"
  ON app_data FOR UPDATE
  TO authenticated
  USING (is_admin = false);

-- Dados de admin: apenas admins e vendedores podem escrever
CREATE POLICY "Admins and sellers can upsert admin data"
  ON app_data FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin = true
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'seller'))
  );

CREATE POLICY "Admins and sellers can update admin data"
  ON app_data FOR UPDATE
  TO authenticated
  USING (
    is_admin = true
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'seller'))
  );

-- =============================================================
-- 6. Tabela orders — encomendas dedicadas
-- =============================================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  addr TEXT NOT NULL DEFAULT '',
  note TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Utilizadores podem ver as suas próprias encomendas
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Utilizadores autenticados podem criar encomendas
CREATE POLICY "Authenticated users can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins e vendedores podem ver todas as encomendas
CREATE POLICY "Admins and sellers can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'seller'))
  );

-- Admins e vendedores podem atualizar estado das encomendas
CREATE POLICY "Admins and sellers can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'seller'))
  );

-- Admins podem eliminar encomendas
CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================================
-- 7. Tabela carts — carrinho persistente por utilizador
-- =============================================================

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  size TEXT,
  color TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, size, color)
);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cart"
  ON carts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart"
  ON carts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart"
  ON carts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart"
  ON carts FOR DELETE
  USING (auth.uid() = user_id);
