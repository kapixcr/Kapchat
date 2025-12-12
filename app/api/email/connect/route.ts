import { NextRequest, NextResponse } from 'next/server';
import Imap from 'imap';
import nodemailer from 'nodemailer';

// Almacenar conexiones activas (en producción, usar Redis o base de datos)
const activeConnections = new Map<string, { imap: Imap; smtp: any }>();

export async function POST(request: NextRequest) {
  try {
    const { user, password, host, port, smtpHost, smtpPort } = await request.json();

    if (!user || !password || !host || !port || !smtpHost || !smtpPort) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    const connectionId = `${user}@${host}`;

    // Si ya hay una conexión activa, verificar su estado
    if (activeConnections.has(connectionId)) {
      const { imap } = activeConnections.get(connectionId)!;
      if (imap && imap.state !== 'disconnected') {
        return NextResponse.json({ 
          connected: true,
          message: 'Ya existe una conexión activa'
        });
      } else {
        activeConnections.delete(connectionId);
      }
    }

    // Crear nueva conexión IMAP
    const imap = new Imap({
      user,
      password,
      host,
      port: parseInt(port),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000,
      authTimeout: 30000,
    });

    // Crear transporte SMTP
    const smtp = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465,
      auth: { user, pass: password },
      tls: { rejectUnauthorized: false },
    });

    // Conectar IMAP
    return new Promise((resolve) => {
      imap.once('ready', () => {
        activeConnections.set(connectionId, { imap, smtp });
        resolve(NextResponse.json({ 
          connected: true,
          message: 'Conexión establecida correctamente'
        }));
      });

      imap.once('error', (err) => {
        console.error('[Email API] IMAP error:', err);
        resolve(NextResponse.json(
          { 
            error: 'Error al conectar con el servidor IMAP',
            message: err.message 
          },
          { status: 500 }
        ));
      });

      imap.connect();
    });
  } catch (error: any) {
    console.error('[Email API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error al conectar Email',
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

