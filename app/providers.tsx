'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const { checkConfig } = useAuthStore();

  useEffect(() => {
    // Inicializar stores al cargar la app
    checkConfig();
  }, [checkConfig]);

  return <>{children}</>;
}

