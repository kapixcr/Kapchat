import { NextRequest, NextResponse } from 'next/server';

// Esto es un placeholder - en producción necesitarías almacenar el estado en una base de datos
// porque las funciones serverless no mantienen estado entre invocaciones

export async function GET() {
  // Por ahora, retornar que no hay sesión
  // En una implementación real, consultarías Supabase para ver si hay una sesión activa
  return NextResponse.json({ 
    hasSession: false,
    isConnected: false,
    state: 'disconnected'
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

