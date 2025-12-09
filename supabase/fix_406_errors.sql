-- Script para corregir errores 406 (Not Acceptable) en Supabase
-- Ejecuta este script en el SQL Editor de Supabase

-- =====================================================
-- PASO 1: Verificar y corregir políticas RLS para flow_executions
-- =====================================================

-- Eliminar políticas existentes si hay problemas
DROP POLICY IF EXISTS "Flow executions viewable by authenticated" ON public.flow_executions;
DROP POLICY IF EXISTS "Flow executions insertable by system" ON public.flow_executions;
DROP POLICY IF EXISTS "Flow executions updatable by system" ON public.flow_executions;
DROP POLICY IF EXISTS "Flow executions deletable by authenticated" ON public.flow_executions;

-- Recrear políticas con permisos completos
CREATE POLICY "Flow executions viewable by authenticated"
  ON public.flow_executions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Flow executions insertable by system"
  ON public.flow_executions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Flow executions updatable by system"
  ON public.flow_executions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Flow executions deletable by authenticated"
  ON public.flow_executions FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- PASO 2: Verificar y corregir políticas RLS para whatsapp_conversations
-- =====================================================

-- Eliminar políticas existentes si hay problemas
DROP POLICY IF EXISTS "WhatsApp conversations for authenticated" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "WhatsApp conversations insert" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "WhatsApp conversations update" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "WhatsApp conversations delete" ON public.whatsapp_conversations;

-- Recrear políticas con permisos completos
CREATE POLICY "WhatsApp conversations for authenticated"
  ON public.whatsapp_conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "WhatsApp conversations insert"
  ON public.whatsapp_conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "WhatsApp conversations update"
  ON public.whatsapp_conversations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "WhatsApp conversations delete"
  ON public.whatsapp_conversations FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- PASO 3: Verificar que las tablas tengan RLS habilitado
-- =====================================================
ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 4: Verificar permisos de las tablas
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;

-- =====================================================
-- PASO 5: Verificar y corregir políticas RLS para whatsapp_messages
-- =====================================================

-- Eliminar políticas existentes si hay problemas
DROP POLICY IF EXISTS "WhatsApp messages select" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "WhatsApp messages insert" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "WhatsApp messages update" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "WhatsApp messages delete" ON public.whatsapp_messages;

-- Recrear políticas con permisos completos
CREATE POLICY "WhatsApp messages select"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "WhatsApp messages insert"
  ON public.whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "WhatsApp messages update"
  ON public.whatsapp_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "WhatsApp messages delete"
  ON public.whatsapp_messages FOR DELETE
  TO authenticated
  USING (true);

-- Asegurar que RLS está habilitado
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Verificar permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;

-- =====================================================
-- PASO 6: Verificar que las políticas existen
-- =====================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('flow_executions', 'whatsapp_conversations', 'whatsapp_messages') 
  AND schemaname = 'public'
ORDER BY tablename, policyname;

