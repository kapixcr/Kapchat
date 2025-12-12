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
  handleNewMessage: (message: any) => Promise<void>;
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

  handleNewMessage: async (message: any) => {
    // Ignorar mensajes de estado y broadcasts
    if (message.from?.includes('status@broadcast') ||
      message.from?.includes('broadcast') ||
      message.from?.includes('@g.us')) {
      return;
    }

    console.log('[WhatsAppStore] Processing new message:', message);
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
        // Create new conversation
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

      // Check for flow triggers
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

        const triggeredFlow = await FlowEngine.checkTriggers(flowContext);
        if (triggeredFlow) {
          console.log('[WhatsAppStore] Flow triggered:', triggeredFlow.name);
          await FlowEngine.startFlow(triggeredFlow, flowContext);
        } else {
          await FlowEngine.continueFlow(flowContext);
        }
      } catch (flowErr) {
        console.error('[WhatsAppStore] Error processing flow:', flowErr);
      }
    } catch (err) {
      console.error('[WhatsAppStore] Error processing message:', err);
    }
  },

  connect: async () => {
    set({ isConnecting: true, qrCode: null, error: null });

    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
        typeof window !== 'undefined' && !!(window as any).api
      );

    // --- ELECTRON ---
    if (isElectron && window.api?.whatsapp) {
      try {
        console.log('[WhatsAppStore] Connecting via Electron native API (WPPConnect)...');

        window.api.whatsapp.onQR((qr) => {
          console.log('[WhatsAppStore] QR received from Electron');
          set({ qrCode: qr, isConnecting: true });
        });

        window.api.whatsapp.onReady((user) => {
          console.log('[WhatsAppStore] Ready from Electron', user);
          set({
            isConnected: true,
            isConnecting: false,
            qrCode: null,
            connectionState: 'connected',
            user: user || null,
          });
          get().fetchConversations();
        });

        window.api.whatsapp.onStateChange((state) => {
          set({ connectionState: state as any });
        });

        window.api.whatsapp.onMessage((message) => {
          console.log('[WhatsAppStore] Message received from Electron', message);
          get().handleNewMessage(message);
        });

        window.api.whatsapp.onDisconnected(() => {
          console.log('[WhatsAppStore] Disconnected (Electron)');
          set({ isConnected: false, isConnecting: false, connectionState: 'disconnected' });
        });

        window.api.whatsapp.onLoggedOut(() => {
          console.log('[WhatsAppStore] Logged out (Electron)');
          set({
            isConnected: false,
            isConnecting: false,
            connectionState: 'disconnected',
            user: null,
          });
        });

        await window.api.whatsapp.connect();
        return;
      } catch (error: any) {
        console.error('[WhatsAppStore] Error connecting via Electron:', error);
        set({
          isConnecting: false,
          error: error.message || 'Error al conectar WhatsApp'
        });
        return;
      }
    }

    // --- WEB ---
    try {
      const { whatsappApiService } = await import('../services/whatsappApi');
      const { user } = useAuthStore.getState();

      console.log('[WhatsAppStore] Connecting via Web/Server...');

      // WebSocket Connection for Web
      if (!isElectron) {
        try {
          const { whatsappWebSocketService } = await import('../services/whatsappWebSocket');

          whatsappWebSocketService.onQR((qr) => {
            console.log('[WhatsAppStore] QR via WebSocket');
            set({ qrCode: qr, isConnecting: true });
          });

          whatsappWebSocketService.onReady((user) => {
            console.log('[WhatsAppStore] Ready via WebSocket', user);
            set({
              isConnected: true,
              isConnecting: false,
              qrCode: null,
              connectionState: 'connected',
              user: user || null,
            });
            get().fetchConversations();
          });

          whatsappWebSocketService.onMessage(async (message) => {
            get().handleNewMessage(message);
          });

          whatsappWebSocketService.connect(user?.id);
        } catch (wsErr) {
          console.warn('[WhatsAppStore] WebSocket service optional import failed or error:', wsErr);
        }
      }

      // API Connect Fallback/Init
      const result = await whatsappApiService.connect(user?.id);

      console.log('[WhatsAppStore] Connect API response:', {
        hasQR: !!result.qrCode,
        state: result.state,
        connected: result.connected
      });

      if (result.connected) {
        set({
          isConnected: true,
          isConnecting: false,
          connectionState: 'connected',
          qrCode: null
        });
        await get().fetchConversations();
      } else if (result.qrCode) {
        console.log('[WhatsAppStore] QR received from connect response');
        set({ qrCode: result.qrCode, isConnecting: true });
      } else {
        console.log('[WhatsAppStore] No QR in response, starting polling (backup)...');
        set({ isConnecting: true });

        let pollCount = 0;
        const pollInterval = setInterval(async () => {
          pollCount++;
          // Only poll if we don't have QR and are not connected
          if (get().qrCode && !get().isConnected) {
            // If we already have QR (maybe from socket), maybe we don't need to poll aggressively for QR, 
            // but we might need to poll for status if socket is not reliable.
            // For now, let's just poll for status check.
          }

          try {
            const qrResult = await whatsappApiService.getQR();
            if (qrResult.qrCode && !get().qrCode) {
              set({ qrCode: qrResult.qrCode, isConnecting: true });
            } else if (qrResult.status === 'connected') {
              set({
                isConnected: true,
                isConnecting: false,
                connectionState: 'connected',
                qrCode: null
              });
              clearInterval(pollInterval);
              await get().fetchConversations();
            }
          } catch (err) {
            // ignore poll error
          }

          if (pollCount > 60) clearInterval(pollInterval); // Stop after ~90s
        }, 1500);
      }

    } catch (err: any) {
      console.error('[WhatsAppStore] Error connecting:', err);
      set({
        isConnecting: false,
        error: err.message || 'Error al conectar WhatsApp'
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
      const { whatsappWebSocketService } = await import('../services/whatsappWebSocket');
      if (whatsappWebSocketService) whatsappWebSocketService.disconnect();
      return;
    }

    await window.api.whatsapp.disconnect();
    set({ isConnected: false, qrCode: null, connectionState: 'disconnected' });
  },

  checkSessionAndAutoConnect: async () => {
    const { isConnected, isConnecting } = get();
    if (isConnected || isConnecting) return;

    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
        typeof window !== 'undefined' && !!(window as any).api
      );

    if (isElectron && window.api?.whatsapp) {
      try {
        const sessionStatus = await window.api.whatsapp.checkSession();
        if (sessionStatus.hasSession && sessionStatus.isConnected) {
          console.log('[WhatsAppStore] Found active session, auto-connecting...');
          await get().connect();
        }
      } catch (err) {
        console.error('[WhatsAppStore] Error checking session:', err);
      }
    } else {
      try {
        const { whatsappApiService } = await import('../services/whatsappApi');
        const sessionStatus = await whatsappApiService.getStatus();
        if (sessionStatus.hasSession && sessionStatus.isConnected) {
          console.log('[WhatsAppStore] Found active session in web, auto-connecting...');
          await get().connect();
        }
      } catch (err) {
        // Silent fail
      }
    }
  },

  logout: async () => {
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
        typeof window !== 'undefined' && !!(window as any).api
      );

    set({
      isConnected: false,
      isConnecting: false,
      connectionState: 'disconnected',
      user: null,
      conversations: [],
      messages: [],
      currentConversation: null,
      qrCode: null
    });

    if (isElectron && window.api?.whatsapp) {
      await window.api.whatsapp.logout();
    } else {
      // Logic for web logout if needed via API
    }
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

      if (supabase && conversation.unread_count > 0) {
        await supabase
          .from('whatsapp_conversations')
          .update({ unread_count: 0 })
          .eq('id', conversationId);

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

    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
        typeof window !== 'undefined' && !!(window as any).api
      );

    // --- WEB SEND ---
    if (!isElectron || !window.api?.whatsapp) {
      try {
        const { whatsappWebSocketService } = await import('../services/whatsappWebSocket');
        const phoneNumber = currentConversation.phone || currentConversation.id;

        await whatsappWebSocketService.sendMessage(user?.id || 'default', phoneNumber, content);

        await supabase.from('whatsapp_messages').insert({
          conversation_id: currentConversation.id,
          from_number: 'me',
          content: content,
          type: 'text',
          status: 'sent',
          is_from_me: true,
          sent_by_user_id: user?.id || null
        });

        await get().fetchMessages(currentConversation.id);
        return;
      } catch (err: any) {
        console.error('[WhatsAppStore] Error sending message via WebSocket:', err);
        set({ error: err.message || 'Error al enviar mensaje via Web.' });
        return;
      }
    }

    // --- ELECTRON SEND ---
    try {
      let formattedContent = content;
      let displayContent = content;

      if (currentConversation.department && currentConversation.department.name) {
        formattedContent = `* ${currentConversation.department.name} *\n${content}`;
        displayContent = formattedContent;
      }

      const result = await window.api.whatsapp.sendMessage({
        to: currentConversation.phone,
        message: formattedContent,
        ...options,
      });

      const timestamp = result?.timestamp || Date.now();
      await supabase.from('whatsapp_messages').insert({
        conversation_id: currentConversation.id,
        from_number: 'me',
        content: displayContent,
        type: options.mediaType || 'text',
        is_from_me: true,
        timestamp,
        status: 'sent',
        sent_by_user_id: user?.id || null,
      });

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

    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
        typeof window !== 'undefined' && !!(window as any).api
      );

    if (!isElectron || !window.api?.whatsapp) {
      set({ error: 'Envío de media solo disponible en Electron por el momento (WIP).' });
      return;
    }

    try {
      let formattedCaption = options.caption;
      let displayContent = options.caption || options.fileName || `[${options.mediaType}]`;

      if (currentConversation.department && currentConversation.department.name && options.caption) {
        formattedCaption = `* ${currentConversation.department.name} *\n${options.caption}`;
        displayContent = formattedCaption;
      }

      const result = await window.api.whatsapp.sendMessage({
        to: currentConversation.phone,
        ...options,
        caption: formattedCaption || options.caption,
      });

      const timestamp = result?.timestamp || Date.now();

      await supabase.from('whatsapp_messages').insert({
        conversation_id: currentConversation.id,
        from_number: 'me',
        content: displayContent,
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

    if (!isElectron || !window.api?.whatsapp) return;

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

    if (!isElectron || !window.api?.whatsapp) return;

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

    if (!isElectron || !window.api?.whatsapp) return false;

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

    const { currentConversation, conversations } = get();
    if (currentConversation?.id === conversationId) {
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

      const updatedConversation: WhatsAppConversation = {
        ...currentConversation,
        department_id: departmentId || undefined,
        department: department || undefined,
      };

      set({ currentConversation: updatedConversation });
      set({
        conversations: conversations.map(c =>
          c.id === conversationId ? updatedConversation : c
        ),
      });
    } else {
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
