import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  User,
  Circle,
} from 'lucide-react';
import { useDirectMessageStore, DirectConversation } from '../store/directMessageStore';
import { useAgentStore } from '../store/agentStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { EmojiPickerButton } from '../components/EmojiPicker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { User as UserType } from '../types';

export function DirectMessagesPage() {
  const params = useParams();
  const conversationId = params?.conversationId as string | undefined;
  const router = useRouter();
  const { user } = useAuthStore();
  const { agents, fetchAgents } = useAgentStore();
  const {
    conversations,
    currentConversation,
    messages,
    fetchConversations,
    getOrCreateConversation,
    setCurrentConversation,
    sendMessage,
    subscribeToConversations,
    subscribeToAllMessages,
    unsubscribeAll,
  } = useDirectMessageStore();

  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    fetchAgents();
    subscribeToConversations();
    subscribeToAllMessages();

    return () => {
      unsubscribeAll();
    };
  }, []);

  useEffect(() => {
    if (conversationId) {
      setCurrentConversation(conversationId);
    }
  }, [conversationId, setCurrentConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await sendMessage(newMessage.trim());
    setNewMessage('');
  };

  const handleStartChat = async (otherUser: UserType) => {
    try {
      const convId = await getOrCreateConversation(otherUser.id);
      setShowNewChatModal(false);
      setUserSearchQuery('');
      router.push(`/direct-messages/${convId}`);
    } catch (err) {
      console.error('Error starting chat:', err);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.other_user?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Usuarios disponibles para iniciar chat (que no sean el usuario actual)
  const availableUsers = agents.filter(
    (a) =>
      a.id !== user?.id &&
      (a.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        a.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'text-emerald-500';
      case 'away':
        return 'text-amber-500';
      case 'busy':
        return 'text-red-500';
      default:
        return 'text-zinc-500';
    }
  };

  return (
    <div className="h-full flex">
      {/* Conversations List */}
      <div className="w-80 bg-kap-darker flex flex-col">
        {/* Header */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-white">
              Mensajes Directos
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowNewChatModal(true)}
              icon={<Plus size={16} />}
            >
              Nuevo
            </Button>
          </div>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-kap-surface text-sm text-zinc-200 placeholder-zinc-500 border border-kap-border focus:border-kap-accent focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-zinc-500">
                {searchQuery
                  ? 'No se encontraron conversaciones'
                  : 'No hay conversaciones aún'}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => setShowNewChatModal(true)}
              >
                Iniciar una conversación
              </Button>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => router.push(`/direct-messages/${conversation.id}`)}
                className={`
                  w-full flex items-center gap-3 p-4 border-b border-kap-border/20 transition-colors
                  ${
                    currentConversation?.id === conversation.id
                      ? 'bg-kap-accent/10'
                      : 'hover:bg-white/5'
                  }
                `}
              >
                <div className="relative">
                  <Avatar
                    name={conversation.other_user?.name || 'Usuario'}
                    size="md"
                  />
                  <Circle
                    size={10}
                    className={`absolute -bottom-0.5 -right-0.5 fill-current ${getStatusColor(
                      conversation.other_user?.status
                    )}`}
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-zinc-200 truncate">
                      {conversation.other_user?.name || 'Usuario'}
                    </span>
                    {conversation.last_message_at && (
                      <span className="text-[10px] text-zinc-500 flex-shrink-0 ml-2">
                        {format(
                          new Date(conversation.last_message_at),
                          'HH:mm'
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-zinc-500 truncate flex-1">
                      {conversation.last_message || 'Sin mensajes'}
                    </p>
                    {conversation.unread_count && conversation.unread_count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-kap-accent text-[10px] text-white font-medium">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            {/* Header */}
            <div className="h-16 px-6 flex items-center gap-4 bg-kap-surface/50">
              <div className="relative">
                <Avatar
                  name={currentConversation.other_user?.name || 'Usuario'}
                  size="md"
                />
                <Circle
                  size={10}
                  className={`absolute -bottom-0.5 -right-0.5 fill-current ${getStatusColor(
                    currentConversation.other_user?.status
                  )}`}
                />
              </div>
              <div>
                <h3 className="font-medium text-white">
                  {currentConversation.other_user?.name || 'Usuario'}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {currentConversation.other_user?.email}
                  </span>
                  <Badge
                    variant={
                      currentConversation.other_user?.status === 'online'
                        ? 'success'
                        : 'default'
                    }
                    size="sm"
                  >
                    {currentConversation.other_user?.status || 'offline'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-kap-surface-light border border-kap-border flex items-center justify-center mb-4">
                    <MessageSquare size={28} className="text-zinc-500" />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">
                    Inicia la conversación
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Envía un mensaje a{' '}
                    {currentConversation.other_user?.name || 'este usuario'}
                  </p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.sender_id === user?.id;
                  const showAvatar =
                    index === 0 ||
                    messages[index - 1].sender_id !== message.sender_id;

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      {showAvatar ? (
                        <Avatar
                          name={message.sender?.name || 'Usuario'}
                          size="md"
                        />
                      ) : (
                        <div className="w-10" />
                      )}
                      <div className={`max-w-[70%] ${isOwn ? 'items-end' : ''}`}>
                        {showAvatar && (
                          <div
                            className={`flex items-center gap-2 mb-1 ${
                              isOwn ? 'flex-row-reverse' : ''
                            }`}
                          >
                            <span className="text-sm font-medium text-zinc-300">
                              {message.sender?.name || 'Usuario'}
                            </span>
                            <span className="text-xs text-zinc-600">
                              {format(new Date(message.created_at), 'HH:mm', {
                                locale: es,
                              })}
                            </span>
                          </div>
                        )}
                        <div
                          className={`
                            px-4 py-2.5 rounded-2xl
                            ${
                              isOwn
                                ? 'bg-kap-accent text-white rounded-tr-md'
                                : 'bg-kap-surface-light text-zinc-200 rounded-tl-md'
                            }
                          `}
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-4"
            >
              <div className="flex items-center gap-3">
                <EmojiPickerButton
                  onEmojiClick={(emoji) => setNewMessage((prev) => prev + emoji)}
                />
                <input
                  type="text"
                  placeholder={`Mensaje a ${currentConversation.other_user?.name || 'usuario'}...`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-kap-surface-light border border-kap-border text-zinc-200 placeholder-zinc-500 focus:border-kap-accent focus:outline-none transition-colors"
                />
                <Button
                  type="submit"
                  icon={<Send size={18} />}
                  disabled={!newMessage.trim()}
                >
                  Enviar
                </Button>
              </div>
            </form>
          </>
        ) : (
          <EmptyState
            icon={<MessageSquare size={40} />}
            title="Mensajes Directos"
            description="Selecciona una conversación o inicia una nueva para chatear con un agente"
            action={
              <Button
                onClick={() => setShowNewChatModal(true)}
                icon={<Plus size={16} />}
              >
                Nueva conversación
              </Button>
            }
          />
        )}
      </div>

      {/* New Chat Modal */}
      <Modal
        isOpen={showNewChatModal}
        onClose={() => {
          setShowNewChatModal(false);
          setUserSearchQuery('');
        }}
        title="Nueva conversación"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Buscar agente..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-kap-surface-light text-sm text-zinc-200 placeholder-zinc-500 border border-kap-border focus:border-kap-accent focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {availableUsers.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">
                {userSearchQuery
                  ? 'No se encontraron usuarios'
                  : 'No hay usuarios disponibles'}
              </p>
            ) : (
              availableUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleStartChat(u)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-kap-surface-light transition-colors"
                >
                  <Avatar name={u.name} size="md" status={u.status} />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-zinc-200">{u.name}</p>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </div>
                  <Badge
                    variant={u.status === 'online' ? 'success' : 'default'}
                  >
                    {u.status}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

