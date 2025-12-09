import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface Department {
  id: string;
  name: string;
  color: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DepartmentsState {
  departments: Department[];
  isLoading: boolean;
  fetchDepartments: () => Promise<void>;
  createDepartment: (data: { name: string; color: string; description?: string }) => Promise<void>;
  updateDepartment: (id: string, data: Partial<Department>) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
}

export const useDepartmentsStore = create<DepartmentsState>((set, get) => ({
  departments: [],
  isLoading: false,

  fetchDepartments: async () => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      set({ departments: data || [], isLoading: false });
    } catch (error) {
      console.error('[DepartmentsStore] Error fetching departments:', error);
      set({ isLoading: false });
    }
  },

  createDepartment: async (data) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('departments')
        .insert(data);

      if (error) throw error;

      await get().fetchDepartments();
    } catch (error) {
      console.error('[DepartmentsStore] Error creating department:', error);
      throw error;
    }
  },

  updateDepartment: async (id, data) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('departments')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      await get().fetchDepartments();
    } catch (error) {
      console.error('[DepartmentsStore] Error updating department:', error);
      throw error;
    }
  },

  deleteDepartment: async (id) => {
    const { supabase } = useAuthStore.getState();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      await get().fetchDepartments();
    } catch (error) {
      console.error('[DepartmentsStore] Error deleting department:', error);
      throw error;
    }
  },
}));

