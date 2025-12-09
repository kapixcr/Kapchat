import { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Mail,
  Bell,
  Palette,
  Save,
  Check,
  Sun,
  Moon,
  Monitor,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUserSettingsStore } from '../store/userSettingsStore';
import { useThemeStore, ThemeMode, AccentColor } from '../store/themeStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

type TabKey = 'general' | 'email' | 'notifications' | 'appearance';

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'General', icon: Database },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'notifications', label: 'Notificaciones', icon: Bell },
  { key: 'appearance', label: 'Apariencia', icon: Palette },
];

const accentColors: { color: AccentColor; name: string }[] = [
  { color: '#7c3aed', name: 'Violeta' },
  { color: '#3b82f6', name: 'Azul' },
  { color: '#10b981', name: 'Verde' },
  { color: '#f59e0b', name: 'Ámbar' },
  { color: '#ef4444', name: 'Rojo' },
  { color: '#ec4899', name: 'Rosa' },
];

const themeModes: { mode: ThemeMode; name: string; icon: React.ElementType }[] = [
  { mode: 'dark', name: 'Oscuro', icon: Moon },
  { mode: 'light', name: 'Claro', icon: Sun },
  { mode: 'system', name: 'Sistema', icon: Monitor },
];

export function SettingsPage() {
  const { config, user, updateProfile } = useAuthStore();
  const {
    emailSettings,
    isLoading: isLoadingSettings,
    loadEmailSettings,
    saveEmailSettings
  } = useUserSettingsStore();
  const { mode, accentColor, setMode, setAccentColor } = useThemeStore();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const [generalForm, setGeneralForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [emailForm, setEmailForm] = useState({
    email_user: '',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    email_password: '',
  });

  const [notifications, setNotifications] = useState({
    chat: true,
    whatsapp: true,
    email: true,
    sounds: true,
  });

  // Load email settings when component mounts or user changes
  useEffect(() => {
    loadEmailSettings();
  }, [loadEmailSettings]);

  // Update form when emailSettings changes
  useEffect(() => {
    if (emailSettings) {
      setEmailForm({
        email_user: emailSettings.email_user || '',
        smtp_host: emailSettings.smtp_host || 'smtp.gmail.com',
        smtp_port: emailSettings.smtp_port || 587,
        imap_host: emailSettings.imap_host || 'imap.gmail.com',
        imap_port: emailSettings.imap_port || 993,
        email_password: emailSettings.email_password || '',
      });
    } else if (config) {
      // Fallback to config for backwards compatibility
      setEmailForm({
        email_user: config.email_user || '',
        smtp_host: config.smtp_host || 'smtp.gmail.com',
        smtp_port: config.smtp_port || 587,
        imap_host: config.imap_host || 'imap.gmail.com',
        imap_port: config.imap_port || 993,
        email_password: localStorage.getItem('kapchat_email_password') || '',
      });
    }
  }, [emailSettings, config]);

  // Cargar notificaciones guardadas
  useEffect(() => {
    const saved = localStorage.getItem('kapchat_notifications');
    if (saved) {
      setNotifications(JSON.parse(saved));
    }
  }, []);

  // Update general form when user changes
  useEffect(() => {
    if (user) {
      setGeneralForm({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const showSavedMessage = () => {
    setSavedMessage('Guardado');
    setTimeout(() => setSavedMessage(''), 2000);
  };

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ name: generalForm.name });
      showSavedMessage();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    setIsSaving(true);
    try {
      // Save to user_settings table via the store
      await saveEmailSettings({
        email_user: emailForm.email_user,
        email_password: emailForm.email_password,
        smtp_host: emailForm.smtp_host,
        smtp_port: emailForm.smtp_port,
        imap_host: emailForm.imap_host,
        imap_port: emailForm.imap_port,
      });

      showSavedMessage();

      // Try to connect to email after saving
      try {
        const { connect } = (await import('../store/emailStore')).useEmailStore.getState();
        const hasUser = !!emailForm.email_user;
        const hasPass = !!(emailForm.email_password || localStorage.getItem('kapchat_email_password'));
        if (hasUser && hasPass) {
          await connect();
        }
      } catch (err) {
        console.warn('No se pudo conectar email desde Ajustes:', err);
      }
    } catch (err) {
      console.error('Error saving email settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('kapchat_notifications', JSON.stringify(notifications));
    showSavedMessage();
  };

  const handleThemeModeChange = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const handleAccentColorChange = (color: AccentColor) => {
    setAccentColor(color);
  };

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-64 bg-kap-darker p-4">
        <div className="flex items-center gap-2 mb-6">
          <Settings size={20} className="text-kap-accent" />
          <h1 className="text-lg font-display font-semibold text-white">Ajustes</h1>
        </div>

        <nav className="space-y-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
                ${activeTab === key
                  ? 'bg-kap-accent/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}
              `}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {/* Saved indicator */}
          {savedMessage && (
            <div className="fixed top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 animate-fade-in z-50">
              <Check size={16} />
              <span className="text-sm font-medium">{savedMessage}</span>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-display font-semibold text-white mb-2">
                  General
                </h2>
                <p className="text-sm text-zinc-500">
                  Configuración general de tu cuenta
                </p>
              </div>

              <div className="space-y-4 p-6 rounded-2xl bg-kap-surface border border-kap-border">
                <Input
                  label="Nombre"
                  value={generalForm.name}
                  onChange={(e) => setGeneralForm({ ...generalForm, name: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  value={generalForm.email}
                  disabled
                />
                <div className="pt-4">
                  <Button onClick={handleSaveGeneral} isLoading={isSaving} icon={<Save size={16} />}>
                    Guardar cambios
                  </Button>
                </div>
              </div>

              <div className="space-y-4 p-6 rounded-2xl bg-kap-surface border border-kap-border">
                <h3 className="font-medium text-white">Supabase</h3>
                <Input
                  label="URL del proyecto"
                  value={config?.supabase_url || ''}
                  disabled
                />
                <Input
                  label="Anon Key"
                  type="password"
                  value={config?.supabase_anon_key || ''}
                  disabled
                />
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-display font-semibold text-white mb-2">
                  Configuración de Email
                </h2>
                <p className="text-sm text-zinc-500">
                  Configura tu cuenta de Google Workspace para enviar y recibir correos.
                  <br />
                  <span className="text-kap-accent">Esta configuración se guarda en tu cuenta y estará disponible en cualquier dispositivo.</span>
                </p>
              </div>

              {isLoadingSettings ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-kap-accent" />
                </div>
              ) : (
                <div className="space-y-4 p-6 rounded-2xl bg-kap-surface border border-kap-border">
                  <Input
                    label="Email de la cuenta"
                    type="email"
                    placeholder="tu@empresa.com"
                    value={emailForm.email_user}
                    onChange={(e) => setEmailForm({ ...emailForm, email_user: e.target.value })}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Servidor SMTP"
                      value={emailForm.smtp_host}
                      onChange={(e) => setEmailForm({ ...emailForm, smtp_host: e.target.value })}
                    />
                    <Input
                      label="Puerto SMTP"
                      type="number"
                      value={emailForm.smtp_port}
                      onChange={(e) => setEmailForm({ ...emailForm, smtp_port: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Servidor IMAP"
                      value={emailForm.imap_host}
                      onChange={(e) => setEmailForm({ ...emailForm, imap_host: e.target.value })}
                    />
                    <Input
                      label="Puerto IMAP"
                      type="number"
                      value={emailForm.imap_port}
                      onChange={(e) => setEmailForm({ ...emailForm, imap_port: parseInt(e.target.value) })}
                    />
                  </div>

                  <Input
                    label="Contraseña de aplicación"
                    type="password"
                    placeholder="••••••••••••••••"
                    value={emailForm.email_password}
                    onChange={(e) => setEmailForm({ ...emailForm, email_password: e.target.value })}
                  />

                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-400">
                      <strong>Nota:</strong> Para Gmail y Google Workspace, necesitas usar una contraseña de aplicación.
                      Ve a tu cuenta de Google → Seguridad → Contraseñas de aplicaciones.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-kap-accent/10 border border-kap-accent/20">
                    <p className="text-sm text-kap-accent">
                      <strong>💾 Persistencia:</strong> Tu configuración de email se guarda de forma segura
                      en tu cuenta y estará disponible automáticamente cuando inicies sesión en cualquier dispositivo.
                    </p>
                  </div>

                  <div className="pt-4">
                    <Button onClick={handleSaveEmail} isLoading={isSaving} icon={<Save size={16} />}>
                      Guardar configuración
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-display font-semibold text-white mb-2">
                  Notificaciones
                </h2>
                <p className="text-sm text-zinc-500">
                  Configura cómo quieres recibir notificaciones
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'chat', label: 'Nuevos mensajes de chat', description: 'Recibe notificaciones de nuevos mensajes' },
                  { key: 'whatsapp', label: 'Mensajes de WhatsApp', description: 'Notificaciones de mensajes entrantes' },
                  { key: 'email', label: 'Nuevos correos', description: 'Alertas de correos recibidos' },
                  { key: 'sounds', label: 'Sonidos', description: 'Reproducir sonidos de notificación' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-4 rounded-xl bg-kap-surface border border-kap-border cursor-pointer hover:border-kap-accent/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-zinc-200">{item.label}</p>
                      <p className="text-sm text-zinc-500">{item.description}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications[item.key as keyof typeof notifications]}
                      onChange={(e) => {
                        const newNotifications = { ...notifications, [item.key]: e.target.checked };
                        setNotifications(newNotifications);
                      }}
                      className="w-5 h-5 rounded border-kap-border text-kap-accent focus:ring-kap-accent"
                    />
                  </label>
                ))}
              </div>

              <Button onClick={handleSaveNotifications} icon={<Save size={16} />}>
                Guardar preferencias
              </Button>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-display font-semibold text-white mb-2">
                  Apariencia
                </h2>
                <p className="text-sm text-zinc-500">
                  Personaliza la apariencia de Kapchat
                </p>
              </div>

              {/* Tema */}
              <div className="space-y-4 p-6 rounded-2xl bg-kap-surface border border-kap-border">
                <h3 className="font-medium text-white mb-4">Tema</h3>
                <div className="grid grid-cols-3 gap-3">
                  {themeModes.map(({ mode: themeMode, name, icon: Icon }) => (
                    <button
                      key={themeMode}
                      onClick={() => handleThemeModeChange(themeMode)}
                      className={`
                        p-4 rounded-xl border-2 transition-all duration-200
                        ${mode === themeMode
                          ? 'border-kap-accent bg-kap-accent/10'
                          : 'border-kap-border hover:border-kap-accent/50'}
                      `}
                    >
                      <div className={`
                        w-full h-16 rounded-lg mb-3 flex items-center justify-center
                        ${themeMode === 'dark' ? 'bg-zinc-900' : themeMode === 'light' ? 'bg-zinc-100' : 'bg-gradient-to-br from-zinc-900 to-zinc-100'}
                      `}>
                        <Icon size={24} className={themeMode === 'dark' ? 'text-zinc-400' : themeMode === 'light' ? 'text-zinc-600' : 'text-zinc-500'} />
                      </div>
                      <span className="text-sm text-zinc-300">{name}</span>
                      {mode === themeMode && (
                        <div className="mt-2 flex justify-center">
                          <Check size={16} className="text-kap-accent" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color de acento */}
              <div className="space-y-4 p-6 rounded-2xl bg-kap-surface border border-kap-border">
                <h3 className="font-medium text-white mb-4">Color de acento</h3>
                <div className="flex flex-wrap gap-3">
                  {accentColors.map(({ color, name }) => (
                    <button
                      key={color}
                      onClick={() => handleAccentColorChange(color)}
                      title={name}
                      className={`
                        w-12 h-12 rounded-xl transition-all duration-200 relative
                        ${accentColor === color
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-kap-surface scale-110'
                          : 'hover:scale-105'}
                      `}
                      style={{ backgroundColor: color }}
                    >
                      {accentColor === color && (
                        <Check size={20} className="absolute inset-0 m-auto text-white drop-shadow-lg" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Color seleccionado: <span className="font-medium" style={{ color: accentColor }}>
                    {accentColors.find(c => c.color === accentColor)?.name}
                  </span>
                </p>
              </div>

              {/* Preview */}
              <div className="space-y-4 p-6 rounded-2xl bg-kap-surface border border-kap-border">
                <h3 className="font-medium text-white mb-4">Vista previa</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Button>Botón primario</Button>
                    <Button variant="secondary">Secundario</Button>
                    <Button variant="ghost">Ghost</Button>
                  </div>
                  <div className="p-3 rounded-xl bg-kap-surface-light border border-kap-border">
                    <p className="text-sm text-zinc-300">
                      Este es un mensaje de ejemplo con el <span className="text-kap-accent font-medium">color de acento</span> aplicado.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-kap-accent animate-pulse" />
                    <span className="text-sm text-zinc-400">Estado activo</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
