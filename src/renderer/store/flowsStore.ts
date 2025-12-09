import { create } from 'zustand';
import type { WhatsAppFlow, FlowNode, FlowExecution } from '../types';
import { useAuthStore } from './authStore';

interface FlowTemplate {
    id: string;
    name: string;
    description?: string;
    category: string;
    nodes: FlowNode[];
    is_public: boolean;
}

interface FlowsState {
    flows: WhatsAppFlow[];
    currentFlow: WhatsAppFlow | null;
    templates: FlowTemplate[];
    executions: FlowExecution[];
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    // CRUD operations
    fetchFlows: () => Promise<void>;
    fetchFlow: (id: string) => Promise<void>;
    createFlow: (flow: Partial<WhatsAppFlow>) => Promise<WhatsAppFlow | null>;
    updateFlow: (id: string, updates: Partial<WhatsAppFlow>) => Promise<void>;
    deleteFlow: (id: string) => Promise<void>;
    duplicateFlow: (id: string) => Promise<WhatsAppFlow | null>;

    // Flow editor
    setCurrentFlow: (flow: WhatsAppFlow | null) => void;
    updateNode: (nodeId: string, updates: Partial<FlowNode>) => void;
    addNode: (node: FlowNode) => void;
    removeNode: (nodeId: string) => void;
    addConnection: (fromNodeId: string, toNodeId: string, condition?: string) => void;
    removeConnection: (fromNodeId: string, connectionId: string) => void;

    // Templates
    fetchTemplates: () => Promise<void>;
    createFromTemplate: (templateId: string) => Promise<WhatsAppFlow | null>;

    // Executions
    fetchExecutions: (flowId?: string) => Promise<void>;
    stopExecution: (executionId: string) => Promise<void>;

    // Toggle active
    toggleFlowActive: (id: string) => Promise<void>;

    // Clear
    clearError: () => void;
}

