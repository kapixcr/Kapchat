import type { VercelRequest, VercelResponse } from '@vercel/node';
import { create } from '@wppconnect-team/wppconnect';

// Almacenar clientes activos en memoria (se perderán al reiniciar, pero es un inicio)
const activeClients = new Map<string, any>();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userId } = req.body;
    const sessionId = userId || 'default';

    // Si ya hay un cliente activo, retornar su estado
    if (activeClients.has(sessionId)) {
      const client = activeClients.get(sessionId);
      const status = await client.getConnectionState();
      res.status(200).json({ 
        connected: status === 'CONNECTED',
        state: status,
        message: 'Ya existe una conexión activa'
      });
      return;
    }

    // Crear nuevo cliente
    // NOTA: En Vercel, esto tiene limitaciones porque las funciones serverless
    // no pueden mantener conexiones persistentes por mucho tiempo
    console.log(`[WhatsApp API] Creating client for session: ${sessionId}`);

    const client = await create({
      session: sessionId,
      headless: true,
      devtools: false,
      useChrome: false,
      debug: false,
      logQR: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
    });

    activeClients.set(sessionId, client);

    // Escuchar QR
    let qrCode: string | null = null;
    client.onQRCode((qr) => {
      qrCode = qr;
      console.log('[WhatsApp API] QR Code generated');
    });

    // Esperar un poco para obtener el QR
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (qrCode) {
      res.status(200).json({ 
        qrCode,
        state: 'connecting',
        message: 'QR code generado, escanea con tu teléfono'
      });
    } else {
      // Verificar si ya está conectado
      const status = await client.getConnectionState();
      if (status === 'CONNECTED') {
        res.status(200).json({ 
          connected: true,
          state: 'connected',
          message: 'Ya está conectado'
        });
      } else {
        res.status(200).json({ 
          state: 'waiting',
          message: 'Esperando conexión...'
        });
      }
    }
  } catch (error: any) {
    console.error('[WhatsApp API] Error:', error);
    res.status(500).json({ 
      error: 'Error al conectar WhatsApp',
      message: error.message 
    });
  }
}

