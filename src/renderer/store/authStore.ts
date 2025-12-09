import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import type { User, AppConfig } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isLoading: boolean;
  config: AppConfig | null;
  supabase: SupabaseClient | null;
  setConfig: (config: AppConfig) => void;
  checkConfig: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearCorruptedSession: () => Promise<void>;
}

// Singleton para el cliente de Supabase
let supabaseInstance: SupabaseClient | null = null;

// Obtener configuración desde variables de entorno
const getEnvConfig = (): AppConfig | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  console.log('🔍 Checking .env config:', {
    hasUrl: !!url,
    hasKey: !!key,
    urlLength: url?.length || 0,
    keyLength: key?.length || 0,
    isElectron: typeof window !== 'undefined' && window.process?.type === 'renderer',
  });

  if (url && key) {
    return {
      supabase_url: url,
      supabase_anon_key: key,
      email_user: import.meta.env.VITE_EMAIL_USER || '',
      smtp_host: import.meta.env.VITE_SMTP_HOST || 'smtp.gmail.com',
      smtp_port: parseInt(import.meta.env.VITE_SMTP_PORT || '587'),
      imap_host: import.meta.env.VITE_IMAP_HOST || 'imap.gmail.com',
      imap_port: parseInt(import.meta.env.VITE_IMAP_PORT || '993'),
    };
  }
  console.warn('⚠️ .env config not found or incomplete');
  return null;
};

