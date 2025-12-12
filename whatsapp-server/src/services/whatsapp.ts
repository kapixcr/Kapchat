import { EventEmitter } from 'events';
import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import type { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class WhatsAppService extends EventEmitter {
  private client: Whatsapp | null = null;
  private sessionPath: string;
  private isConnecting: boolean = false;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private supabase: SupabaseClient;
  private sessionId: string;

  constructor(sessionId: string, supabase: SupabaseClient) {
    super();
    this.sessionId = sessionId;
    this.supabase = supabase;
    this.sessionPath = path.join(os.tmpdir(), 'whatsapp-session', sessionId);
    
    // Asegurar que el directorio existe
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  getStatus() {
    return {
      connected: this.connectionState === 'connected',
      state: this.connectionState,
    };
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      console.log('[WhatsApp Service] Already connecting, ignoring...');
      return;
    }

    if (this.client) {
      console.log('[WhatsApp Service] Closing existing client...');
      try {
        await this.client.close();
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error('[WhatsApp Service] Error closing client:', e);
      }
      this.client = null;
    }

    this.isConnecting = true;
    this.connectionState = 'connecting';
    this.emit('connectionState', this.connectionState);

    try {
      console.log('[WhatsApp Service] Creating WPPConnect client...');

      // Intentar cargar sesión desde Supabase
      const hasSession = await this.loadSessionFromSupabase();

      // Crear un userDataDir único para evitar conflictos con navegadores en ejecución
      const userDataDir = path.join(this.sessionPath, `browser-data-${Date.now()}`);
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }

      console.log(`[WhatsApp Service] Using userDataDir: ${userDataDir}`);

      this.client = await create({
        session: 'kapchat-session',
        folderNameToken: this.sessionPath,
        disableWelcome: true,
        logQR: false,
        autoClose: 0,
        headless: true,
        devtools: false,
        useChrome: false,
        puppeteerOptions: {
          userDataDir: userDataDir,
        },
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      // Escuchar QR
      this.client.onQRCode(async (qr) => {
        console.log('[WhatsApp Service] QR Code generated');
        this.emit('qr', qr);
        await this.saveSessionToSupabase('connecting', qr);
      });

      // Escuchar cuando esté listo
      this.client.onStateChange(async (state) => {
        console.log('[WhatsApp Service] State changed:', state);
        if (state === 'CONNECTED') {
          this.connectionState = 'connected';
          this.isConnecting = false;
          this.emit('connectionState', 'connected');
          this.emit('ready', { id: this.sessionId });
          await this.saveSessionToSupabase('connected');
        } else if (state === 'DISCONNECTED') {
          this.connectionState = 'disconnected';
          this.isConnecting = false;
          this.emit('connectionState', 'disconnected');
        }
      });

      // Escuchar mensajes
      this.client.onMessage(async (message) => {
        this.emit('message', message);
      });

    } catch (error: any) {
      console.error('[WhatsApp Service] Error connecting:', error);
      this.connectionState = 'disconnected';
      this.isConnecting = false;
      this.emit('connectionState', 'disconnected');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (e) {
        console.error('[WhatsApp Service] Error disconnecting:', e);
      }
      this.client = null;
    }
    this.connectionState = 'disconnected';
    this.isConnecting = false;
  }

  async sendMessage(to: string, message: string): Promise<void> {
    if (!this.client) {
      throw new Error('WhatsApp no está conectado');
    }
    await this.client.sendText(to, message);
  }

  private async loadSessionFromSupabase(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_session')
        .select('*')
        .eq('session_name', 'kapchat-session')
        .single();

      if (error || !data || !data.session_data) {
        console.log('[WhatsApp Service] No session found in database');
        return false;
      }

      const sessionBuffer = Buffer.from(data.session_data, 'base64');
      const decompressed = await gunzipAsync(sessionBuffer);
      const sessionFiles = JSON.parse(decompressed.toString());

      const sessionDir = path.join(this.sessionPath, 'kapchat-session');
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      for (const [filename, fileData] of Object.entries(sessionFiles)) {
        const filePath = path.join(sessionDir, filename);
        fs.writeFileSync(filePath, Buffer.from(fileData as any));
      }

      console.log('[WhatsApp Service] Session loaded from database');
      return true;
    } catch (error) {
      console.error('[WhatsApp Service] Error loading session:', error);
      return false;
    }
  }

  private async saveSessionToSupabase(status: string, qrCode?: string): Promise<void> {
    try {
      const sessionDir = path.join(this.sessionPath, 'kapchat-session');
      
      if (!fs.existsSync(sessionDir)) {
        return;
      }

      const sessionFiles: { [key: string]: Buffer } = {};
      const files = fs.readdirSync(sessionDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(sessionDir, file.name);
          sessionFiles[file.name] = fs.readFileSync(filePath);
        }
      }

      const sessionJson = JSON.stringify(sessionFiles);
      const compressed = await gzipAsync(Buffer.from(sessionJson));

      const { error } = await this.supabase
        .from('whatsapp_session')
        .upsert({
          session_name: 'kapchat-session',
          session_data: compressed.toString('base64'),
          qr_code: qrCode || null,
          status: status,
          connected_user_id: this.sessionId !== 'default' ? this.sessionId : null,
          connected_at: status === 'connected' ? new Date().toISOString() : null,
          last_activity_at: new Date().toISOString(),
        }, {
          onConflict: 'session_name'
        });

      if (error) {
        console.error('[WhatsApp Service] Error saving session:', error);
      } else {
        console.log('[WhatsApp Service] Session saved to database');
      }
    } catch (error) {
      console.error('[WhatsApp Service] Error saving session:', error);
    }
  }
}

