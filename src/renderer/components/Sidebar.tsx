import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  MessageSquare,
  MessageCircle,
  Mail,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Send,
  Workflow,
  CheckSquare,
  Timer,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTasksStore } from '../store/tasksStore';

const navItems = [
  { icon: MessageSquare, label: 'Canales', path: '/chat', color: 'text-kap-accent' },
  { icon: Send, label: 'Mensajes', path: '/messages', color: 'text-cyan-400' },
  { icon: MessageCircle, label: 'WhatsApp', path: '/whatsapp', color: 'text-kap-whatsapp' },
  { icon: CheckSquare, label: 'Tareas', path: '/tasks', color: 'text-emerald-400' },
  { icon: Workflow, label: 'Flows', path: '/flows', color: 'text-purple-400' },
  { icon: Mail, label: 'Email', path: '/email', color: 'text-kap-email' },
  { icon: Users, label: 'Agentes', path: '/agents', color: 'text-amber-400' },
  { icon: Settings, label: 'Ajustes', path: '/settings', color: 'text-zinc-400' },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { timer, pauseTimer, resumeTimer, stopTimer, updateTimerElapsed } = useTasksStore();
  const pathname = usePathname();
  const router = useRouter();
  const [currentElapsed, setCurrentElapsed] = useState(0);

  // Actualizar el cronómetro cada segundo
  useEffect(() => {
    if (timer.isRunning && timer.startTime) {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - timer.startTime!) / 1000);
        setCurrentElapsed(elapsed);
        updateTimerElapsed(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCurrentElapsed(timer.elapsedSeconds);
    }
  }, [timer.isRunning, timer.startTime, updateTimerElapsed]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleGoToTask = () => {
    if (timer.taskId) {
      router.push(`/tasks`);
      // El modal se abrirá desde TasksPage cuando detecte que hay un timer activo
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-emerald-500';
      case 'away': return 'bg-amber-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-zinc-500';
    }
  };

  return (
    <aside className="w-16 lg:w-64 bg-kap-darker flex flex-col transition-all duration-300">
      {/* User Profile */}
      <div className="p-3 lg:p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-kap-accent to-purple-400 flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-kap-darker ${getStatusColor(user?.status || 'offline')}`} />
          </div>
          <div className="hidden lg:block flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{user?.name}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.role}</p>
          </div>
          <button className="hidden lg:flex text-zinc-500 hover:text-zinc-300 transition-colors">
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Timer Widget - Solo se muestra si hay un cronómetro activo */}
      {timer.taskId && (
        <div className="px-3 py-2 mb-2">
          <div className="bg-kap-dark border border-emerald-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Cronómetro Activo</span>
            </div>
            <div className="mb-2">
              <div className="text-lg font-mono font-bold text-white mb-1">
                {formatTime(currentElapsed)}
              </div>
              <p className="text-xs text-zinc-400 truncate" title={timer.taskName || ''}>
                {timer.taskName || 'Tarea'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {timer.isRunning ? (
                <button
                  onClick={pauseTimer}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-white transition-colors"
                  title="Pausar"
                >
                  <Pause className="w-3 h-3" />
                  <span className="hidden lg:inline">Pausar</span>
                </button>
              ) : (
                <button
                  onClick={resumeTimer}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs text-white transition-colors"
                  title="Continuar"
                >
                  <Play className="w-3 h-3" />
                  <span className="hidden lg:inline">Continuar</span>
                </button>
              )}
              <button
                onClick={handleGoToTask}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-kap-accent/20 hover:bg-kap-accent/30 rounded text-xs text-kap-accent transition-colors"
                title="Ir a tarea"
              >
                <CheckSquare className="w-3 h-3" />
                <span className="hidden lg:inline">Ver</span>
              </button>
              <button
                onClick={stopTimer}
                className="flex items-center justify-center px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-xs text-red-400 transition-colors"
                title="Detener"
              >
                <Square className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, path, color }) => {
          const isActive = pathname?.startsWith(path) || false;
          return (
            <Link
              key={path}
              href={path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isActive
                  ? 'bg-kap-accent/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}
              `}
            >
              <Icon size={20} className={isActive ? color : ''} />
              <span className="hidden lg:block text-sm font-medium">{label}</span>
              {isActive && (
                <div className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-kap-accent" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={20} />
          <span className="hidden lg:block text-sm font-medium">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
