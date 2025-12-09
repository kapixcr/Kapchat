import type { WhatsAppFlow, FlowNode, FlowExecution, FlowNodeData } from '../types';
import { useAuthStore } from '../store/authStore';
import { useFlowsStore } from '../store/flowsStore';

interface FlowContext {
    conversationId: string;
    phone: string;
    contactName: string;
    message: string;
    messageType: string;
    variables: Record<string, any>;
}

interface ExecutionResult {
    success: boolean;
    nextNodeId?: string;
    responseMessage?: string;
    shouldWait?: boolean;
    error?: string;
}

class FlowEngineClass {
    private activeExecutions: Map<string, FlowExecution> = new Map();

    /**
     * Check if an incoming message should trigger a flow
     */
    async checkTriggers(context: FlowContext): Promise<WhatsAppFlow | null> {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return null;

        try {
            // Get all active flows
            const { data: flows, error } = await supabase
                .from('whatsapp_flows')
                .select('*')
                .eq('is_active', true);

            if (error || !flows) return null;

            const message = context.message.toLowerCase().trim();

            for (const flow of flows) {
                // Check if there's already an active execution for this conversation
                const existingExecution = await this.getActiveExecution(context.conversationId);
                if (existingExecution) {
                    // Continue existing flow instead of starting new one
                    return null;
                }

                switch (flow.trigger_type) {
                    case 'keyword':
                        // Check if message contains the trigger keyword
                        const keywords = (flow.trigger_value || '').toLowerCase().split(',').map((k: string) => k.trim());
                        if (keywords.some((keyword: string) => message.includes(keyword))) {
                            return flow;
                        }
                        break;

                    case 'first_message':
                        // Check if this is the first message from this contact
                        const { data: existingMessages } = await supabase
                            .from('whatsapp_messages')
                            .select('id')
                            .eq('conversation_id', context.conversationId)
                            .limit(2);

                        if (!existingMessages || existingMessages.length <= 1) {
                            return flow;
                        }
                        break;

                    case 'schedule':
                        // Schedule triggers are handled separately by a cron job
                        break;

                    case 'webhook':
                        // Webhooks are handled by external calls
                        break;
                }
            }

            return null;
        } catch (err) {
            console.error('[FlowEngine] Error checking triggers:', err);
            return null;
        }
    }

    /**
     * Start executing a flow
     */
    async startFlow(flow: WhatsAppFlow, context: FlowContext): Promise<void> {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return;

        try {
            // Find the first node (usually the one without incoming connections)
            const firstNode = this.findFirstNode(flow.nodes);
            if (!firstNode) {
                console.error('[FlowEngine] No starting node found in flow');
                return;
            }

            // Create execution record
            const { data: execution, error } = await supabase
                .from('flow_executions')
                .insert({
                    flow_id: flow.id,
                    conversation_id: context.conversationId,
                    current_node_id: firstNode.id,
                    variables: context.variables || {},
                    status: 'running',
                })
                .select()
                .single();

            if (error) throw error;

            // Store in memory for quick access
            this.activeExecutions.set(context.conversationId, execution);

            // Execute the first node
            await this.executeNode(flow, firstNode, execution.id, context);
        } catch (err) {
            console.error('[FlowEngine] Error starting flow:', err);
        }
    }

    /**
     * Continue an existing flow execution with a new message
     */
    async continueFlow(context: FlowContext): Promise<void> {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return;

        try {
            // Get active execution
            const execution = await this.getActiveExecution(context.conversationId);
            if (!execution || execution.status !== 'running') return;

            // Get the flow
            const { data: flow, error } = await supabase
                .from('whatsapp_flows')
                .select('*')
                .eq('id', execution.flow_id)
                .single();

            if (error || !flow) return;

            // Get current node
            const currentNode = flow.nodes.find((n: FlowNode) => n.id === execution.current_node_id);
            if (!currentNode) return;

            // Process user response
            await this.processUserResponse(flow, currentNode, execution, context);
        } catch (err) {
            console.error('[FlowEngine] Error continuing flow:', err);
        }
    }

    /**
     * Process user response for question nodes
     */
    private async processUserResponse(
        flow: WhatsAppFlow,
        currentNode: FlowNode,
        execution: FlowExecution,
        context: FlowContext
    ): Promise<void> {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return;

        // If it's a question node, save the response and find next node
        if (currentNode.type === 'question') {
            const variableName = currentNode.data.variable_name || 'response';
            const variables = { ...execution.variables, [variableName]: context.message };

            // Find matching connection based on response
            let nextConnection = currentNode.connections.find(conn => {
                if (!conn.condition) return false;
                return context.message.toLowerCase() === conn.condition.toLowerCase() ||
                    context.message === conn.condition;
            });

            // If no match, try to find a default connection (one without condition)
            if (!nextConnection) {
                nextConnection = currentNode.connections.find(conn => !conn.condition);
            }

            if (nextConnection) {
                const nextNode = flow.nodes.find((n: FlowNode) => n.id === nextConnection!.target_node_id);
                if (nextNode) {
                    // Update execution
                    await supabase
                        .from('flow_executions')
                        .update({
                            current_node_id: nextNode.id,
                            variables,
                            last_activity_at: new Date().toISOString(),
                        })
                        .eq('id', execution.id);

                    // Execute next node
                    await this.executeNode(flow, nextNode, execution.id, { ...context, variables });
                }
            } else {
                // No matching connection, end the flow
                await this.endExecution(execution.id, 'completed');
            }
        }
    }

