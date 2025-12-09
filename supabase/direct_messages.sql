-- =====================================================
-- MENSAJES DIRECTOS - SQL Adicional
-- Ejecutar DESPUÉS del schema.sql principal
-- =====================================================

-- Tabla de conversaciones directas (entre 2 usuarios)
CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Asegurar que no haya duplicados (user1, user2) o (user2, user1)
  CONSTRAINT unique_conversation UNIQUE (user1_id, user2_id),
  CONSTRAINT different_users CHECK (user1_id != user2_id)
);

-- Tabla de mensajes directos
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'file')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_direct_conversations_user1 ON public.direct_conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_user2 ON public.direct_conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON public.direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON public.direct_messages(created_at);

-- Habilitar RLS
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para conversaciones directas
CREATE POLICY "Users can view own conversations"
  ON public.direct_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create conversations"
  ON public.direct_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update own conversations"
  ON public.direct_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Políticas RLS para mensajes directos
CREATE POLICY "Users can view messages in their conversations"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_conversations dc
      WHERE dc.id = conversation_id
      AND (dc.user1_id = auth.uid() OR dc.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.direct_conversations dc
      WHERE dc.id = conversation_id
      AND (dc.user1_id = auth.uid() OR dc.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own messages"
  ON public.direct_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid());

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_direct_conversations_updated_at ON public.direct_conversations;
CREATE TRIGGER update_direct_conversations_updated_at 
  BEFORE UPDATE ON public.direct_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_direct_messages_updated_at ON public.direct_messages;
CREATE TRIGGER update_direct_messages_updated_at 
  BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para obtener o crear una conversación directa
CREATE OR REPLACE FUNCTION get_or_create_direct_conversation(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Buscar conversación existente
  SELECT id INTO conv_id
  FROM public.direct_conversations
  WHERE (user1_id = current_user_id AND user2_id = other_user_id)
     OR (user1_id = other_user_id AND user2_id = current_user_id);
  
  -- Si no existe, crear una nueva
  IF conv_id IS NULL THEN
    INSERT INTO public.direct_conversations (user1_id, user2_id)
    VALUES (current_user_id, other_user_id)
    RETURNING id INTO conv_id;
  END IF;
  
  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

