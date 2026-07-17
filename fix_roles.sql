-- Execute este script no Supabase Dashboard > SQL Editor
-- Corrige permissões e RLS para TODAS as tabelas da app

-- =============================================
-- 1. GRANT permissions
-- =============================================
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_data TO authenticated;

-- =============================================
-- 2. Habilitar RLS em todas as tabelas
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. Policies: profiles
-- =============================================
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =============================================
-- 4. Policies: carts
-- =============================================
DROP POLICY IF EXISTS "Users can manage own cart" ON public.carts;
CREATE POLICY "Users can manage own cart"
  ON public.carts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 5. Policies: orders
-- =============================================
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
CREATE POLICY "Users can read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
CREATE POLICY "Users can update own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- 6. Policies: app_data (admin only via service_role)
-- =============================================
DROP POLICY IF EXISTS "Authenticated can read app_data" ON public.app_data;
CREATE POLICY "Authenticated can read app_data"
  ON public.app_data FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can upsert app_data" ON public.app_data;
CREATE POLICY "Authenticated can upsert app_data"
  ON public.app_data FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update app_data" ON public.app_data;
CREATE POLICY "Authenticated can update app_data"
  ON public.app_data FOR UPDATE
  USING (true);

-- =============================================
-- 7. Definir roles dos utilizadores
-- =============================================
UPDATE profiles SET role = 'admin' WHERE email = 'lizaivalden1@outlook.com';
UPDATE profiles SET role = 'seller' WHERE email = 'miltoncesarlizai9@gmail.com';

-- Verificar resultado
SELECT id, name, email, role FROM profiles ORDER BY role, name;
