/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_EMAIL_USER?: string;
  readonly VITE_SMTP_HOST?: string;
  readonly VITE_SMTP_PORT?: string;
  readonly VITE_IMAP_HOST?: string;
  readonly VITE_IMAP_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

