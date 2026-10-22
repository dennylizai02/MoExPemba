-- =============================================================
-- MoEx Pemba — Migração v2
-- Bucket de imagens + políticas de roles/clientes + storage
-- Execute no Supabase Dashboard > SQL Editor
-- =============================================================

-- =============================================
-- 1. Bucket de imagens dos produtos
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública das imagens
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Utilizadores autenticados podem enviar (na sua própria pasta)
DROP POLICY IF EXISTS "Users upload own product images" ON storage.objects;
CREATE POLICY "Users upload own product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Cada utilizador gere apenas as suas imagens
DROP POLICY IF EXISTS "Users manage own product images" ON storage.objects;
CREATE POLICY "Users manage own product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own product images" ON storage.objects;
CREATE POLICY "Users delete own product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================
-- 2. Perfis: admins podem mudar a role de qualquer utilizador
--    (necessário para a gestão de clientes / pedidos de vendedor)
-- =============================================
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Sellers podem consultar a lista de clientes (para encomendas)
DROP POLICY IF EXISTS "Sellers can read all profiles" ON public.profiles;
CREATE POLICY "Sellers can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'seller'));

-- =============================================
-- 3. app_data: linhas globais só o admin altera
--    Linhas "is_admin = false" (favoritos, pedidos de vendedor)
--    podem ser criadas/lidas por cada utilizador na sua chave
-- =============================================
DROP POLICY IF EXISTS "Authenticated can read app_data" ON public.app_data;
CREATE POLICY "Authenticated can read app_data"
  ON public.app_data FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert app_data" ON public.app_data;
CREATE POLICY "Authenticated can insert app_data"
  ON public.app_data FOR INSERT
  TO authenticated
  WITH CHECK (is_admin = false OR public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated can update app_data" ON public.app_data;
CREATE POLICY "Authenticated can update app_data"
  ON public.app_data FOR UPDATE
  TO authenticated
  USING (is_admin = false OR public.get_user_role() = 'admin')
  WITH CHECK (is_admin = false OR public.get_user_role() = 'admin');

-- =============================================
-- 4. Conceder permissões de storage
-- =============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT USAGE ON storage.buckets TO authenticated;

-- =============================================
-- 5. Verificação
-- =============================================
SELECT id, name, public FROM storage.buckets WHERE id = 'product-images';

SELECT policyname, tablename, cmd
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND tablename IN ('profiles', 'app_data', 'objects')
ORDER BY tablename, policyname;

-- NOTA (limitação conhecida): o catálogo de produtos vive numa única
-- linha da tabela app_data (key = 'products', is_admin = true).
-- Dois vendedores a editar em simultâneo podem sobrepor-se.
-- Migrar para uma tabela `products` dedicada é o próximo passo.
