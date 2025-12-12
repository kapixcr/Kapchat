import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  Hash,
  Lock,
  Plus,
  Send,
  Search,
  Settings,
  Users,
  UserPlus,
  UserMinus,
  Edit3,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { useChannelStore } from '../store/channelStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { EmojiPickerButton } from '../components/EmojiPicker';
import { StickerPickerButton } from '../components/StickerPicker';
import { RichTextEditor } from '../components/RichTextEditor';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DOMPurify from 'dompurify';
import type { User } from '../types';

export function ChatPage() {
  const params = useParams();
  const channelId = params?.channelId as string | undefined;
  const router = useRouter();
  const { user, supabase } = useAuthStore();
  const {
    channels,
    currentChannel,
    messages,
    isLoadingMessages,
    fetchChannels,
    setCurrentChannel,
    sendMessage,
    createChannel,
    deleteChannel,
    subscribeToChannels,
    subscribeToAllMessages,
    unsubscribeAll,
    addMember,
    removeMember,
  } = useChannelStore();

  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', description: '', isPrivate: false });
  const [editChannel, setEditChannel] = useState({ name: '', description: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [channelMembers, setChannelMembers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChannels();
    subscribeToChannels();
    subscribeToAllMessages();
    
    return () => {
      unsubscribeAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (channelId) {
      // Pequeño delay para asegurar que todo esté inicializado en Electron
      const timer = setTimeout(() => {
        console.log('🔄 Setting current channel:', channelId);
        setCurrentChannel(channelId);
      }, 100);
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      // Si no hay channelId, limpiar suscripciones
      unsubscribeAll();
    }
    
    // Cleanup al cambiar de canal
    return () => {
      if (!channelId) {
        unsubscribeAll();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160;
    messagesEndRef.current?.scrollIntoView({ behavior: nearBottom ? 'smooth' : 'auto' });
  }, [messages, isLoadingMessages]);

  // Fallback: Si los mensajes están cargando por más de 5 segundos, intentar recargar
  useEffect(() => {
    if (isLoadingMessages && currentChannel) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Messages loading timeout, attempting to reload...');
        const { fetchMessages } = useChannelStore.getState();
        if (currentChannel) {
          fetchMessages(currentChannel.id);
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [isLoadingMessages, currentChannel]);

  // Cargar usuarios cuando se abre el modal de miembros
  useEffect(() => {
    if (showMembersModal && supabase && currentChannel) {
      loadUsersAndMembers();
    }
  }, [showMembersModal, currentChannel]);

  const loadUsersAndMembers = async () => {
    if (!supabase || !currentChannel) return;

    // Cargar todos los usuarios
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .order('name');
    
    setAllUsers(users || []);

    // Cargar miembros del canal
    const { data: members } = await supabase
      .from('channel_members')
      .select('user_id, users(*)')
      .eq('channel_id', currentChannel.id);

    const memberUsers = members?.map((m: any) => m.users).filter(Boolean) || [];
    setChannelMembers(memberUsers);
  };

  const sanitizeMessage = (html: string) =>
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'strong', 'u', 'i', 'em', 'code', 'pre', 'br', 'p', 'div', 'span'],
      ALLOWED_ATTR: [],
    });

  const getPlainText = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeMessage(newMessage);
    const plain = getPlainText(clean).trim();
    if (!plain) return;

    await sendMessage(clean);
    setNewMessage('');
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await createChannel(newChannel.name, newChannel.description, newChannel.isPrivate);
      setShowCreateModal(false);
      setNewChannel({ name: '', description: '', isPrivate: false });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditModal = () => {
    if (currentChannel) {
      setEditChannel({
        name: currentChannel.name,
        description: currentChannel.description || '',
      });
      setShowEditModal(true);
    }
  };

  const handleEditChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !currentChannel) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('channels')
        .update({
          name: editChannel.name,
          description: editChannel.description,
        })
        .eq('id', currentChannel.id);

      if (error) throw error;

      await fetchChannels();
      setShowEditModal(false);
    } catch (err) {
      console.error('Error updating channel:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChannel = async () => {
    if (!currentChannel) return;

    try {
      await deleteChannel(currentChannel.id);
      setShowDeleteConfirm(false);
      setShowEditModal(false);
      router.push('/chat');
    } catch (err) {
      console.error('Error deleting channel:', err);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!currentChannel) return;

    try {
      await addMember(currentChannel.id, userId);
      await loadUsersAndMembers();
    } catch (err) {
      console.error('Error adding member:', err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentChannel) return;

    try {
      await removeMember(currentChannel.id, userId);
      await loadUsersAndMembers();
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const publicChannels = filteredChannels.filter(c => !c.is_private);
  const privateChannels = filteredChannels.filter(c => c.is_private);

  const isChannelOwner = currentChannel?.created_by === user?.id;
  
  // Usuarios que no son miembros del canal
  const nonMembers = allUsers.filter(
    u => !channelMembers.some(m => m.id === u.id)
  ).filter(
    u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
         u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex min-h-0">
      {/* Channel List */}
      <div className="w-64 bg-kap-darker flex flex-col">
        {/* Header */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-white">Canales</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCreateModal(true)}
              icon={<Plus size={16} />}
            >
              Crear
            </Button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar canales..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-kap-surface text-sm text-zinc-200 placeholder-zinc-500 border border-kap-border focus:border-kap-accent focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Channel Lists */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Public Channels */}
          <div className="px-2">
            <div className="px-3 py-2">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Públicos
              </span>
            </div>
            {publicChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => router.push(`/chat/${channel.id}`)}
                className={`
                  channel-item w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 transition-colors
                  ${currentChannel?.id === channel.id
                    ? 'active bg-kap-accent/10 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}
                `}
              >
                <Hash size={18} className="text-zinc-500" />
                <span className="flex-1 truncate text-sm">{channel.name}</span>
                {channel.unread_count && channel.unread_count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-kap-accent text-[10px] text-white">
                    {channel.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Private Channels */}
          {privateChannels.length > 0 && (
            <div className="px-2 mt-4">
              <div className="px-3 py-2">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Privados
                </span>
              </div>
              {privateChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => router.push(`/chat/${channel.id}`)}
                  className={`
                    channel-item w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 transition-colors
                    ${currentChannel?.id === channel.id
                      ? 'active bg-kap-accent/10 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}
                  `}
                >
                  <Lock size={16} className="text-zinc-500" />
                  <span className="flex-1 truncate text-sm">{channel.name}</span>
                  {channel.unread_count && channel.unread_count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-kap-accent text-[10px] text-white">
                      {channel.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {currentChannel ? (
          <>
            {/* Channel Header */}
            <div className="h-14 px-6 flex items-center justify-between bg-kap-surface/50">
              <div className="flex items-center gap-3">
                {currentChannel.is_private ? (
                  <Lock size={18} className="text-zinc-500" />
                ) : (
                  <Hash size={18} className="text-zinc-500" />
                )}
                <div>
                  <h3 className="font-medium text-white">{currentChannel.name}</h3>
                  {currentChannel.description && (
                    <p className="text-xs text-zinc-500">{currentChannel.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  icon={<Users size={16} />}
                  onClick={() => setShowMembersModal(true)}
                  title="Miembros del canal"
                />
                {isChannelOwner && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    icon={<Settings size={16} />}
                    onClick={handleOpenEditModal}
                    title="Configuración del canal"
                  />
                )}
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4"
            >
              {isLoadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-kap-surface-light border border-kap-border flex items-center justify-center mb-4 animate-pulse">
                    <Hash size={28} className="text-zinc-500" />
                  </div>
                  <p className="text-sm text-zinc-500">Cargando mensajes...</p>
                  <p className="text-xs text-zinc-600 mt-2">Si tarda mucho, verifica la consola</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-kap-surface-light border border-kap-border flex items-center justify-center mb-4">
                    <Hash size={28} className="text-zinc-500" />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">
                    Bienvenido a #{currentChannel.name}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Este es el inicio del canal. ¡Envía el primer mensaje!
                  </p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const showAvatar =
                    index === 0 ||
                    messages[index - 1].user_id !== message.user_id;
                  const isOwn = message.user_id === user?.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      {showAvatar ? (
                        <Avatar
                          name={message.user?.name || 'Usuario'}
                          src={message.user?.avatar}
                          size="md"
                        />
                      ) : (
                        <div className="w-10" />
                      )}
                      <div className={`max-w-[70%] ${isOwn ? 'items-end' : ''}`}>
                        {showAvatar && (
                          <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm font-medium text-zinc-300">
                              {message.user?.name || 'Usuario'}
                            </span>
                            <span className="text-xs text-zinc-600">
                              {format(new Date(message.created_at), 'HH:mm', { locale: es })}
                            </span>
                          </div>
                        )}
                        <div
                          className={`
                            px-4 py-2.5 rounded-2xl
                            ${isOwn
                              ? 'bg-kap-accent text-white rounded-tr-md'
                              : 'bg-kap-surface-light text-zinc-200 rounded-tl-md'}
                          `}
                        >
                          <div
                            className="text-sm prose prose-invert prose-p:my-1 prose-pre:my-2 max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizeMessage(message.content) }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4">
              <div className="flex items-start gap-3">
                <EmojiPickerButton
                  onEmojiClick={(emoji) => setNewMessage((prev) => prev + emoji)}
                />
                <StickerPickerButton
                  onStickerSelect={async (stickerUrl) => {
                    // Enviar sticker como imagen en el chat
                    if (currentChannel && supabase && user) {
                      await sendMessage(`<img src="${stickerUrl}" alt="sticker" />`, 'image');
                    }
                  }}
                />
                <div className="flex-1">
                  <RichTextEditor
                    value={newMessage}
                    onChange={setNewMessage}
                    placeholder={`Mensaje en #${currentChannel.name}`}
                  />
                </div>
                <Button type="submit" icon={<Send size={18} />} disabled={!getPlainText(newMessage).trim()}>
                  Enviar
                </Button>
              </div>
            </form>
          </>
        ) : (
          <EmptyState
            icon={<Hash size={40} />}
            title="Selecciona un canal"
            description="Elige un canal de la lista o crea uno nuevo para comenzar a chatear"
            action={
              <Button onClick={() => setShowCreateModal(true)} icon={<Plus size={16} />}>
                Crear canal
              </Button>
            }
          />
        )}
      </div>

      {/* Create Channel Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear nuevo canal"
      >
        <form onSubmit={handleCreateChannel} className="space-y-4">
          <Input
            label="Nombre del canal"
            placeholder="general"
            value={newChannel.name}
            onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
            required
          />

          <Input
            label="Descripción (opcional)"
            placeholder="¿De qué trata este canal?"
            value={newChannel.description}
            onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
          />

          <label className="flex items-center gap-3 p-3 rounded-xl bg-kap-surface-light border border-kap-border cursor-pointer hover:border-kap-accent transition-colors">
            <input
              type="checkbox"
              checked={newChannel.isPrivate}
              onChange={(e) => setNewChannel({ ...newChannel, isPrivate: e.target.checked })}
              className="w-4 h-4 rounded border-kap-border text-kap-accent focus:ring-kap-accent"
            />
            <div>
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-zinc-400" />
                <span className="text-sm font-medium text-zinc-200">Canal privado</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Solo los miembros invitados pueden ver este canal
              </p>
            </div>
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Crear canal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Members Modal */}
      <Modal
        isOpen={showMembersModal}
        onClose={() => {
          setShowMembersModal(false);
          setUserSearchQuery('');
        }}
        title="Miembros del canal"
        size="md"
      >
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar usuarios..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-kap-surface-light text-sm text-zinc-200 placeholder-zinc-500 border border-kap-border focus:border-kap-accent focus:outline-none transition-colors"
            />
          </div>

          {/* Current Members */}
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-2">
              Miembros actuales ({channelMembers.length})
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {channelMembers.length === 0 ? (
                <p className="text-sm text-zinc-500 py-2">No hay miembros en este canal</p>
              ) : (
                channelMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-kap-surface-light"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="sm" status={member.status} />
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{member.name}</p>
                        <p className="text-xs text-zinc-500">{member.email}</p>
                      </div>
                    </div>
                    {isChannelOwner && member.id !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remover del canal"
                      >
                        <UserMinus size={16} />
                      </button>
                    )}
                    {member.id === currentChannel?.created_by && (
                      <Badge variant="info">Creador</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Members */}
          {isChannelOwner && (
            <div>
              <h4 className="text-sm font-medium text-zinc-400 mb-2">
                Agregar miembros
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {nonMembers.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-2">
                    {userSearchQuery ? 'No se encontraron usuarios' : 'Todos los usuarios ya son miembros'}
                  </p>
                ) : (
                  nonMembers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-kap-surface-light"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" status={u.status} />
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{u.name}</p>
                          <p className="text-xs text-zinc-500">{u.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddMember(u.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        title="Agregar al canal"
                      >
                        <UserPlus size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Channel Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar canal"
      >
        <form onSubmit={handleEditChannel} className="space-y-4">
          <Input
            label="Nombre del canal"
            value={editChannel.name}
            onChange={(e) => setEditChannel({ ...editChannel, name: e.target.value })}
            required
          />

          <Input
            label="Descripción"
            placeholder="¿De qué trata este canal?"
            value={editChannel.description}
            onChange={(e) => setEditChannel({ ...editChannel, description: e.target.value })}
          />

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              icon={<Trash2 size={16} />}
            >
              Eliminar canal
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowEditModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative bg-kap-surface border border-kap-border rounded-2xl p-6 max-w-sm animate-scale-in">
              <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar canal?</h3>
              <p className="text-sm text-zinc-400 mb-6">
                Esta acción no se puede deshacer. Se eliminarán todos los mensajes del canal.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={handleDeleteChannel}>
                  Sí, eliminar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