    /**
     * Execute a single node
     */
    private async executeNode(
        flow: WhatsAppFlow,
        node: FlowNode,
        executionId: string,
        context: FlowContext
    ): Promise<ExecutionResult> {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return { success: false, error: 'No Supabase connection' };

        const startTime = Date.now();

        try {
            let result: ExecutionResult = { success: true };

            switch (node.type) {
                case 'message':
                    result = await this.executeMessageNode(node.data, context);
                    break;

                case 'question':
                    result = await this.executeQuestionNode(node.data, context);
                    break;

                case 'condition':
                    result = await this.executeConditionNode(node, context);
                    break;

                case 'action':
                    result = await this.executeActionNode(node.data, context);
                    break;

                case 'delay':
                    result = await this.executeDelayNode(node.data, context);
                    break;

                case 'transfer':
                    result = await this.executeTransferNode(node.data, context);
                    break;

                default:
                    result = { success: false, error: `Unknown node type: ${node.type}` };
            }

            // Log the execution
            await supabase.from('flow_logs').insert({
                execution_id: executionId,
                node_id: node.id,
                node_type: node.type,
                action: result.success ? 'executed' : 'failed',
                input_data: { message: context.message, variables: context.variables },
                output_data: { response: result.responseMessage, nextNode: result.nextNodeId },
                duration_ms: Date.now() - startTime,
            });

            // If there's a response, send it
            if (result.responseMessage) {
                await this.sendMessage(context.phone, result.responseMessage);
            }

            // If should wait for user response, update execution status
            if (result.shouldWait) {
                await supabase
                    .from('flow_executions')
                    .update({
                        current_node_id: node.id,
                        last_activity_at: new Date().toISOString(),
                    })
                    .eq('id', executionId);
                return result;
            }

            // Continue to next node if available
            if (result.nextNodeId) {
                const nextNode = flow.nodes.find(n => n.id === result.nextNodeId);
                if (nextNode) {
                    await this.executeNode(flow, nextNode, executionId, context);
                }
            } else if (node.connections.length === 1 && !node.connections[0].condition) {
                // Auto-continue to single unconditional connection
                const nextNode = flow.nodes.find(n => n.id === node.connections[0].target_node_id);
                if (nextNode) {
                    await supabase
                        .from('flow_executions')
                        .update({ current_node_id: nextNode.id })
                        .eq('id', executionId);
                    await this.executeNode(flow, nextNode, executionId, context);
                }
            } else if (node.connections.length === 0) {
                // End of flow
                await this.endExecution(executionId, 'completed');
            }

            return result;
        } catch (err: any) {
            // Log error
            await supabase.from('flow_logs').insert({
                execution_id: executionId,
                node_id: node.id,
                node_type: node.type,
                action: 'error',
                input_data: { message: context.message },
                output_data: { error: err.message },
                duration_ms: Date.now() - startTime,
            });

            await this.endExecution(executionId, 'failed', err.message);
            return { success: false, error: err.message };
        }
    }

    private async executeMessageNode(data: FlowNodeData, context: FlowContext): Promise<ExecutionResult> {
        const message = this.replaceVariables(data.message || '', context.variables);
        return { success: true, responseMessage: message };
    }

    private async executeQuestionNode(data: FlowNodeData, context: FlowContext): Promise<ExecutionResult> {
        const question = this.replaceVariables(data.question || '', context.variables);
        return { success: true, responseMessage: question, shouldWait: true };
    }

    private async executeConditionNode(node: FlowNode, context: FlowContext): Promise<ExecutionResult> {
        const condition = node.data.condition;
        if (!condition) {
            return { success: false, error: 'No condition defined' };
        }

        const value = context.variables[condition.variable];
        let matches = false;

        switch (condition.operator) {
            case 'equals':
                matches = String(value).toLowerCase() === condition.value.toLowerCase();
                break;
            case 'contains':
                matches = String(value).toLowerCase().includes(condition.value.toLowerCase());
                break;
            case 'starts_with':
                matches = String(value).toLowerCase().startsWith(condition.value.toLowerCase());
                break;
            case 'ends_with':
                matches = String(value).toLowerCase().endsWith(condition.value.toLowerCase());
                break;
            case 'greater_than':
                matches = Number(value) > Number(condition.value);
                break;
            case 'less_than':
                matches = Number(value) < Number(condition.value);
                break;
        }

        // Find connection for true or false
        const connection = node.connections.find(c =>
            (matches && c.label === 'true') || (!matches && c.label === 'false')
        ) || node.connections[0];

        return {
            success: true,
            nextNodeId: connection?.target_node_id,
        };
    }

