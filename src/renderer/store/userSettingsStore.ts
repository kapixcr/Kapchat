import { create } from 'zustand';
import { useAuthStore } from './authStore';

interface EmailSettings {
    email_user: string;
    email_password: string;
    smtp_host: string;
    smtp_port: number;
    imap_host: string;
    imap_port: number;
}

interface UserSettingsState {
    emailSettings: EmailSettings | null;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    loadEmailSettings: () => Promise<void>;
    saveEmailSettings: (settings: Partial<EmailSettings>) => Promise<void>;
    clearSettings: () => void;
}

export const useUserSettingsStore = create<UserSettingsState>((set, get) => ({
    emailSettings: null,
    isLoading: false,
    isSaving: false,
    error: null,

    loadEmailSettings: async () => {
        const { supabase, user } = useAuthStore.getState();
        if (!supabase || !user) {
            console.log('[UserSettings] No user or supabase, skipping load');
            return;
        }

        set({ isLoading: true, error: null });

        try {
            // Call the RPC function to get settings with decrypted password
            const { data, error } = await supabase.rpc('get_email_settings', {
                p_user_id: user.id,
            });

            if (error) {
                console.error('[UserSettings] Error loading email settings:', error);

                // If function doesn't exist, try direct query (without password)
                if (error.code === '42883') {
                    console.log('[UserSettings] RPC not found, trying direct query');
                    const { data: directData, error: directError } = await supabase
                        .from('user_settings')
                        .select('email_user, smtp_host, smtp_port, imap_host, imap_port')
                        .eq('user_id', user.id)
                        .single();

                    if (directData) {
                        // Load password from localStorage as fallback
                        const storedPassword = localStorage.getItem('kapchat_email_password') || '';

                        set({
                            emailSettings: {
                                email_user: directData.email_user || '',
                                email_password: storedPassword,
                                smtp_host: directData.smtp_host || 'smtp.gmail.com',
                                smtp_port: directData.smtp_port || 587,
                                imap_host: directData.imap_host || 'imap.gmail.com',
                                imap_port: directData.imap_port || 993,
                            },
                            isLoading: false,
                        });
                        return;
                    } else if (directError?.code !== 'PGRST116') {
                        throw directError;
                    }
                } else {
                    throw error;
                }
            }

            if (data && data.length > 0) {
                const settings = data[0];
                set({
                    emailSettings: {
                        email_user: settings.email_user || '',
                        email_password: settings.email_password || '',
                        smtp_host: settings.smtp_host || 'smtp.gmail.com',
                        smtp_port: settings.smtp_port || 587,
                        imap_host: settings.imap_host || 'imap.gmail.com',
                        imap_port: settings.imap_port || 993,
                    },
                    isLoading: false,
                });

                // Also store password in localStorage for the email service
                if (settings.email_password) {
                    localStorage.setItem('kapchat_email_password', settings.email_password);
                }

                console.log('[UserSettings] Email settings loaded successfully');
            } else {
                // No settings found, initialize empty
                set({
                    emailSettings: {
                        email_user: '',
                        email_password: '',
                        smtp_host: 'smtp.gmail.com',
                        smtp_port: 587,
                        imap_host: 'imap.gmail.com',
                        imap_port: 993,
                    },
                    isLoading: false,
                });
            }
        } catch (err: any) {
            console.error('[UserSettings] Error:', err);
            set({ error: err.message, isLoading: false });

            // Fallback to localStorage
            const storedPassword = localStorage.getItem('kapchat_email_password') || '';
            const { config } = useAuthStore.getState();

            if (config?.email_user || storedPassword) {
                set({
                    emailSettings: {
                        email_user: config?.email_user || '',
                        email_password: storedPassword,
                        smtp_host: config?.smtp_host || 'smtp.gmail.com',
                        smtp_port: config?.smtp_port || 587,
                        imap_host: config?.imap_host || 'imap.gmail.com',
                        imap_port: config?.imap_port || 993,
                    },
                });
            }
        }
    },

    saveEmailSettings: async (settings: Partial<EmailSettings>) => {
        const { supabase, user, config, setConfig } = useAuthStore.getState();
        if (!supabase || !user) {
            throw new Error('No autenticado');
        }

        set({ isSaving: true, error: null });

        try {
            const currentSettings = get().emailSettings || {
                email_user: '',
                email_password: '',
                smtp_host: 'smtp.gmail.com',
                smtp_port: 587,
                imap_host: 'imap.gmail.com',
                imap_port: 993,
            };

            const newSettings = { ...currentSettings, ...settings };

            // Try to save via RPC function (with encryption)
            const { error } = await supabase.rpc('save_email_settings', {
                p_user_id: user.id,
                p_email_user: newSettings.email_user,
                p_email_password: newSettings.email_password || null,
                p_smtp_host: newSettings.smtp_host,
                p_smtp_port: newSettings.smtp_port,
                p_imap_host: newSettings.imap_host,
                p_imap_port: newSettings.imap_port,
            });

            if (error) {
                console.error('[UserSettings] Error saving via RPC:', error);

                // Fallback to direct upsert if RPC doesn't exist
                if (error.code === '42883') {
                    console.log('[UserSettings] RPC not found, using direct upsert');

                    const { error: upsertError } = await supabase
                        .from('user_settings')
                        .upsert({
                            user_id: user.id,
                            email_user: newSettings.email_user,
                            smtp_host: newSettings.smtp_host,
                            smtp_port: newSettings.smtp_port,
                            imap_host: newSettings.imap_host,
                            imap_port: newSettings.imap_port,
                        }, { onConflict: 'user_id' });

                    if (upsertError && upsertError.code !== '23505') {
                        throw upsertError;
                    }

                    // Store password in localStorage as fallback
                    if (newSettings.email_password) {
                        localStorage.setItem('kapchat_email_password', newSettings.email_password);
                    }
                } else {
                    throw error;
                }
            } else {
                // Also store password in localStorage for the email service
                if (newSettings.email_password) {
                    localStorage.setItem('kapchat_email_password', newSettings.email_password);
                }
            }

            // Update local state
            set({ emailSettings: newSettings, isSaving: false });

            // Also update the config in authStore for backwards compatibility
            if (config) {
                setConfig({
                    ...config,
                    email_user: newSettings.email_user,
                    smtp_host: newSettings.smtp_host,
                    smtp_port: newSettings.smtp_port,
                    imap_host: newSettings.imap_host,
                    imap_port: newSettings.imap_port,
                });
            }

            console.log('[UserSettings] Email settings saved successfully');
        } catch (err: any) {
            console.error('[UserSettings] Error saving:', err);
            set({ error: err.message, isSaving: false });
            throw err;
        }
    },

    clearSettings: () => {
        set({
            emailSettings: null,
            isLoading: false,
            isSaving: false,
            error: null,
        });
    },
}));
