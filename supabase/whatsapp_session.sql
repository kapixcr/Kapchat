-- Tabla para almacenar la sesión de WhatsApp compartida
-- Esta sesión será compartida entre todos los usuarios del sistema

CREATE TABLE IF NOT EXISTS public.whatsapp_session (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_name TEXT NOT NULL DEFAULT 'kapchat-session' UNIQUE,
  session_data TEXT NOT NULL, -- Almacena los archivos de sesión comprimidos como base64
  qr_code TEXT, -- QR code actual si está esperando escaneo
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'qr_required')),
  connected_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Usuario que inició la conexión
  connected_at TIMESTAMPTZ, -- Cuándo se conectó
  last_activity_at TIMESTAMPTZ DEFAULT NOW(), -- Última actividad
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_whatsapp_session_status ON public.whatsapp_session(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_session_name ON public.whatsapp_session(session_name);

-- Habilitar RLS
ALTER TABLE public.whatsapp_session ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: todos los usuarios autenticados pueden leer/actualizar la sesión
CREATE POLICY "WhatsApp session viewable by authenticated"
  ON public.whatsapp_session FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "WhatsApp session insertable by authenticated"
  ON public.whatsapp_session FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "WhatsApp session updatable by authenticated"
  ON public.whatsapp_session FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_whatsapp_session_updated_at ON public.whatsapp_session;
CREATE TRIGGER update_whatsapp_session_updated_at 
  BEFORE UPDATE ON public.whatsapp_session
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar realtime para la sesión
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_session;

-- Permisos
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_session TO authenticated;

