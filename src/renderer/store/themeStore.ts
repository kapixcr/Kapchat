import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = '#7c3aed' | '#3b82f6' | '#10b981' | '#f59e0b' | '#ef4444' | '#ec4899';

interface ThemeState {
  mode: ThemeMode;
  accentColor: AccentColor;
  
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  applyTheme: () => void;
}

const accentColors: Record<AccentColor, { name: string; rgb: string; hover: string }> = {
  '#7c3aed': { name: 'Violeta', rgb: '124, 58, 237', hover: '#8b5cf6' },
  '#3b82f6': { name: 'Azul', rgb: '59, 130, 246', hover: '#60a5fa' },
  '#10b981': { name: 'Verde', rgb: '16, 185, 129', hover: '#34d399' },
  '#f59e0b': { name: 'Ámbar', rgb: '245, 158, 11', hover: '#fbbf24' },
  '#ef4444': { name: 'Rojo', rgb: '239, 68, 68', hover: '#f87171' },
  '#ec4899': { name: 'Rosa', rgb: '236, 72, 153', hover: '#f472b6' },
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      accentColor: '#7c3aed',

      setMode: (mode) => {
        set({ mode });
        get().applyTheme();
      },

      setAccentColor: (color) => {
        set({ accentColor: color });
        get().applyTheme();
      },

      applyTheme: () => {
        // Solo aplicar en el cliente
        if (typeof window === 'undefined') return;
        
        const { mode, accentColor } = get();
        const root = document.documentElement;
        const colorInfo = accentColors[accentColor];

        // Aplicar color de acento
        root.style.setProperty('--color-accent', accentColor);
        root.style.setProperty('--color-accent-rgb', colorInfo.rgb);
        root.style.setProperty('--color-accent-hover', colorInfo.hover);

        // Aplicar modo
        let effectiveMode = mode;
        if (mode === 'system') {
          effectiveMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        if (effectiveMode === 'dark') {
          root.style.setProperty('--color-bg-dark', '#0f0f12');
          root.style.setProperty('--color-bg-darker', '#0a0a0d');
          root.style.setProperty('--color-surface', '#18181d');
          root.style.setProperty('--color-surface-light', '#1f1f26');
          root.style.setProperty('--color-border', '#2a2a35');
          root.style.setProperty('--color-text-primary', '#e4e4e7');
          root.style.setProperty('--color-text-secondary', '#a1a1aa');
          root.style.setProperty('--color-text-muted', '#71717a');
          root.classList.remove('light-mode');
          root.classList.add('dark-mode');
        } else {
          root.style.setProperty('--color-bg-dark', '#f4f4f5');
          root.style.setProperty('--color-bg-darker', '#e4e4e7');
          root.style.setProperty('--color-surface', '#ffffff');
          root.style.setProperty('--color-surface-light', '#fafafa');
          root.style.setProperty('--color-border', '#d4d4d8');
          root.style.setProperty('--color-text-primary', '#18181b');
          root.style.setProperty('--color-text-secondary', '#3f3f46');
          root.style.setProperty('--color-text-muted', '#71717a');
          root.classList.remove('dark-mode');
          root.classList.add('light-mode');
        }
      },
    }),
    {
      name: 'kapchat-theme',
      onRehydrateStorage: () => (state) => {
        // Aplicar tema al cargar
        if (state) {
          setTimeout(() => state.applyTheme(), 0);
        }
      },
    }
  )
);

// Escuchar cambios en preferencia del sistema
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { mode, applyTheme } = useThemeStore.getState();
    if (mode === 'system') {
      applyTheme();
    }
  });
}

