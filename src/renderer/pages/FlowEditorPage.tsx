import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    Play,
    Pause,
    Plus,
    Trash2,
    MessageSquare,
    HelpCircle,
    GitBranch,
    Zap,
    Clock,
    Users,
    Settings,
} from 'lucide-react';
import { useFlowsStore } from '../store/flowsStore';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import type { FlowNode, FlowNodeData } from '../types';

const NODE_TYPES = [
    { type: 'message', label: 'Mensaje', icon: MessageSquare, color: 'bg-blue-500' },
    { type: 'question', label: 'Pregunta', icon: HelpCircle, color: 'bg-purple-500' },
    { type: 'condition', label: 'Condición', icon: GitBranch, color: 'bg-yellow-500' },
    { type: 'action', label: 'Acción', icon: Zap, color: 'bg-orange-500' },
    { type: 'delay', label: 'Espera', icon: Clock, color: 'bg-cyan-500' },
    { type: 'transfer', label: 'Transferir', icon: Users, color: 'bg-green-500' },
];

interface NodeEditorModalProps {
    node: FlowNode | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: FlowNodeData) => void;
    allNodes: FlowNode[];
}

function NodeEditorModal({ node, isOpen, onClose, onSave, allNodes }: NodeEditorModalProps) {
    const [data, setData] = useState<FlowNodeData>({});

    useEffect(() => {
        if (node) {
            setData(node.data);
        }
    }, [node]);

    if (!node) return null;

    const handleSave = () => {
        onSave(data);
        onClose();
    };

    const renderFields = () => {
        switch (node.type) {
            case 'message':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                Mensaje
                            </label>
                            <textarea
                                value={data.message || ''}
                                onChange={(e) => setData({ ...data, message: e.target.value })}
                                rows={4}
                                placeholder="Escribe el mensaje a enviar..."
                                className="w-full px-4 py-3 rounded-xl bg-kap-surface-light border border-kap-border text-zinc-200 placeholder-zinc-500 focus:border-kap-accent focus:outline-none resize-none"
                            />
                            <p className="text-xs text-zinc-500 mt-1">
                                Usa {"{{variable}}"} para insertar valores dinámicos
                            </p>
                        </div>
                    </div>
                );

            case 'question':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                Pregunta
                            </label>
                            <textarea
                                value={data.question || ''}
                                onChange={(e) => setData({ ...data, question: e.target.value })}
                                rows={3}
                                placeholder="Escribe la pregunta..."
                                className="w-full px-4 py-3 rounded-xl bg-kap-surface-light border border-kap-border text-zinc-200 placeholder-zinc-500 focus:border-kap-accent focus:outline-none resize-none"
                            />
                        </div>
                        <Input
                            label="Guardar respuesta en variable"
                            placeholder="nombre_variable"
                            value={data.variable_name || ''}
                            onChange={(e) => setData({ ...data, variable_name: e.target.value })}
                        />
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                Opciones de respuesta
                            </label>
                            {(data.options || []).map((opt, idx) => (
                                <div key={idx} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={opt.value}
                                        onChange={(e) => {
                                            const newOptions = [...(data.options || [])];
                                            newOptions[idx] = { ...opt, value: e.target.value };
                                            setData({ ...data, options: newOptions });
                                        }}
                                        placeholder="Valor (ej: 1)"
                                        className="flex-1 px-3 py-2 rounded-lg bg-kap-surface-light border border-kap-border text-sm text-zinc-200"
                                    />
                                    <input
                                        type="text"
                                        value={opt.label}
                                        onChange={(e) => {
                                            const newOptions = [...(data.options || [])];
                                            newOptions[idx] = { ...opt, label: e.target.value };
                                            setData({ ...data, options: newOptions });
                                        }}
                                        placeholder="Etiqueta"
                                        className="flex-1 px-3 py-2 rounded-lg bg-kap-surface-light border border-kap-border text-sm text-zinc-200"
                                    />
                                    <button
                                        onClick={() => {
                                            const newOptions = (data.options || []).filter((_, i) => i !== idx);
                                            setData({ ...data, options: newOptions });
                                        }}
                                        className="p-2 text-red-400 hover:bg-red-500/20 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setData({
                                    ...data,
                                    options: [...(data.options || []), { label: '', value: '' }]
                                })}
                                icon={<Plus size={14} />}
                            >
                                Agregar opción
                            </Button>
                        </div>
                    </div>
                );

            case 'condition':
                return (
                    <div className="space-y-4">
                        <Input
                            label="Variable a evaluar"
                            placeholder="nombre_variable"
                            value={data.condition?.variable || ''}
                            onChange={(e) => setData({
                                ...data,
                                condition: { ...data.condition, variable: e.target.value } as any
                            })}
                        />
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                Operador
                            </label>
                            <select
                                value={data.condition?.operator || 'equals'}
                                onChange={(e) => setData({
                                    ...data,
                                    condition: { ...data.condition, operator: e.target.value } as any
                                })}
                                className="w-full px-3 py-2 rounded-lg bg-kap-surface-light border border-kap-border text-zinc-200"
                            >
                                <option value="equals">Igual a</option>
                                <option value="contains">Contiene</option>
                                <option value="starts_with">Empieza con</option>
                                <option value="ends_with">Termina con</option>
                                <option value="greater_than">Mayor que</option>
                                <option value="less_than">Menor que</option>
                            </select>
                        </div>
                        <Input
                            label="Valor a comparar"
                            placeholder="valor"
                            value={data.condition?.value || ''}
                            onChange={(e) => setData({
                                ...data,
                                condition: { ...data.condition, value: e.target.value } as any
                            })}
                        />
                    </div>
                );

            case 'delay':
                return (
                    <div className="space-y-4">
                        <Input
                            type="number"
                            label="Segundos de espera"
                            placeholder="5"
                            value={data.delay_seconds || ''}
                            onChange={(e) => setData({ ...data, delay_seconds: parseInt(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-zinc-500">
                            El flow esperará este tiempo antes de continuar al siguiente nodo
                        </p>
                    </div>
                );

            case 'transfer':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                Mensaje de transferencia
                            </label>
                            <textarea
                                value={data.transfer_message || ''}
                                onChange={(e) => setData({ ...data, transfer_message: e.target.value })}
                                rows={2}
                                placeholder="Te estamos transfiriendo con un agente..."
                                className="w-full px-4 py-3 rounded-xl bg-kap-surface-light border border-kap-border text-zinc-200 placeholder-zinc-500 focus:border-kap-accent focus:outline-none resize-none"
                            />
                        </div>
                    </div>
                );

            case 'action':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                Tipo de acción
                            </label>
                            <select
                                value={data.action_type || 'set_variable'}
                                onChange={(e) => setData({ ...data, action_type: e.target.value as any })}
                                className="w-full px-3 py-2 rounded-lg bg-kap-surface-light border border-kap-border text-zinc-200"
                            >
                                <option value="set_variable">Establecer variable</option>
                                <option value="assign_agent">Asignar agente</option>
                                <option value="tag_conversation">Etiquetar conversación</option>
                            </select>
                        </div>
                        {data.action_type === 'set_variable' && (
                            <>
                                <Input
                                    label="Nombre de variable"
                                    placeholder="mi_variable"
                                    value={data.action_config?.variable_name || ''}
                                    onChange={(e) => setData({
                                        ...data,
                                        action_config: { ...data.action_config, variable_name: e.target.value }
                                    })}
                                />
                                <Input
                                    label="Valor"
                                    placeholder="valor"
                                    value={data.action_config?.value || ''}
                                    onChange={(e) => setData({
                                        ...data,
                                        action_config: { ...data.action_config, value: e.target.value }
                                    })}
                                />
                            </>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar ${node.type}`} size="lg">
            <div className="space-y-6">
                {renderFields()}

                {/* Connections */}
                {node.connections.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Conexiones
                        </label>
                        <div className="space-y-2">
                            {node.connections.map((conn) => {
                                const targetNode = allNodes.find(n => n.id === conn.target_node_id);
                                return (
                                    <div key={conn.id} className="flex items-center gap-2 p-2 rounded-lg bg-kap-surface-light text-sm">
                                        <span className="text-zinc-500">→</span>
                                        <span className="text-zinc-300">{targetNode?.type || 'Nodo'}</span>
                                        {conn.condition && (
                                            <Badge variant="info">
                                                Si: {conn.condition}
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-kap-border">
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave}>
                        Guardar
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export function FlowEditorPage() {
    const { flowId } = useParams<{ flowId: string }>();
    const navigate = useNavigate();
    const {
        currentFlow,
        isLoading,
        isSaving,
        fetchFlow,
        updateFlow,
        updateNode,
        addNode,
        removeNode,
        addConnection,
        toggleFlowActive,
    } = useFlowsStore();

    const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
    const [showNodeEditor, setShowNodeEditor] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
    
    // Drag and drop state
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
    const [isMouseDown, setIsMouseDown] = useState(false);

    // Settings state
    const [flowName, setFlowName] = useState('');
    const [flowDescription, setFlowDescription] = useState('');
    const [triggerType, setTriggerType] = useState<'keyword' | 'first_message'>('keyword');
    const [triggerValue, setTriggerValue] = useState('');

    useEffect(() => {
        if (flowId) {
            fetchFlow(flowId);
        }
    }, [flowId, fetchFlow]);

    useEffect(() => {
        if (currentFlow) {
            setFlowName(currentFlow.name);
            setFlowDescription(currentFlow.description || '');
            setTriggerType(currentFlow.trigger_type as any);
            setTriggerValue(currentFlow.trigger_value || '');
        }
    }, [currentFlow]);

    const handleSave = async () => {
        if (!currentFlow) return;
        await updateFlow(currentFlow.id, {
            name: flowName,
            description: flowDescription,
            trigger_type: triggerType,
            trigger_value: triggerValue,
            nodes: currentFlow.nodes,
        });
    };

    const handleAddNode = (type: string) => {
        const id = `node_${Date.now()}`;
        const newNode: FlowNode = {
            id,
            type: type as any,
            position: {
                x: 100 + (currentFlow?.nodes.length || 0) * 50,
                y: 100 + (currentFlow?.nodes.length || 0) * 80
            },
            data: {},
            connections: [],
        };
        addNode(newNode);
    };

    const handleNodeClick = (node: FlowNode, e?: React.MouseEvent) => {
        // If clicking on a button, don't handle node click
        if (e) {
            const target = e.target as HTMLElement;
            if (target.closest('button')) {
                return;
            }
        }

        if (connectingFrom) {
            // Complete connection
            if (connectingFrom !== node.id) {
                addConnection(connectingFrom, node.id);
            }
            setConnectingFrom(null);
        } else {
            setSelectedNode(node);
            setShowNodeEditor(true);
        }
    };

    const handleNodeDataSave = (data: FlowNodeData) => {
        if (selectedNode) {
            updateNode(selectedNode.id, { data });
        }
    };

    const handleSaveSettings = async () => {
        if (!currentFlow) return;
        await updateFlow(currentFlow.id, {
            name: flowName,
            description: flowDescription,
            trigger_type: triggerType,
            trigger_value: triggerValue,
        });
        setShowSettingsModal(false);
    };

    const getNodeTypeConfig = (type: string) => {
        return NODE_TYPES.find(t => t.type === type) || NODE_TYPES[0];
    };

    // Drag and drop handlers
    const dragStateRef = useRef<{ nodeId: string | null; offset: { x: number; y: number } | null }>({
        nodeId: null,
        offset: null,
    });
    const dragStartRef = useRef<{ x: number; y: number; nodeId: string | null }>({
        x: 0,
        y: 0,
        nodeId: null,
    });
    const hasDraggedRef = useRef(false);

    const handleNodeMouseDown = (e: React.MouseEvent, node: FlowNode) => {
        // Don't start dragging if clicking on buttons or connection points
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('[title="Conectar a otro nodo"]')) {
            return;
        }

        // Don't start dragging if we're in connection mode - allow clicks to go through
        if (connectingFrom) {
            return;
        }

        // Store initial mouse position to detect if it's a drag or click
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            nodeId: node.id,
        };
        hasDraggedRef.current = false;
        
        const canvas = document.querySelector('.relative.overflow-auto');
        if (!canvas) return;
        
        const canvasRect = canvas.getBoundingClientRect();
        const scrollX = canvas.scrollLeft;
        const scrollY = canvas.scrollTop;
        
        // Calculate offset from mouse position to node position
        const offset = {
            x: e.clientX - canvasRect.left - node.position.x + scrollX,
            y: e.clientY - canvasRect.top - node.position.y + scrollY,
        };
        
        dragStateRef.current = { nodeId: node.id, offset };
        setIsMouseDown(true);
    };

    // Sync ref with state
    useEffect(() => {
        dragStateRef.current = { nodeId: draggingNode, offset: dragOffset };
    }, [draggingNode, dragOffset]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const { nodeId, offset } = dragStateRef.current;
            if (!nodeId || !offset) return;

            // Check if mouse has moved enough to consider it a drag (threshold: 5px)
            const dragThreshold = 5;
            const deltaX = Math.abs(e.clientX - dragStartRef.current.x);
            const deltaY = Math.abs(e.clientY - dragStartRef.current.y);
            
            // Only start dragging if mouse moved beyond threshold
            if (!hasDraggedRef.current && (deltaX > dragThreshold || deltaY > dragThreshold)) {
                hasDraggedRef.current = true;
                setDraggingNode(nodeId);
                setDragOffset(offset);
            }

            // Only update position if we're actually dragging
            if (hasDraggedRef.current) {
                const canvas = document.querySelector('.relative.overflow-auto');
                if (!canvas) return;

                const canvasRect = canvas.getBoundingClientRect();
                const scrollX = canvas.scrollLeft;
                const scrollY = canvas.scrollTop;

                const newX = e.clientX - canvasRect.left - offset.x + scrollX;
                const newY = e.clientY - canvasRect.top - offset.y + scrollY;

                updateNode(nodeId, {
                    position: { x: Math.max(0, newX), y: Math.max(0, newY) },
                });
            }
        };

        const handleMouseUp = () => {
            setIsMouseDown(false);
            // Reset drag state
            if (hasDraggedRef.current) {
                // Was a drag, prevent click event
                setTimeout(() => {
                    setDraggingNode(null);
                    setDragOffset(null);
                    dragStateRef.current = { nodeId: null, offset: null };
                    dragStartRef.current = { x: 0, y: 0, nodeId: null };
                    hasDraggedRef.current = false;
                }, 10);
            } else {
                // Was just a click, allow click event to proceed
                dragStateRef.current = { nodeId: null, offset: null };
                dragStartRef.current = { x: 0, y: 0, nodeId: null };
            }
        };

        // Only listen to mouse events when mouse is down
        if (isMouseDown) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isMouseDown, draggingNode, updateNode]);

    if (isLoading || !currentFlow) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-kap-accent border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-kap-darker">
            {/* Toolbar */}
            <div className="h-14 px-4 flex items-center justify-between bg-kap-surface border-b border-kap-border">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/flows')}
                        icon={<ArrowLeft size={16} />}
                    />
                    <div className="h-6 w-px bg-kap-border" />
                    <h1 className="font-medium text-zinc-200">{currentFlow.name}</h1>
                    {currentFlow.is_active ? (
                        <Badge variant="success">Activo</Badge>
                    ) : (
                        <Badge variant="default">Inactivo</Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSettingsModal(true)}
                        icon={<Settings size={16} />}
                    >
                        Configurar
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFlowActive(currentFlow.id)}
                        icon={currentFlow.is_active ? <Pause size={16} /> : <Play size={16} />}
                    >
                        {currentFlow.is_active ? 'Pausar' : 'Activar'}
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        isLoading={isSaving}
                        icon={<Save size={16} />}
                    >
                        Guardar
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Node Palette */}
                <div className="w-56 bg-kap-surface border-r border-kap-border p-4">
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                        Nodos
                    </h3>
                    <div className="space-y-2">
                        {NODE_TYPES.map((nodeType) => (
                            <button
                                key={nodeType.type}
                                onClick={() => handleAddNode(nodeType.type)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-kap-surface-light hover:bg-kap-accent/10 border border-kap-border hover:border-kap-accent/50 transition-all group"
                            >
                                <div className={`w-6 h-6 rounded flex items-center justify-center ${nodeType.color}`}>
                                    <nodeType.icon size={14} className="text-white" />
                                </div>
                                <span className="text-sm text-zinc-300 group-hover:text-white">
                                    {nodeType.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-kap-border">
                        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                            Ayuda
                        </h3>
                        <ul className="text-xs text-zinc-500 space-y-1">
                            <li>• Haz clic en un nodo para editarlo</li>
                            <li>• Arrastra entre nodos para conectar</li>
                            <li>• Usa variables con {"{{nombre}}"}</li>
                        </ul>
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 relative overflow-auto bg-kap-dark p-6">
                    {/* Grid Background */}
                    <div
                        className="absolute inset-0 opacity-5"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                        }}
                    />

                    {/* Nodes */}
                    <div className="relative min-h-full min-w-full">
                        {currentFlow.nodes.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 rounded-full bg-kap-surface flex items-center justify-center mx-auto mb-4">
                                        <Plus size={24} className="text-zinc-500" />
                                    </div>
                                    <p className="text-zinc-500">Agrega nodos desde el panel izquierdo</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {currentFlow.nodes.map((node) => {
                                    const config = getNodeTypeConfig(node.type);
                                    return (
                                        <div
                                            key={node.id}
                                            className={`
                        absolute min-w-[200px] rounded-xl bg-kap-surface border-2 transition-all
                        ${draggingNode === node.id ? 'cursor-grabbing z-50' : 'cursor-grab'}
                        ${connectingFrom === node.id
                                                    ? 'border-kap-accent shadow-lg shadow-kap-accent/20'
                                                    : selectedNode?.id === node.id
                                                        ? 'border-kap-accent/50'
                                                        : 'border-kap-border hover:border-kap-accent/30'}
                      `}
                                            style={{
                                                left: `${node.position.x}px`,
                                                top: `${node.position.y}px`,
                                            }}
                                            onMouseDown={(e) => handleNodeMouseDown(e, node)}
                                            onClick={(e) => {
                                                // Don't handle click if we just finished dragging
                                                if (hasDraggedRef.current || draggingNode) {
                                                    return;
                                                }
                                                // If in connection mode, always handle click to complete connection
                                                if (connectingFrom) {
                                                    e.stopPropagation();
                                                    handleNodeClick(node, e);
                                                    return;
                                                }
                                                handleNodeClick(node, e);
                                            }}
                                        >
                                            {/* Node Header */}
                                            <div className={`px-3 py-2 rounded-t-lg ${config.color} flex items-center gap-2`}>
                                                <config.icon size={14} className="text-white" />
                                                <span className="text-xs font-medium text-white capitalize">{node.type}</span>
                                                <div className="flex-1" />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeNode(node.id);
                                                    }}
                                                    className="p-1 rounded hover:bg-white/20 text-white/70 hover:text-white"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>

                                            {/* Node Content */}
                                            <div className="px-3 py-2">
                                                {node.type === 'message' && (
                                                    <p className="text-xs text-zinc-400 line-clamp-2">
                                                        {node.data.message || 'Sin mensaje configurado'}
                                                    </p>
                                                )}
                                                {node.type === 'question' && (
                                                    <p className="text-xs text-zinc-400 line-clamp-2">
                                                        {node.data.question || 'Sin pregunta configurada'}
                                                    </p>
                                                )}
                                                {node.type === 'delay' && (
                                                    <p className="text-xs text-zinc-400">
                                                        Esperar {node.data.delay_seconds || 0}s
                                                    </p>
                                                )}
                                                {node.type === 'transfer' && (
                                                    <p className="text-xs text-zinc-400">
                                                        Transferir a agente
                                                    </p>
                                                )}
                                                {node.type === 'condition' && (
                                                    <p className="text-xs text-zinc-400">
                                                        Si {node.data.condition?.variable || '...'} {node.data.condition?.operator || '='} {node.data.condition?.value || '...'}
                                                    </p>
                                                )}
                                                {node.type === 'action' && (
                                                    <p className="text-xs text-zinc-400">
                                                        {node.data.action_type || 'Sin acción'}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Connections Indicator */}
                                            {node.connections.length > 0 && (
                                                <div className="px-3 pb-2 flex items-center gap-1">
                                                    <span className="text-[10px] text-zinc-600">
                                                        → {node.connections.length} conexión{node.connections.length > 1 ? 'es' : ''}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Connect Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    const newConnectingFrom = connectingFrom === node.id ? null : node.id;
                                                    setConnectingFrom(newConnectingFrom);
                                                }}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                }}
                                                className={`
                          absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all cursor-pointer z-10
                          ${connectingFrom === node.id
                                                        ? 'bg-kap-accent border-kap-accent'
                                                        : 'bg-kap-surface border-kap-border hover:border-kap-accent'}
                        `}
                                                title="Conectar a otro nodo"
                                            />
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    {/* Connection Mode Indicator */}
                    {connectingFrom && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-kap-accent text-white text-sm shadow-lg">
                            Haz clic en otro nodo para conectar
                        </div>
                    )}
                </div>
            </div>

            {/* Node Editor Modal */}
            <NodeEditorModal
                node={selectedNode}
                isOpen={showNodeEditor}
                onClose={() => {
                    setShowNodeEditor(false);
                    setSelectedNode(null);
                }}
                onSave={handleNodeDataSave}
                allNodes={currentFlow?.nodes || []}
            />

            {/* Settings Modal */}
            <Modal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                title="Configuración del Flow"
            >
                <div className="space-y-4">
                    <Input
                        label="Nombre"
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                    />
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                            Descripción
                        </label>
                        <textarea
                            value={flowDescription}
                            onChange={(e) => setFlowDescription(e.target.value)}
                            rows={2}
                            className="w-full px-4 py-3 rounded-xl bg-kap-surface-light border border-kap-border text-zinc-200 placeholder-zinc-500 focus:border-kap-accent focus:outline-none resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                            Tipo de activador
                        </label>
                        <select
                            value={triggerType}
                            onChange={(e) => setTriggerType(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-lg bg-kap-surface-light border border-kap-border text-zinc-200"
                        >
                            <option value="keyword">Palabra clave</option>
                            <option value="first_message">Primer mensaje</option>
                        </select>
                    </div>
                    {triggerType === 'keyword' && (
                        <Input
                            label="Palabra(s) clave"
                            placeholder="hola, info, ayuda"
                            value={triggerValue}
                            onChange={(e) => setTriggerValue(e.target.value)}
                        />
                    )}
                    <div className="flex justify-end gap-3 pt-4 border-t border-kap-border">
                        <Button variant="ghost" onClick={() => setShowSettingsModal(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveSettings} isLoading={isSaving}>
                            Guardar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
