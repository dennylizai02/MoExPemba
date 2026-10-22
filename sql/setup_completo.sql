-- =============================================================
-- MoEx Pemba — Configuração completa (projeto novo)
-- Supabase Dashboard > SQL Editor > colar > Run
-- Cria: tabelas, RLS, políticas, storage, utilizadores de teste
-- e o catálogo inicial. É seguro correr várias vezes (idempotente).
-- =============================================================

-- =============================================
-- 0. Extensões
-- =============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- 1. profiles
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT UNIQUE NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Lookup de telefone (login por telemóvel)
CREATE OR REPLACE FUNCTION public.lookup_phone_email(p_phone TEXT)
RETURNS TEXT AS $$
  SELECT email FROM public.profiles WHERE phone = p_phone LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Trigger: cria o profile quando o utilizador se regista.
-- O tipo de conta escolhido no registo vem em raw_user_meta_data.role.
-- Só se aceitam 'user' e 'seller' — 'admin' nunca pode ser auto-atribuído.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.email, ''),
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'seller' THEN 'seller' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 2. app_data (chave/valor: catálogo, zonas, pagamentos…)
-- =============================================
CREATE TABLE IF NOT EXISTS public.app_data (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. orders
-- =============================================
CREATE TABLE IF NOT EXISTS public.orders (
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

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. carts
-- =============================================
CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  size TEXT,
  color TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, size, color)
);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. Políticas de profiles
-- =============================================
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Sellers can read all profiles" ON public.profiles;
CREATE POLICY "Sellers can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.get_user_role() = 'seller');

-- Admin pode promover/despromover qualquer utilizador (gestão de clientes)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- =============================================
-- 6. Políticas de app_data
-- =============================================
DROP POLICY IF EXISTS "Authenticated can read app_data" ON public.app_data;
CREATE POLICY "Authenticated can read app_data" ON public.app_data
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert app_data" ON public.app_data;
CREATE POLICY "Authenticated can insert app_data" ON public.app_data
  FOR INSERT TO authenticated
  WITH CHECK (is_admin = false OR public.get_user_role() IN ('admin', 'seller'));

DROP POLICY IF EXISTS "Authenticated can update app_data" ON public.app_data;
CREATE POLICY "Authenticated can update app_data" ON public.app_data
  FOR UPDATE TO authenticated
  USING (is_admin = false OR public.get_user_role() IN ('admin', 'seller'))
  WITH CHECK (is_admin = false OR public.get_user_role() IN ('admin', 'seller'));

-- =============================================
-- 7. Políticas de orders
-- =============================================
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
CREATE POLICY "Users can read own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
CREATE POLICY "Users can create own orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
CREATE POLICY "Users can update own orders" ON public.orders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Sellers can read all orders" ON public.orders;
CREATE POLICY "Sellers can read all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.get_user_role() IN ('admin', 'seller'));

DROP POLICY IF EXISTS "Sellers can update all orders" ON public.orders;
CREATE POLICY "Sellers can update all orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.get_user_role() IN ('admin', 'seller'));

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE TO authenticated USING (public.get_user_role() = 'admin');

-- =============================================
-- 8. Políticas de carts
-- =============================================
DROP POLICY IF EXISTS "Users can manage own cart" ON public.carts;
CREATE POLICY "Users can manage own cart" ON public.carts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 9. Permissões
-- =============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_data TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =============================================
-- 10. Storage — bucket de imagens dos produtos
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Users upload own product images" ON storage.objects;
CREATE POLICY "Users upload own product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users manage own product images" ON storage.objects;
CREATE POLICY "Users manage own product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own product images" ON storage.objects;
CREATE POLICY "Users delete own product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================
-- 11. Utilizadores de teste (para os testes E2E)
--     admin   : lizaivalden1@outlook.com  / Isly2017
--     vendedor: miltoncesarlizai9@gmail.com / Isly2017
-- =============================================
-- Nota: auth.users.id não tem default neste projeto, tem de ser passado
-- explicitamente. auth.identities.id é TEXT em projetos novos e UUID em
-- antigos, por isso o INSERT é feito com format(%L) para o literal ser
-- convertido para o tipo real da coluna.
DO $$
DECLARE
  u_admin UUID;
  u_seller UUID;
