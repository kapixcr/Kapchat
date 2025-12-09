-- Agregar campo para rastrear qué agente envió el mensaje
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS sent_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Crear índice para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_by ON public.whatsapp_messages(sent_by_user_id);

-- Comentario para documentación
COMMENT ON COLUMN public.whatsapp_messages.sent_by_user_id IS 'ID del agente que envió el mensaje (solo para mensajes enviados por el sistema)';

