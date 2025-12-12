'use client';

import { Sidebar } from '@/components/Sidebar';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isConfigured, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!isConfigured) {
      router.push('/setup');
    } else if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isConfigured, isAuthenticated, router]);

  if (isLoading || !isConfigured || !isAuthenticated) {
    return null; // El middleware de Next.js manejará la redirección
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-kap-dark overflow-hidden">
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

