import { create } from 'zustand';
import type { User } from '../types';
import { useAuthStore } from './authStore';

interface AgentState {
  agents: User[];
  isLoading: boolean;
  
  fetchAgents: () => Promise<void>;
  updateAgentRole: (userId: string, role: 'admin' | 'agent' | 'user') => Promise<void>;
  updateAgentStatus: (userId: string, status: 'online' | 'offline' | 'away' | 'busy') => Promise<void>;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  isLoading: false,

  fetchAgents: async () => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    set({ isLoading: true });

    const { data } = await supabase
      .from('users')
      .select('*')
      .in('role', ['admin', 'agent', 'user'])
      .order('name', { ascending: true });

    set({ agents: data || [], isLoading: false });
  },

  updateAgentRole: async (userId, role) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    await supabase
      .from('users')
      .update({ role })
      .eq('id', userId);

    const { fetchAgents } = useAgentStore.getState();
    await fetchAgents();
  },

  updateAgentStatus: async (userId, status) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    await supabase
      .from('users')
      .update({ status })
      .eq('id', userId);

    const { fetchAgents } = useAgentStore.getState();
    await fetchAgents();
  },
}));

