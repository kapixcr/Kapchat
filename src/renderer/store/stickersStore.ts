import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface Sticker {
  id: string;
  name: string;
  file_url: string;
  file_path?: string;
  mime_type: string;
  uploaded_by?: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface StickersState {
  stickers: Sticker[];
  isLoading: boolean;
  error: string | null;
  fetchStickers: () => Promise<void>;
  uploadSticker: (file: File, name: string, category?: string) => Promise<Sticker>;
  deleteSticker: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useStickersStore = create<StickersState>((set, get) => ({
  stickers: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchStickers: async () => {
    set({ isLoading: true, error: null });
    const { supabase } = useAuthStore.getState();
    if (!supabase) {
      set({ isLoading: false, error: 'No hay conexión a Supabase' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('stickers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ stickers: data || [], isLoading: false });
    } catch (err: any) {
      console.error('[StickersStore] Error fetching stickers:', err);
      set({ error: err.message, isLoading: false });
    }
  },

  uploadSticker: async (file: File, name: string, category = 'general') => {
    set({ isLoading: true, error: null });
    const { supabase, user } = useAuthStore.getState();
    if (!supabase || !user) {
      set({ isLoading: false, error: 'No hay conexión a Supabase o usuario no autenticado' });
      throw new Error('No hay conexión a Supabase o usuario no autenticado');
    }

    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `stickers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('stickers')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('stickers')
        .getPublicUrl(filePath);

      // Save sticker metadata to database
      const { data, error: insertError } = await supabase
        .from('stickers')
        .insert({
          name,
          file_url: publicUrl,
          file_path: filePath,
          mime_type: file.type,
          uploaded_by: user.id,
          category,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Refresh stickers list
      await get().fetchStickers();

      set({ isLoading: false });
      return data;
    } catch (err: any) {
      console.error('[StickersStore] Error uploading sticker:', err);
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  deleteSticker: async (id: string) => {
    set({ isLoading: true, error: null });
    const { supabase } = useAuthStore.getState();
    if (!supabase) {
      set({ isLoading: false, error: 'No hay conexión a Supabase' });
      return;
    }

    try {
      // Get sticker to delete file
      const sticker = get().stickers.find(s => s.id === id);
      
      // Delete from database (soft delete by setting is_active to false)
      const { error } = await supabase
        .from('stickers')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      // Optionally delete file from storage
      if (sticker?.file_path) {
        await supabase.storage
          .from('stickers')
          .remove([sticker.file_path]);
      }

      // Refresh stickers list
      await get().fetchStickers();

      set({ isLoading: false });
    } catch (err: any) {
      console.error('[StickersStore] Error deleting sticker:', err);
      set({ error: err.message, isLoading: false });
    }
  },
}));

