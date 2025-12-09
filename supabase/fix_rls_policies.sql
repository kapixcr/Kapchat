-- Script para corregir las políticas RLS de la tabla users
-- Ejecuta este script en el SQL Editor de Supabase
-- IMPORTANTE: Ejecuta este script completo en una sola vez

-- =====================================================
-- PASO 1: Eliminar políticas existentes si hay problemas
-- =====================================================
DROP POLICY IF EXISTS "Users are viewable by authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- =====================================================
-- PASO 2: Crear función helper con SECURITY DEFINER
-- Esta función puede crear perfiles sin restricciones RLS
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  avatar TEXT,
  role TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Insertar o actualizar el perfil
  INSERT INTO public.users (id, email, name, role, status)
  VALUES (
    user_id,
    user_email,
    COALESCE(user_name, split_part(user_email, '@', 1)),
    'user',
    'online'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    updated_at = NOW();
  
  -- Retornar el perfil creado/actualizado
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.avatar,
    u.role,
    u.status,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos para que los usuarios autenticados puedan llamar esta función
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT, TEXT) TO authenticated;

-- =====================================================
-- PASO 3: Actualizar el trigger para usar la función helper
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.create_user_profile(
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar que el trigger esté activo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- PASO 4: Recrear políticas RLS con mejor configuración
-- =====================================================

-- Política para SELECT: todos los usuarios autenticados pueden ver otros usuarios
CREATE POLICY "Users are viewable by authenticated users" 
  ON public.users FOR SELECT 
  TO authenticated
  USING (true);

-- Política para INSERT: permitir que los usuarios creen su propio perfil
-- Esto es necesario cuando el trigger no funciona o cuando se crea manualmente
CREATE POLICY "Users can insert own profile" 
  ON public.users FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Política para UPDATE: los usuarios solo pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" 
  ON public.users FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- PASO 5: Verificar que todo esté correcto
-- =====================================================
-- Verificar que las políticas existen
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- Verificar que el trigger existe
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

