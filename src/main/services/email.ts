import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import nodemailer, { Transporter } from 'nodemailer';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { createHash } from 'crypto';

interface EmailConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  smtpHost: string;
  smtpPort: number;
}

interface ParsedEmail {
  id: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  date: Date;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

export class EmailService extends EventEmitter {
  private imap: Imap | null = null;
  private smtp: Transporter | null = null;
  private config: EmailConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;

  constructor(config: EmailConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    // Setup IMAP for receiving
    this.imap = new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000,
      authTimeout: 30000,
      keepalive: {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: true
      },
    });

    // Setup SMTP for sending
    this.smtp = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not initialized'));
        return;
      }

      this.imap.once('ready', () => {
        console.log('[Email] IMAP connection ready');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startListening();
        resolve();
      });

      this.imap.once('error', (err: Error & { source?: string }) => {
        console.error('[Email] IMAP error:', err.message);
        this.isConnected = false;
        this.emit('error', err);

        // Solo rechazar si es el primer intento de conexión
        if (this.reconnectAttempts === 0) {
          reject(err);
        } else {
          this.scheduleReconnect();
        }
      });

      this.imap.once('end', () => {
        console.log('[Email] IMAP connection ended');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.imap.once('close', (hadError: boolean) => {
        console.log('[Email] IMAP connection closed', hadError ? 'with error' : 'normally');
        this.isConnected = false;
        if (hadError) {
          this.scheduleReconnect();
        }
      });

      this.imap.connect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Email] Max reconnection attempts reached');
      this.emit('error', new Error('No se pudo reconectar al servidor de correo después de varios intentos'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`[Email] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);

    setTimeout(async () => {
      try {
        await this.connect();
        console.log('[Email] Reconnection successful');
      } catch (err) {
        console.error('[Email] Reconnection failed:', err);
      }
    }, this.reconnectDelay);
  }

  private startListening(): void {
    if (!this.imap) return;

    this.imap.openBox('INBOX', false, (err) => {
      if (err) {
        console.error('[Email] Error opening inbox:', err);
        this.emit('error', err);
        return;
      }

      console.log('[Email] Inbox opened successfully, listening for new emails');

      this.imap!.on('mail', (numNewMsgs: number) => {
        console.log(`[Email] ${numNewMsgs} new message(s) received`);
        this.fetchNewMails();
      });

      // También escuchar actualizaciones
      this.imap!.on('update', (seqno: number) => {
        console.log(`[Email] Message ${seqno} updated`);
      });
    });
  }

  private async fetchNewMails(): Promise<void> {
    if (!this.imap) return;

    try {
      const fetch = this.imap.seq.fetch('*', {
        bodies: '',
        markSeen: false,
      });

      fetch.on('message', (msg) => {
        msg.on('body', (stream) => {
          simpleParser(stream as unknown as Readable, (err, parsed) => {
            if (err) {
              console.error('[Email] Error parsing email:', err);
              return;
            }

            const email = this.parseEmail(parsed);
            this.emit('mail', email);
          });
        });
      });

      fetch.once('error', (err) => {
        console.error('[Email] Error fetching new mails:', err);
      });
    } catch (err) {
      console.error('[Email] Error in fetchNewMails:', err);
    }
  }

  async fetchMails(limit: number = 50): Promise<ParsedEmail[]> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not connected'));
        return;
      }

      if (!this.isConnected) {
        reject(new Error('IMAP connection not ready'));
        return;
      }

      console.log('[Email] Fetching emails from inbox...');

      this.imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          console.error('[Email] Error opening inbox:', err);
          reject(err);
          return;
        }

        console.log(`[Email] Inbox has ${box.messages.total} messages`);

        if (box.messages.total === 0) {
          console.log('[Email] No messages in inbox');
          resolve([]);
          return;
        }

        // Calcular el rango de mensajes a obtener
        const start = Math.max(1, box.messages.total - limit + 1);
        const end = box.messages.total;
        const range = `${start}:${end}`;

        console.log(`[Email] Fetching messages ${start} to ${end}`);

        const emails: ParsedEmail[] = [];
        const parsePromises: Promise<void>[] = [];
        let messagesReceived = 0;

        const fetch = this.imap!.seq.fetch(range, {
          bodies: '',
          struct: true,
        });

        fetch.on('message', (msg, seqno) => {
          messagesReceived++;

          const parsePromise = new Promise<void>((resolveMsg) => {
            let buffer = '';

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });

              stream.once('end', () => {
                simpleParser(buffer, (parseErr, parsed) => {
                  if (parseErr) {
                    console.error(`[Email] Error parsing message ${seqno}:`, parseErr);
                    resolveMsg();
                    return;
                  }

                  try {
                    const email = this.parseEmail(parsed);
                    emails.push(email);
                  } catch (e) {
                    console.error(`[Email] Error processing message ${seqno}:`, e);
                  }
                  resolveMsg();
                });
              });

              stream.once('error', (streamErr) => {
                console.error(`[Email] Stream error for message ${seqno}:`, streamErr);
                resolveMsg();
              });
            });

            msg.once('error', (msgErr) => {
              console.error(`[Email] Message error for ${seqno}:`, msgErr);
              resolveMsg();
            });
          });

          parsePromises.push(parsePromise);
        });

        fetch.once('error', (fetchErr) => {
          console.error('[Email] Fetch error:', fetchErr);
          reject(fetchErr);
        });

        fetch.once('end', async () => {
          console.log(`[Email] Fetch ended, received ${messagesReceived} messages, waiting for parsing...`);

          try {
            // Esperar a que todos los emails se parseen
            await Promise.all(parsePromises);

            // Ordenar por fecha (más reciente primero)
            emails.sort((a, b) => b.date.getTime() - a.date.getTime());

            console.log(`[Email] Successfully parsed ${emails.length} emails`);
            resolve(emails);
          } catch (promiseErr) {
            console.error('[Email] Error waiting for parse promises:', promiseErr);
            resolve(emails); // Devolver lo que tengamos
          }
        });
      });
    });
  }

  private parseEmail(parsed: ParsedMail): ParsedEmail {
    const from = parsed.from?.value?.[0];
    const messageId = parsed.messageId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Generar un UUID válido basado en el messageId usando SHA-256
    // Esto asegura que el mismo mensaje siempre tenga el mismo UUID
    const hash = createHash('sha256').update(messageId).digest('hex');
    const uuid = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;

    return {
      id: uuid,
      from: from?.address || '',
      fromName: from?.name || from?.address || 'Desconocido',
      to: Array.isArray(parsed.to)
        ? parsed.to.map(t => t.text).join(', ')
        : parsed.to?.text || '',
      subject: parsed.subject || '(Sin asunto)',
      html: parsed.html || parsed.textAsHtml || '',
      text: parsed.text || '',
      date: parsed.date || new Date(),
      attachments: (parsed.attachments || []).map(att => ({
        filename: att.filename || 'attachment',
        contentType: att.contentType,
        size: att.size,
      })),
    };
  }

  async sendMail(data: {
    to: string;
    subject: string;
    html: string;
    attachments?: any[];
  }): Promise<boolean> {
    if (!this.smtp) throw new Error('SMTP not connected');

    try {
      const result = await this.smtp.sendMail({
        from: this.config.user,
        to: data.to,
        subject: data.subject,
        html: data.html,
        attachments: data.attachments,
      });

      console.log('[Email] Message sent:', result.messageId);
      return true;
    } catch (err) {
      console.error('[Email] Error sending mail:', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    console.log('[Email] Disconnecting...');

    if (this.imap) {
      try {
        this.imap.end();
      } catch (e) {
        console.error('[Email] Error ending IMAP:', e);
      }
      this.imap = null;
    }

    if (this.smtp) {
      try {
        this.smtp.close();
      } catch (e) {
        console.error('[Email] Error closing SMTP:', e);
      }
      this.smtp = null;
    }

    this.isConnected = false;
    console.log('[Email] Disconnected');
  }

  getStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}
