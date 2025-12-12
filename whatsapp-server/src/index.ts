import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { WhatsAppService } from './services/whatsapp';
import { createClient } from '@supabase/supabase-js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000', '*'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000', '*'],
  credentials: true,
}));
app.use(express.json());

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase no configurado. Verifica las variables de entorno.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase inicializado');

// Almacenar servicios de WhatsApp por usuario
const whatsappServices = new Map<string, WhatsAppService>();

// API REST para operaciones de WhatsApp
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const { userId } = req.body;
    const sessionId = userId || 'default';

    // Si ya existe un servicio, retornar su estado
    if (whatsappServices.has(sessionId)) {
      const service = whatsappServices.get(sessionId)!;
      const status = service.getStatus();
      return res.json({
        connected: status.connected,
        state: status.state,
        message: 'Ya existe una conexión activa',
      });
    }

    // Crear nuevo servicio
    console.log(`[WhatsApp Server] Creating service for session: ${sessionId}`);
    const service = new WhatsAppService(sessionId, supabase);

    // Escuchar eventos y emitir a través de WebSocket
    service.on('qr', (qr) => {
      io.emit(`whatsapp:qr:${sessionId}`, qr);
      console.log(`[WhatsApp Server] QR generated for ${sessionId}`);
    });

    service.on('ready', (user) => {
      io.emit(`whatsapp:ready:${sessionId}`, user);
      console.log(`[WhatsApp Server] Ready for ${sessionId}`, user);
    });

    service.on('message', (message) => {
      io.emit(`whatsapp:message:${sessionId}`, message);
    });

    service.on('connectionState', (state) => {
      io.emit(`whatsapp:state:${sessionId}`, state);
    });

    whatsappServices.set(sessionId, service);

    // Conectar
    await service.connect();

    // Esperar un poco para obtener el QR si se genera
    await new Promise(resolve => setTimeout(resolve, 2000));

    const status = service.getStatus();
    res.json({
      connected: status.connected,
      state: status.state,
      message: status.connected ? 'Conectado' : 'Conectando...',
    });
  } catch (error: any) {
    console.error('[WhatsApp Server] Error:', error);
    res.status(500).json({
      error: 'Error al conectar WhatsApp',
      message: error.message,
    });
  }
});

app.get('/api/whatsapp/status/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId || 'default';
    const service = whatsappServices.get(userId);

    if (!service) {
      return res.json({
        hasSession: false,
        isConnected: false,
        state: 'disconnected',
      });
    }

    const status = service.getStatus();
    res.json({
      hasSession: true,
      isConnected: status.connected,
      state: status.state,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Error al obtener estado',
      message: error.message,
    });
  }
});

app.get('/api/whatsapp/qr', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_session')
      .select('qr_code, status')
      .eq('session_name', 'kapchat-session')
      .single();

    if (error || !data) {
      return res.json({
        qrCode: null,
        status: 'disconnected',
      });
    }

    res.json({
      qrCode: data.qr_code,
      status: data.status || 'disconnected',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Error al obtener QR',
      message: error.message,
    });
  }
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log('[WhatsApp Server] Client connected:', socket.id);

  socket.on('whatsapp:subscribe', (userId: string) => {
    const sessionId = userId || 'default';
    console.log(`[WhatsApp Server] Client ${socket.id} subscribed to ${sessionId}`);

    // Unirse a la sala del usuario
    socket.join(`whatsapp:${sessionId}`);
  });

  socket.on('whatsapp:send', async (data: { userId?: string; to: string; message: string }) => {
    try {
      const sessionId = data.userId || 'default';
      const service = whatsappServices.get(sessionId);

      if (!service) {
        socket.emit('error', { message: 'WhatsApp no conectado' });
        return;
      }

      await service.sendMessage(data.to, data.message);
      socket.emit('whatsapp:sent', { success: true });
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('[WhatsApp Server] Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 WhatsApp Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🌐 API REST: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing connections...');
  whatsappServices.forEach((service) => {
    service.disconnect();
  });
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

