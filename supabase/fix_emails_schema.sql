-- Fix emails table schema to match the application code
-- Run this SQL in your Supabase SQL Editor if you have issues with email sync

-- First, check if the columns need renaming
DO $$ 
BEGIN
    -- Rename from_address to from if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'emails' AND column_name = 'from_address') THEN
        -- Column exists with new name, no action needed
        RAISE NOTICE 'Column from_address exists';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'emails' AND column_name = 'from') THEN
        -- Old column name, rename it
        ALTER TABLE public.emails RENAME COLUMN "from" TO from_address;
        RAISE NOTICE 'Renamed from to from_address';
    END IF;

    -- Rename to_address if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'emails' AND column_name = 'to_address') THEN
        RAISE NOTICE 'Column to_address exists';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'emails' AND column_name = 'to') THEN
        ALTER TABLE public.emails RENAME COLUMN "to" TO to_address;
        RAISE NOTICE 'Renamed to to to_address';
    END IF;

    -- Rename text_content if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'emails' AND column_name = 'text_content') THEN
        RAISE NOTICE 'Column text_content exists';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'emails' AND column_name = 'text') THEN
        ALTER TABLE public.emails RENAME COLUMN "text" TO text_content;
        RAISE NOTICE 'Renamed text to text_content';
    END IF;
END $$;

-- Make sure all required columns exist
ALTER TABLE public.emails 
    ADD COLUMN IF NOT EXISTS from_address TEXT,
    ADD COLUMN IF NOT EXISTS from_name TEXT,
    ADD COLUMN IF NOT EXISTS to_address TEXT,
    ADD COLUMN IF NOT EXISTS text_content TEXT;

-- Update NOT NULL constraints if needed (be careful with existing data)
-- Only run these if you're sure the data is clean:
-- ALTER TABLE public.emails ALTER COLUMN from_address SET NOT NULL;
-- ALTER TABLE public.emails ALTER COLUMN from_name SET NOT NULL;
-- ALTER TABLE public.emails ALTER COLUMN to_address SET NOT NULL;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_emails_from_address ON public.emails(from_address);
CREATE INDEX IF NOT EXISTS idx_emails_subject ON public.emails(subject);

-- Refresh the emails table publication for realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.emails;

COMMIT;
