import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, UserPlus, Mail, Lock, User, Sparkles } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir múltiples envíos simultáneos
    if (isSubmitting || isLoading) {
      return;
    }
    
    setIsSubmitting(true);
    setIsLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        await register(form.email, form.password, form.name);
      }
      router.push('/');
    } catch (err: any) {
      // Mensajes de error más específicos
      if (err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
        setError('Demasiados intentos. Por favor espera unos minutos antes de intentar de nuevo.');
      } else if (err.message?.includes('User already registered')) {
        setError('Este correo electrónico ya está registrado. Intenta iniciar sesión.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('Correo electrónico o contraseña incorrectos.');
      } else {
        setError(err.message || 'Error de autenticación');
      }
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
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
          <p className="text-zinc-500">
            {isLogin ? 'Bienvenido de nuevo' : 'Crear nueva cuenta'}
          </p>
        </div>

        {/* Form */}
        <div className="glass rounded-3xl p-8 animate-slide-up">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input
                label="Nombre completo"
                placeholder="Tu nombre"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                icon={<User size={18} />}
                required
              />
            )}

            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              icon={<Mail size={18} />}
              required
            />

            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              icon={<Lock size={18} />}
              required
              minLength={6}
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
              isLoading={isLoading || isSubmitting}
              disabled={isLoading || isSubmitting}
              icon={isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
            >
              {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-kap-border">
            <p className="text-sm text-zinc-500 text-center">
              {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-kap-accent hover:underline font-medium"
              >
                {isLogin ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

