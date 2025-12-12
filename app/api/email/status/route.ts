import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  // Por ahora, retornar que no hay conexión
  // En una implementación real, consultarías el estado de las conexiones activas
  return NextResponse.json({ 
    connected: false,
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

