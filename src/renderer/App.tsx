import React, { useEffect } from 'react';
import { HashRouter, BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { useEmailStore } from './store/emailStore';
import { useThemeStore } from './store/themeStore';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { ChatPage } from './pages/ChatPage';
import { DirectMessagesPage } from './pages/DirectMessagesPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { EmailPage } from './pages/EmailPage';
import { SettingsPage } from './pages/SettingsPage';
import { AgentsPage } from './pages/AgentsPage';
import { FlowsPage } from './pages/FlowsPage';
import { FlowEditorPage } from './pages/FlowEditorPage';
import { TasksPage } from './pages/TasksPage';

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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isConfigured, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;
  if (!isConfigured) return <Navigate to="/setup" />;
  if (!isAuthenticated) return <Navigate to="/login" />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isConfigured, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;
  if (isConfigured && isAuthenticated) return <Navigate to="/chat" />;

  return <>{children}</>;
}

// Detectar si estamos en Electron o en web
const isElectron = typeof window !== 'undefined' && (
  (window as any).api !== undefined ||
  navigator.userAgent.includes('Electron')
);

// Usar HashRouter para Electron (mejor compatibilidad con file://) y BrowserRouter para web
const Router = isElectron ? HashRouter : BrowserRouter;

export default function App() {
  const { checkConfig, isLoading, isAuthenticated, config } = useAuthStore();
  const { applyTheme } = useThemeStore();
  const { isConnected, connect } = useEmailStore();

  useEffect(() => {
    checkConfig();
    applyTheme();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('kapchat_email_password');
    if (isAuthenticated && config?.email_user && saved && !isConnected) {
      connect();
    }
  }, [isAuthenticated, config?.email_user, isConnected, connect]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/chat" />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/:channelId" element={<ChatPage />} />
          <Route path="messages" element={<DirectMessagesPage />} />
          <Route path="messages/:conversationId" element={<DirectMessagesPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="whatsapp/:conversationId" element={<WhatsAppPage />} />
          <Route path="email" element={<EmailPage />} />
          <Route path="email/:emailId" element={<EmailPage />} />
          <Route path="flows" element={<FlowsPage />} />
          <Route path="flows/:flowId" element={<FlowEditorPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
