import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { create, Whatsapp, StatusFind } from '@wppconnect-team/wppconnect';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { SupabaseService } from './supabase';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface WhatsAppMessageData {
  id: string;
  from: string;
  fromName: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact';
  timestamp: number;
  isFromMe: boolean;
  quotedMessage?: {
    id: string;
    content: string;
  };
  mediaUrl?: string;
  mediaMimetype?: string;
  mediaSize?: number;
  caption?: string;
  fileName?: string;
}

export interface SendMessageOptions {
  to: string;
  message?: string;
  mediaPath?: string;
  mediaUrl?: string;
  mediaBuffer?: Buffer;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  fileName?: string;
  quotedMessageId?: string;
  mentions?: string[];
}

export class WhatsAppService extends EventEmitter {
  private client: Whatsapp | null = null;
  private sessionPath: string;
  private mediaPath: string;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private currentUserId: string | undefined;

  constructor() {
    super();
    this.sessionPath = path.join(app.getPath('userData'), 'whatsapp-session');
    this.mediaPath = path.join(app.getPath('userData'), 'whatsapp-media');

    // Ensure directories exist
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
    if (!fs.existsSync(this.mediaPath)) {
      fs.mkdirSync(this.mediaPath, { recursive: true });
    }
  }

  setUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Cargar sesión desde Supabase
   */
  private async loadSessionFromSupabase(): Promise<boolean> {
    try {
      const supabase = SupabaseService.getClient();
      const { data, error } = await supabase
        .from('whatsapp_session')
        .select('*')
        .eq('session_name', 'kapchat-session')
        .single();

      if (error || !data || !data.session_data) {
        console.log('[WhatsApp] No session found in database');
        return false;
      }

      // Convertir base64 string a Buffer y descomprimir
      // Supabase almacena como TEXT en formato base64
      let sessionBuffer: Buffer;
      if (typeof data.session_data === 'string') {
        // Supabase devuelve como string base64
        sessionBuffer = Buffer.from(data.session_data, 'base64');
      } else if (Buffer.isBuffer(data.session_data)) {
        sessionBuffer = data.session_data;
      } else {
        sessionBuffer = Buffer.from(data.session_data as any);
      }
      
      const decompressed = await gunzipAsync(sessionBuffer);
      
      // Parsear JSON con los archivos de sesión
      const sessionFiles = JSON.parse(decompressed.toString());
      
      // Crear directorio para la sesión
      const sessionDir = path.join(this.sessionPath, 'kapchat-session');
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // Restaurar todos los archivos de sesión
      for (const [filename, fileData] of Object.entries(sessionFiles)) {
        const filePath = path.join(sessionDir, filename);
        fs.writeFileSync(filePath, Buffer.from(fileData as any));
      }

      console.log('[WhatsApp] Session loaded from database');
      return true;
    } catch (error) {
      console.error('[WhatsApp] Error loading session from database:', error);
      return false;
    }
  }

