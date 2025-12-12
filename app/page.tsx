'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

function LoadingScreen() {
  return (
    <div className="h-screen w-screen bg-kap-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-kap-accent to-purple-400 flex items-center justify-center animate-pulse">
          <span className="text-2xl font-bold text-white">K</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isConfigured, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    
    if (!isConfigured) {
      router.push('/setup');
    } else if (!isAuthenticated) {
      router.push('/login');
    } else {
      router.push('/chat');
    }
  }, [isLoading, isConfigured, isAuthenticated, router]);

  return <LoadingScreen />;
}

