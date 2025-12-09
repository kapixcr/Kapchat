-- User Settings Schema
-- Run this SQL in your Supabase SQL Editor to enable per-user email configuration

-- User settings table - stores user-specific configurations
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Email configuration
  email_user TEXT,
  email_password_encrypted TEXT, -- Encrypted with pgcrypto
  smtp_host TEXT DEFAULT 'smtp.gmail.com',
  smtp_port INTEGER DEFAULT 587,
  imap_host TEXT DEFAULT 'imap.gmail.com',
  imap_port INTEGER DEFAULT 993,
  
  -- Other settings can be added here
  notification_sound BOOLEAN DEFAULT true,
  notification_desktop BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - each user can only access their own settings
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own settings"
  ON public.user_settings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at 
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_user_settings_updated_at();

-- Function to get or create user settings
CREATE OR REPLACE FUNCTION get_or_create_user_settings(p_user_id UUID)
RETURNS SETOF public.user_settings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to get existing settings
  IF EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = p_user_id) THEN
    RETURN QUERY SELECT * FROM public.user_settings WHERE user_id = p_user_id;
  ELSE
    -- Create default settings
    INSERT INTO public.user_settings (user_id) VALUES (p_user_id);
    RETURN QUERY SELECT * FROM public.user_settings WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Simple encryption functions using pgcrypto
-- Note: For production, use proper key management!
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to encrypt password
CREATE OR REPLACE FUNCTION encrypt_email_password(p_password TEXT, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Create a key derived from user_id (in production, use a proper secret)
  v_key := 'kapchat_' || p_user_id::TEXT;
  RETURN encode(encrypt(p_password::bytea, v_key::bytea, 'aes'), 'base64');
END;
$$;

-- Function to decrypt password
CREATE OR REPLACE FUNCTION decrypt_email_password(p_encrypted TEXT, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;
  
  v_key := 'kapchat_' || p_user_id::TEXT;
  RETURN convert_from(decrypt(decode(p_encrypted, 'base64'), v_key::bytea, 'aes'), 'UTF8');
EXCEPTION
  WHEN OTHERS THEN
    -- If decryption fails, return NULL
    RETURN NULL;
END;
$$;

-- Function to save email settings with encrypted password
CREATE OR REPLACE FUNCTION save_email_settings(
  p_user_id UUID,
  p_email_user TEXT,
  p_email_password TEXT DEFAULT NULL,
  p_smtp_host TEXT DEFAULT 'smtp.gmail.com',
  p_smtp_port INTEGER DEFAULT 587,
  p_imap_host TEXT DEFAULT 'imap.gmail.com',
  p_imap_port INTEGER DEFAULT 993
)
RETURNS public.user_settings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encrypted_password TEXT;
  v_result public.user_settings;
BEGIN
  -- Encrypt password if provided
  IF p_email_password IS NOT NULL AND p_email_password != '' THEN
    v_encrypted_password := encrypt_email_password(p_email_password, p_user_id);
  END IF;
  
  -- Upsert settings
  INSERT INTO public.user_settings (
    user_id, 
    email_user, 
    email_password_encrypted,
    smtp_host, 
    smtp_port, 
    imap_host, 
    imap_port
  )
  VALUES (
    p_user_id, 
    p_email_user, 
    v_encrypted_password,
    p_smtp_host, 
    p_smtp_port, 
    p_imap_host, 
    p_imap_port
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email_user = EXCLUDED.email_user,
    email_password_encrypted = COALESCE(EXCLUDED.email_password_encrypted, user_settings.email_password_encrypted),
    smtp_host = EXCLUDED.smtp_host,
    smtp_port = EXCLUDED.smtp_port,
    imap_host = EXCLUDED.imap_host,
    imap_port = EXCLUDED.imap_port,
    updated_at = NOW();
  
  SELECT * INTO v_result FROM public.user_settings WHERE user_id = p_user_id;
  RETURN v_result;
END;
$$;

-- Function to get email settings with decrypted password
CREATE OR REPLACE FUNCTION get_email_settings(p_user_id UUID)
RETURNS TABLE (
  email_user TEXT,
  email_password TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  imap_host TEXT,
  imap_port INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.email_user,
    decrypt_email_password(us.email_password_encrypted, p_user_id) as email_password,
    us.smtp_host,
    us.smtp_port,
    us.imap_host,
    us.imap_port
  FROM public.user_settings us
  WHERE us.user_id = p_user_id;
END;
$$;
