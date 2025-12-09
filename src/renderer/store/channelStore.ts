import { create } from 'zustand';
import type { Channel, Message } from '../types';
import { useAuthStore } from './authStore';
import { RealtimeChannel } from '@supabase/supabase-js';
import { notificationService } from '../services/notifications';

interface ChannelState {
  channels: Channel[];
  currentChannel: Channel | null;
  messages: Message[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  realtimeSubscription: RealtimeChannel | null;
  messagesSubscription: RealtimeChannel | null;
  allMessagesSubscription: RealtimeChannel | null;
  isRealtimeConnected: boolean;
  lastMessageIds: Set<string>;
  fetchChannels: () => Promise<void>;
  createChannel: (name: string, description: string, isPrivate: boolean, members?: string[]) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  setCurrentChannel: (channelId: string) => Promise<void>;
  fetchMessages: (channelId: string) => Promise<void>;
  sendMessage: (content: string, type?: 'text' | 'image' | 'file') => Promise<void>;
  subscribeToChannels: () => void;
  subscribeToMessages: (channelId: string) => void;
  subscribeToAllMessages: () => void;
  unsubscribeAll: () => void;
  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: (channelId: string) => Promise<void>;
  addMember: (channelId: string, userId: string) => Promise<void>;
  removeMember: (channelId: string, userId: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  currentChannel: null,
  messages: [],
  isLoading: false,
  isLoadingMessages: false,
  realtimeSubscription: null,
  messagesSubscription: null,
  allMessagesSubscription: null,
  isRealtimeConnected: false,
  lastMessageIds: new Set(),

  fetchChannels: async () => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) return;

    set({ isLoading: true });

    try {
      const { data: publicChannels } = await supabase
        .from('channels')
        .select('*')
        .eq('is_private', false)
        .order('created_at', { ascending: true });

      const { data: memberChannels } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id);

      const memberChannelIds = memberChannels?.map(m => m.channel_id) || [];

      const { data: ownedChannels } = await supabase
        .from('channels')
        .select('*')
        .eq('is_private', true)
        .eq('created_by', user.id)
        .order('created_at', { ascending: true });

      let privateChannels: Channel[] = ownedChannels || [];
      
      if (memberChannelIds.length > 0) {
        const { data } = await supabase
          .from('channels')
          .select('*')
          .eq('is_private', true)
          .in('id', memberChannelIds)
          .order('created_at', { ascending: true });
        
        const existingIds = new Set(privateChannels.map(c => c.id));
        const additionalChannels = (data || []).filter(c => !existingIds.has(c.id));
        privateChannels = [...privateChannels, ...additionalChannels];
      }

      const allChannels = [...(publicChannels || []), ...privateChannels];
      
      // Obtener el último mensaje de cada canal para calcular unread_count
      // Usar localStorage para guardar el último mensaje visto
      const lastReadMap = new Map<string, string>();
      try {
        const saved = localStorage.getItem('kapchat_channel_reads');
        if (saved) {
          const parsed = JSON.parse(saved);
          Object.entries(parsed).forEach(([channelId, timestamp]) => {
            lastReadMap.set(channelId, timestamp as string);
          });
        }
      } catch (err) {
        console.warn('Error loading channel reads:', err);
      }

      // Obtener el último mensaje de cada canal
      const channelsWithUnread = await Promise.all(
        allChannels.map(async (channel) => {
          const lastReadAt = lastReadMap.get(channel.id);
          
          if (!lastReadAt) {
            // Si nunca ha leído, contar todos los mensajes que no son del usuario
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('channel_id', channel.id)
              .neq('user_id', user.id);
            
            return { ...channel, unread_count: count || 0 };
          }

          // Contar mensajes después del último leído
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', channel.id)
            .neq('user_id', user.id)
            .gt('created_at', lastReadAt);

          return { ...channel, unread_count: count || 0 };
        })
      );

      set({ channels: channelsWithUnread, isLoading: false });
    } catch (err) {
      console.error('Error in fetchChannels:', err);
      set({ isLoading: false });
    }
  },

  createChannel: async (name, description, isPrivate, members = []) => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) return;

    const { data: channel, error } = await supabase
      .from('channels')
      .insert({
        name,
        description,
        is_private: isPrivate,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating channel:', error);
      throw error;
    }

    if (isPrivate && channel) {
      await supabase.from('channel_members').insert({
        channel_id: channel.id,
        user_id: user.id,
      });

      for (const memberId of members) {
        await supabase.from('channel_members').insert({
          channel_id: channel.id,
          user_id: memberId,
        });
      }
    }

    await get().fetchChannels();
  },

  deleteChannel: async (channelId) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    await supabase.from('channels').delete().eq('id', channelId);
    await get().fetchChannels();
  },

  setCurrentChannel: async (channelId) => {
    const { channels, messagesSubscription, currentChannel } = get();
    
    // Si ya estamos en este canal, no hacer nada
    if (currentChannel?.id === channelId) {
      console.log('⏭️ Already in this channel, skipping');
      return;
    }
    
    // Validar que el channelId existe
    if (!channelId) {
      console.warn('⚠️ No channelId provided');
      return;
    }
    
    // Limpiar suscripción anterior antes de cambiar
    if (messagesSubscription) {
      const { supabase } = useAuthStore.getState();
      if (supabase) {
        try {
          console.log('🔌 Unsubscribing from previous channel messages');
          supabase.removeChannel(messagesSubscription);
        } catch (err) {
          console.error('Error removing previous subscription:', err);
        }
      }
    }
    
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      console.warn('⚠️ Channel not found:', channelId, 'Available channels:', channels.map(c => c.id));
      // Intentar recargar canales
      await get().fetchChannels();
      const updatedChannels = get().channels;
      const foundChannel = updatedChannels.find(c => c.id === channelId);
      if (!foundChannel) {
        console.error('❌ Channel still not found after refresh');
        return;
      }
      
      // Establecer el canal primero
      set({ 
        currentChannel: foundChannel, 
        messagesSubscription: null,
      });
      
      // Cargar mensajes y suscribirse
      try {
        console.log('🔄 Loading channel data for:', channelId);
        await get().fetchMessages(channelId);
        console.log('✅ Messages loaded, subscribing to realtime...');
        get().subscribeToMessages(channelId);
      } catch (err) {
        console.error('❌ Error loading channel:', err);
        // Aún así intentar cargar mensajes sin suscripción
        try {
          await get().fetchMessages(channelId);
        } catch (fetchErr) {
          console.error('❌ Failed to fetch messages after error:', fetchErr);
        }
      }
      return;
    }
    
    // Establecer el canal primero
    set({ 
      currentChannel: channel, 
      messagesSubscription: null,
      messages: [],
      lastMessageIds: new Set(),
      isLoadingMessages: true,
    });
    
      // Cargar mensajes y suscribirse
      try {
        console.log('🔄 Loading channel data for:', channelId);
        
        // Primero cargar mensajes (esto debe funcionar siempre)
        const fetchPromise = get().fetchMessages(channelId);
        await fetchPromise;
        console.log('✅ Messages loaded');
        
        // Marcar como leído cuando se abre el canal
        const { messages } = get();
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          const lastReadMap: Record<string, string> = {};
          try {
            const saved = localStorage.getItem('kapchat_channel_reads');
            if (saved) {
              Object.assign(lastReadMap, JSON.parse(saved));
            }
          } catch (err) {
            console.warn('Error loading channel reads:', err);
          }
          lastReadMap[channelId] = lastMessage.created_at;
          localStorage.setItem('kapchat_channel_reads', JSON.stringify(lastReadMap));
          
          // Actualizar unread_count del canal
          set((state) => ({
            channels: state.channels.map(c => 
              c.id === channelId ? { ...c, unread_count: 0 } : c
            ),
          }));
        }
        
        // Luego intentar suscribirse (puede fallar en Electron, pero no es crítico)
        // Hacerlo de forma asíncrona para no bloquear
        setTimeout(() => {
          try {
            console.log('📡 Attempting to subscribe to realtime...');
            get().subscribeToMessages(channelId);
          } catch (subscribeErr) {
            console.warn('⚠️ Realtime subscription failed (non-critical):', subscribeErr);
            // No es crítico si falla, los mensajes ya están cargados
          }
        }, 500);
      } catch (err) {
        console.error('❌ Error loading channel:', err);
        // Aún así intentar cargar mensajes sin suscripción
        try {
          await get().fetchMessages(channelId);
        } catch (fetchErr) {
          console.error('❌ Failed to fetch messages after error:', fetchErr);
          // Forzar que se complete el loading
          set({ isLoadingMessages: false });
        }
      }
  },

  fetchMessages: async (channelId) => {
    const { supabase, session } = useAuthStore.getState();
    if (!supabase) {
      console.error('❌ No supabase client available for fetchMessages');
      set({ isLoadingMessages: false, messages: [] });
      return;
    }

    // Verificar sesión antes de hacer la query
    if (!session) {
      console.error('❌ No session available for fetchMessages');
      set({ isLoadingMessages: false, messages: [] });
      return;
    }

    console.log('📥 Fetching messages for channel:', channelId);
    console.log('🔐 Session user ID:', session.user?.id);
    set({ isLoadingMessages: true });

    // Timeout más corto para detectar problemas más rápido
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ fetchMessages timeout after 5s, forcing completion');
      set({ isLoadingMessages: false, messages: [] });
    }, 5000); // 5 segundos máximo

    try {
      console.log('🔍 Step 1: Testing Supabase connection...');
      
      // Primero verificar que podemos hacer una query simple
      const testQuery = await supabase
        .from('messages')
        .select('id')
        .eq('channel_id', channelId)
        .limit(1);
      
      console.log('🔍 Test query result:', { 
        hasData: !!testQuery.data, 
        hasError: !!testQuery.error,
        error: testQuery.error?.message 
      });

      if (testQuery.error) {
        console.error('❌ Test query failed:', testQuery.error);
        clearTimeout(timeoutId);
        set({ messages: [], isLoadingMessages: false });
        return;
      }

      console.log('🔍 Step 2: Executing full messages query...');
      
      // Ahora hacer la query completa
      const simpleQueryPromise = supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100);

      // Usar Promise.race para detectar si la query se cuelga
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => 
        setTimeout(() => resolve({ data: null, error: { message: 'Query timeout after 4 seconds' } }), 4000)
      );

      const result = await Promise.race([
        simpleQueryPromise,
        timeoutPromise
      ]);

      const { data: messagesData, error: messagesError } = result;

      clearTimeout(timeoutId);

      if (messagesError) {
        console.error('❌ Error fetching messages:', messagesError);
        console.error('Error details:', {
          message: messagesError.message,
          details: messagesError.details,
          hint: messagesError.hint,
          code: messagesError.code,
        });
        set({ messages: [], isLoadingMessages: false });
        return;
      }

      console.log(`✅ Step 2 complete: Loaded ${messagesData?.length || 0} raw messages`);

      if (!messagesData || messagesData.length === 0) {
        console.log('ℹ️ No messages found for this channel');
        set({ 
          messages: [], 
          lastMessageIds: new Set(),
          isLoadingMessages: false,
        });
        return;
      }

      // Step 3: Obtener usuarios para los mensajes
      console.log('🔍 Step 3: Fetching user data...');
      const userIds = [...new Set(messagesData.map((m: any) => m.user_id))];
      
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);

      if (usersError) {
        console.warn('⚠️ Error fetching users, using messages without user data:', usersError);
      }

      // Combinar mensajes con usuarios
      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));
      const messagesWithUsers = messagesData.map((m: any) => ({
        ...m,
        user: usersMap.get(m.user_id) || null,
      }));

      console.log(`✅ Step 3 complete: Combined ${messagesWithUsers.length} messages with user data`);
      
      if (messagesWithUsers.length > 0) {
        console.log('📋 Sample message:', {
          id: messagesWithUsers[0].id,
          content: messagesWithUsers[0].content?.substring(0, 50),
          user: messagesWithUsers[0].user?.name || 'Unknown',
        });
      }

      // Guardar IDs de mensajes existentes
      const messageIds = new Set(messagesWithUsers.map((m: any) => m.id));
      set({ 
        messages: messagesWithUsers, 
        lastMessageIds: messageIds,
        isLoadingMessages: false,
      });
      
      console.log('✅ Messages state updated, isLoadingMessages set to false');
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('❌ Exception fetching messages:', err);
      console.error('Exception details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      set({ messages: [], isLoadingMessages: false });
    }
  },

  sendMessage: async (content, type = 'text') => {
    const { supabase, user } = useAuthStore.getState();
    const { currentChannel, lastMessageIds } = get();
    if (!supabase || !user || !currentChannel) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    
    // Mensaje optimista
    const optimisticMessage: Message = {
      id: tempId,
      channel_id: currentChannel.id,
      user_id: user.id,
      content,
      type,
      created_at: new Date().toISOString(),
      user: user,
    };

    // Agregar a la lista de IDs conocidos y mostrar
    const newIds = new Set(lastMessageIds);
    newIds.add(tempId);
    set((state) => ({
      messages: [...state.messages, optimisticMessage],
      lastMessageIds: newIds,
    }));

    try {
      const { data, error } = await supabase.from('messages').insert({
        channel_id: currentChannel.id,
        user_id: user.id,
        content,
        type,
      }).select(`*, user:users(*)`).single();

      if (error) {
        set((state) => ({
          messages: state.messages.filter(m => m.id !== tempId),
        }));
        throw error;
      }

      // Reemplazar optimista con real y actualizar IDs conocidos
      if (data) {
        const updatedIds = new Set(get().lastMessageIds);
        updatedIds.delete(tempId);
        updatedIds.add(data.id);
        
        set((state) => ({
          messages: state.messages.map(m => m.id === tempId ? data : m),
          lastMessageIds: updatedIds,
        }));
      }
    } catch (err) {
      set((state) => ({
        messages: state.messages.filter(m => m.id !== tempId),
      }));
      throw err;
    }
  },

  subscribeToChannels: () => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) {
      console.warn('❌ No supabase client available for channels subscription');
      return;
    }

    console.log('🔍 Checking Supabase client:', {
      hasClient: !!supabase,
      realtimeEnabled: !!supabase.realtime,
    });

    const { realtimeSubscription, isRealtimeConnected } = get();
    
    // Si ya está conectado, no suscribirse de nuevo
    if (isRealtimeConnected && realtimeSubscription) {
      console.log('⏭️ Already subscribed to channels');
      return;
    }
    
    if (realtimeSubscription) {
      try {
        console.log('🔌 Removing existing channels subscription');
        supabase.removeChannel(realtimeSubscription);
      } catch (err) {
        console.error('Error removing channels subscription:', err);
      }
    }

    console.log('🔌 Subscribing to channels...');

    const subscription = supabase
      .channel('db-channels')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
        },
        async (payload) => {
          console.log('📢 Channel event received:', payload.eventType, payload);
          try {
            await get().fetchChannels();
          } catch (err) {
            console.error('Error fetching channels after event:', err);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Channels subscription status:', status, err ? `Error: ${err.message || err}` : '');
        set({ isRealtimeConnected: status === 'SUBSCRIBED' });
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to channels');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.error('❌ Channels subscription error:', {
            status,
            error: err,
            errorMessage: err?.message,
            errorStack: err?.stack,
          });
          // Solo reconectar una vez, evitar loops
          const { realtimeSubscription: currentSub } = get();
          if (currentSub === subscription) {
            setTimeout(() => {
              const { isRealtimeConnected: stillConnected } = get();
              if (!stillConnected) {
                console.log('🔄 Reconnecting channels subscription...');
                get().subscribeToChannels();
              }
            }, 2000);
          }
        }
      });

    set({ realtimeSubscription: subscription });
  },

  subscribeToMessages: (channelId) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) {
      console.warn('⚠️ No supabase client available for messages subscription');
      return;
    }

    const { messagesSubscription, currentChannel } = get();
    
    // Si ya hay una suscripción activa para este canal, no crear otra
    if (messagesSubscription && currentChannel?.id === channelId) {
      console.log('⏭️ Already subscribed to this channel');
      return;
    }

    // Limpiar suscripción anterior si existe
    if (messagesSubscription) {
      console.log('🔌 Removing previous subscription');
      try {
        supabase.removeChannel(messagesSubscription);
      } catch (err) {
        console.warn('⚠️ Error removing previous subscription:', err);
      }
    }

    console.log('🔌 Subscribing to messages for channel:', channelId);

    try {
      const subscription = supabase
        .channel(`db-messages-${channelId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${channelId}`,
          },
          async (payload) => {
            console.log('📨 New message event:', payload);
            
            const newMsg = payload.new as any;
            if (!newMsg?.id) return;

            // Verificar que estamos en el canal correcto
            const { currentChannel: current } = get();
            if (current?.id !== channelId) {
              console.log('⏭️ Not in this channel anymore, ignoring');
              return;
            }

            // Verificar si ya tenemos este mensaje
            const { lastMessageIds, messages } = get();
            if (lastMessageIds.has(newMsg.id) || messages.some(m => m.id === newMsg.id)) {
              console.log('⏭️ Message already exists, skipping');
              return;
            }

            // Obtener mensaje completo con usuario
            try {
              const { data } = await supabase
                .from('messages')
                .select(`*, user:users(*)`)
                .eq('id', newMsg.id)
                .single();

              if (data) {
                console.log('✅ Adding new message from:', data.user?.name);
                
                const updatedIds = new Set(get().lastMessageIds);
                updatedIds.add(data.id);
                
                set((state) => ({
                  messages: [...state.messages, data],
                  lastMessageIds: updatedIds,
                }));
              }
            } catch (fetchErr) {
              console.error('❌ Error fetching new message:', fetchErr);
            }
          }
        )
        .subscribe((status, err) => {
          console.log('📡 Messages subscription status:', status, err ? `Error: ${err.message || err}` : '');
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to messages');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' || err) {
            console.warn('⚠️ Messages subscription issue (non-critical, messages will still load on refresh):', {
              status,
              error: err?.message || err,
            });
            // No intentar reconectar automáticamente para evitar loops
            // Los mensajes se pueden recargar manualmente o al cambiar de canal
          }
        });

      set({ messagesSubscription: subscription });
    } catch (err) {
      console.error('❌ Error creating messages subscription:', err);
      // No es crítico, los mensajes ya están cargados
    }
  },

  subscribeToAllMessages: () => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) {
      console.warn('⚠️ No supabase client available for all messages subscription');
      return;
    }

    const { allMessagesSubscription } = get();
    
    if (allMessagesSubscription) {
      console.log('⏭️ Already subscribed to all messages');
      return;
    }

    // Limpiar suscripción anterior si existe
    if (allMessagesSubscription) {
      console.log('🔌 Removing previous all messages subscription');
      try {
        supabase.removeChannel(allMessagesSubscription);
      } catch (err) {
        console.warn('⚠️ Error removing previous all messages subscription:', err);
      }
    }

    console.log('🔌 Subscribing to all messages for badges and notifications...');

    try {
      const subscription = supabase
        .channel('db-all-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload) => {
            const newMsg = payload.new as any;
            if (!newMsg?.id || !newMsg?.channel_id) return;

            // Ignorar mensajes propios
            if (newMsg.user_id === user.id) return;

            const { currentChannel, channels } = get();
            const channel = channels.find(c => c.id === newMsg.channel_id);
            
            if (!channel) return;

            // Si estamos en este canal, no hacer nada (ya se maneja en subscribeToMessages)
            if (currentChannel?.id === newMsg.channel_id) {
              return;
            }

            // Obtener información del mensaje y usuario
            try {
              const { data } = await supabase
                .from('messages')
                .select(`*, user:users(*)`)
                .eq('id', newMsg.id)
                .single();

              if (data && data.user) {
                // Actualizar badge del canal
                const lastReadMap: Record<string, string> = {};
                try {
                  const saved = localStorage.getItem('kapchat_channel_reads');
                  if (saved) {
                    Object.assign(lastReadMap, JSON.parse(saved));
                  }
                } catch (err) {
                  console.warn('Error loading channel reads:', err);
                }

                const lastReadAt = lastReadMap[newMsg.channel_id];
                const isUnread = !lastReadAt || new Date(newMsg.created_at) > new Date(lastReadAt);

                if (isUnread) {
                  // Actualizar unread_count
                  set((state) => ({
                    channels: state.channels.map(c =>
                      c.id === newMsg.channel_id
                        ? { ...c, unread_count: (c.unread_count || 0) + 1 }
                        : c
                    ),
                  }));

                  // Mostrar notificación
                  notificationService.notifyChannelMessage(
                    channel.name,
                    data.user.name || 'Usuario',
                    newMsg.content || ''
                  );
                }
              }
            } catch (fetchErr) {
              console.error('❌ Error fetching new message for badge:', fetchErr);
            }
          }
        )
        .subscribe((status, err) => {
          console.log('📡 All messages subscription status:', status, err ? `Error: ${err.message || err}` : '');
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to all messages');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
            console.warn('⚠️ All messages subscription issue:', {
              status,
              error: err?.message || err,
            });
          }
        });

      set({ allMessagesSubscription: subscription });
    } catch (err) {
      console.error('❌ Error creating all messages subscription:', err);
    }
  },

  unsubscribeAll: () => {
    const { supabase } = useAuthStore.getState();
    const { realtimeSubscription, messagesSubscription, allMessagesSubscription } = get();
    
    console.log('🔌 Unsubscribing from all channels...');
    
    if (supabase) {
      if (realtimeSubscription) {
        try {
          supabase.removeChannel(realtimeSubscription);
        } catch (err) {
          console.error('Error removing realtime subscription:', err);
        }
      }
      if (messagesSubscription) {
        try {
          supabase.removeChannel(messagesSubscription);
        } catch (err) {
          console.error('Error removing messages subscription:', err);
        }
      }
      if (allMessagesSubscription) {
        try {
          supabase.removeChannel(allMessagesSubscription);
        } catch (err) {
          console.error('Error removing all messages subscription:', err);
        }
      }
    }
    
    set({ 
      realtimeSubscription: null, 
      messagesSubscription: null,
      allMessagesSubscription: null,
      isRealtimeConnected: false,
      messages: [],
      lastMessageIds: new Set(),
    });
  },

  joinChannel: async (channelId) => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) return;

    await supabase.from('channel_members').insert({
      channel_id: channelId,
      user_id: user.id,
    });

    await get().fetchChannels();
  },

  leaveChannel: async (channelId) => {
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) return;

    await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', user.id);

    await get().fetchChannels();
    set({ currentChannel: null, messages: [] });
  },

  addMember: async (channelId, userId) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    await supabase.from('channel_members').insert({
      channel_id: channelId,
      user_id: userId,
    });
  },

  removeMember: async (channelId, userId) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId);
  },
}));
