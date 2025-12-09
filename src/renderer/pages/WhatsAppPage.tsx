import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  QrCode,
  Send,
  Search,
  Phone,
  UserPlus,
  Check,
  CheckCheck,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  Paperclip,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Play,
  Download,
} from 'lucide-react';
import { useWhatsAppStore } from '../store/whatsappStore';
import { useAgentStore } from '../store/agentStore';
import { useDepartmentsStore } from '../store/departmentsStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { EmojiPickerButton } from '../components/EmojiPicker';
import { StickerPickerButton } from '../components/StickerPicker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function WhatsAppPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { agents, fetchAgents } = useAgentStore();
  const { departments, fetchDepartments } = useDepartmentsStore();
  const {
    isConnected,
    isConnecting,
    qrCode,
    conversations,
    currentConversation,
    messages,
    connect,
    disconnect,
    checkSessionAndAutoConnect,
    fetchConversations,
    setCurrentConversation,
    sendMessage,
    sendMediaMessage,
    assignAgent,
    assignDepartment,
    updateStatus,
  } = useWhatsAppStore();

  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'assigned' | 'resolved'>('all');
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificar sesión y auto-conectar al cargar la página
  useEffect(() => {
    checkSessionAndAutoConnect();
  }, [checkSessionAndAutoConnect]);

  useEffect(() => {
    if (isConnected) {
      fetchConversations();
    }
    fetchAgents();
    fetchDepartments();
  }, [isConnected, fetchConversations, fetchAgents, fetchDepartments]);

  useEffect(() => {
    if (conversationId && isConnected) {
      setCurrentConversation(conversationId);
    }
  }, [conversationId, isConnected, setCurrentConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    await sendMessage(newMessage.trim());
    setNewMessage('');
  };

  const handleAssign = async (agentId: string) => {
    if (currentConversation) {
      await assignAgent(currentConversation.id, agentId);
      if (selectedDepartmentId !== null) {
        await assignDepartment(currentConversation.id, selectedDepartmentId);
      }
      setShowAssignModal(false);
      setSelectedDepartmentId(null);
    }
  };

  const handleDepartmentChange = async (departmentId: string | null) => {
    if (currentConversation) {
      await assignDepartment(currentConversation.id, departmentId);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentConversation) return;

    try {
      // Determine media type
      let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
      if (file.type.startsWith('image/')) {
        mediaType = 'image';
      } else if (file.type.startsWith('video/')) {
        mediaType = 'video';
      } else if (file.type.startsWith('audio/')) {
        mediaType = 'audio';
      }

      // Convert file to base64 or use file path
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        await sendMediaMessage({
          mediaUrl: base64,
          mediaType,
          fileName: file.name,
          caption: mediaType === 'image' || mediaType === 'video' ? newMessage.trim() || undefined : undefined,
        });
        
        setNewMessage('');
        setShowMediaMenu(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error sending file:', error);
      alert(`Error al enviar archivo: ${error.message}`);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredConversations = conversations.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);
    const matchesFilter = filter === 'all' || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pendiente</Badge>;
      case 'assigned':
        return <Badge variant="info">Asignado</Badge>;
      case 'resolved':
        return <Badge variant="success">Resuelto</Badge>;
      default:
        return null;
    }
  };

  // Not connected - show QR or connect button
  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center p-8 gradient-mesh">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-3xl bg-kap-whatsapp/20 flex items-center justify-center mx-auto mb-8">
            <MessageCircle size={48} className="text-kap-whatsapp" />
          </div>

          {isConnecting && qrCode ? (
            <>
              <h2 className="text-2xl font-display font-bold text-white mb-4">
                Escanea el código QR
              </h2>
              <p className="text-zinc-400 mb-8">
                Abre WhatsApp en tu teléfono, ve a Configuración → Dispositivos vinculados → Vincular un dispositivo
              </p>
              <div className="inline-block p-4 bg-white rounded-2xl mb-8">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
              <Button variant="ghost" onClick={disconnect}>
                Cancelar
              </Button>
            </>
          ) : isConnecting ? (
            <>
              <h2 className="text-2xl font-display font-bold text-white mb-4">
                Conectando...
              </h2>
              <div className="flex items-center justify-center gap-3 text-zinc-400">
                <Loader2 size={24} className="animate-spin" />
                <span>Generando código QR</span>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-display font-bold text-white mb-4">
                Conectar WhatsApp
              </h2>
              <p className="text-zinc-400 mb-8">
                Vincula tu cuenta de WhatsApp para recibir y responder mensajes desde Kapchat
              </p>
              <Button
                size="lg"
                onClick={connect}
                icon={<QrCode size={20} />}
                className="bg-kap-whatsapp hover:bg-kap-whatsapp/90"
              >
                Conectar con QR
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex min-h-0">
      {/* Conversation List */}
      <div className="w-80 bg-kap-darker flex flex-col min-h-0">
        {/* Header */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-display font-semibold text-white">WhatsApp</h2>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-kap-whatsapp/20">
                <Wifi size={12} className="text-kap-whatsapp" />
                <span className="text-[10px] text-kap-whatsapp font-medium">Conectado</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchConversations}
              icon={<RefreshCw size={14} />}
            />
          </div>
          
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-kap-surface text-sm text-zinc-200 placeholder-zinc-500 border border-kap-border focus:border-kap-whatsapp focus:outline-none transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1">
            {['all', 'pending', 'assigned', 'resolved'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`
                  flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${filter === f
                    ? 'bg-kap-whatsapp/20 text-kap-whatsapp'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                `}
              >
                {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendiente' : f === 'assigned' ? 'Asignado' : 'Resuelto'}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => navigate(`/whatsapp/${conversation.id}`)}
              className={`
                w-full flex items-start gap-3 p-4 border-b border-kap-border/20 transition-colors relative
                ${currentConversation?.id === conversation.id
                  ? 'bg-kap-whatsapp/10'
                  : 'hover:bg-white/5'}
              `}
              style={{
                borderLeft: conversation.department?.color 
                  ? `4px solid ${conversation.department.color}` 
                  : undefined
              }}
            >
              <Avatar name={conversation.name} size="md" />
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-medium text-zinc-200 truncate">
                      {conversation.name}
                    </span>
                    {conversation.department && (
                      <span 
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white flex-shrink-0"
                        style={{ backgroundColor: conversation.department.color }}
                      >
                        {conversation.department.name}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 flex-shrink-0">
                    {conversation.last_message_at &&
                      format(new Date(conversation.last_message_at), 'HH:mm')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-zinc-500 truncate flex-1">
                    {conversation.last_message || 'Sin mensajes'}
                  </p>
                  {conversation.unread_count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-kap-whatsapp text-[10px] text-white font-medium">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
                <div className="mt-1.5">
                  {getStatusBadge(conversation.status)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 flex items-center justify-between bg-kap-surface/50">
              <div className="flex items-center gap-3">
                <Avatar name={currentConversation.name} size="md" />
                <div>
                  <h3 className="font-medium text-white">{currentConversation.name}</h3>
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-zinc-500" />
                    <span className="text-xs text-zinc-500">{currentConversation.phone}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={currentConversation.department_id || ''}
                  onChange={(e) => handleDepartmentChange(e.target.value || null)}
                  className="px-3 py-1.5 rounded-lg bg-kap-surface-light border text-sm text-zinc-300 focus:outline-none focus:border-kap-accent"
                  style={{ 
                    borderColor: currentConversation.department?.color || 'var(--kap-border)',
                  }}
                >
                  <option value="">Sin departamento</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {currentConversation.assigned_agent ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-kap-surface-light">
                    <Avatar name={currentConversation.assigned_agent.name} size="sm" />
                    <span className="text-sm text-zinc-300">
                      {currentConversation.assigned_agent.name}
                    </span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowAssignModal(true)}
                    icon={<UserPlus size={14} />}
                  >
                    Asignar
                  </Button>
                )}
                <select
                  value={currentConversation.status}
                  onChange={(e) => updateStatus(currentConversation.id, e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg bg-kap-surface-light border border-kap-border text-sm text-zinc-300 focus:outline-none focus:border-kap-accent"
                >
                  <option value="pending">Pendiente</option>
                  <option value="assigned">Asignado</option>
                  <option value="resolved">Resuelto</option>
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyYTJhMzUiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTJoLTJ2Mmgyem0tNCA2aC0ydi00aDJ2NHptMC02di0yaC0ydjJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] bg-kap-dark">
              {messages.map((message, index) => {
                const showAgentName = message.is_from_me && message.sent_by_user && 
                  (index === 0 || messages[index - 1].sent_by_user_id !== message.sent_by_user_id || !messages[index - 1].is_from_me);
                
                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${message.is_from_me ? 'items-end' : 'items-start'}`}
                  >
                    {showAgentName && (
                      <div className="mb-1.5 px-2 flex items-center gap-2">
                        {message.sent_by_user?.avatar ? (
                          <img 
                            src={message.sent_by_user.avatar} 
                            alt={message.sent_by_user.name}
                            className="w-4 h-4 rounded-full"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-kap-accent flex items-center justify-center">
                            <span className="text-[8px] text-white font-semibold">
                              {message.sent_by_user?.name?.charAt(0).toUpperCase() || 'A'}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-zinc-400 font-medium">
                          {message.sent_by_user?.name || 'Agente'}
                        </span>
                      </div>
                    )}
                    <div
                      className={`
                        max-w-[70%] px-4 py-2.5 rounded-2xl
                        ${message.is_from_me
                          ? 'bg-kap-whatsapp text-white rounded-tr-md'
                          : 'bg-kap-surface-light text-zinc-200 rounded-tl-md'}
                      `}
                    >
                      {/* Render media based on message type */}
                      {message.type === 'image' && message.media_url && (
                        <div className="mb-2 rounded-lg overflow-hidden">
                          <img
                            src={message.media_url}
                            alt={message.caption || 'Imagen'}
                            className="max-w-full max-h-64 object-contain cursor-pointer"
                            onClick={() => window.open(message.media_url, '_blank')}
                          />
                        </div>
                      )}
                      
                      {message.type === 'video' && message.media_url && (
                        <div className="mb-2 rounded-lg overflow-hidden">
                          <video
                            src={message.media_url}
                            controls
                            className="max-w-full max-h-64"
                          />
                        </div>
                      )}
                      
                      {message.type === 'audio' && message.media_url && (
                        <div className="mb-2 flex items-center gap-2">
                          <Music size={20} className={message.is_from_me ? 'text-white/70' : 'text-zinc-400'} />
                          <audio
                            src={message.media_url}
                            controls
                            className="flex-1"
                          />
                        </div>
                      )}
                      
                      {message.type === 'document' && message.media_url && (
                        <div className="mb-2 flex items-center gap-2 p-2 rounded-lg bg-black/20">
                          <File size={20} className={message.is_from_me ? 'text-white/70' : 'text-zinc-400'} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${message.is_from_me ? 'text-white' : 'text-zinc-200'}`}>
                              {message.file_name || 'Documento'}
                            </p>
                            {message.caption && (
                              <p className={`text-xs mt-1 ${message.is_from_me ? 'text-white/70' : 'text-zinc-400'}`}>
                                {message.caption}
                              </p>
                            )}
                          </div>
                          <a
                            href={message.media_url}
                            download={message.file_name}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            title="Descargar"
                          >
                            <Download size={16} className={message.is_from_me ? 'text-white/70' : 'text-zinc-400'} />
                          </a>
                        </div>
                      )}
                      
                      {message.type === 'sticker' && message.media_url && (
                        <div className="mb-2">
                          <img
                            src={message.media_url}
                            alt="Sticker"
                            className="max-w-48 max-h-48 object-contain"
                          />
                        </div>
                      )}
                      
                      {/* Show caption or content */}
                      {(message.caption || (message.type === 'text' && message.content)) && (
                        <p className={`text-sm whitespace-pre-wrap ${message.type !== 'text' ? 'mt-2' : ''}`}>
                          {message.caption || message.content}
                        </p>
                      )}
                      
                      <div className={`flex items-center gap-1 mt-1 ${message.is_from_me ? 'justify-end' : ''}`}>
                        <span className={`text-[10px] ${message.is_from_me ? 'text-white/70' : 'text-zinc-500'}`}>
                          {format(new Date(message.timestamp), 'HH:mm')}
                        </span>
                        {message.is_from_me && (
                          message.status === 'read' 
                            ? <CheckCheck size={14} className="text-blue-300" />
                            : <Check size={14} className="text-white/70" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-kap-surface/50">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMediaMenu(!showMediaMenu)}
                    icon={<Paperclip size={18} />}
                    className="text-zinc-400 hover:text-zinc-200"
                  />
                  {showMediaMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowMediaMenu(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-2 p-2 bg-kap-surface border border-kap-border rounded-xl shadow-2xl z-50 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowMediaMenu(false);
                          }}
                          className="p-3 rounded-lg hover:bg-kap-surface-light transition-colors flex flex-col items-center gap-1"
                          title="Imagen"
                        >
                          <ImageIcon size={20} className="text-zinc-400" />
                          <span className="text-xs text-zinc-500">Imagen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowMediaMenu(false);
                          }}
                          className="p-3 rounded-lg hover:bg-kap-surface-light transition-colors flex flex-col items-center gap-1"
                          title="Video"
                        >
                          <Video size={20} className="text-zinc-400" />
                          <span className="text-xs text-zinc-500">Video</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowMediaMenu(false);
                          }}
                          className="p-3 rounded-lg hover:bg-kap-surface-light transition-colors flex flex-col items-center gap-1"
                          title="Audio"
                        >
                          <Music size={20} className="text-zinc-400" />
                          <span className="text-xs text-zinc-500">Audio</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowMediaMenu(false);
                          }}
                          className="p-3 rounded-lg hover:bg-kap-surface-light transition-colors flex flex-col items-center gap-1"
                          title="Archivo"
                        >
                          <File size={20} className="text-zinc-400" />
                          <span className="text-xs text-zinc-500">Archivo</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <EmojiPickerButton
                  onEmojiClick={(emoji) => setNewMessage((prev) => prev + emoji)}
                />
                <StickerPickerButton
                  onStickerSelect={(stickerUrl) => {
                    // Enviar sticker como imagen
                    if (currentConversation) {
                      sendMediaMessage({
                        mediaUrl: stickerUrl,
                        mediaType: 'image',
                      });
                    }
                  }}
                />
                <input
                  type="text"
                  placeholder="Escribe un mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-kap-surface-light border border-kap-border text-zinc-200 placeholder-zinc-500 focus:border-kap-whatsapp focus:outline-none transition-colors"
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim()}
                  icon={<Send size={18} />}
                  className="bg-kap-whatsapp hover:bg-kap-whatsapp/90"
                >
                  Enviar
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,*/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </form>
          </>
        ) : (
          <EmptyState
            icon={<MessageCircle size={40} />}
            title="Selecciona una conversación"
            description="Elige una conversación de la lista para ver los mensajes"
          />
        )}
      </div>

      {/* Assign Agent Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedDepartmentId(null);
        }}
        title="Asignar agente"
      >
        <div className="space-y-4">
          {/* Department Selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Departamento
            </label>
            <select
              value={selectedDepartmentId || currentConversation?.department_id || ''}
              onChange={(e) => {
                const deptId = e.target.value || null;
                setSelectedDepartmentId(deptId);
                handleDepartmentChange(deptId);
              }}
              className="w-full px-3 py-2 rounded-lg bg-kap-surface-light border border-kap-border text-sm text-zinc-300 focus:outline-none focus:border-kap-accent"
            >
              <option value="">Sin departamento</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Agents List */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Agente
            </label>
            <div className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAssign(agent.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-kap-surface-light transition-colors"
                >
                  <Avatar name={agent.name} status={agent.status} size="md" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-zinc-200">{agent.name}</p>
                    <p className="text-xs text-zinc-500">{agent.email}</p>
                  </div>
                  <Badge variant={agent.status === 'online' ? 'success' : 'default'}>
                    {agent.status}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