  /**
   * Guardar sesión en Supabase
   */
  private async saveSessionToSupabase(status: string, qrCode?: string, userId?: string): Promise<void> {
    try {
      const supabase = SupabaseService.getClient();
      const sessionDir = path.join(this.sessionPath, 'kapchat-session');
      
      if (!fs.existsSync(sessionDir)) {
        console.log('[WhatsApp] No session directory to save');
        return;
      }

      // Leer todos los archivos de sesión y comprimirlos
      const sessionFiles: { [key: string]: Buffer } = {};
      const files = fs.readdirSync(sessionDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(sessionDir, file.name);
          sessionFiles[file.name] = fs.readFileSync(filePath);
        }
      }

      // Convertir a JSON y comprimir
      const sessionJson = JSON.stringify(sessionFiles);
      const compressed = await gzipAsync(Buffer.from(sessionJson));

      // Guardar en Supabase
      const { error } = await supabase
        .from('whatsapp_session')
        .upsert({
          session_name: 'kapchat-session',
          session_data: compressed.toString('base64'),
          qr_code: qrCode || null,
          status: status,
          connected_user_id: userId || null,
          connected_at: status === 'connected' ? new Date().toISOString() : null,
          last_activity_at: new Date().toISOString(),
        }, {
          onConflict: 'session_name'
        });

      if (error) {
        console.error('[WhatsApp] Error saving session to database:', error);
      } else {
        console.log('[WhatsApp] Session saved to database');
      }
    } catch (error) {
      console.error('[WhatsApp] Error saving session to database:', error);
    }
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      console.log('[WhatsApp] Already connecting, ignoring...');
      return;
    }

    // Close any existing client before creating a new one
    if (this.client) {
      console.log('[WhatsApp] Closing existing client...');
      try {
        await this.client.close();
        // Esperar a que el navegador se cierre completamente
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error('[WhatsApp] Error closing existing client:', e);
      }
      this.client = null;
    }

    this.isConnecting = true;
    this.connectionState = 'connecting';
    this.emit('connectionState', this.connectionState);

    try {
      console.log('[WhatsApp] Creating WPPConnect client...');

      // Intentar cargar sesión desde Supabase
      const hasSession = await this.loadSessionFromSupabase();
      
      // Use a unique userDataDir to avoid conflicts
      const userDataDir = path.join(this.sessionPath, 'browser-data');

      this.client = await create({
        session: 'kapchat-session',
        folderNameToken: this.sessionPath,
        disableWelcome: true,
        logQR: false,
        autoClose: 0, // Deshabilitar autoClose para mantener la conexión activa
        puppeteerOptions: {
          headless: true,
          userDataDir: userDataDir,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
          ],
        },
        // QR Code callback
        catchQR: (qrCode: string) => {
          console.log('[WhatsApp] QR code received');
          // WPPConnect already returns base64 string, check if it already has data URI prefix
          let qrDataUrl: string;
          if (qrCode.startsWith('data:')) {
            qrDataUrl = qrCode;
          } else {
            qrDataUrl = `data:image/png;base64,${qrCode}`;
          }
          this.emit('qr', qrDataUrl);
        },
        // Status callback
        statusFind: async (status: StatusFind | keyof typeof StatusFind) => {
          const statusStr = String(status);
          console.log(`[WhatsApp] Status: ${statusStr}`);
          
          try {
            if (status === StatusFind.inChat || statusStr === 'inChat') {
              console.log('[WhatsApp] Connection opened successfully');
              this.isConnecting = false;
              this.reconnectAttempts = 0;
              this.connectionState = 'connected';
              this.emit('connectionState', this.connectionState);
              
              // Get user info
              this.client?.getHostDevice().then(async (device) => {
                const userInfo = {
                  id: device.wid?.user || '',
                  name: device.pushname || '',
                };
                this.emit('ready', userInfo);
                
                // Guardar sesión en Supabase después de conectar
                await this.saveSessionToSupabase('connected', undefined, this.currentUserId);
              }).catch((err) => {
                console.error('[WhatsApp] Error getting host device:', err);
                // No desconectar por este error
              });
            } else if (status === StatusFind.disconnectedMobile || status === StatusFind.serverClose || 
                       statusStr === 'disconnectedMobile' || statusStr === 'serverClose') {
              // Solo desconectar si realmente estamos conectados
              if (this.connectionState === 'connected') {
                console.log('[WhatsApp] Connection closed');
                this.isConnecting = false;
                this.connectionState = 'disconnected';
                this.emit('connectionState', this.connectionState);
                this.emit('disconnected');
                
                // Cerrar el cliente antes de intentar reconectar
                if (this.client) {
                  try {
                    await this.client.close();
                    // Esperar un poco para asegurar que el navegador se cierre
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  } catch (e) {
                    console.error('[WhatsApp] Error closing client on disconnect:', e);
                  }
                  this.client = null;
                }
                
                // No reconectar automáticamente - el usuario debe reconectar manualmente
                // para evitar bucles de reconexión
                console.log('[WhatsApp] Disconnected. Please reconnect manually.');
              } else {
                console.log(`[WhatsApp] Ignoring disconnect status (current state: ${this.connectionState})`);
              }
            } else if (status === StatusFind.notLogged || statusStr === 'notLogged') {
              if (this.connectionState !== 'connected') {
                this.connectionState = 'connecting';
                this.emit('connectionState', this.connectionState);
              }
            } else if (status === StatusFind.qrReadSuccess || statusStr === 'qrReadSuccess') {
              console.log('[WhatsApp] QR code scanned successfully');
            } else {
              // Log otros estados pero no cambiar el estado de conexión
              console.log(`[WhatsApp] Unknown status: ${statusStr}, current state: ${this.connectionState}`);
            }
          } catch (error) {
            console.error('[WhatsApp] Error in statusFind callback:', error);
            // No cambiar el estado de conexión por errores en el callback
          }
        },
      });

      // Set up message listener
      this.client.onMessage(async (message: any) => {
        try {
          // Ignorar mensajes de estado y broadcasts
          if (message.from?.includes('status@broadcast') || 
              message.from?.includes('broadcast') ||
              message.from?.includes('@g.us')) {
            return; // Ignorar mensajes de estado y grupos
          }

          const messageData = await this.parseMessage(message);
          if (messageData && !messageData.isFromMe) {
            this.emit('message', messageData);
          }
        } catch (error) {
          console.error('[WhatsApp] Error processing message:', error);
          // No emitir error para evitar desconexiones - solo loguear
        }
      });

    } catch (error: any) {
      console.error('[WhatsApp] Connection error:', error);
      
      // Handle "browser already running" error
      if (error?.message?.includes('browser is already running')) {
        console.log('[WhatsApp] Browser already running, closing existing instance...');
        
        // Try to close any existing browser processes
        try {
          if (this.client) {
            await this.client.close();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (e) {
          console.error('[WhatsApp] Error closing browser:', e);
        }
        
        // Use a unique userDataDir with timestamp to avoid conflicts
        const uniqueUserDataDir = path.join(this.sessionPath, `browser-data-${Date.now()}`);
        console.log('[WhatsApp] Retrying with unique userDataDir:', uniqueUserDataDir);
        
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Retry connection with a different userDataDir
        try {
          const uniqueUserDataDir = path.join(this.sessionPath, `browser-data-${Date.now()}`);
          console.log('[WhatsApp] Retrying with unique userDataDir:', uniqueUserDataDir);
          
          this.client = await create({
            session: 'kapchat-session',
            folderNameToken: this.sessionPath,
            disableWelcome: true,
            logQR: false,
            autoClose: 60000,
            puppeteerOptions: {
              headless: true,
              userDataDir: uniqueUserDataDir,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
              ],
            },
            catchQR: (qrCode: string) => {
              console.log('[WhatsApp] QR code received');
              let qrDataUrl: string;
              if (qrCode.startsWith('data:')) {
                qrDataUrl = qrCode;
              } else {
                qrDataUrl = `data:image/png;base64,${qrCode}`;
              }
              this.emit('qr', qrDataUrl);
            },
            statusFind: (status: StatusFind | keyof typeof StatusFind) => {
              const statusStr = String(status);
              console.log(`[WhatsApp] Status: ${statusStr}`);
              
              if (status === StatusFind.inChat || statusStr === 'inChat') {
                console.log('[WhatsApp] Connection opened successfully');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.connectionState = 'connected';
                this.emit('connectionState', this.connectionState);
                
                this.client?.getHostDevice().then((device) => {
                  this.emit('ready', {
                    id: device.wid?.user || '',
                    name: device.pushname || '',
                  });
                }).catch(console.error);
              } else if (status === StatusFind.disconnectedMobile || status === StatusFind.serverClose || 
                         statusStr === 'disconnectedMobile' || statusStr === 'serverClose') {
                console.log('[WhatsApp] Connection closed');
                this.isConnecting = false;
                this.connectionState = 'disconnected';
                this.emit('connectionState', this.connectionState);
                this.emit('disconnected');
                
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                  this.connectionState = 'reconnecting';
                  this.emit('connectionState', this.connectionState);
                  this.reconnectAttempts++;
                  console.log(`[WhatsApp] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                  
                  setTimeout(async () => {
                    await this.connect();
                  }, this.reconnectDelay);
                }
              } else if (status === StatusFind.notLogged || statusStr === 'notLogged') {
                this.connectionState = 'connecting';
                this.emit('connectionState', this.connectionState);
              } else if (status === StatusFind.qrReadSuccess || statusStr === 'qrReadSuccess') {
                console.log('[WhatsApp] QR code scanned successfully');
              }
            },
          });

          this.client.onMessage(async (message: any) => {
            try {
              // Ignorar mensajes de estado y broadcasts
              if (message.from?.includes('status@broadcast') || 
                  message.from?.includes('broadcast') ||
                  message.from?.includes('@g.us')) {
                return; // Ignorar mensajes de estado y grupos
              }

              const messageData = await this.parseMessage(message);
              if (messageData && !messageData.isFromMe) {
                this.emit('message', messageData);
              }
            } catch (error) {
              console.error('[WhatsApp] Error processing message:', error);
              // No emitir error para evitar desconexiones - solo loguear
            }
          });

          return; // Successfully retried
        } catch (retryError) {
          console.error('[WhatsApp] Retry connection failed:', retryError);
          this.isConnecting = false;
          this.connectionState = 'disconnected';
          this.emit('connectionState', this.connectionState);
          this.emit('error', retryError);
          throw retryError;
        }
      }
      
      this.isConnecting = false;
      this.connectionState = 'disconnected';
      this.emit('connectionState', this.connectionState);
      this.emit('error', error);
      throw error;
    }
  }

  private async parseMessage(message: any): Promise<WhatsAppMessageData | null> {
    if (!message) return null;

    let content = '';
    let type: WhatsAppMessageData['type'] = 'text';
    let mediaUrl: string | undefined;
    let mediaMimetype: string | undefined;
    let mediaSize: number | undefined;
    let caption: string | undefined;
    let fileName: string | undefined;

    // Get phone number
    const phone = message.from?.replace('@c.us', '').replace('@g.us', '') || '';
    const fromName = message.notifyName || message.sender?.pushname || 'Desconocido';

    // Handle different message types
    if (message.type === 'chat' || message.type === 'ptt') {
      content = message.body || message.text || '';
      type = message.type === 'ptt' ? 'audio' : 'text';
    } else if (message.type === 'image') {
      type = 'image';
      caption = message.caption || '';
      content = caption || '[Imagen]';
      mediaMimetype = message.mimetype;
      mediaUrl = await this.downloadMedia(message);
    } else if (message.type === 'video') {
      type = 'video';
      caption = message.caption || '';
      content = caption || '[Video]';
      mediaMimetype = message.mimetype;
      mediaUrl = await this.downloadMedia(message);
    } else if (message.type === 'audio') {
      type = 'audio';
      content = '[Audio]';
      mediaMimetype = message.mimetype;
      mediaUrl = await this.downloadMedia(message);
    } else if (message.type === 'document') {
      type = 'document';
      fileName = message.filename || message.body || 'documento';
      content = fileName || 'documento';
      mediaMimetype = message.mimetype;
      mediaUrl = await this.downloadMedia(message);
    } else if (message.type === 'sticker') {
      type = 'sticker';
      content = '[Sticker]';
      mediaUrl = await this.downloadMedia(message);
    } else if (message.type === 'location') {
      type = 'location';
      const lat = message.lat;
      const lng = message.lng;
      content = `[Ubicación: ${lat}, ${lng}]`;
    } else if (message.type === 'vcard' || message.type === 'vcard_list') {
      type = 'contact';
      content = '[Contacto]';
    }

    // Handle quoted message
    let quotedMessage: WhatsAppMessageData['quotedMessage'];
    if (message.quotedMsg) {
      quotedMessage = {
        id: message.quotedMsgId || '',
        content: message.quotedMsg.body || message.quotedMsg.caption || '[Mensaje multimedia]',
      };
    }

    // Handle timestamp
    const timestamp = message.timestamp ? message.timestamp * 1000 : Date.now();

    return {
      id: message.id || Date.now().toString(),
      from: phone,
      fromName,
      content,
      type,
      timestamp,
      isFromMe: message.fromMe || false,
      quotedMessage,
      mediaUrl,
      mediaMimetype,
      mediaSize,
      caption,
      fileName,
    };
  }

  private async downloadMedia(message: any): Promise<string | undefined> {
    if (!this.client || !message.id) return undefined;

    try {
      const media = await this.client.downloadMedia(message.id);
      if (media) {
        // Convert base64 to buffer
        const buffer = Buffer.from(media, 'base64');
        
        // Generate unique filename
        const ext = this.getExtensionFromMimetype(message.mimetype || '');
        const filename = `${message.id}_${Date.now()}${ext}`;
        const filepath = path.join(this.mediaPath, filename);

        // Save to file
        fs.writeFileSync(filepath, buffer);

        return filepath;
      }
    } catch (error) {
      console.error('[WhatsApp] Error downloading media:', error);
    }

    return undefined;
  }

  private getExtensionFromMimetype(mimetype: string): string {
    if (mimetype.includes('png')) return '.png';
    if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return '.jpg';
    if (mimetype.includes('gif')) return '.gif';
    if (mimetype.includes('webp')) return '.webp';
    if (mimetype.includes('mp4')) return '.mp4';
    if (mimetype.includes('mp3')) return '.mp3';
    if (mimetype.includes('ogg')) return '.ogg';
    if (mimetype.includes('pdf')) return '.pdf';
    return '.bin';
  }

  async sendMessage(options: SendMessageOptions): Promise<{ id: string; timestamp: number }> {
    if (!this.client) throw new Error('WhatsApp no conectado');

    const phone = options.to.includes('@') ? options.to.split('@')[0] : options.to;
    const chatId = `${phone}@c.us`;

    let result: any;

    try {
      if (options.mediaPath || options.mediaBuffer || options.mediaUrl) {
        // Send media message
        let mediaSource: string;
        
        if (options.mediaPath) {
          mediaSource = options.mediaPath;
        } else if (options.mediaBuffer) {
          // Convert buffer to base64 data URI
          const base64 = options.mediaBuffer.toString('base64');
          const mimetype = this.getMimetypeFromType(options.mediaType || 'image');
          mediaSource = `data:${mimetype};base64,${base64}`;
        } else if (options.mediaUrl) {
          mediaSource = options.mediaUrl;
        } else {
          throw new Error('No se proporcionó fuente de medios');
        }

        const filename = options.fileName || 'file';
        const caption = options.caption || '';

        switch (options.mediaType) {
          case 'image':
            result = await this.client.sendImage(chatId, mediaSource, filename, caption);
            break;
          case 'video':
            // Use sendFile for video
            result = await this.client.sendFile(chatId, mediaSource, { filename, caption });
            break;
          case 'audio':
            // Use sendFile for audio
            result = await this.client.sendFile(chatId, mediaSource, { filename, caption });
            break;
          case 'document':
            result = await this.client.sendFile(chatId, mediaSource, { filename, caption });
            break;
          default:
            result = await this.client.sendImage(chatId, mediaSource, filename, caption);
        }
      } else if (options.message) {
        // Send text message
        result = await this.client.sendText(chatId, options.message);
      } else {
        throw new Error('Se requiere mensaje o archivo multimedia');
      }

      return {
        id: result?.id || Date.now().toString(),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[WhatsApp] Error sending message:', error);
      throw error;
    }
  }

  private getMimetypeFromType(type: string): string {
    switch (type) {
      case 'image': return 'image/jpeg';
      case 'video': return 'video/mp4';
      case 'audio': return 'audio/mp3';
      case 'document': return 'application/octet-stream';
      default: return 'image/jpeg';
    }
  }

  // Simplified send for backwards compatibility
  async send(to: string, message: string): Promise<boolean> {
    await this.sendMessage({ to, message });
    return true;
  }

  async sendTyping(to: string): Promise<void> {
    if (!this.client) return;
    const phone = to.includes('@') ? to.split('@')[0] : to;
    const chatId = `${phone}@c.us`;
    try {
      // WPPConnect doesn't have a direct typing indicator, use sendSeen instead
      await this.client.sendSeen(chatId);
    } catch (e) {
      console.error('[WhatsApp] Error sending seen:', e);
    }
  }

  async sendPresenceOnline(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.setOnlinePresence(true);
    } catch (e) {
      console.error('[WhatsApp] Error sending presence:', e);
    }
  }

  async markAsRead(messageKeys: Array<{ id: string; remoteJid: string }>): Promise<void> {
    if (!this.client) return;

    try {
      // Mark chat as read (seen)
      const chatIds = new Set<string>();
      for (const key of messageKeys) {
        const phone = key.remoteJid.includes('@') ? key.remoteJid.split('@')[0] : key.remoteJid;
        chatIds.add(`${phone}@c.us`);
      }
      
      for (const chatId of chatIds) {
        await this.client.sendSeen(chatId);
      }
    } catch (e) {
      console.error('[WhatsApp] Error marking as read:', e);
    }
  }

  async checkNumberExists(phone: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const cleanPhone = phone.includes('@') ? phone.split('@')[0] : phone;
      const result = await this.client.checkNumberStatus(`${cleanPhone}@c.us`);
      return result ? (result as any).exists === true : false;
    } catch (e) {
      console.error('[WhatsApp] Error checking number:', e);
      return false;
    }
  }

  async getProfilePicture(phone: string): Promise<string | undefined> {
    if (!this.client) return undefined;

    try {
      const cleanPhone = phone.includes('@') ? phone.split('@')[0] : phone;
      const profilePic = await this.client.getProfilePicFromServer(`${cleanPhone}@c.us`);
      // ProfilePicThumbObj has eurl property
      return (profilePic as any)?.eurl || undefined;
    } catch {
      return undefined;
    }
  }

  async disconnect(): Promise<void> {
    console.log('[WhatsApp] Disconnecting...');

    // Reset reconnect attempts
    this.reconnectAttempts = 0;
    this.isConnecting = false;

    if (this.client) {
      try {
        // Cerrar el cliente y esperar a que se cierre completamente
        await this.client.close();
        // Esperar un poco para asegurar que el navegador se cierre
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.error('[WhatsApp] Error during close:', e);
      }
      this.client = null;
    }

    this.connectionState = 'disconnected';
    this.emit('connectionState', this.connectionState);
    this.emit('disconnected');
  }

  async logout(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch (e) {
        console.error('[WhatsApp] Error during logout:', e);
      }
    }

    await this.disconnect();

    // Clear session files
    try {
      const sessionDir = path.join(this.sessionPath, 'kapchat-session');
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      console.log('[WhatsApp] Session files cleared');
    } catch (e) {
      console.error('[WhatsApp] Error clearing session files:', e);
    }
  }

  getStatus(): {
    connected: boolean;
    state: string;
    user?: { id: string; name?: string }
  } {
    return {
      connected: this.connectionState === 'connected',
      state: this.connectionState,
      user: this.client ? {
        id: '',
        name: '',
      } : undefined,
    };
  }

  getConnectionState(): string {
    return this.connectionState;
  }

  /**
   * Verificar si hay una sesión guardada con estado conectado
   */
  async checkSessionStatus(): Promise<{ hasSession: boolean; isConnected: boolean }> {
    try {
      const supabase = SupabaseService.getClient();
      const { data, error } = await supabase
        .from('whatsapp_session')
        .select('status, session_data')
        .eq('session_name', 'kapchat-session')
        .single();

      if (error || !data) {
        return { hasSession: false, isConnected: false };
      }

      const hasSession = !!data.session_data;
      const isConnected = data.status === 'connected';

      return { hasSession, isConnected };
    } catch (error) {
      console.error('[WhatsApp] Error checking session status:', error);
      return { hasSession: false, isConnected: false };
    }
  }
}
