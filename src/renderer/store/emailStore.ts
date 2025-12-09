import { create } from 'zustand';
import type { Email } from '../types';
import { useAuthStore } from './authStore';

interface EmailState {
  isConnected: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  syncError?: string;
  lastSyncAt?: Date;
  emails: Email[];
  currentEmail: Email | null;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  fetchEmails: () => Promise<void>;
  syncEmails: () => Promise<void>;
  setCurrentEmail: (emailId: string) => void;
  sendEmail: (to: string, subject: string, html: string) => Promise<void>;
  assignAgent: (emailId: string, agentId: string) => Promise<void>;
  markAsRead: (emailId: string) => Promise<void>;
  updateStatus: (emailId: string, status: 'pending' | 'assigned' | 'resolved') => Promise<void>;
  clearError: () => void;
}

export const useEmailStore = create<EmailState>((set, get) => ({
  isConnected: false,
  isConnecting: false,
  isSyncing: false,
  syncError: undefined,
  lastSyncAt: undefined,
  emails: [],
  currentEmail: null,

  clearError: () => {
    set({ syncError: undefined });
  },

  connect: async () => {
    const { config } = useAuthStore.getState();
    if (!config || !config.email_user) {
      throw new Error('Configuración de email no encontrada. Por favor, configura tu cuenta de email en Ajustes primero.');
    }

    set({ isConnecting: true, syncError: undefined });

    const emailPassword = localStorage.getItem('kapchat_email_password');
    if (!emailPassword) {
      set({ isConnecting: false });
      throw new Error('Contraseña de email no configurada');
    }

    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
        typeof window !== 'undefined' && !!(window as any).api
      );

    if (!isElectron) {
      set({ isConnecting: false });
      // En web, no lanzar error, solo retornar silenciosamente
      // No loguear, es comportamiento esperado en web
      return;
    }

    // Esperar a que window.api esté disponible
    let retries = 10;
    while (retries > 0 && (typeof window === 'undefined' || !window.api || !window.api.email)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries--;
    }

    if (typeof window === 'undefined' || !window.api || !window.api.email) {
      set({ isConnecting: false });
      // Si estamos en Electron pero window.api.email no está disponible, loguear como warning
      // Si estamos en web, no loguear (comportamiento esperado)
      if (isElectron) {
        console.warn('[EmailStore] window.api.email no disponible después de esperar. Asegúrate de que la aplicación se está ejecutando en Electron.');
      }
      return;
    }

    try {
      // Escuchar errores del proceso main
      if (typeof window.api.email.onError === 'function') {
        window.api.email.onError((err) => {
          console.error('[EmailStore] Error from main process:', err);
          set({ syncError: err?.message || String(err) });
        });
      }

      // Escuchar nuevos emails
      window.api.email.onNew(async (mail) => {
        if (!mail) return;
        console.log('[EmailStore] New email received:', mail.subject);

        const { supabase } = useAuthStore.getState();
        if (!supabase) return;

        try {
          // Guardar en base de datos
          const { error } = await supabase.from('emails').upsert({
            id: mail.id,
            from_address: mail.from,
            from_name: mail.fromName,
            to_address: mail.to,
            subject: mail.subject,
            html: mail.html,
            text_content: mail.text,
            date: mail.date instanceof Date ? mail.date.toISOString() : mail.date,
            is_read: false,
            status: 'pending',
            attachments: mail.attachments ? JSON.stringify(mail.attachments) : null,
          }, { onConflict: 'id' });

          if (error) {
            console.error('[EmailStore] Error saving new email:', error);
          }

          await get().fetchEmails();
        } catch (err) {
          console.error('[EmailStore] Error processing new email:', err);
        }
      });

      console.log('[EmailStore] Connecting to email server...');

      await window.api.email.connect({
        user: config.email_user,
        password: emailPassword,
        host: config.imap_host || 'imap.gmail.com',
        port: config.imap_port || 993,
        smtpHost: config.smtp_host || 'smtp.gmail.com',
        smtpPort: config.smtp_port || 587,
      });

      console.log('[EmailStore] Connected successfully');
      set({ isConnected: true, isConnecting: false });

      // Sincronizar emails iniciales
      await get().syncEmails();

    } catch (error: any) {
      console.error('[EmailStore] Connection error:', error);
      set({
        isConnecting: false,
        isConnected: false,
        syncError: error?.message || String(error)
      });
      throw error;
    }
  },

  disconnect: async () => {
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron || !window.api?.email) {
      // En web, simplemente actualizar el estado sin lanzar error
      set({ isConnected: false, emails: [], currentEmail: null });
      return;
    }

    await window.api.email.disconnect();
    set({ isConnected: false, emails: [], currentEmail: null });
  },

  fetchEmails: async () => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    try {
      // Limpiar emails existentes para empezar la carga progresiva
      set({ emails: [] });

      const batchSize = 20;
      const maxEmails = 100;
      let allEmails: Email[] = [];
      let offset = 0;
      let hasMore = true;

      // Cargar correos en lotes pequeños para mostrar progresivamente
      while (hasMore && offset < maxEmails) {
        const { data, error } = await supabase
          .from('emails')
          .select(`
            *,
            assigned_agent:users(*)
          `)
          .order('date', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error('[EmailStore] Error fetching emails from DB:', error);
          break;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        // Mapear campos de la base de datos al formato del frontend
        const mappedEmails: Email[] = data.map((row: any) => ({
          id: row.id,
          from: row.from_address,
          from_name: row.from_name,
          to: row.to_address,
          subject: row.subject,
          html: row.html || '',
          text: row.text_content || '',
          date: row.date,
          is_read: row.is_read,
          assigned_agent_id: row.assigned_agent_id,
          assigned_agent: row.assigned_agent,
          status: row.status,
          attachments: row.attachments ? (
            typeof row.attachments === 'string'
              ? JSON.parse(row.attachments)
              : row.attachments
          ) : [],
        }));

        // Actualizar el estado inmediatamente con los nuevos correos
        allEmails = [...allEmails, ...mappedEmails];
        set({ emails: allEmails });

        // Si recibimos menos correos que el tamaño del lote, no hay más
        if (data.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
          // Pequeña pausa para permitir que la UI se actualice
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (err) {
      console.error('[EmailStore] fetchEmails error:', err);
    }
  },

  syncEmails: async () => {
    set({ isSyncing: true, syncError: undefined });

    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
        typeof window !== 'undefined' && !!(window as any).api
      );

    if (!isElectron || !window.api?.email) {
      set({ isSyncing: false, syncError: 'API de email no disponible' });
      return;
    }

    try {
      console.log('[EmailStore] Syncing emails from IMAP...');
      const mails = await window.api.email.fetch();

      console.log(`[EmailStore] Received ${mails?.length || 0} emails from IMAP`);

      const { supabase } = useAuthStore.getState();
      if (supabase && Array.isArray(mails) && mails.length > 0) {
        // Preparar datos para inserción
        const rows = mails.map((mail: any) => ({
          id: mail.id,
          from_address: mail.from || '',
          from_name: mail.fromName || mail.from || 'Desconocido',
          to_address: mail.to || '',
          subject: mail.subject || '(Sin asunto)',
          html: mail.html || '',
          text_content: mail.text || '',
          date: mail.date instanceof Date ? mail.date.toISOString() : (mail.date || new Date().toISOString()),
          is_read: false,
          status: 'pending',
          attachments: mail.attachments ? JSON.stringify(mail.attachments) : null,
        }));

        console.log(`[EmailStore] Upserting ${rows.length} emails to database...`);

        // Insertar en lotes para evitar timeout
        const batchSize = 20;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error } = await supabase
            .from('emails')
            .upsert(batch, {
              onConflict: 'id',
              ignoreDuplicates: false
            });

          if (error) {
            console.error(`[EmailStore] Error upserting batch ${i / batchSize + 1}:`, error);
          }
        }

        console.log('[EmailStore] Sync complete');
        set({ lastSyncAt: new Date() });
      }
    } catch (err: any) {
      console.error('[EmailStore] Sync error:', err);
      set({ syncError: err?.message || String(err) });
    }

    // Actualizar lista de emails desde la base de datos
    await get().fetchEmails();
    set({ isSyncing: false });
  },

  setCurrentEmail: (emailId) => {
    const { emails } = get();
    const email = emails.find(e => e.id === emailId);
    if (email) {
      set({ currentEmail: email });
      if (!email.is_read) {
        get().markAsRead(emailId);
      }
    }
  },

  sendEmail: async (to, subject, html) => {
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
        typeof window !== 'undefined' && !!(window as any).api
      );

    if (!isElectron || !window.api?.email) {
      throw new Error('API de email no disponible.');
    }

    await window.api.email.send({ to, subject, html });
  },

  assignAgent: async (emailId, agentId) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    const { error } = await supabase
      .from('emails')
      .update({
        assigned_agent_id: agentId,
        status: 'assigned',
      })
      .eq('id', emailId);

    if (error) {
      console.error('[EmailStore] Error assigning agent:', error);
    }

    await get().fetchEmails();
  },

  markAsRead: async (emailId) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    const { error } = await supabase
      .from('emails')
      .update({ is_read: true })
      .eq('id', emailId);

    if (error) {
      console.error('[EmailStore] Error marking as read:', error);
    }

    await get().fetchEmails();
  },

  updateStatus: async (emailId, status) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    const { error } = await supabase
      .from('emails')
      .update({ status })
      .eq('id', emailId);

    if (error) {
      console.error('[EmailStore] Error updating status:', error);
    }

    await get().fetchEmails();
  },
}));
