-- Execute este script no Supabase Dashboard > SQL Editor
-- after logging in with each account at least once (so profiles are auto-created)

-- Definir role admin
UPDATE profiles SET role = 'admin' WHERE email = 'lizaivalden1@outlook.com';

-- Definir role seller/vendedor
UPDATE profiles SET role = 'seller' WHERE email = 'miltoncesarlizai9@gmail.com';

-- Verificar resultado
SELECT id, name, email, role FROM profiles ORDER BY role, name;
