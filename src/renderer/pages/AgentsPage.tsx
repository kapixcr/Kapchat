import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Shield,
  ShieldCheck,
  User,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
} from 'lucide-react';
import { useAgentStore } from '../store/agentStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function AgentsPage() {
  const { user, supabase } = useAuthStore();
  const { agents, isLoading, fetchAgents, updateAgentRole } = useAgentStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck size={16} className="text-amber-400" />;
      case 'agent':
        return <Shield size={16} className="text-kap-accent" />;
      default:
        return <User size={16} className="text-zinc-500" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="warning">Admin</Badge>;
      case 'agent':
        return <Badge variant="info">Agente</Badge>;
      default:
        return <Badge>Usuario</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500';
      case 'away':
        return 'bg-amber-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-zinc-500';
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd send an invitation email
    // For now, we just close the modal
    setShowInviteModal(false);
    setInviteEmail('');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 bg-kap-surface/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Agentes</h1>
            <p className="text-sm text-zinc-500">
              Administra los agentes y sus permisos
            </p>
          </div>
          {user?.role === 'admin' && (
            <Button onClick={() => setShowInviteModal(true)} icon={<UserPlus size={16} />}>
              Invitar agente
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar agentes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-kap-surface text-sm text-zinc-200 placeholder-zinc-500 border border-kap-border focus:border-kap-accent focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-400">
                {agents.filter((a) => a.status === 'online').length} en línea
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
              <span className="text-zinc-400">
                {agents.filter((a) => a.status === 'offline').length} desconectados
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="bg-kap-surface border border-kap-border rounded-2xl p-5 hover:border-kap-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={agent.name}
                    src={agent.avatar}
                    size="lg"
                    status={agent.status}
                  />
                  <div>
                    <h3 className="font-semibold text-white">{agent.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getRoleBadge(agent.role)}
                    </div>
                  </div>
                </div>
                {user?.role === 'admin' && user.id !== agent.id && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setSelectedAgent(selectedAgent === agent.id ? null : agent.id)
                      }
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {selectedAgent === agent.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-kap-surface-light border border-kap-border rounded-xl shadow-xl z-10 py-1 animate-scale-in">
                        <button
                          onClick={() => {
                            updateAgentRole(
                              agent.id,
                              agent.role === 'admin' ? 'agent' : 'admin'
                            );
                            setSelectedAgent(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-white/5 flex items-center gap-2"
                        >
                          {agent.role === 'admin' ? (
                            <>
                              <Shield size={14} />
                              Cambiar a Agente
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={14} />
                              Hacer Admin
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            updateAgentRole(agent.id, 'user');
                            setSelectedAgent(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                        >
                          <User size={14} />
                          Remover rol
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Mail size={14} />
                  <span className="truncate">{agent.email}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Calendar size={14} />
                  <span>
                    Se unió el{' '}
                    {format(new Date(agent.created_at), "d 'de' MMMM, yyyy", {
                      locale: es,
                    })}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-kap-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                    <span className="text-xs text-zinc-500 capitalize">{agent.status}</span>
                  </div>
                  {agent.id === user?.id && (
                    <span className="text-xs text-kap-accent">Tú</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-kap-surface-light border border-kap-border flex items-center justify-center text-zinc-500 mb-4">
              <Users size={32} />
            </div>
            <h3 className="text-lg font-semibold text-zinc-300 mb-2">
              No se encontraron agentes
            </h3>
            <p className="text-sm text-zinc-500">
              {searchQuery
                ? 'Intenta con otro término de búsqueda'
                : 'Invita a tu equipo para comenzar'}
            </p>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invitar agente"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <p className="text-sm text-zinc-400">
            Envía una invitación por email para agregar un nuevo agente al equipo.
          </p>
          <Input
            label="Email"
            type="email"
            placeholder="agente@empresa.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowInviteModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" icon={<Mail size={16} />}>
              Enviar invitación
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

