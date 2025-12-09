import { create } from 'zustand';
import type { WhatsAppConversation, WhatsAppMessage } from '../types';
import { useAuthStore } from './authStore';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface WhatsAppUser {
  id: string;
  name?: string;
}

interface SendMessageOptions {
  message?: string;
  mediaPath?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  fileName?: string;
  quotedMessageId?: string;
}

interface WhatsAppState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionState: ConnectionState;
  user: WhatsAppUser | null;
  qrCode: string | null;
  conversations: WhatsAppConversation[];
  currentConversation: WhatsAppConversation | null;
  messages: WhatsAppMessage[];
  error: string | null;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  logout: () => Promise<void>;
  checkSessionAndAutoConnect: () => Promise<void>;
  fetchConversations: () => Promise<void>;
  setCurrentConversation: (conversationId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  sendMediaMessage: (options: SendMessageOptions) => Promise<void>;
  sendTyping: () => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  checkNumber: (phone: string) => Promise<boolean>;
  assignAgent: (conversationId: string, agentId: string) => Promise<void>;
  assignDepartment: (conversationId: string, departmentId: string | null) => Promise<void>;
  updateStatus: (conversationId: string, status: 'pending' | 'assigned' | 'resolved') => Promise<void>;
  clearError: () => void;
}

