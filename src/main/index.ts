import { app, BrowserWindow, ipcMain, shell, Menu, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';

let mainWindow: BrowserWindow | null = null;
let whatsappService: any = null;
let emailService: any = null;

// Detectar si estamos en desarrollo o producción
// Producción: app está empaquetada O existe dist/renderer/index.html (archivos compilados)
// Desarrollo: app no está empaquetada Y NO existe dist/renderer/index.html (necesita Vite)
const rendererPath = path.join(__dirname, '../renderer/index.html');
const hasCompiledRenderer = fs.existsSync(rendererPath);
const isDev = !app.isPackaged && !hasCompiledRenderer;

// Función para esperar a que el servidor de Vite esté listo
function waitForViteServer(maxAttempts = 30, delay = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkServer = () => {
      attempts++;
      
      const req = http.get('http://localhost:5173', (res) => {
        // Servidor está respondiendo
        resolve();
      });
      
      req.on('error', () => {
        // Servidor aún no está listo
        if (attempts >= maxAttempts) {
          reject(new Error(`Servidor de Vite no disponible después de ${maxAttempts} intentos`));
        } else {
          setTimeout(checkServer, delay);
        }
      });
      
      req.setTimeout(1000, () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error(`Timeout esperando servidor de Vite después de ${maxAttempts} intentos`));
        } else {
          setTimeout(checkServer, delay);
        }
      });
    };
    
    checkServer();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0f0f12',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    console.log('🔧 Modo desarrollo: esperando servidor de Vite...');
    waitForViteServer()
      .then(() => {
        console.log('✅ Servidor de Vite listo, cargando aplicación...');
        if (mainWindow) {
          mainWindow.loadURL('http://localhost:5173');
          mainWindow.webContents.openDevTools();
        }
      })
      .catch((err) => {
        console.error('❌ Error esperando servidor de Vite:', err.message);
        console.log('💡 Asegúrate de ejecutar "npm run dev:renderer" en otra terminal');
        // Intentar cargar de todas formas después de un delay
        setTimeout(() => {
          if (mainWindow) {
            console.log('🔄 Intentando cargar de nuevo...');
            mainWindow.loadURL('http://localhost:5173');
            mainWindow.webContents.openDevTools();
          }
        }, 2000);
      });
  } else {
    // En producción, cargar desde archivos compilados
    console.log('📦 Modo producción: cargando archivo local');
    
    // Intentar diferentes rutas según cómo esté empaquetada la app
    const possiblePaths = [
      path.join(__dirname, '../renderer/index.html'), // Empaquetado: dist/main -> dist/renderer
      path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'), // Empaquetado: desde app.asar
      path.join(app.getAppPath(), 'renderer', 'index.html'), // Empaquetado: desde app.asar (sin dist)
      path.join(__dirname, '../../dist/renderer/index.html'), // Desarrollo compilado
    ];

    let loaded = false;
    for (const htmlPath of possiblePaths) {
      if (fs.existsSync(htmlPath)) {
        console.log(`✅ Cargando desde: ${htmlPath}`);
        mainWindow.loadFile(htmlPath).catch((err) => {
          console.error(`❌ Error al cargar desde ${htmlPath}:`, err);
        });
        loaded = true;
        break;
      }
    }

    if (!loaded) {
      console.error('❌ No se encontró index.html en ninguna ruta esperada');
      console.error('Rutas intentadas:', possiblePaths);
    }
  }

  // Suprimir errores conocidos de Electron
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (message && typeof message === 'string' && message.includes('dragEvent is not defined')) {
      return;
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Solo mostrar error si es en desarrollo y es un error de conexión
    if (isDev && errorCode === -102 && validatedURL.includes('localhost:5173')) {
      console.warn('⚠️ No se pudo conectar a Vite. Asegúrate de que esté corriendo.');
      console.warn('💡 Ejecuta "npm run dev:renderer" en otra terminal o usa "npm run dev" para ambos');
      
      // Reintentar después de 2 segundos
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log('🔄 Reintentando conexión...');
          waitForViteServer(10, 500)
            .then(() => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.loadURL('http://localhost:5173');
              }
            })
            .catch(() => {
              console.log('⏳ Esperando servidor de Vite...');
            });
        }
      }, 2000);
    } else {
      console.error('❌ Failed to load:', errorCode, errorDescription, validatedURL);
    }
  });

  if (!isDev) {
    mainWindow.webContents.session.webRequest.onBeforeRequest(
      { urls: ['file://*/*'] },
      (details, callback) => {
        callback({});
      }
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Menú estándar
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Archivo',
      submenu: [
        { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar recarga' },
        { role: 'toggleDevTools', label: 'Alternar DevTools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Restablecer zoom' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Documentación de Electron',
          click: () => shell.openExternal('https://www.electronjs.org/docs/latest'),
        },
        {
          label: 'Página de Kapchat',
          click: () => shell.openExternal('https://kapix.com'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Window controls
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:reload', () => mainWindow?.reload());

// Supabase handlers
ipcMain.handle('supabase:init', async (_, config: { url: string; anonKey: string }) => {
  const { SupabaseService } = await import('./services/supabase');
  return SupabaseService.initialize(config.url, config.anonKey);
});

// WhatsApp handlers
ipcMain.handle('whatsapp:connect', async (_, userId?: string) => {
  // Reutilizar servicio existente si ya está conectado o conectando
  if (whatsappService) {
    const status = whatsappService.getStatus();
    if (status.connected || status.state === 'connecting' || status.state === 'connected') {
      console.log('[Main] WhatsApp service already exists and is connected/connecting, reusing...');
      return true;
    }
  }
  
  const { WhatsAppService } = await import('./services/whatsapp');
  whatsappService = new WhatsAppService();
  
  // Pasar userId al servicio si está disponible
  if (userId && whatsappService.setUserId) {
    whatsappService.setUserId(userId);
  }

  whatsappService.on('qr', (qr: string) => {
    mainWindow?.webContents.send('whatsapp:qr', qr);
  });

  whatsappService.on('ready', (user: any) => {
    mainWindow?.webContents.send('whatsapp:ready', user);
  });

  whatsappService.on('message', (message: any) => {
    mainWindow?.webContents.send('whatsapp:message', message);
  });

  whatsappService.on('messageUpsert', (message: any) => {
    mainWindow?.webContents.send('whatsapp:messageUpsert', message);
  });

  whatsappService.on('messageUpdate', (update: any) => {
    mainWindow?.webContents.send('whatsapp:messageUpdate', update);
  });

  whatsappService.on('chatsUpsert', (chats: any) => {
    mainWindow?.webContents.send('whatsapp:chatsUpsert', chats);
  });

  whatsappService.on('contactsUpsert', (contacts: any) => {
    mainWindow?.webContents.send('whatsapp:contactsUpsert', contacts);
  });

  whatsappService.on('presenceUpdate', (presence: any) => {
    mainWindow?.webContents.send('whatsapp:presenceUpdate', presence);
  });

  whatsappService.on('connectionState', (state: string) => {
    mainWindow?.webContents.send('whatsapp:connectionState', state);
  });

  whatsappService.on('disconnected', () => {
    mainWindow?.webContents.send('whatsapp:disconnected');
  });

  whatsappService.on('loggedOut', () => {
    mainWindow?.webContents.send('whatsapp:loggedOut');
  });

  whatsappService.on('error', (error: any) => {
    mainWindow?.webContents.send('whatsapp:error', { message: error?.message || String(error) });
  });

  await whatsappService.connect();
  return true;
});

ipcMain.handle('whatsapp:checkSession', async () => {
  if (!whatsappService) {
    const { WhatsAppService } = await import('./services/whatsapp');
    whatsappService = new WhatsAppService();
  }
  return await whatsappService.checkSessionStatus();
});

ipcMain.handle('whatsapp:send', async (_, data: { to: string; message: string }) => {
  if (!whatsappService) throw new Error('WhatsApp not connected');
  return whatsappService.send(data.to, data.message);
});

ipcMain.handle('whatsapp:sendMessage', async (_, options: {
  to: string;
  message?: string;
  mediaPath?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  fileName?: string;
  quotedMessageId?: string;
  mentions?: string[];
}) => {
  if (!whatsappService) throw new Error('WhatsApp not connected');
  return whatsappService.sendMessage(options);
});

ipcMain.handle('whatsapp:sendTyping', async (_, to: string) => {
  if (!whatsappService) throw new Error('WhatsApp not connected');
  return whatsappService.sendTyping(to);
});

ipcMain.handle('whatsapp:markAsRead', async (_, keys: Array<{ id: string; remoteJid: string }>) => {
  if (!whatsappService) throw new Error('WhatsApp not connected');
  return whatsappService.markAsRead(keys);
});

ipcMain.handle('whatsapp:checkNumber', async (_, phone: string) => {
  if (!whatsappService) throw new Error('WhatsApp not connected');
  return whatsappService.checkNumberExists(phone);
});

ipcMain.handle('whatsapp:getProfilePicture', async (_, phone: string) => {
  if (!whatsappService) throw new Error('WhatsApp not connected');
  return whatsappService.getProfilePicture(phone);
});

ipcMain.handle('whatsapp:getStatus', async () => {
  if (!whatsappService) return { connected: false, state: 'disconnected' };
  return whatsappService.getStatus();
});

ipcMain.handle('whatsapp:disconnect', async () => {
  if (whatsappService) {
    await whatsappService.disconnect();
    whatsappService = null;
  }
  return true;
});

ipcMain.handle('whatsapp:logout', async () => {
  if (whatsappService) {
    await whatsappService.logout();
    whatsappService = null;
  }
  return true;
});

// Email handlers
ipcMain.handle('email:connect', async (_, config: {
  user: string;
  password: string;
  host: string;
  port: number;
  smtpHost: string;
  smtpPort: number;
}) => {
  const { EmailService } = await import('./services/email');
  emailService = new EmailService(config);

  emailService.on('mail', (mail: any) => {
    mainWindow?.webContents.send('email:new', mail);
  });

  emailService.on('error', (err: any) => {
    const payload = {
      message: err?.message || String(err),
      source: err?.source,
    };
    mainWindow?.webContents.send('email:error', payload);
  });

  await emailService.connect();
  return true;
});

ipcMain.handle('email:send', async (_, data: {
  to: string;
  subject: string;
  html: string;
  attachments?: any[];
}) => {
  if (!emailService) throw new Error('Email not connected');
  return emailService.sendMail(data);
});

ipcMain.handle('email:fetch', async () => {
  if (!emailService) throw new Error('Email not connected');
  return emailService.fetchMails();
});

ipcMain.handle('email:getStatus', async () => {
  if (!emailService) return { connected: false, reconnectAttempts: 0 };
  return emailService.getStatus();
});

ipcMain.handle('email:disconnect', async () => {
  if (emailService) {
    await emailService.disconnect();
    emailService = null;
  }
  return true;
});

// Kapix API handlers (para evitar problemas de CORS)
const KAPIX_API_BASE = 'https://kpixs.com/api';
const KAPIX_AUTH_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiS2VubmV0aCIsIm5hbWUiOiJLYXBpeCBBUEkiLCJBUElfVElNRSI6MTcyMTQ0NzI4Nn0.2vfJW3If8KeDoRFTwlRgIHSL6Eitxt1MWAkSVZNvrsM';

const makeKapixRequest = (endpoint: string, method: string = 'GET', body?: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Construir la URL correctamente
    const endpointPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${KAPIX_API_BASE}${endpointPath}`;
    const url = new URL(fullUrl);
    
    console.log(`[Main] 🌐 Request: ${method} ${fullUrl}`);
    
    // Preparar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'authtoken': KAPIX_AUTH_TOKEN,
    };

    // Si hay body, calcular Content-Length antes
    let bodyString = '';
    if (body) {
      bodyString = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(bodyString).toString();
      console.log('[Main] 📦 Request body:', bodyString);
    }
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
    };

    const requestModule = url.protocol === 'https:' ? https : http;
    
    const req = requestModule.request(options, (res) => {
      let data = '';
      
      console.log(`[Main] 📡 Response: ${res.statusCode} ${res.statusMessage}`);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = JSON.parse(data);
            console.log(`[Main] ✅ Request exitoso, datos recibidos:`, Array.isArray(parsed) ? `${parsed.length} items` : 'objeto');
            resolve(parsed);
          } else {
            console.error(`[Main] ❌ HTTP Error ${res.statusCode}:`, data.substring(0, 200));
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          }
        } catch (error) {
          console.error('[Main] ❌ Error parsing response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('[Main] ❌ Request error:', error);
      reject(error);
    });

    req.setTimeout(30000, () => {
      console.error('[Main] ❌ Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Escribir el body si existe
    if (bodyString) {
      req.write(bodyString);
    }

    req.end();
  });
};

ipcMain.handle('kapix:getTasks', async () => {
  try {
    console.log('[Main] 📥 IPC: kapix:getTasks');
    const data = await makeKapixRequest('/tasks');
    console.log('[Main] ✅ Tareas obtenidas:', Array.isArray(data) ? data.length : 0);
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[Main] ❌ Error fetching tasks:', error);
    throw error;
  }
});

ipcMain.handle('kapix:getTaskById', async (_, id: string) => {
  try {
    console.log('[Main] 📥 IPC: kapix:getTaskById', id);
    return await makeKapixRequest(`/tasks/${id}`);
  } catch (error: any) {
    console.error('[Main] ❌ Error fetching task:', error);
    throw error;
  }
});

ipcMain.handle('kapix:updateTask', async (_, id: string, updates: any) => {
  try {
    console.log('[Main] 📥 IPC: kapix:updateTask', id);
    return await makeKapixRequest(`/tasks/${id}`, 'PUT', updates);
  } catch (error: any) {
    console.error('[Main] ❌ Error updating task:', error);
    throw error;
  }
});

ipcMain.handle('kapix:getStaffs', async () => {
  try {
    console.log('[Main] 📥 IPC: kapix:getStaffs');
    const data = await makeKapixRequest('/staffs');
    console.log('[Main] ✅ Staffs obtenidos:', Array.isArray(data) ? data.length : 0);
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[Main] ❌ Error fetching staffs:', error);
    throw error;
  }
});

// Timesheet handlers
ipcMain.handle('kapix:createTimesheet', async (_, timesheetData: {
  task_id: string;
  start_time: string;
  end_time: string;
  staff_id: string;
  hourly_rate: number;
  note?: string;
}) => {
  try {
    console.log('[Main] 📥 IPC: kapix:createTimesheet recibido:', JSON.stringify(timesheetData, null, 2));
    
    // Validar que todos los campos requeridos estén presentes
    if (!timesheetData.task_id || !timesheetData.start_time || !timesheetData.end_time || !timesheetData.staff_id) {
      const missing = [];
      if (!timesheetData.task_id) missing.push('task_id');
      if (!timesheetData.start_time) missing.push('start_time');
      if (!timesheetData.end_time) missing.push('end_time');
      if (!timesheetData.staff_id) missing.push('staff_id');
      throw new Error(`Campos faltantes: ${missing.join(', ')}`);
    }
    
    // Asegurar que los campos numéricos sean números y los strings sean strings
    const payload = {
      task_id: String(timesheetData.task_id).trim(),
      start_time: String(timesheetData.start_time).trim(),
      end_time: String(timesheetData.end_time).trim(),
      staff_id: String(timesheetData.staff_id).trim(),
      hourly_rate: Number(timesheetData.hourly_rate) || 0,
      ...(timesheetData.note && timesheetData.note.trim() && { note: String(timesheetData.note).trim() }),
    };
    
    console.log('[Main] 📤 Payload validado y formateado:', JSON.stringify(payload, null, 2));
    console.log('[Main] 🔍 Verificando tipos:', {
      task_id: typeof payload.task_id,
      start_time: typeof payload.start_time,
      end_time: typeof payload.end_time,
      staff_id: typeof payload.staff_id,
      hourly_rate: typeof payload.hourly_rate,
    });
    
    // Intentar con y sin barra final
    try {
      return await makeKapixRequest('/timesheets/', 'POST', payload);
    } catch (error: any) {
      // Si falla con barra final, intentar sin ella
      if (error.message.includes('404')) {
        console.log('[Main] 🔄 Reintentando sin barra final...');
        return await makeKapixRequest('/timesheets', 'POST', payload);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('[Main] ❌ Error creating timesheet:', error);
    throw error;
  }
});

ipcMain.handle('kapix:getTimesheet', async (_, id: string) => {
  try {
    console.log('[Main] 📥 IPC: kapix:getTimesheet', id);
    return await makeKapixRequest(`/timesheets/${id}`);
  } catch (error: any) {
    console.error('[Main] ❌ Error fetching timesheet:', error);
    throw error;
  }
});

ipcMain.handle('kapix:updateTimesheet', async (_, id: string, updates: any) => {
  try {
    console.log('[Main] 📥 IPC: kapix:updateTimesheet', id);
    return await makeKapixRequest(`/timesheets/${id}`, 'PUT', updates);
  } catch (error: any) {
    console.error('[Main] ❌ Error updating timesheet:', error);
    throw error;
  }
});

// Registrar esquema de protocolo personalizado ANTES de que la app esté lista
if (!isDev) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        secure: true,
        standard: true,
        corsEnabled: true,
        supportFetchAPI: true,
      },
    },
  ]);
}

app.whenReady().then(() => {
  if (!isDev) {
    protocol.interceptFileProtocol('file', (request, callback) => {
      const filePath = request.url.substr(7);
      callback({ path: filePath });
    });
  }
  createWindow();
});

app.on('window-all-closed', () => {
  // Cleanup services before quitting
  if (whatsappService) {
    whatsappService.disconnect().catch(() => { });
  }
  if (emailService) {
    emailService.disconnect().catch(() => { });
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