export const useFlowsStore = create<FlowsState>((set, get) => ({
    flows: [],
    currentFlow: null,
    templates: [],
    executions: [],
    isLoading: false,
    isSaving: false,
    error: null,

    clearError: () => set({ error: null }),

    fetchFlows: async () => {
        set({ isLoading: true, error: null });

        const { supabase } = useAuthStore.getState();
        if (!supabase) {
            set({ isLoading: false, error: 'No hay conexión a Supabase' });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('whatsapp_flows')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const flows: WhatsAppFlow[] = (data || []).map((row: any) => ({
                id: row.id,
                name: row.name,
                description: row.description,
                trigger_type: row.trigger_type,
                trigger_value: row.trigger_value,
                is_active: row.is_active,
                nodes: row.nodes || [],
                created_at: row.created_at,
                updated_at: row.updated_at,
            }));

            set({ flows, isLoading: false });
        } catch (err: any) {
            console.error('[FlowsStore] Error fetching flows:', err);
            set({ error: err.message, isLoading: false });
        }
    },

    fetchFlow: async (id: string) => {
        set({ isLoading: true, error: null });

        const { supabase } = useAuthStore.getState();
        if (!supabase) {
            set({ isLoading: false, error: 'No hay conexión a Supabase' });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('whatsapp_flows')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            const flow: WhatsAppFlow = {
                id: data.id,
                name: data.name,
                description: data.description,
                trigger_type: data.trigger_type,
                trigger_value: data.trigger_value,
                is_active: data.is_active,
                nodes: data.nodes || [],
                created_at: data.created_at,
                updated_at: data.updated_at,
            };

            set({ currentFlow: flow, isLoading: false });
        } catch (err: any) {
            console.error('[FlowsStore] Error fetching flow:', err);
            set({ error: err.message, isLoading: false });
        }
    },

    createFlow: async (flowData: Partial<WhatsAppFlow>) => {
        set({ isSaving: true, error: null });

        const { supabase, user } = useAuthStore.getState();
        if (!supabase || !user) {
            set({ isSaving: false, error: 'No hay conexión a Supabase' });
            return null;
        }

        try {
            const { data, error } = await supabase
                .from('whatsapp_flows')
                .insert({
                    name: flowData.name || 'Nuevo Flow',
                    description: flowData.description || '',
                    trigger_type: flowData.trigger_type || 'keyword',
                    trigger_value: flowData.trigger_value || '',
                    is_active: false,
                    nodes: flowData.nodes || [],
                    created_by: user.id,
                })
                .select()
                .single();

            if (error) throw error;

            const newFlow: WhatsAppFlow = {
                id: data.id,
                name: data.name,
                description: data.description,
                trigger_type: data.trigger_type,
                trigger_value: data.trigger_value,
                is_active: data.is_active,
                nodes: data.nodes || [],
                created_at: data.created_at,
                updated_at: data.updated_at,
            };

            set({
                flows: [newFlow, ...get().flows],
                currentFlow: newFlow,
                isSaving: false,
            });

            return newFlow;
        } catch (err: any) {
            console.error('[FlowsStore] Error creating flow:', err);
            set({ error: err.message, isSaving: false });
            return null;
        }
    },

    updateFlow: async (id: string, updates: Partial<WhatsAppFlow>) => {
        set({ isSaving: true, error: null });

        const { supabase } = useAuthStore.getState();
        if (!supabase) {
            set({ isSaving: false, error: 'No hay conexión a Supabase' });
            return;
        }

        try {
            const { error } = await supabase
                .from('whatsapp_flows')
                .update({
                    name: updates.name,
                    description: updates.description,
                    trigger_type: updates.trigger_type,
                    trigger_value: updates.trigger_value,
                    is_active: updates.is_active,
                    nodes: updates.nodes,
                })
                .eq('id', id);

            if (error) throw error;

            // Update local state
            set({
                flows: get().flows.map(f => f.id === id ? { ...f, ...updates } : f),
                currentFlow: get().currentFlow?.id === id
                    ? { ...get().currentFlow!, ...updates }
                    : get().currentFlow,
                isSaving: false,
            });
        } catch (err: any) {
            console.error('[FlowsStore] Error updating flow:', err);
            set({ error: err.message, isSaving: false });
        }
    },

    deleteFlow: async (id: string) => {
        set({ isLoading: true, error: null });

        const { supabase } = useAuthStore.getState();
        if (!supabase) {
            set({ isLoading: false, error: 'No hay conexión a Supabase' });
            return;
        }

        try {
            const { error } = await supabase
                .from('whatsapp_flows')
                .delete()
                .eq('id', id);

            if (error) throw error;

            set({
                flows: get().flows.filter(f => f.id !== id),
                currentFlow: get().currentFlow?.id === id ? null : get().currentFlow,
                isLoading: false,
            });
        } catch (err: any) {
            console.error('[FlowsStore] Error deleting flow:', err);
            set({ error: err.message, isLoading: false });
        }
    },

    duplicateFlow: async (id: string) => {
        const flow = get().flows.find(f => f.id === id);
        if (!flow) return null;

        return await get().createFlow({
            name: `${flow.name} (copia)`,
            description: flow.description,
            trigger_type: flow.trigger_type,
            trigger_value: '',
            nodes: flow.nodes.map(node => ({
                ...node,
                id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            })),
        });
    },

    setCurrentFlow: (flow) => {
        set({ currentFlow: flow });
    },

    updateNode: (nodeId, updates) => {
        const { currentFlow } = get();
        if (!currentFlow) return;

        const updatedNodes = currentFlow.nodes.map(node =>
            node.id === nodeId ? { ...node, ...updates } : node
        );

        set({
            currentFlow: { ...currentFlow, nodes: updatedNodes },
        });
    },

    addNode: (node) => {
        const { currentFlow } = get();
        if (!currentFlow) return;

        set({
            currentFlow: {
                ...currentFlow,
                nodes: [...currentFlow.nodes, node],
            },
        });
    },

    removeNode: (nodeId) => {
        const { currentFlow } = get();
        if (!currentFlow) return;

        // Remove node and any connections to it
        const updatedNodes = currentFlow.nodes
            .filter(node => node.id !== nodeId)
            .map(node => ({
                ...node,
                connections: node.connections.filter(conn => conn.target_node_id !== nodeId),
            }));

        set({
            currentFlow: { ...currentFlow, nodes: updatedNodes },
        });
    },

    addConnection: (fromNodeId, toNodeId, condition) => {
        const { currentFlow } = get();
        if (!currentFlow) return;

        const updatedNodes = currentFlow.nodes.map(node => {
            if (node.id === fromNodeId) {
                return {
                    ...node,
                    connections: [
                        ...node.connections,
                        {
                            id: `conn_${Date.now()}`,
                            target_node_id: toNodeId,
                            condition,
                        },
                    ],
                };
            }
            return node;
        });

        set({
            currentFlow: { ...currentFlow, nodes: updatedNodes },
        });
    },

    removeConnection: (fromNodeId, connectionId) => {
        const { currentFlow } = get();
        if (!currentFlow) return;

        const updatedNodes = currentFlow.nodes.map(node => {
            if (node.id === fromNodeId) {
                return {
                    ...node,
                    connections: node.connections.filter(conn => conn.id !== connectionId),
                };
            }
            return node;
        });

        set({
            currentFlow: { ...currentFlow, nodes: updatedNodes },
        });
    },

    fetchTemplates: async () => {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return;

        try {
            const { data, error } = await supabase
                .from('flow_templates')
                .select('*')
                .order('name');

            if (error) throw error;

            set({ templates: data || [] });
        } catch (err: any) {
            console.error('[FlowsStore] Error fetching templates:', err);
        }
    },

    createFromTemplate: async (templateId: string) => {
        const template = get().templates.find(t => t.id === templateId);
        if (!template) return null;

        return await get().createFlow({
            name: template.name,
            description: template.description,
            trigger_type: 'keyword',
            trigger_value: '',
            nodes: template.nodes,
        });
    },

    fetchExecutions: async (flowId?: string) => {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return;

        try {
            let query = supabase
                .from('flow_executions')
                .select('*')
                .order('started_at', { ascending: false })
                .limit(100);

            if (flowId) {
                query = query.eq('flow_id', flowId);
            }

            const { data, error } = await query;

            if (error) throw error;

            set({ executions: data || [] });
        } catch (err: any) {
            console.error('[FlowsStore] Error fetching executions:', err);
        }
    },

    stopExecution: async (executionId: string) => {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return;

        try {
            const { error } = await supabase
                .from('flow_executions')
                .update({
                    status: 'paused',
                    completed_at: new Date().toISOString(),
                })
                .eq('id', executionId);

            if (error) throw error;

            set({
                executions: get().executions.map(e =>
                    e.id === executionId ? { ...e, status: 'paused' } : e
                ),
            });
        } catch (err: any) {
            console.error('[FlowsStore] Error stopping execution:', err);
        }
    },

    toggleFlowActive: async (id: string) => {
        const flow = get().flows.find(f => f.id === id);
        if (!flow) return;

        await get().updateFlow(id, { is_active: !flow.is_active });
    },
}));