export const useWhatsAppStore = create<WhatsAppState>((set, get) => ({
  isConnected: false,
  isConnecting: false,
  connectionState: 'disconnected',
  user: null,
  qrCode: null,
  conversations: [],
  currentConversation: null,
  messages: [],
  error: null,

  clearError: () => {
    set({ error: null });
  },

  connect: async () => {
    set({ isConnecting: true, qrCode: null, error: null });

    // Verificar que estamos en Electron
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron) {
      set({ 
        isConnecting: false,
        error: 'WhatsApp solo está disponible en la aplicación de escritorio de Electron.'
      });
      return;
    }

    // Esperar a que window.api esté disponible
    let retries = 10;
    while (retries > 0 && (typeof window === 'undefined' || !window.api || !window.api.whatsapp)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries--;
    }

    if (typeof window === 'undefined' || !window.api || !window.api.whatsapp) {
      set({ 
        isConnecting: false,
        error: 'API de WhatsApp no disponible. Asegúrate de que la aplicación se está ejecutando en Electron.'
      });
      return;
    }

    // Setup listeners
    window.api.whatsapp.onQR((qr) => {
      console.log('[WhatsAppStore] QR received');
      set({ qrCode: qr });
    });

    window.api.whatsapp.onReady((user) => {
      console.log('[WhatsAppStore] Ready', user);
      set({
        isConnected: true,
        isConnecting: false,
        qrCode: null,
        connectionState: 'connected',
        user: user || null,
      });
      get().fetchConversations();
    });

    window.api.whatsapp.onConnectionState((state) => {
      console.log('[WhatsAppStore] Connection state:', state);
      set({
        connectionState: state,
        isConnecting: state === 'connecting' || state === 'reconnecting',
        isConnected: state === 'connected',
      });
    });

    window.api.whatsapp.onMessage(async (message) => {
      // Ignorar mensajes de estado y broadcasts
      if (message.from?.includes('status@broadcast') || 
          message.from?.includes('broadcast') ||
          message.from?.includes('@g.us')) {
        return;
      }

      console.log('[WhatsAppStore] New message:', message);
      const { supabase } = useAuthStore.getState();
      if (!supabase) return;

      try {
        // Check if conversation exists
        const { data: existing, error: convError } = await supabase
          .from('whatsapp_conversations')
          .select('*')
          .eq('phone', message.from)
          .maybeSingle();

        if (convError && convError.code !== 'PGRST116') {
          console.error('[WhatsAppStore] Error checking conversation:', convError);
        }

        let conversationId: string;

        if (existing) {
          conversationId = existing.id;
          // Update last message
          await supabase
            .from('whatsapp_conversations')
            .update({
              last_message: message.content,
              last_message_at: new Date().toISOString(),
              unread_count: existing.unread_count + 1,
            })
            .eq('id', existing.id);
        } else {
          // Create new conversation - generate UUID explicitly to avoid null constraint
          const newConversationId = crypto.randomUUID();
          
          const { data: newConv, error: insertError } = await supabase
            .from('whatsapp_conversations')
            .insert({
              id: newConversationId,
              phone: message.from,
              name: message.fromName || 'Desconocido',
              last_message: message.content || '',
              last_message_at: new Date().toISOString(),
              unread_count: 1,
              status: 'pending',
            })
            .select()
            .single();
          
          if (insertError) {
            console.error('[WhatsAppStore] Error creating conversation:', insertError);
            // Si falla por duplicado, intentar obtener la conversación existente
            if (insertError.code === '23505') {
              const { data: existingConv } = await supabase
                .from('whatsapp_conversations')
                .select('*')
                .eq('phone', message.from)
                .maybeSingle();
              
              if (existingConv) {
                conversationId = existingConv.id;
              } else {
                return; // No se pudo crear ni obtener
              }
            } else {
              return; // Otro error
            }
          } else if (newConv) {
            conversationId = newConv.id;
          } else {
            // Usar el ID generado si no hay respuesta pero tampoco error
            conversationId = newConversationId;
          }
        }

        // Save message
        const { error: messageError } = await supabase.from('whatsapp_messages').insert({
          conversation_id: conversationId,
          from_number: message.from,
          content: message.content || '',
          type: message.type || 'text',
          is_from_me: false,
          timestamp: message.timestamp || Date.now(),
          status: 'delivered',
        });

        if (messageError) {
          console.error('[WhatsAppStore] Error upserting message:', messageError);
        }

        // Refresh conversations
        await get().fetchConversations();

        // If current conversation, refresh messages
        if (get().currentConversation?.id === conversationId) {
          await get().fetchMessages(conversationId);
        }

        // Check for flow triggers and execute if applicable
        try {
          const { FlowEngine } = await import('../services/FlowEngine');

          const flowContext = {
            conversationId,
            phone: message.from,
            contactName: message.fromName || 'Desconocido',
            message: message.content,
            messageType: message.type,
            variables: {
              contact_name: message.fromName || '',
              phone: message.from,
            },
          };

          // First check if this message triggers a new flow
          const triggeredFlow = await FlowEngine.checkTriggers(flowContext);
          if (triggeredFlow) {
            console.log('[WhatsAppStore] Flow triggered:', triggeredFlow.name);
            await FlowEngine.startFlow(triggeredFlow, flowContext);
          } else {
            // If no new flow triggered, try to continue an existing one
            await FlowEngine.continueFlow(flowContext);
          }
        } catch (flowErr) {
          console.error('[WhatsAppStore] Error processing flow:', flowErr);
          // Don't throw - flows are optional functionality
        }
      } catch (err) {
        console.error('[WhatsAppStore] Error processing message:', err);
      }
    });

    // Listen for message status updates
    window.api.whatsapp.onMessageUpdate(async (update) => {
      const { supabase } = useAuthStore.getState();
      if (!supabase) return;

      // Update message status in database
      await supabase
        .from('whatsapp_messages')
        .update({ status: update.status })
        .eq('id', update.id);

      // Refresh messages if in current conversation
      const currentConv = get().currentConversation;
      if (currentConv) {
        await get().fetchMessages(currentConv.id);
      }
    });

    window.api.whatsapp.onDisconnected(() => {
      console.log('[WhatsAppStore] Disconnected');
      set({ isConnected: false, isConnecting: false, connectionState: 'disconnected' });
    });

    window.api.whatsapp.onLoggedOut(() => {
      console.log('[WhatsAppStore] Logged out');
      set({
        isConnected: false,
        isConnecting: false,
        connectionState: 'disconnected',
        user: null,
        conversations: [],
        messages: [],
        currentConversation: null,
      });
    });

    window.api.whatsapp.onError((error) => {
      console.error('[WhatsAppStore] Error:', error);
      set({ error: error.message, isConnecting: false });
    });

    try {
      const { user } = useAuthStore.getState();
      await window.api.whatsapp.connect(user?.id);
    } catch (err: any) {
      console.error('[WhatsAppStore] Connect error:', err);
      set({
        error: err?.message || String(err),
        isConnecting: false,
        connectionState: 'disconnected',
      });
    }
  },

  disconnect: async () => {
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron || !window.api?.whatsapp) {
      set({ isConnected: false, qrCode: null, connectionState: 'disconnected' });
      return;
    }

    await window.api.whatsapp.disconnect();
    set({ isConnected: false, qrCode: null, connectionState: 'disconnected' });
  },

  checkSessionAndAutoConnect: async () => {
    // Solo verificar si no está ya conectado o conectando
    const { isConnected, isConnecting } = get();
    if (isConnected || isConnecting) {
      return;
    }

    // Verificar que estamos en Electron
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron || !window.api?.whatsapp) {
      // En web, WhatsApp no está disponible, simplemente retornar sin error
      return;
    }

    try {
      const sessionStatus = await window.api.whatsapp.checkSession();
      
      if (sessionStatus.hasSession && sessionStatus.isConnected) {
        console.log('[WhatsAppStore] Found active session, auto-connecting...');
        // Conectar automáticamente si hay una sesión activa
        await get().connect();
      }
    } catch (err: any) {
      console.error('[WhatsAppStore] Error checking session:', err);
      // No mostrar error al usuario, solo loguear
    }
  },

  logout: async () => {
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron || !window.api?.whatsapp) {
      set({
        isConnected: false,
        isConnecting: false,
        connectionState: 'disconnected',
        user: null,
        conversations: [],
        messages: [],
        currentConversation: null,
      });
      return;
    }

    await window.api.whatsapp.logout();
    set({
      isConnected: false,
      qrCode: null,
      connectionState: 'disconnected',
      user: null,
      conversations: [],
      messages: [],
      currentConversation: null,
    });
  },

  fetchConversations: async () => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select(`
        *,
        assigned_agent:users(*),
        department:departments(id, name, color, description)
      `)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('[WhatsAppStore] Error fetching conversations:', error);
      return;
    }

    set({ conversations: data || [] });
  },

  setCurrentConversation: async (conversationId) => {
    const { conversations } = get();
    const { supabase } = useAuthStore.getState();

    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      set({ currentConversation: conversation });
      await get().fetchMessages(conversationId);

      // Mark as read
      if (supabase && conversation.unread_count > 0) {
        await supabase
          .from('whatsapp_conversations')
          .update({ unread_count: 0 })
          .eq('id', conversationId);

        // Also update local state
        set({
          conversations: get().conversations.map(c =>
            c.id === conversationId ? { ...c, unread_count: 0 } : c
          ),
          currentConversation: { ...conversation, unread_count: 0 },
        });
      }
    }
  },

  fetchMessages: async (conversationId) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select(`
        *,
        sent_by_user:users!whatsapp_messages_sent_by_user_id_fkey(id, name, avatar)
      `)
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('[WhatsAppStore] Error fetching messages:', error);
      return;
    }

    // Map from database fields to frontend fields
    const messages: WhatsAppMessage[] = (data || []).map((row: any) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      from: row.from_number,
      content: row.content,
      type: row.type,
      is_from_me: row.is_from_me,
      timestamp: row.timestamp,
      status: row.status,
      media_url: row.media_url,
      media_mimetype: row.media_mimetype,
      caption: row.caption,
      file_name: row.file_name,
      sent_by_user_id: row.sent_by_user_id,
      sent_by_user: row.sent_by_user ? {
        id: row.sent_by_user.id,
        name: row.sent_by_user.name,
        avatar: row.sent_by_user.avatar,
      } : undefined,
    }));

    set({ messages });
  },

  sendMessage: async (content, options = {}) => {
    const { currentConversation } = get();
    const { supabase, user } = useAuthStore.getState();
    if (!currentConversation || !supabase) return;

    // Verificar que estamos en Electron
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron || !window.api?.whatsapp) {
      set({ error: 'WhatsApp solo está disponible en la aplicación de escritorio de Electron.' });
      return;
    }

    try {
      // Formatear mensaje con departamento si está asignado
      let formattedContent = content;
      let displayContent = content; // Contenido para mostrar en la UI
      
      if (currentConversation.department && currentConversation.department.name) {
        // Agregar formato de departamento al inicio del mensaje
        formattedContent = `* ${currentConversation.department.name} *\n${content}`;
        displayContent = formattedContent; // Guardar el formato completo en la BD
      }

      // Send via WhatsApp
      const result = await window.api.whatsapp.sendMessage({
        to: currentConversation.phone,
        message: formattedContent,
        ...options,
      });

      // Save to database with agent info (guardar el contenido formateado)
      const timestamp = result?.timestamp || Date.now();
      await supabase.from('whatsapp_messages').insert({
        conversation_id: currentConversation.id,
        from_number: 'me',
        content: displayContent, // Guardar con el formato del departamento
        type: options.mediaType || 'text',
        is_from_me: true,
        timestamp,
        status: 'sent',
        sent_by_user_id: user?.id || null,
      });

      // Update conversation (mostrar solo el contenido original sin el formato del departamento)
      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message: content || options.caption || `[${options.mediaType || 'archivo'}]`,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', currentConversation.id);

      await get().fetchMessages(currentConversation.id);
      await get().fetchConversations();
    } catch (err: any) {
      console.error('[WhatsAppStore] Error sending message:', err);
      set({ error: err?.message || 'Error al enviar mensaje' });
    }
  },

  sendMediaMessage: async (options) => {
    const { currentConversation } = get();
    const { supabase, user } = useAuthStore.getState();
    if (!currentConversation || !supabase) return;

    // Verificar que estamos en Electron
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron || !window.api?.whatsapp) {
      set({ error: 'WhatsApp solo está disponible en la aplicación de escritorio de Electron.' });
      return;
    }

    try {
      // Formatear caption con departamento si está asignado
      let formattedCaption = options.caption;
      let displayContent = options.caption || options.fileName || `[${options.mediaType}]`;
      
      if (currentConversation.department && currentConversation.department.name && options.caption) {
        // Agregar formato de departamento al inicio del caption
        formattedCaption = `* ${currentConversation.department.name} *\n${options.caption}`;
        displayContent = formattedCaption;
      }

      // Send via WhatsApp con caption formateado
      const result = await window.api.whatsapp.sendMessage({
        to: currentConversation.phone,
        ...options,
        caption: formattedCaption || options.caption,
      });

      const timestamp = result?.timestamp || Date.now();

      await supabase.from('whatsapp_messages').insert({
        conversation_id: currentConversation.id,
        from_number: 'me',
        content: displayContent, // Guardar con el formato del departamento si aplica
        type: options.mediaType || 'document',
        is_from_me: true,
        timestamp,
        status: 'sent',
        sent_by_user_id: user?.id || null,
      });

      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message: options.caption || options.fileName || `[${options.mediaType}]`,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', currentConversation.id);

      await get().fetchMessages(currentConversation.id);
      await get().fetchConversations();
    } catch (err: any) {
      console.error('[WhatsAppStore] Error sending media:', err);
      set({ error: err?.message || 'Error al enviar archivo' });
    }
  },

  sendTyping: async () => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron || !window.api?.whatsapp) {
      return; // Silenciosamente fallar en web
    }

    try {
      await window.api.whatsapp.sendTyping(currentConversation.phone);
    } catch (err) {
      console.error('[WhatsAppStore] Error sending typing:', err);
    }
  },

  markAsRead: async (messageId) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron || !window.api?.whatsapp) {
      return; // Silenciosamente fallar en web
    }

    try {
      await window.api.whatsapp.markAsRead([{
        id: messageId,
        remoteJid: currentConversation.phone,
      }]);
    } catch (err) {
      console.error('[WhatsAppStore] Error marking as read:', err);
    }
  },

  checkNumber: async (phone) => {
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron || !window.api?.whatsapp) {
      return false; // En web, retornar false silenciosamente
    }

    try {
      return await window.api.whatsapp.checkNumber(phone);
    } catch (err) {
      console.error('[WhatsAppStore] Error checking number:', err);
      return false;
    }
  },

  assignAgent: async (conversationId, agentId) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({
        assigned_agent_id: agentId,
        status: 'assigned',
      })
      .eq('id', conversationId);

    if (error) {
      console.error('[WhatsAppStore] Error assigning agent:', error);
    }

    await get().fetchConversations();
  },

  assignDepartment: async (conversationId, departmentId) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ department_id: departmentId })
      .eq('id', conversationId);

    if (error) {
      console.error('[WhatsAppStore] Error assigning department:', error);
    }

    // Actualizar la conversación localmente sin hacer fetch completo para evitar efectos secundarios
    const { currentConversation, conversations } = get();
    if (currentConversation?.id === conversationId) {
      // Obtener el departamento desde Supabase si existe
      let department = null;
      if (departmentId) {
        const { data: deptData } = await supabase
          .from('departments')
          .select('id, name, color, description')
          .eq('id', departmentId)
          .single();
        
        if (deptData) {
          department = {
            id: deptData.id,
            name: deptData.name,
            color: deptData.color,
            description: deptData.description,
          };
        }
      }
      
      const updatedConversation = {
        ...currentConversation,
        department_id: departmentId,
        department: department || undefined,
      };
      
      set({ currentConversation: updatedConversation });
      
      // Actualizar también en la lista de conversaciones
      set({
        conversations: conversations.map(c =>
          c.id === conversationId ? updatedConversation : c
        ),
      });
    } else {
      // Si no es la conversación actual, solo actualizar la lista
      await get().fetchConversations();
    }
  },

  updateStatus: async (conversationId, status) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ status })
      .eq('id', conversationId);

    if (error) {
      console.error('[WhatsAppStore] Error updating status:', error);
    }

    await get().fetchConversations();
  },
}));
