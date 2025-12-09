import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseService {
  private static instance: SupabaseClient | null = null;

  static initialize(url: string, anonKey: string): boolean {
    this.instance = createClient(url, anonKey);
    return true;
  }

  static getClient(): SupabaseClient {
    if (!this.instance) {
      throw new Error('Supabase not initialized');
    }
    return this.instance;
  }
}
