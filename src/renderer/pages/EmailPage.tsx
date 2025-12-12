import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Send,
  Search,
  Paperclip,
  Reply,
  UserPlus,
  Inbox,
  Clock,
  CheckCircle,
  RefreshCw,
  Settings,
  Loader2,
} from 'lucide-react';
import { useEmailStore } from '../store/emailStore';
import { useAgentStore } from '../store/agentStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function EmailPage() {
  const params = useParams();
  const emailId = params?.emailId as string | undefined;
  const router = useRouter();
  const { config } = useAuthStore();
  const { agents, fetchAgents } = useAgentStore();
  const {
    isConnected,
    isConnecting,
    isSyncing,
    syncError,
    emails,
    currentEmail,
    connect,
    fetchEmails,
    syncEmails,
    setCurrentEmail,
    sendEmail,
    assignAgent,
    updateStatus,
  } = useEmailStore();

  // Verificar si estamos en Electron
  const isElectron = (
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
  ) || (
    typeof window !== 'undefined' && !!(window as any).api
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'assigned' | 'resolved'>('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState({ to: '', subject: '', body: '' });
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchAgents();
    if (isConnected) {
      fetchEmails();
    }
  }, [isConnected, fetchEmails, fetchAgents]);

  useEffect(() => {
    if (emailId && isConnected) {
      setCurrentEmail(emailId);
    }
  }, [emailId, isConnected, setCurrentEmail]);

  useEffect(() => {
    // Verificar si estamos en Electron antes de intentar conectar
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron) {
      // En web, email no está disponible, no intentar conectar
      return;
    }

    const saved = localStorage.getItem('kapchat_email_password') || '';
    if (saved && !emailPassword) {
      setEmailPassword(saved);
    }
    if (!isConnected && config?.email_user && saved) {
      connect().catch((err) => {
        // Solo loguear errores, no mostrar al usuario si es porque no está en Electron
        if (!err.message?.includes('Electron')) {
          console.error('[EmailPage] Error connecting:', err);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, config?.email_user]);

  const handleConnect = async () => {
    // Verificar si estamos en Electron
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron) {
      alert('La funcionalidad de Email solo está disponible en la aplicación de escritorio de Electron.');
      return;
    }

    if (!emailPassword) {
      setShowConfigModal(true);
      return;
    }
    localStorage.setItem('kapchat_email_password', emailPassword);
    try {
      await connect();
    } catch (err: any) {
      // El error ya se maneja en el store
      console.error('[EmailPage] Error connecting:', err);
    }
  };

  const handleSavePassword = async () => {
    // Verificar si estamos en Electron
    const isElectron = (
      typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
    ) || (
      typeof window !== 'undefined' && !!(window as any).api
    );

    if (!isElectron) {
      alert('La funcionalidad de Email solo está disponible en la aplicación de escritorio de Electron.');
      setShowConfigModal(false);
      return;
    }

    if (!emailPassword) return;
    localStorage.setItem('kapchat_email_password', emailPassword);
    setShowConfigModal(false);
    try {
      await connect();
    } catch (err: any) {
      // El error ya se maneja en el store
      console.error('[EmailPage] Error connecting:', err);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      await sendEmail(newEmail.to, newEmail.subject, `<p>${newEmail.body}</p>`);
      setShowComposeModal(false);
      setNewEmail({ to: '', subject: '', body: '' });
    } finally {
      setIsSending(false);
    }
  };

  const handleAssign = async (agentId: string) => {
    if (currentEmail) {
      await assignAgent(currentEmail.id, agentId);
      setShowAssignModal(false);
    }
  };

  const filteredEmails = emails.filter(e => {
    const matchesSearch =
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.from_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || e.status === filter;
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

  // Not connected - show connect option
  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center p-8 gradient-mesh">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-3xl bg-kap-email/20 flex items-center justify-center mx-auto mb-8">
            <Mail size={48} className="text-kap-email" />
          </div>

          {!isElectron ? (
            <>
              <h2 className="text-2xl font-display font-bold text-white mb-4">
                Email no disponible en Web
              </h2>
              <p className="text-zinc-400 mb-6">
                La funcionalidad de Email solo está disponible en la aplicación de escritorio de Electron.
                <br /><br />
                Por favor, descarga e instala la aplicación de escritorio para usar esta funcionalidad.
              </p>
              <Button
                variant="ghost"
                onClick={() => router.push('/settings')}
                icon={<Settings size={16} />}
              >
                Ir a Ajustes
              </Button>
            </>
          ) : isConnecting ? (
            <>
              <h2 className="text-2xl font-display font-bold text-white mb-4">
                Conectando...
              </h2>
              <div className="flex items-center justify-center gap-3 text-zinc-400">
                <Loader2 size={24} className="animate-spin" />
                <span>Estableciendo conexión con el servidor de correo</span>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-display font-bold text-white mb-4">
                Conectar Email
              </h2>
              <p className="text-zinc-400 mb-6">
                Conecta tu cuenta de Google Workspace para recibir y enviar correos desde Kapchat
              </p>
              
              {config?.email_user ? (
                <div className="mb-6 p-4 rounded-xl bg-kap-surface border border-kap-border">
                  <p className="text-sm text-zinc-400 mb-1">Cuenta configurada:</p>
                  <p className="text-zinc-200 font-medium">{config.email_user}</p>
                </div>
              ) : (
                <p className="text-amber-400 text-sm mb-6">
                  Configura tu cuenta de email en Ajustes primero
                </p>
              )}

              {syncError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6">
                  {syncError}
                </div>
              )}

              <div className="space-y-3">
                <Button
                  size="lg"
                  onClick={handleConnect}
                  icon={<Mail size={20} />}
                  className="bg-kap-email hover:bg-kap-email/90"
                  disabled={!config?.email_user}
                >
                  Conectar Email
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => router.push('/settings')}
                  icon={<Settings size={16} />}
                >
                  Ir a Ajustes
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Password Modal */}
        <Modal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          title="Contraseña de aplicación"
        >
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Ingresa tu contraseña de aplicación de Google. Puedes generarla en tu cuenta de Google → Seguridad → Contraseñas de aplicaciones.
            </p>
            <Input
              type="password"
              label="Contraseña de aplicación"
              placeholder="••••••••••••••••"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowConfigModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSavePassword}>
                Guardar y conectar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Email List */}
      <div className="w-96 bg-kap-darker flex flex-col">
        {/* Header */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-display font-semibold text-white">Correos</h2>
              <Badge variant="success">Conectado</Badge>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={syncEmails}
                isLoading={isSyncing}
                disabled={isSyncing}
                icon={<RefreshCw size={14} />}
              />
              <Button
                size="sm"
                onClick={() => setShowComposeModal(true)}
                icon={<Send size={14} />}
              >
                Nuevo
              </Button>
            </div>
          </div>

          {syncError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-3">
              {syncError}
            </div>
          )}

          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar correos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-kap-surface text-sm text-zinc-200 placeholder-zinc-500 border border-kap-border focus:border-kap-email focus:outline-none transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1">
            {[
              { key: 'all', label: 'Todos', icon: Inbox },
              { key: 'pending', label: 'Pendiente', icon: Clock },
              { key: 'assigned', label: 'Asignado', icon: UserPlus },
              { key: 'resolved', label: 'Resuelto', icon: CheckCircle },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`
                  flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${filter === key
                    ? 'bg-kap-email/20 text-kap-email'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                `}
              >
                <Icon size={12} />
                <span className="hidden xl:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Emails */}
        <div className="flex-1 overflow-y-auto">
          {filteredEmails.map((email) => (
            <button
              key={email.id}
              onClick={() => router.push(`/email/${email.id}`)}
              className={`
                w-full flex items-start gap-3 p-4 border-b border-kap-border/20 transition-colors text-left
                ${currentEmail?.id === email.id
                  ? 'bg-kap-email/10'
                  : email.is_read ? 'hover:bg-white/5' : 'bg-kap-surface/50 hover:bg-kap-surface'}
              `}
            >
              <Avatar name={email.from_name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`truncate ${email.is_read ? 'text-zinc-400' : 'font-medium text-zinc-200'}`}>
                    {email.from_name}
                  </span>
                  <span className="text-[10px] text-zinc-500 flex-shrink-0 ml-2">
                    {format(new Date(email.date), 'dd MMM', { locale: es })}
                  </span>
                </div>
                <p className={`text-sm truncate mb-1 ${email.is_read ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  {email.subject}
                </p>
                <p className="text-xs text-zinc-600 truncate">
                  {email.text.substring(0, 100)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(email.status)}
                  {email.attachments && email.attachments.length > 0 && (
                    <div className="flex items-center gap-1 text-zinc-500">
                      <Paperclip size={12} />
                      <span className="text-[10px]">{email.attachments.length}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentEmail ? (
          <>
            {/* Email Header */}
            <div className="px-6 py-4 bg-kap-surface/50 border-b border-kap-border flex-shrink-0">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-display font-semibold text-white pr-4">
                  {currentEmail.subject}
                </h2>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setNewEmail({
                        to: currentEmail.from,
                        subject: `Re: ${currentEmail.subject}`,
                        body: '',
                      });
                      setShowComposeModal(true);
                    }}
                    icon={<Reply size={14} />}
                  >
                    Responder
                  </Button>
                  {currentEmail.assigned_agent ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-kap-surface-light">
                      <Avatar name={currentEmail.assigned_agent.name} size="sm" />
                      <span className="text-sm text-zinc-300">
                        {currentEmail.assigned_agent.name}
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
                    value={currentEmail.status}
                    onChange={(e) => updateStatus(currentEmail.id, e.target.value as any)}
                    className="px-3 py-1.5 rounded-lg bg-kap-surface-light border border-kap-border text-sm text-zinc-300 focus:outline-none focus:border-kap-accent"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="assigned">Asignado</option>
                    <option value="resolved">Resuelto</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Avatar name={currentEmail.from_name} size="lg" />
                <div>
                  <p className="font-medium text-zinc-200">{currentEmail.from_name}</p>
                  <p className="text-sm text-zinc-500">{currentEmail.from}</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {format(new Date(currentEmail.date), "EEEE, d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              <div
                className="prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: currentEmail.html || `<p>${currentEmail.text}</p>` }}
              />

              {/* Attachments */}
              {currentEmail.attachments && currentEmail.attachments.length > 0 && (
                <div className="mt-6 pt-6 border-t border-kap-border">
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">
                    Archivos adjuntos ({currentEmail.attachments.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {currentEmail.attachments.map((att, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-kap-surface-light border border-kap-border"
                      >
                        <Paperclip size={14} className="text-zinc-500" />
                        <span className="text-sm text-zinc-300">{att.filename}</span>
                        <span className="text-xs text-zinc-500">
                          ({Math.round(att.size / 1024)}KB)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reply */}
            <div className="p-4 bg-kap-surface/50 border-t border-kap-border flex-shrink-0">
              <Button
                onClick={() => {
                  setNewEmail({
                    to: currentEmail.from,
                    subject: `Re: ${currentEmail.subject}`,
                    body: '',
                  });
                  setShowComposeModal(true);
                }}
                icon={<Reply size={16} />}
              >
                Responder
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Mail size={40} />}
            title="Selecciona un correo"
            description="Elige un correo de la lista para ver su contenido"
          />
        )}
      </div>

      {/* Compose Modal */}
      <Modal
        isOpen={showComposeModal}
        onClose={() => setShowComposeModal(false)}
        title="Nuevo correo"
        size="lg"
      >
        <form onSubmit={handleSendEmail} className="space-y-4">
          <Input
            label="Para"
            type="email"
            placeholder="destinatario@email.com"
            value={newEmail.to}
            onChange={(e) => setNewEmail({ ...newEmail, to: e.target.value })}
            required
          />
          <Input
            label="Asunto"
            placeholder="Asunto del correo"
            value={newEmail.subject}
            onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Mensaje
            </label>
            <textarea
              placeholder="Escribe tu mensaje..."
              value={newEmail.body}
              onChange={(e) => setNewEmail({ ...newEmail, body: e.target.value })}
              rows={8}
              required
              className="w-full px-4 py-3 rounded-xl bg-kap-surface-light border border-kap-border text-zinc-200 placeholder-zinc-500 focus:border-kap-accent focus:outline-none resize-none transition-colors"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowComposeModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSending} icon={<Send size={16} />}>
              Enviar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Asignar agente"
      >
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
      </Modal>
    </div>
  );
}