BEGIN
  SELECT id INTO u_admin FROM auth.users WHERE email = 'lizaivalden1@outlook.com';
  IF u_admin IS NULL THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'lizaivalden1@outlook.com', crypt('Isly2017', gen_salt('bf')), now(),
            '{"role":"admin"}', '{"name":"Loja Admin","phone":"840000000"}', 'authenticated', 'authenticated', now(), now())
    RETURNING id INTO u_admin;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = u_admin AND provider = 'email') THEN
    EXECUTE format(
      'INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, now(), now(), now())',
      gen_random_uuid()::text, u_admin::text, u_admin::text,
      jsonb_build_object('sub', u_admin::text, 'email', 'lizaivalden1@outlook.com', 'email_verified', true, 'phone_verified', false)::text,
      'email');
  END IF;

  SELECT id INTO u_seller FROM auth.users WHERE email = 'miltoncesarlizai9@gmail.com';
  IF u_seller IS NULL THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'miltoncesarlizai9@gmail.com', crypt('Isly2017', gen_salt('bf')), now(),
            '{"role":"seller"}', '{"name":"Ana Vendedora","phone":"840000001"}', 'authenticated', 'authenticated', now(), now())
    RETURNING id INTO u_seller;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = u_seller AND provider = 'email') THEN
    EXECUTE format(
      'INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, now(), now(), now())',
      gen_random_uuid()::text, u_seller::text, u_seller::text,
      jsonb_build_object('sub', u_seller::text, 'email', 'miltoncesarlizai9@gmail.com', 'email_verified', true, 'phone_verified', false)::text,
      'email');
  END IF;
END $$;

-- Perfis correspondentes (o trigger trata de novos registos)
INSERT INTO public.profiles (id, name, phone, email, role)
SELECT u.id, u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'phone', u.email,
       COALESCE(u.raw_app_meta_data->>'role', 'user')
FROM auth.users u
WHERE u.email IN ('lizaivalden1@outlook.com', 'miltoncesarlizai9@gmail.com')
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role, name = EXCLUDED.name;

UPDATE public.profiles SET role = 'admin'   WHERE email = 'lizaivalden1@outlook.com';
UPDATE public.profiles SET role = 'seller'  WHERE email = 'miltoncesarlizai9@gmail.com';

-- Contas de teste dos E2E/auditorias (idempotente, telefones distintos)
DO $$
DECLARE
  u RECORD;
  uid UUID;
BEGIN
  FOR u IN SELECT * FROM (VALUES
      ('teste.admin@moex.mz',    'Teste2026!', 'Administrador Teste', '840000010', 'admin'),
      ('teste.vendedor@moex.mz', 'Teste2026!', 'Vendedor Teste',      '840000002', 'seller'),
      ('teste.cliente@moex.mz',  'Teste2026!', 'Cliente Teste',       '840000003', 'user')
    ) AS t(email, pass, name, phone, role)
  LOOP
    SELECT id INTO uid FROM auth.users WHERE email = u.email;
    IF uid IS NULL THEN
      INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', u.email, crypt(u.pass, gen_salt('bf')), now(),
              jsonb_build_object('role', u.role), jsonb_build_object('name', u.name, 'phone', u.phone),
              'authenticated', 'authenticated', now(), now())
      RETURNING id INTO uid;
    ELSE
      UPDATE auth.users SET
        encrypted_password = crypt(u.pass, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = jsonb_build_object('role', u.role),
        raw_user_meta_data = jsonb_build_object('name', u.name, 'phone', u.phone),
        updated_at = now()
      WHERE id = uid;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = uid AND provider = 'email') THEN
      EXECUTE format(
        'INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, now(), now(), now())',
        gen_random_uuid()::text, uid::text, uid::text,
        jsonb_build_object('sub', uid::text, 'email', u.email, 'email_verified', true, 'phone_verified', false)::text,
        'email');
    END IF;

    INSERT INTO public.profiles (id, name, phone, email, role)
    VALUES (uid, u.name, u.phone, u.email, u.role)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, role = EXCLUDED.role;
  END LOOP;
END $$;

-- =============================================
-- 12. Catálogo inicial (app_data)
-- =============================================
INSERT INTO public.app_data (key, value, is_admin) VALUES
('zones', '["Cariaco", "Alto Gingone", "Cimento", "Mucumbi", "Namatibe"]'::jsonb, true),
('payments', '["M-Pesa", "e-Mola", "BIM", "Emola"]'::jsonb, true),
('requests', '[]'::jsonb, true),
('suppliers', '[]'::jsonb, true)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- =============================================
-- 13. Verificação
-- =============================================
SELECT 'profiles' t, count(*) FROM public.profiles
UNION ALL SELECT 'app_data', count(*) FROM public.app_data
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'carts', count(*) FROM public.carts;

SELECT id, name, phone, email, role FROM public.profiles ORDER BY role, name;
