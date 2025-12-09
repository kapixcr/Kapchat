-- Stickers Schema
-- Run this SQL in your Supabase SQL Editor to enable sticker management

-- Stickers table
CREATE TABLE IF NOT EXISTS public.stickers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/webp',
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for category and active status
CREATE INDEX IF NOT EXISTS idx_stickers_category ON public.stickers(category);
CREATE INDEX IF NOT EXISTS idx_stickers_active ON public.stickers(is_active);
CREATE INDEX IF NOT EXISTS idx_stickers_uploaded_by ON public.stickers(uploaded_by);

-- Enable RLS for stickers
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stickers
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Stickers viewable by authenticated users" ON public.stickers;
DROP POLICY IF EXISTS "Stickers insertable by authenticated users" ON public.stickers;
DROP POLICY IF EXISTS "Stickers updatable by authenticated users" ON public.stickers;
DROP POLICY IF EXISTS "Stickers deletable by authenticated users" ON public.stickers;

CREATE POLICY "Stickers viewable by authenticated users"
  ON public.stickers FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

CREATE POLICY "Stickers insertable by authenticated users"
  ON public.stickers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stickers updatable by authenticated users"
  ON public.stickers FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stickers deletable by authenticated users"
  ON public.stickers FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Grant permissions
GRANT ALL ON public.stickers TO authenticated;

-- Trigger for updating updated_at
DROP TRIGGER IF EXISTS update_stickers_updated_at ON public.stickers;
CREATE TRIGGER update_stickers_updated_at
  BEFORE UPDATE ON public.stickers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for stickers
ALTER PUBLICATION supabase_realtime ADD TABLE public.stickers;

-- Create storage bucket for stickers (run this in Supabase Storage section or via SQL)
-- Note: You need to create the bucket manually in Supabase Dashboard > Storage
-- Or use the following SQL if you have the storage extension enabled:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('stickers', 'stickers', true);

-- Storage policies for stickers bucket
-- Run these after creating the bucket in Supabase Dashboard
/*
CREATE POLICY "Stickers are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stickers');

CREATE POLICY "Authenticated users can upload stickers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stickers' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their stickers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'stickers' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete their stickers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stickers' AND auth.role() = 'authenticated');
*/

