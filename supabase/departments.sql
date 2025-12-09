-- Tabla de departamentos
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3B82F6', -- Color en formato hexadecimal
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar campo department_id a whatsapp_conversations
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON public.departments(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_department ON public.whatsapp_conversations(department_id);

-- Habilitar RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para departamentos
CREATE POLICY "Departments viewable by authenticated"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Departments insertable by authenticated"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Departments updatable by authenticated"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Departments deletable by authenticated"
  ON public.departments FOR DELETE
  TO authenticated
  USING (true);

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
CREATE TRIGGER update_departments_updated_at 
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;

-- Insertar algunos departamentos por defecto
INSERT INTO public.departments (name, color, description) VALUES
  ('Ventas', '#10B981', 'Departamento de ventas'),
  ('Soporte', '#3B82F6', 'Departamento de soporte técnico'),
  ('Facturación', '#F59E0B', 'Departamento de facturación'),
  ('General', '#6B7280', 'Departamento general')
ON CONFLICT (name) DO NOTHING;

