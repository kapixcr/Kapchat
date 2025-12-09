-- WhatsApp Flows Schema
-- Run this SQL in your Supabase SQL Editor to enable WhatsApp automation flows

-- Flows table - stores flow definitions
CREATE TABLE IF NOT EXISTS public.whatsapp_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'first_message', 'webhook', 'schedule')),
  trigger_value TEXT, -- keyword to trigger, cron expression for schedule, etc.
  is_active BOOLEAN NOT NULL DEFAULT false,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flow executions table - tracks running/completed flows
CREATE TABLE IF NOT EXISTS public.flow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES public.whatsapp_flows(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  current_node_id TEXT,
  variables JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'paused', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flow logs table - stores execution logs for debugging
CREATE TABLE IF NOT EXISTS public.flow_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES public.flow_executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  action TEXT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flow templates table - stores reusable flow templates
CREATE TABLE IF NOT EXISTS public.flow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_flows_trigger_type ON public.whatsapp_flows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_flows_is_active ON public.whatsapp_flows(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_flows_trigger_value ON public.whatsapp_flows(trigger_value);

CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_id ON public.flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_conversation_id ON public.flow_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_status ON public.flow_executions(status);
CREATE INDEX IF NOT EXISTS idx_flow_executions_last_activity ON public.flow_executions(last_activity_at);

CREATE INDEX IF NOT EXISTS idx_flow_logs_execution_id ON public.flow_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_flow_logs_created_at ON public.flow_logs(created_at);

-- Enable RLS
ALTER TABLE public.whatsapp_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_flows
CREATE POLICY "Flows viewable by authenticated users"
  ON public.whatsapp_flows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Flows insertable by authenticated users"
  ON public.whatsapp_flows FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Flows updatable by authenticated users"
  ON public.whatsapp_flows FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Flows deletable by creator"
  ON public.whatsapp_flows FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for flow_executions
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
  USING (true);

-- RLS Policies for flow_logs
CREATE POLICY "Flow logs viewable by authenticated"
  ON public.flow_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Flow logs insertable by system"
  ON public.flow_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for flow_templates
CREATE POLICY "Public templates viewable by all"
  ON public.flow_templates FOR SELECT
  TO authenticated
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Templates insertable by authenticated"
  ON public.flow_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Templates updatable by creator"
  ON public.flow_templates FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Trigger for updating updated_at
DROP TRIGGER IF EXISTS update_whatsapp_flows_updated_at ON public.whatsapp_flows;
CREATE TRIGGER update_whatsapp_flows_updated_at 
  BEFORE UPDATE ON public.whatsapp_flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for flow executions
ALTER PUBLICATION supabase_realtime ADD TABLE public.flow_executions;

-- Insert some default flow templates
INSERT INTO public.flow_templates (name, description, category, is_public, nodes) VALUES
(
  'Saludo de Bienvenida',
  'Un simple mensaje de bienvenida para nuevos contactos',
  'welcome',
  true,
  '[
    {
      "id": "node_1",
      "type": "message",
      "position": {"x": 100, "y": 100},
      "data": {
        "message": "¡Hola! 👋 Bienvenido. ¿En qué puedo ayudarte hoy?"
      },
      "connections": []
    }
  ]'::jsonb
),
(
  'Menú Principal',
  'Ofrece opciones al usuario con un menú interactivo',
  'menu',
  true,
  '[
    {
      "id": "node_1",
      "type": "question",
      "position": {"x": 100, "y": 100},
      "data": {
        "question": "¡Hola! ¿En qué puedo ayudarte?\n\n1️⃣ Información de productos\n2️⃣ Soporte técnico\n3️⃣ Hablar con un agente",
        "options": [
          {"label": "Productos", "value": "1"},
          {"label": "Soporte", "value": "2"},
          {"label": "Agente", "value": "3"}
        ],
        "variable_name": "menu_selection"
      },
      "connections": [
        {"id": "conn_1", "target_node_id": "node_2", "condition": "1"},
        {"id": "conn_2", "target_node_id": "node_3", "condition": "2"},
        {"id": "conn_3", "target_node_id": "node_4", "condition": "3"}
      ]
    },
    {
      "id": "node_2",
      "type": "message",
      "position": {"x": 100, "y": 250},
      "data": {
        "message": "📦 Aquí tienes información sobre nuestros productos..."
      },
      "connections": []
    },
    {
      "id": "node_3",
      "type": "message",
      "position": {"x": 300, "y": 250},
      "data": {
        "message": "🔧 Para soporte técnico, por favor describe tu problema..."
      },
      "connections": []
    },
    {
      "id": "node_4",
      "type": "transfer",
      "position": {"x": 500, "y": 250},
      "data": {
        "transfer_message": "🙋 Un momento, te transfiero con un agente disponible..."
      },
      "connections": []
    }
  ]'::jsonb
),
(
  'Fuera de Horario',
  'Mensaje automático fuera del horario de atención',
  'schedule',
  true,
  '[
    {
      "id": "node_1",
      "type": "message",
      "position": {"x": 100, "y": 100},
      "data": {
        "message": "🌙 Gracias por contactarnos.\n\nNuestro horario de atención es de Lunes a Viernes, 9:00 AM a 6:00 PM.\n\nTe responderemos lo antes posible. ¡Gracias por tu paciencia!"
      },
      "connections": []
    }
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
