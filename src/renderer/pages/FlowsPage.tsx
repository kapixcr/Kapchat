import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Workflow,
    Plus,
    Play,
    Pause,
    Edit2,
    Trash2,
    Copy,
    Search,
    RefreshCw,
    ChevronRight,
    MessageSquare,
    HelpCircle,
    GitBranch,
    Zap,
    Clock,
    Users,
    LayoutTemplate,
} from 'lucide-react';
import { useFlowsStore } from '../store/flowsStore';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { EmptyState } from '../components/EmptyState';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { WhatsAppFlow } from '../types';

export function FlowsPage() {
    const router = useRouter();
    const {
        flows,
        templates,
        isLoading,
        isSaving,
        error,
        fetchFlows,
        fetchTemplates,
        createFlow,
        deleteFlow,
        duplicateFlow,
        toggleFlowActive,
        createFromTemplate,
        clearError,
    } = useFlowsStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [showNewModal, setShowNewModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState<WhatsAppFlow | null>(null);
    const [newFlowName, setNewFlowName] = useState('');
    const [newFlowTrigger, setNewFlowTrigger] = useState<'keyword' | 'first_message'>('keyword');
    const [newFlowKeyword, setNewFlowKeyword] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    useEffect(() => {
        fetchFlows();
        fetchTemplates();
    }, [fetchFlows, fetchTemplates]);

    const handleCreateFlow = async () => {
        let newFlow: WhatsAppFlow | null = null;

        if (selectedTemplate) {
            newFlow = await createFromTemplate(selectedTemplate);
        } else {
            newFlow = await createFlow({
                name: newFlowName || 'Nuevo Flow',
                trigger_type: newFlowTrigger,
                trigger_value: newFlowKeyword,
                nodes: [],
            });
        }

        if (newFlow) {
            setShowNewModal(false);
            setNewFlowName('');
            setNewFlowKeyword('');
            setSelectedTemplate(null);
            router.push(`/flows/${newFlow.id}`);
        }
    };

    const handleDeleteFlow = async () => {
        if (showDeleteModal) {
            await deleteFlow(showDeleteModal.id);
            setShowDeleteModal(null);
        }
    };

    const handleDuplicateFlow = async (flow: WhatsAppFlow) => {
        const newFlow = await duplicateFlow(flow.id);
        if (newFlow) {
            router.push(`/flows/${newFlow.id}`);
        }
    };

    const filteredFlows = flows.filter(flow =>
        flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flow.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getTriggerBadge = (triggerType: string) => {
        switch (triggerType) {
            case 'keyword':
                return <Badge variant="info">Palabra clave</Badge>;
            case 'first_message':
                return <Badge variant="success">Primer mensaje</Badge>;
            case 'webhook':
                return <Badge variant="warning">Webhook</Badge>;
            case 'schedule':
                return <Badge variant="default">Programado</Badge>;
            default:
                return null;
        }
    };

    const getNodeTypeIcon = (type: string) => {
        switch (type) {
            case 'message':
                return <MessageSquare size={14} />;
            case 'question':
                return <HelpCircle size={14} />;
            case 'condition':
                return <GitBranch size={14} />;
            case 'action':
                return <Zap size={14} />;
            case 'delay':
                return <Clock size={14} />;
            case 'transfer':
                return <Users size={14} />;
            default:
                return null;
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-kap-border bg-kap-surface/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Workflow size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-display font-semibold text-white">Flows de WhatsApp</h1>
                            <p className="text-sm text-zinc-500">Automatiza conversaciones con flujos interactivos</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchFlows()}
                            isLoading={isLoading}
                            icon={<RefreshCw size={14} />}
                        />
                        <Button
                            onClick={() => setShowNewModal(true)}
                            icon={<Plus size={16} />}
                        >
                            Nuevo Flow
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-4 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Buscar flows..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full max-w-md pl-9 pr-4 py-2 rounded-lg bg-kap-surface text-sm text-zinc-200 placeholder-zinc-500 border border-kap-border focus:border-kap-accent focus:outline-none transition-colors"
                    />
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={clearError} className="text-red-300 hover:text-white">✕</button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {isLoading && flows.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw size={24} className="animate-spin text-zinc-500" />
                    </div>
                ) : filteredFlows.length === 0 ? (
                    <EmptyState
                        icon={<Workflow size={40} />}
                        title="No hay flows"
                        description={searchQuery ? 'No se encontraron flows con esa búsqueda' : 'Crea tu primer flow para automatizar conversaciones'}
                        action={
                            !searchQuery && (
                                <Button onClick={() => setShowNewModal(true)} icon={<Plus size={16} />}>
                                    Crear Flow
                                </Button>
                            )
                        }
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredFlows.map((flow) => (
                            <div
                                key={flow.id}
                                className="group bg-kap-surface rounded-xl border border-kap-border hover:border-kap-accent/50 transition-all overflow-hidden"
                            >
                                {/* Card Header */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-zinc-200 truncate">{flow.name}</h3>
                                            {flow.description && (
                                                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{flow.description}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => toggleFlowActive(flow.id)}
                                            className={`
                        ml-2 p-1.5 rounded-lg transition-colors
                        ${flow.is_active
                                                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                    : 'bg-zinc-700/50 text-zinc-500 hover:bg-zinc-700'}
                      `}
                                        >
                                            {flow.is_active ? <Play size={14} /> : <Pause size={14} />}
                                        </button>
                                    </div>

                                    {/* Trigger & Stats */}
                                    <div className="flex items-center gap-2 mb-3">
                                        {getTriggerBadge(flow.trigger_type)}
                                        {flow.trigger_value && (
                                            <span className="text-xs text-zinc-500 truncate">
                                                "{flow.trigger_value}"
                                            </span>
                                        )}
                                    </div>

                                    {/* Nodes Preview */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {flow.nodes.slice(0, 5).map((node, idx) => (
                                            <div
                                                key={node.id}
                                                className="flex items-center gap-1 px-2 py-1 rounded bg-kap-surface-light text-xs text-zinc-400"
                                            >
                                                {getNodeTypeIcon(node.type)}
                                                <span className="capitalize">{node.type}</span>
                                                {idx < Math.min(flow.nodes.length - 1, 4) && (
                                                    <ChevronRight size={12} className="text-zinc-600 ml-1" />
                                                )}
                                            </div>
                                        ))}
                                        {flow.nodes.length > 5 && (
                                            <span className="text-xs text-zinc-500">+{flow.nodes.length - 5} más</span>
                                        )}
                                        {flow.nodes.length === 0 && (
                                            <span className="text-xs text-zinc-500 italic">Sin nodos</span>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer */}
                                <div className="px-4 py-3 bg-kap-darker/50 border-t border-kap-border/50 flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-600">
                                        Actualizado {format(new Date(flow.updated_at), "d MMM", { locale: es })}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => router.push(`/flows/${flow.id}`)}
                                            className="p-1.5 rounded hover:bg-kap-surface-light text-zinc-400 hover:text-white transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDuplicateFlow(flow)}
                                            className="p-1.5 rounded hover:bg-kap-surface-light text-zinc-400 hover:text-white transition-colors"
                                            title="Duplicar"
                                        >
                                            <Copy size={14} />
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteModal(flow)}
                                            className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* New Flow Modal */}
            <Modal
                isOpen={showNewModal}
                onClose={() => {
                    setShowNewModal(false);
                    setSelectedTemplate(null);
                    setNewFlowName('');
                    setNewFlowKeyword('');
                }}
                title="Crear nuevo Flow"
                size="lg"
            >
                <div className="space-y-6">
                    {/* Templates Section */}
                    {templates.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-3">
                                <LayoutTemplate size={14} className="inline mr-1" />
                                Comenzar desde una plantilla
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {templates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => setSelectedTemplate(
                                            selectedTemplate === template.id ? null : template.id
                                        )}
                                        className={`
                      p-3 rounded-lg border text-left transition-all
                      ${selectedTemplate === template.id
                                                ? 'border-kap-accent bg-kap-accent/10'
                                                : 'border-kap-border hover:border-kap-accent/50 bg-kap-surface-light'}
                    `}
                                    >
                                        <p className="font-medium text-sm text-zinc-200">{template.name}</p>
                                        <p className="text-xs text-zinc-500 mt-0.5">{template.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    {templates.length > 0 && (
                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-kap-border"></div>
                            <span className="text-xs text-zinc-500">o crear desde cero</span>
                            <div className="flex-1 h-px bg-kap-border"></div>
                        </div>
                    )}

                    {/* Manual Creation */}
                    <div className="space-y-4">
                        <Input
                            label="Nombre del flow"
                            placeholder="Ej: Bienvenida, Soporte, FAQ..."
                            value={newFlowName}
                            onChange={(e) => setNewFlowName(e.target.value)}
                            disabled={!!selectedTemplate}
                        />

                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                Tipo de activador
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setNewFlowTrigger('keyword')}
                                    disabled={!!selectedTemplate}
                                    className={`
                    p-3 rounded-lg border text-left transition-all
                    ${selectedTemplate ? 'opacity-50 cursor-not-allowed' : ''}
                    ${newFlowTrigger === 'keyword' && !selectedTemplate
                                            ? 'border-kap-accent bg-kap-accent/10'
                                            : 'border-kap-border hover:border-kap-accent/50'}
                  `}
                                >
                                    <p className="font-medium text-sm text-zinc-200">Palabra clave</p>
                                    <p className="text-xs text-zinc-500">Se activa cuando el mensaje contiene una palabra</p>
                                </button>
                                <button
                                    onClick={() => setNewFlowTrigger('first_message')}
                                    disabled={!!selectedTemplate}
                                    className={`
                    p-3 rounded-lg border text-left transition-all
                    ${selectedTemplate ? 'opacity-50 cursor-not-allowed' : ''}
                    ${newFlowTrigger === 'first_message' && !selectedTemplate
                                            ? 'border-kap-accent bg-kap-accent/10'
                                            : 'border-kap-border hover:border-kap-accent/50'}
                  `}
                                >
                                    <p className="font-medium text-sm text-zinc-200">Primer mensaje</p>
                                    <p className="text-xs text-zinc-500">Se activa con nuevos contactos</p>
                                </button>
                            </div>
                        </div>

                        {newFlowTrigger === 'keyword' && !selectedTemplate && (
                            <Input
                                label="Palabra(s) clave"
                                placeholder="Ej: hola, info, ayuda (separadas por coma)"
                                value={newFlowKeyword}
                                onChange={(e) => setNewFlowKeyword(e.target.value)}
                            />
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-kap-border">
                        <Button variant="ghost" onClick={() => setShowNewModal(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateFlow}
                            isLoading={isSaving}
                            disabled={!selectedTemplate && !newFlowName.trim()}
                        >
                            Crear Flow
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!showDeleteModal}
                onClose={() => setShowDeleteModal(null)}
                title="Eliminar Flow"
            >
                <div className="space-y-4">
                    <p className="text-zinc-300">
                        ¿Estás seguro de que quieres eliminar el flow <strong>"{showDeleteModal?.name}"</strong>?
                    </p>
                    <p className="text-sm text-zinc-500">
                        Esta acción no se puede deshacer. Todas las ejecuciones activas serán canceladas.
                    </p>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setShowDeleteModal(null)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteFlow}
                            isLoading={isLoading}
                        >
                            Eliminar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