// Crear cliente de Supabase singleton
const getSupabaseClient = (url: string, key: string): SupabaseClient => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  console.log('🔌 Creating Supabase client with URL:', url.substring(0, 30) + '...');

  supabaseInstance = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: localStorage,
      storageKey: 'kapchat-auth-token',
      flowType: 'pkce', // Usar PKCE flow para mejor seguridad y compatibilidad
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      heartbeatIntervalMs: 30000,
      reconnectAfterMs: (tries: number) => {
        const delay = Math.min(tries * 1000, 10000);
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${tries})`);
        return delay;
      },
      log_level: 'info', // Habilitar logs de realtime para debugging
    },
    global: {
      headers: {
        'X-Client-Info': 'kapchat-electron',
      },
    },
  });

  console.log('✅ Supabase client created successfully');

  return supabaseInstance;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isConfigured: false,
      isLoading: true,
      config: null,
      supabase: null,

      setConfig: (config) => {
        const supabase = getSupabaseClient(config.supabase_url, config.supabase_anon_key);
        set({ config, isConfigured: true, supabase });
        localStorage.setItem('kapchat_config', JSON.stringify(config));
      },

      checkConfig: async () => {
        console.log('🔧 Checking configuration...');

        // Si ya tenemos supabase configurado, no hacer nada
        if (get().supabase && get().isConfigured) {
          console.log('✅ Already configured, initializing auth...');
          await get().initializeAuth();
          return;
        }

        // Primero intentar cargar desde .env
        const envConfig = getEnvConfig();
        if (envConfig) {
          console.log('✅ Found .env config, creating Supabase client...');
          const supabase = getSupabaseClient(envConfig.supabase_url, envConfig.supabase_anon_key);
          set({ config: envConfig, isConfigured: true, supabase });
          console.log('✅ Supabase client created, initializing auth...');
          await get().initializeAuth();
          return;
        }

        // Si no hay .env, buscar en localStorage
        console.log('📦 No .env found, checking localStorage...');
        const stored = localStorage.getItem('kapchat_config');
        if (stored) {
          console.log('✅ Found config in localStorage');
          const config = JSON.parse(stored) as AppConfig;
          const supabase = getSupabaseClient(config.supabase_url, config.supabase_anon_key);
          set({ config, isConfigured: true, supabase });
          await get().initializeAuth();
        } else {
          console.log('❌ No configuration found');
          set({ isLoading: false });
        }
      },

      initializeAuth: async () => {
        const { supabase } = get();
        if (!supabase) {
          set({ isLoading: false });
          return;
        }

        try {
          // Verificar sesión existente
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            console.error('Error getting session:', error);

            // Si el error es relacionado con refresh_token_hmac_key, limpiar la sesión corrupta
            if (error.message?.includes('refresh_token_hmac_key') || error.message?.includes('missing destination')) {
              console.warn('⚠️ Session structure error detected, clearing corrupted session...');
              try {
                // Limpiar localStorage de autenticación
                localStorage.removeItem('kapchat-auth-token');
                // Intentar cerrar sesión para limpiar cualquier estado corrupto
                await supabase.auth.signOut();
              } catch (cleanupError) {
                console.error('Error cleaning up session:', cleanupError);
              }
            }

            set({ isLoading: false, isAuthenticated: false, user: null, session: null });
            return;
          }

          if (session?.user) {
            // Obtener perfil del usuario
            const { data: profile, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              set({
                user: profile,
                session,
                isAuthenticated: true,
                isLoading: false,
              });
            } else if (profileError) {
              console.warn('Profile not found during init:', profileError);

              // Si el perfil no existe, intentar crearlo
              if (profileError.code === 'PGRST116') {
                console.log('Profile does not exist, attempting to create...');
                const newProfile = {
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuario',
                  role: 'user',
                  status: 'online',
                };

                const { data: createdProfile, error: createError } = await supabase
                  .from('users')
                  .insert(newProfile)
                  .select()
                  .single();

                if (createdProfile) {
                  set({
                    user: createdProfile,
                    session,
                    isAuthenticated: true,
                    isLoading: false,
                  });
                } else {
                  console.error('Error creating profile during init:', createError);
                  set({ isLoading: false, isAuthenticated: false });
                }
              } else {
                set({ isLoading: false, isAuthenticated: false });
              }
            } else {
              set({ isLoading: false, isAuthenticated: false });
            }
          } else {
            set({ isLoading: false, isAuthenticated: false });
          }

          // Escuchar cambios de autenticación (solo una vez)
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);

            if (event === 'SIGNED_IN' && session?.user) {
              const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (profile) {
                set({ user: profile, session, isAuthenticated: true });
              }
            } else if (event === 'SIGNED_OUT') {
              set({ user: null, session: null, isAuthenticated: false });
            } else if (event === 'TOKEN_REFRESHED' && session) {
              set({ session });
            } else if (event === 'TOKEN_REFRESHED' && !session) {
              // Si el refresh falla, limpiar la sesión
              console.warn('⚠️ Token refresh failed, clearing session');
              localStorage.removeItem('kapchat-auth-token');
              set({ user: null, session: null, isAuthenticated: false });
            }
          });
        } catch (error) {
          console.error('Error initializing auth:', error);
          set({ isLoading: false });
        }
      },

      login: async (email, password) => {
        const { supabase } = get();
        if (!supabase) throw new Error('Supabase no configurado');

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Get user profile
        let { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        // Manejar error 406 (Not Acceptable) - puede ser un problema de headers
        if (profileError && (profileError.code === 'PGRST301' || profileError.message?.includes('406'))) {
          console.warn('406 error detected, retrying with different approach...');
          // Reintentar con una query más simple
          const { data: retryData, error: retryErr } = await supabase
            .from('users')
            .select('id, email, name, role, status, avatar, created_at, updated_at')
            .eq('id', data.user.id)
            .single();

          if (retryData) {
            profile = retryData;
            profileError = null;
          } else {
            profileError = retryErr;
          }
        }

        // Si no existe el perfil, esperar un poco por si el trigger lo crea
        if (profileError || !profile) {
          console.log('Profile not found, waiting for trigger...');

          // Esperar un poco para que el trigger cree el perfil
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Intentar obtener el perfil de nuevo
          const { data: retryProfile, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (retryProfile) {
            profile = retryProfile;
          } else if (retryError?.code === 'PGRST116') {
            // Si aún no existe, intentar usar la función helper primero
            console.log('Profile not found, trying helper function...');

            try {
              // Intentar usar la función helper que tiene SECURITY DEFINER
              const { data: helperResult, error: helperError } = await supabase
                .rpc('create_user_profile', {
                  user_id: data.user.id,
                  user_email: data.user.email || email,
                  user_name: data.user.user_metadata?.name || email.split('@')[0],
                });

              if (helperError) {
                console.error('Helper function error:', helperError);
                throw helperError;
              }

              // La función retorna un array, tomar el primer elemento
              if (helperResult && Array.isArray(helperResult) && helperResult.length > 0) {
                profile = helperResult[0] as any;
                console.log('✅ Profile created via helper function');
              } else if (helperResult && !Array.isArray(helperResult)) {
                // Si retorna un objeto directamente
                profile = helperResult as any;
                console.log('✅ Profile created via helper function');
              } else {
                // Si no retorna nada, esperar un poco y obtener el perfil
                console.log('Helper function executed, fetching profile...');
                await new Promise(resolve => setTimeout(resolve, 500));

                const { data: fetchedProfile, error: fetchError } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', data.user.id)
                  .single();

                if (fetchedProfile) {
                  profile = fetchedProfile;
                } else {
                  throw fetchError || new Error('No se pudo obtener el perfil después de crearlo');
                }
              }
            } catch (helperErr: any) {
              console.warn('Helper function failed, trying direct insert:', helperErr);

              // Si la función helper falla, intentar inserción directa
              const newProfile = {
                id: data.user.id,
                email: data.user.email || email,
                name: data.user.user_metadata?.name || email.split('@')[0],
                role: 'user',
                status: 'online',
              };

              const { data: createdProfile, error: createError } = await supabase
                .from('users')
                .insert(newProfile)
                .select()
                .single();

              if (createError) {
                console.error('Error creating profile:', createError);

                // Último intento: esperar un poco más y volver a intentar obtener
                await new Promise(resolve => setTimeout(resolve, 2000));
                const { data: finalRetry } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', data.user.id)
                  .single();

                if (finalRetry) {
                  profile = finalRetry;
                } else {
                  throw new Error(`No se pudo crear el perfil del usuario: ${createError.message}. Por favor, ejecuta el script fix_rls_policies.sql en Supabase.`);
                }
              } else {
                profile = createdProfile;
              }
            }
          } else {
            throw new Error(`Error al obtener el perfil: ${retryError?.message || 'Desconocido'}`);
          }
        }

        if (profile) {
          // Update status to online
          await supabase
            .from('users')
            .update({ status: 'online' })
            .eq('id', data.user.id);

          set({
            user: { ...profile, status: 'online' },
            session: data.session,
            isAuthenticated: true,
          });

          // Load user settings (email config) after successful login
          try {
            const { useUserSettingsStore } = await import('./userSettingsStore');
            await useUserSettingsStore.getState().loadEmailSettings();

            // Update config with loaded email settings
            const emailSettings = useUserSettingsStore.getState().emailSettings;
            if (emailSettings?.email_user) {
              const currentConfig = get().config;
              if (currentConfig) {
                set({
                  config: {
                    ...currentConfig,
                    email_user: emailSettings.email_user,
                    smtp_host: emailSettings.smtp_host,
                    smtp_port: emailSettings.smtp_port,
                    imap_host: emailSettings.imap_host,
                    imap_port: emailSettings.imap_port,
                  },
                });
              }
            }
          } catch (settingsErr) {
            console.warn('[Auth] Error loading user settings:', settingsErr);
          }
        }
      },

      logout: async () => {
        const { supabase, user } = get();
        if (supabase && user) {
          try {
            await supabase
              .from('users')
              .update({ status: 'offline' })
              .eq('id', user.id);
          } catch (err) {
            console.warn('Error updating user status:', err);
          }

          try {
            await supabase.auth.signOut();
          } catch (err) {
            console.warn('Error signing out:', err);
            // Limpiar manualmente si falla
            localStorage.removeItem('kapchat-auth-token');
          }
        } else {
          // Limpiar manualmente si no hay supabase
          localStorage.removeItem('kapchat-auth-token');
        }
        set({ user: null, session: null, isAuthenticated: false });
      },

      clearCorruptedSession: async () => {
        const { supabase } = get();
        console.log('🧹 Clearing corrupted session...');

        // Limpiar localStorage
        localStorage.removeItem('kapchat-auth-token');

        // Intentar cerrar sesión en Supabase
        if (supabase) {
          try {
            await supabase.auth.signOut();
          } catch (err) {
            console.warn('Error during cleanup signOut:', err);
          }
        }

        // Resetear estado
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false
        });

        console.log('✅ Session cleared, please login again');
      },

      register: async (email, password, name) => {
        const { supabase } = get();
        if (!supabase) throw new Error('Supabase no configurado');

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            },
          },
        });

        if (error) {
          // Manejar error 429 (Too Many Requests) con mensaje más claro
          if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
            throw new Error('Demasiados intentos. Por favor espera unos minutos antes de intentar de nuevo.');
          }
          throw error;
        }
        if (!data.user) throw new Error('Error al crear usuario');

        // Esperar a que el trigger cree el perfil
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Obtener el perfil creado por el trigger
        let { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          // Si el trigger no funcionó, esperar un poco más
          console.log('Profile not found after trigger, waiting a bit more...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Intentar obtener de nuevo
          const { data: retryProfile, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (retryProfile) {
            profile = retryProfile;
          } else if (retryError?.code === 'PGRST116') {
            // Si aún no existe, intentar usar la función helper primero
            console.log('Trigger did not create profile, trying helper function...');

            try {
              // Intentar usar la función helper que tiene SECURITY DEFINER
              const { data: helperResult, error: helperError } = await supabase
                .rpc('create_user_profile', {
                  user_id: data.user.id,
                  user_email: email,
                  user_name: name,
                });

              if (helperError) {
                console.error('Helper function error:', helperError);
                throw helperError;
              }

              // La función retorna un array, tomar el primer elemento
              if (helperResult && Array.isArray(helperResult) && helperResult.length > 0) {
                profile = helperResult[0] as any;
                console.log('✅ Profile created via helper function');
              } else if (helperResult && !Array.isArray(helperResult)) {
                // Si retorna un objeto directamente
                profile = helperResult as any;
                console.log('✅ Profile created via helper function');
              } else {
                // Si no retorna nada, esperar un poco y obtener el perfil
                console.log('Helper function executed, fetching profile...');
                await new Promise(resolve => setTimeout(resolve, 500));

                const { data: fetchedProfile, error: fetchError } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', data.user.id)
                  .single();

                if (fetchedProfile) {
                  profile = fetchedProfile;
                } else {
                  throw fetchError || new Error('No se pudo obtener el perfil después de crearlo');
                }
              }
            } catch (helperErr: any) {
              console.warn('Helper function failed, trying direct insert:', helperErr);

              // Si la función helper falla, intentar inserción directa
              const newUser = {
                id: data.user.id,
                email,
                name,
                role: 'user',
                status: 'online',
              };

              const { data: createdProfile, error: insertError } = await supabase
                .from('users')
                .insert(newUser)
                .select()
                .single();

              if (insertError) {
                console.error('Error creating user profile:', insertError);

                // Último intento: esperar más y volver a intentar obtener
                await new Promise(resolve => setTimeout(resolve, 2000));
                const { data: finalRetry } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', data.user.id)
                  .single();

                if (finalRetry) {
                  profile = finalRetry;
                } else {
                  throw new Error(`Error al crear el perfil del usuario: ${insertError.message}. Por favor, ejecuta el script fix_rls_policies.sql en Supabase.`);
                }
              } else {
                profile = createdProfile;
              }
            }
          } else {
            throw new Error(`Error al obtener el perfil: ${retryError?.message || profileError?.message || 'Desconocido'}`);
          }
        }

        if (profile) {
          set({
            user: profile,
            session: data.session,
            isAuthenticated: true,
          });
        } else {
          throw new Error('No se pudo obtener o crear el perfil del usuario');
        }
      },

      updateProfile: async (data) => {
        const { supabase, user } = get();
        if (!supabase || !user) throw new Error('No autenticado');

        const { error } = await supabase
          .from('users')
          .update(data)
          .eq('id', user.id);

        if (error) throw error;

        set({ user: { ...user, ...data } });
      },
    }),
    {
      name: 'kapchat-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        config: state.config,
      }),
      onRehydrate: () => {
        return (state) => {
          // Restaurar el cliente de Supabase después de rehidratar
          if (state?.config) {
            const supabase = getSupabaseClient(state.config.supabase_url, state.config.supabase_anon_key);
            state.supabase = supabase;
            state.isConfigured = true;
          }
        };
      },
    }
  )
);
