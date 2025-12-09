-- Fix RLS Policies for Stickers
-- Run this SQL in your Supabase SQL Editor to fix sticker upload permissions

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Stickers viewable by authenticated users" ON public.stickers;
DROP POLICY IF EXISTS "Stickers insertable by authenticated users" ON public.stickers;
DROP POLICY IF EXISTS "Stickers updatable by authenticated users" ON public.stickers;
DROP POLICY IF EXISTS "Stickers deletable by authenticated users" ON public.stickers;

-- Recreate policies with proper authentication checks
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

-- Also ensure the table exists and has proper permissions
GRANT ALL ON public.stickers TO authenticated;