    private async executeActionNode(data: FlowNodeData, context: FlowContext): Promise<ExecutionResult> {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return { success: false, error: 'No Supabase connection' };

        switch (data.action_type) {
            case 'set_variable':
                const varName = data.action_config?.variable_name;
                const varValue = this.replaceVariables(data.action_config?.value || '', context.variables);
                context.variables[varName] = varValue;
                break;

            case 'assign_agent':
                await supabase
                    .from('whatsapp_conversations')
                    .update({
                        status: 'assigned',
                        assigned_agent_id: data.action_config?.agent_id,
                    })
                    .eq('id', context.conversationId);
                break;

            case 'tag_conversation':
                // Could be implemented with a tags column
                break;

            case 'http_request':
                // Execute HTTP request (be careful with this in production)
                try {
                    const response = await fetch(data.action_config?.url, {
                        method: data.action_config?.method || 'GET',
                        headers: data.action_config?.headers || {},
                        body: data.action_config?.body ? JSON.stringify(data.action_config.body) : undefined,
                    });
                    context.variables['http_response'] = await response.json();
                } catch (err) {
                    console.error('[FlowEngine] HTTP request failed:', err);
                }
                break;
        }

        return { success: true };
    }

    private async executeDelayNode(data: FlowNodeData, context: FlowContext): Promise<ExecutionResult> {
        const seconds = data.delay_seconds || 1;
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        return { success: true };
    }

    private async executeTransferNode(data: FlowNodeData, context: FlowContext): Promise<ExecutionResult> {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return { success: false, error: 'No Supabase connection' };

        // Update conversation status to pending for agent pickup
        await supabase
            .from('whatsapp_conversations')
            .update({
                status: 'pending',
                assigned_agent_id: data.transfer_to_agent || null,
            })
            .eq('id', context.conversationId);

        const message = data.transfer_message || '🙋 Te estamos transfiriendo con un agente...';
        return { success: true, responseMessage: message };
    }

    /**
     * Replace {{variable}} placeholders with actual values
     */
    private replaceVariables(text: string, variables: Record<string, any>): string {
        return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            if (varName === 'contact_name') return variables.contactName || '';
            if (varName === 'phone') return variables.phone || '';
            return variables[varName] !== undefined ? String(variables[varName]) : match;
        });
    }

    /**
     * Find the first node (entry point) of the flow
     */
    private findFirstNode(nodes: FlowNode[]): FlowNode | undefined {
        // Find nodes that are not targeted by any connection
        const targetIds = new Set<string>();
        nodes.forEach(node => {
            node.connections.forEach(conn => {
                targetIds.add(conn.target_node_id);
            });
        });

        return nodes.find(node => !targetIds.has(node.id)) || nodes[0];
    }

    /**
     * Get active execution for a conversation
     */
    private async getActiveExecution(conversationId: string): Promise<FlowExecution | null> {
        // Check memory cache first
        const cached = this.activeExecutions.get(conversationId);
        if (cached && cached.status === 'running') return cached;

        const { supabase } = useAuthStore.getState();
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('flow_executions')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[FlowEngine] Error fetching active execution:', error);
            return null;
        }

        if (data) {
            this.activeExecutions.set(conversationId, data);
        }

        return data || null;
    }

    /**
     * End a flow execution
     */
    private async endExecution(executionId: string, status: 'completed' | 'failed', errorMessage?: string): Promise<void> {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return;

        await supabase
            .from('flow_executions')
            .update({
                status,
                error_message: errorMessage,
                completed_at: new Date().toISOString(),
            })
            .eq('id', executionId);

        // Remove from cache
        for (const [convId, exec] of this.activeExecutions.entries()) {
            if (exec.id === executionId) {
                this.activeExecutions.delete(convId);
                break;
            }
        }
    }

    /**
     * Send a WhatsApp message
     */
    private async sendMessage(phone: string, message: string): Promise<void> {
        try {
            await window.api.whatsapp.send({ to: phone, message });
        } catch (err) {
            console.error('[FlowEngine] Error sending message:', err);
        }
    }

    /**
     * Check for timed out executions and pause them
     */
    async cleanupTimedOutExecutions(timeoutMinutes: number = 30): Promise<void> {
        const { supabase } = useAuthStore.getState();
        if (!supabase) return;

        const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

        await supabase
            .from('flow_executions')
            .update({ status: 'paused' })
            .eq('status', 'running')
            .lt('last_activity_at', cutoffTime);
    }
}

export const FlowEngine = new FlowEngineClass();
