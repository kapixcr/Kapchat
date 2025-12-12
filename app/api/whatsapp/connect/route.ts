import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Almacenar clientes activos (en producción, usar Redis o base de datos)
const activeClients = new Map<string, any>();

// Obtener cliente de Supabase desde variables de entorno
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase no configurado. Verifica las variables de entorno.');
  }
  
  return createClient(url, key);
}

// Cargar sesión desde Supabase
async function loadSessionFromSupabase(sessionPath: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('whatsapp_session')
      .select('*')
      .eq('session_name', 'kapchat-session')
      .single();

    if (error || !data || !data.session_data) {
      console.log('[WhatsApp API] No session found in database');
      return false;
    }

    // Convertir base64 string a Buffer y descomprimir
    const sessionBuffer = Buffer.from(data.session_data, 'base64');
    const decompressed = await gunzipAsync(sessionBuffer);
    
    // Parsear JSON con los archivos de sesión
    const sessionFiles = JSON.parse(decompressed.toString());
    
    // Crear directorio para la sesión
    const sessionDir = path.join(sessionPath, 'kapchat-session');
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Restaurar todos los archivos de sesión
    for (const [filename, fileData] of Object.entries(sessionFiles)) {
      const filePath = path.join(sessionDir, filename);
      fs.writeFileSync(filePath, Buffer.from(fileData as any));
    }

    console.log('[WhatsApp API] Session loaded from database');
    return true;
  } catch (error) {
    console.error('[WhatsApp API] Error loading session from database:', error);
    return false;
  }
}

// Guardar sesión en Supabase
async function saveSessionToSupabase(sessionPath: string, status: string, qrCode?: string, userId?: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const sessionDir = path.join(sessionPath, 'kapchat-session');
    
    if (!fs.existsSync(sessionDir)) {
      console.log('[WhatsApp API] No session directory to save');
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
      console.error('[WhatsApp API] Error saving session to database:', error);
    } else {
      console.log('[WhatsApp API] Session saved to database');
    }
  } catch (error) {
    console.error('[WhatsApp API] Error saving session to database:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Importación dinámica para evitar análisis estático
    const { create } = await import('@wppconnect-team/wppconnect');
    
    const { userId } = await request.json();
    const sessionId = userId || 'default';

    // Si ya hay un cliente activo, retornar su estado
    if (activeClients.has(sessionId)) {
      const client = activeClients.get(sessionId);
      try {
        const status = await client.getConnectionState();
        return NextResponse.json({ 
          connected: status === 'CONNECTED',
          state: status,
          message: 'Ya existe una conexión activa'
        });
      } catch (error) {
        // Si hay error, eliminar el cliente y crear uno nuevo
        activeClients.delete(sessionId);
      }
    }

    // Crear directorio temporal para la sesión
    const sessionPath = path.join(os.tmpdir(), 'whatsapp-session');
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Intentar cargar sesión desde Supabase
    const hasSession = await loadSessionFromSupabase(sessionPath);

    // Crear nuevo cliente
    console.log(`[WhatsApp API] Creating client for session: ${sessionId}`);

    const client = await create({
      session: 'kapchat-session',
      folderNameToken: sessionPath,
      headless: true,
      devtools: false,
      useChrome: false,
      debug: false,
      logQR: true,
      autoClose: 0, // Deshabilitar autoClose para mantener la conexión activa
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

    // Crear una promesa que se resuelve cuando el QR esté disponible
    let qrCode: string | null = null;
    let qrResolve: ((qr: string) => void) | null = null;
    const qrPromise = new Promise<string>((resolve) => {
      qrResolve = resolve;
    });

    // Escuchar QR y guardar en Supabase
    client.onQRCode(async (qr) => {
      qrCode = qr;
      console.log('[WhatsApp API] QR Code generated:', qr.substring(0, 50) + '...');
      // Guardar QR en Supabase
      await saveSessionToSupabase(sessionPath, 'connecting', qr, userId);
      // Resolver la promesa cuando el QR esté disponible
      if (qrResolve) {
        qrResolve(qr);
      }
    });

    // Escuchar cuando esté listo y guardar sesión
    client.onStateChange(async (state) => {
      console.log('[WhatsApp API] State changed:', state);
      if (state === 'CONNECTED') {
        // Guardar sesión cuando se conecte
        await saveSessionToSupabase(sessionPath, 'connected', undefined, userId);
      }
    });

    // Verificar estado actual primero
    const currentStatus = await client.getConnectionState();
    if (currentStatus === 'CONNECTED') {
      return NextResponse.json({ 
        connected: true,
        state: 'connected',
        message: 'Ya está conectado'
      });
    }

    // Esperar el QR con timeout
    try {
      const qr = await Promise.race([
        qrPromise,
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout waiting for QR')), 30000)
        )
      ]);

      return NextResponse.json({ 
        qrCode: qr,
        state: 'connecting',
        message: 'QR code generado, escanea con tu teléfono'
      });
    } catch (error: any) {
      // Si no se generó QR en 30 segundos, verificar estado
      const status = await client.getConnectionState();
      if (status === 'CONNECTED') {
        return NextResponse.json({ 
          connected: true,
          state: 'connected',
          message: 'Ya está conectado'
        });
      }
      
      // Retornar que está esperando, el frontend puede hacer polling
      return NextResponse.json({ 
        state: 'waiting',
        message: 'Generando código QR...',
        // Retornar null para que el frontend sepa que debe hacer polling
        qrCode: null
      });
    }
  } catch (error: any) {
    console.error('[WhatsApp API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error al conectar WhatsApp',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
