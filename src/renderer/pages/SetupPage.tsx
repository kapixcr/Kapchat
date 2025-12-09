import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuthStore } from '../store/authStore';

export function SetupPage() {
  const navigate = useNavigate();
  const { setConfig, checkConfig, isConfigured } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasEnvConfig, setHasEnvConfig] = useState(false);
  const [form, setForm] = useState({
    supabase_url: '',
    supabase_anon_key: '',
  });

  useEffect(() => {
    // Verificar si hay configuración en .env
    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (envUrl && envKey) {
      setHasEnvConfig(true);
      setForm({
        supabase_url: envUrl,
        supabase_anon_key: envKey,
      });
    }
    
    // Si ya está configurado, ir al login
    checkConfig();
  }, [checkConfig]);

  useEffect(() => {
    if (isConfigured) {
      navigate('/login');
    }
  }, [isConfigured, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      setConfig({
        supabase_url: form.supabase_url,
        supabase_anon_key: form.supabase_anon_key,
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Error al configurar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseEnvConfig = () => {
    setConfig({
      supabase_url: form.supabase_url,
      supabase_anon_key: form.supabase_anon_key,
    });
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-kap-dark gradient-mesh flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-kap-accent to-purple-400 shadow-2xl shadow-kap-accent/30 mb-6">
            <Sparkles size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Kapchat</h1>
          <p className="text-zinc-500">Configuración inicial</p>
        </div>

        {/* Env Config Found */}
        {hasEnvConfig && (
          <div className="glass rounded-3xl p-8 mb-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle size={20} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-white">Configuración detectada</h2>
                <p className="text-xs text-zinc-500">Se encontró configuración en .env</p>
              </div>
            </div>
            
            <div className="p-3 rounded-xl bg-kap-surface-light border border-kap-border mb-4">
              <p className="text-xs text-zinc-500 mb-1">URL del proyecto</p>
              <p className="text-sm text-zinc-300 truncate">{form.supabase_url}</p>
            </div>
            
            <Button
              onClick={handleUseEnvConfig}
              className="w-full"
              size="lg"
              icon={<ArrowRight size={18} />}
            >
              Usar esta configuración
            </Button>
          </div>
        )}

        {/* Manual Form */}
        <div className="glass rounded-3xl p-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-kap-accent/20 flex items-center justify-center">
              <Database size={20} className="text-kap-accent" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-white">
                {hasEnvConfig ? 'O configura manualmente' : 'Supabase'}
              </h2>
              <p className="text-xs text-zinc-500">Conecta tu base de datos</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="URL del proyecto"
              placeholder="https://xxxxx.supabase.co"
              value={form.supabase_url}
              onChange={(e) => setForm({ ...form, supabase_url: e.target.value })}
              required
            />

            <Input
              label="Anon Key"
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              value={form.supabase_anon_key}
              onChange={(e) => setForm({ ...form, supabase_anon_key: e.target.value })}
              required
            />

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
              variant={hasEnvConfig ? 'secondary' : 'primary'}
              icon={<ArrowRight size={18} />}
            >
              Continuar
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-kap-border">
            <p className="text-xs text-zinc-500 text-center">
              ¿No tienes Supabase?{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-kap-accent hover:underline"
              >
                Crear cuenta gratis
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
