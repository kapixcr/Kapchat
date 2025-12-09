import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { User } from '../types';
import { notificationService } from '../services/notifications';

export interface DirectConversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
  other_user?: User;
  unread_count?: number;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'file';
  is_read: boolean;
  created_at: string;
  sender?: User;
}

interface DirectMessageState {
  conversations: DirectConversation[];
  currentConversation: DirectConversation | null;
  messages: DirectMessage[];
  isLoading: boolean;
  realtimeSubscription: RealtimeChannel | null;
  messagesSubscription: RealtimeChannel | null;
  allMessagesSubscription: RealtimeChannel | null;
  lastMessageIds: Set<string>;
  fetchConversations: () => Promise<void>;
  getOrCreateConversation: (otherUserId: string) => Promise<string>;
  setCurrentConversation: (conversationId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  subscribeToConversations: () => void;
  subscribeToMessages: (conversationId: string) => void;
  subscribeToAllMessages: () => void;
  unsubscribeAll: () => void;
}

export const useDirectMessageStore = create<DirectMessageState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  realtimeSubscription: null,
  messagesSubscription: null,
  allMessagesSubscription: null,
  lastMessageIds: new Set(),

  fetchConversations: async () => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) return;

    set({ isLoading: true });

    try {
      const { data: conversations, error } = await supabase
        .from('direct_conversations')
        .select(`
          *,
          user1:users!direct_conversations_user1_id_fkey(*),
          user2:users!direct_conversations_user2_id_fkey(*)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        set({ isLoading: false });
        return;
      }

      const processedConversations = (conversations || []).map((conv: any) => {
        const otherUser = conv.user1_id === user.id ? conv.user2 : conv.user1;
        return {
          ...conv,
          other_user: otherUser,
          unread_count: 0,
        };
      });

      const { data: unreadCounts } = await supabase
        .from('direct_messages')
        .select('conversation_id')
        .eq('is_read', false)
        .neq('sender_id', user.id);

      if (unreadCounts) {
        const countMap = new Map<string, number>();
        unreadCounts.forEach((msg: any) => {
          countMap.set(msg.conversation_id, (countMap.get(msg.conversation_id) || 0) + 1);
        });
        
        processedConversations.forEach((conv: DirectConversation) => {
          conv.unread_count = countMap.get(conv.id) || 0;
        });
      }

      set({ conversations: processedConversations, isLoading: false });
    } catch (err) {
      console.error('Error in fetchConversations:', err);
      set({ isLoading: false });
    }
  },

  getOrCreateConversation: async (otherUserId: string) => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) throw new Error('No autenticado');

    const { data: existing } = await supabase
      .from('direct_conversations')
      .select('id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`)
      .single();

    if (existing) {
      return existing.id;
    }

    const { data: newConv, error } = await supabase
      .from('direct_conversations')
      .insert({
        user1_id: user.id,
        user2_id: otherUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }

    await get().fetchConversations();
    return newConv.id;
  },

  setCurrentConversation: async (conversationId: string) => {
    const { conversations, messagesSubscription, currentConversation } = get();
    
    // Si ya estamos en esta conversación, no hacer nada
    if (currentConversation?.id === conversationId) {
      return;
    }
    
    // Limpiar suscripción anterior antes de cambiar
    if (messagesSubscription) {
      const { supabase } = useAuthStore.getState();
      if (supabase) {
        console.log('🔌 Unsubscribing from previous DM messages');
        supabase.removeChannel(messagesSubscription);
      }
    }
    
    const conversation = conversations.find(c => c.id === conversationId);
    
    if (conversation) {
      // Limpiar mensajes y IDs antes de cargar nuevos
      set({ 
        currentConversation: conversation, 
        messages: [],
        lastMessageIds: new Set(),
        messagesSubscription: null,
      });
      
      await get().fetchMessages(conversationId);
      await get().markAsRead(conversationId);
      get().subscribeToMessages(conversationId);
    }
  },

  fetchMessages: async (conversationId: string) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    const { data, error } = await supabase
      .from('direct_messages')
      .select(`
        *,
        sender:users(*)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    const messageIds = new Set((data || []).map(m => m.id));
    set({ messages: data || [], lastMessageIds: messageIds });
  },

  sendMessage: async (content: string) => {
    const { supabase, user } = useAuthStore.getState();
    const { currentConversation, lastMessageIds } = get();
    if (!supabase || !user || !currentConversation) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;

    const optimisticMessage: DirectMessage = {
      id: tempId,
      conversation_id: currentConversation.id,
      sender_id: user.id,
      content,
      type: 'text',
      is_read: false,
      created_at: new Date().toISOString(),
      sender: user,
    };

    const newIds = new Set(lastMessageIds);
    newIds.add(tempId);
    set((state) => ({
      messages: [...state.messages, optimisticMessage],
      lastMessageIds: newIds,
    }));

    try {
      const { data, error } = await supabase.from('direct_messages').insert({
        conversation_id: currentConversation.id,
        sender_id: user.id,
        content,
        type: 'text',
      }).select(`*, sender:users(*)`).single();

      if (error) {
        set((state) => ({
          messages: state.messages.filter(m => m.id !== tempId),
        }));
        throw error;
      }

      if (data) {
        const updatedIds = new Set(get().lastMessageIds);
        updatedIds.delete(tempId);
        updatedIds.add(data.id);
        
        set((state) => ({
          messages: state.messages.map(m => m.id === tempId ? data : m),
          lastMessageIds: updatedIds,
        }));
      }

      await supabase
        .from('direct_conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', currentConversation.id);
    } catch (err) {
      set((state) => ({
        messages: state.messages.filter(m => m.id !== tempId),
      }));
      throw err;
    }
  },

  markAsRead: async (conversationId: string) => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) return;

    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  },

  subscribeToConversations: () => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) {
      console.warn('No supabase client available');
      return;
    }

    const { realtimeSubscription } = get();
    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);
    }

    console.log('🔌 Subscribing to DM conversations...');

    const subscription = supabase
      .channel('db-dm-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_conversations',
        },
        async () => {
          console.log('📢 DM conversation changed');
          await get().fetchConversations();
        }
      )
      .subscribe((status, err) => {
        console.log('📡 DM conversations subscription:', status, err || '');
      });

    set({ realtimeSubscription: subscription });
  },

  subscribeToMessages: (conversationId: string) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) {
      console.warn('No supabase client available');
      return;
    }

    const { messagesSubscription, currentConversation } = get();
    
    // Si ya hay una suscripción activa para esta conversación, no crear otra
    if (messagesSubscription && currentConversation?.id === conversationId) {
      console.log('📡 Already subscribed to this conversation');
      return;
    }

    // Limpiar suscripción anterior si existe
    if (messagesSubscription) {
      console.log('🔌 Removing previous DM subscription');
      supabase.removeChannel(messagesSubscription);
    }

    console.log('🔌 Subscribing to DM messages for:', conversationId);

    const subscription = supabase
      .channel(`db-dm-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          console.log('📨 New DM event:', payload);
          
          const newMsg = payload.new as any;
          if (!newMsg?.id) return;

          // Verificar que estamos en la conversación correcta
          const { currentConversation: current } = get();
          if (current?.id !== conversationId) {
            console.log('⏭️ Not in this conversation anymore, ignoring');
            return;
          }

          const { lastMessageIds, messages } = get();
          if (lastMessageIds.has(newMsg.id) || messages.some(m => m.id === newMsg.id)) {
            console.log('⏭️ DM already exists, skipping');
            return;
          }

          const { data } = await supabase
            .from('direct_messages')
            .select(`*, sender:users(*)`)
            .eq('id', newMsg.id)
            .single();

          if (data) {
            console.log('✅ Adding new DM from:', data.sender?.name);
            
            const updatedIds = new Set(get().lastMessageIds);
            updatedIds.add(data.id);
            
            set((state) => ({
              messages: [...state.messages, data],
              lastMessageIds: updatedIds,
            }));

            await get().markAsRead(conversationId);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('📡 DM messages subscription:', status, err || '');
        
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.error('❌ DM subscription error, attempting to reconnect...', err);
          // Intentar reconectar después de un delay
          setTimeout(() => {
            const { currentConversation: current } = get();
            if (current?.id === conversationId) {
              console.log('🔄 Reconnecting DM subscription...');
              get().subscribeToMessages(conversationId);
            }
          }, 2000);
        }
      });

    set({ messagesSubscription: subscription });
  },

  subscribeToAllMessages: () => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) {
      console.warn('⚠️ No supabase client available for all DM messages subscription');
      return;
    }

    const { allMessagesSubscription } = get();
    
    if (allMessagesSubscription) {
      console.log('⏭️ Already subscribed to all DM messages');
      return;
    }

    // Limpiar suscripción anterior si existe
    if (allMessagesSubscription) {
      console.log('🔌 Removing previous all DM messages subscription');
      try {
        supabase.removeChannel(allMessagesSubscription);
      } catch (err) {
        console.warn('⚠️ Error removing previous all DM messages subscription:', err);
      }
    }

    console.log('🔌 Subscribing to all DM messages for badges and notifications...');

    try {
      const subscription = supabase
        .channel('db-all-dm-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
          },
          async (payload) => {
            const newMsg = payload.new as any;
            if (!newMsg?.id || !newMsg?.conversation_id) return;

            // Ignorar mensajes propios
            if (newMsg.sender_id === user.id) return;

            const { currentConversation, conversations } = get();
            const conversation = conversations.find(c => c.id === newMsg.conversation_id);
            
            if (!conversation) {
              // Si no tenemos la conversación, recargar
              await get().fetchConversations();
              return;
            }

            // Si estamos en esta conversación, no hacer nada (ya se maneja en subscribeToMessages)
            if (currentConversation?.id === newMsg.conversation_id) {
              return;
            }

            // Obtener información del mensaje y usuario
            try {
              const { data } = await supabase
                .from('direct_messages')
                .select(`*, sender:users(*)`)
                .eq('id', newMsg.id)
                .single();

              if (data && data.sender) {
                // Actualizar badge de la conversación
                set((state) => ({
                  conversations: state.conversations.map(c =>
                    c.id === newMsg.conversation_id
                      ? { ...c, unread_count: (c.unread_count || 0) + 1 }
                      : c
                  ),
                }));

                // Mostrar notificación
                notificationService.notifyDirectMessage(
                  data.sender.name || 'Usuario',
                  newMsg.content || ''
                );
              }
            } catch (fetchErr) {
              console.error('❌ Error fetching new DM for badge:', fetchErr);
            }
          }
        )
        .subscribe((status, err) => {
          console.log('📡 All DM messages subscription status:', status, err ? `Error: ${err.message || err}` : '');
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to all DM messages');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
            console.warn('⚠️ All DM messages subscription issue:', {
              status,
              error: err?.message || err,
            });
          }
        });

      set({ allMessagesSubscription: subscription });
    } catch (err) {
      console.error('❌ Error creating all DM messages subscription:', err);
    }
  },

  unsubscribeAll: () => {
    const { supabase } = useAuthStore.getState();
    const { realtimeSubscription, messagesSubscription, allMessagesSubscription } = get();
    
    console.log('🔌 Unsubscribing from DM channels...');
    
    if (supabase) {
      if (realtimeSubscription) {
        try {
          supabase.removeChannel(realtimeSubscription);
        } catch (err) {
          console.error('Error removing DM realtime subscription:', err);
        }
      }
      if (messagesSubscription) {
        try {
          supabase.removeChannel(messagesSubscription);
        } catch (err) {
          console.error('Error removing DM messages subscription:', err);
        }
      }
      if (allMessagesSubscription) {
        try {
          supabase.removeChannel(allMessagesSubscription);
        } catch (err) {
          console.error('Error removing all DM messages subscription:', err);
        }
      }
    }
    
    set({ 
      realtimeSubscription: null, 
      messagesSubscription: null,
      allMessagesSubscription: null,
      messages: [],
      lastMessageIds: new Set(),
    });
  },
}));
