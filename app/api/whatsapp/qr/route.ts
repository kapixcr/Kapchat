import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Obtener cliente de Supabase desde variables de entorno
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase no configurado');
  }
  
  return createClient(url, key);
}

// Endpoint para obtener el QR desde Supabase
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('whatsapp_session')
      .select('qr_code, status')
      .eq('session_name', 'kapchat-session')
      .single();

    if (error || !data) {
      return NextResponse.json({ 
        qrCode: null,
        status: 'disconnected'
      });
    }

    // Asegurar que el QR esté en formato data URL si existe
    let qrCode: string | null = data.qr_code;
    if (qrCode && !qrCode.startsWith('data:')) {
      // Si no tiene el prefijo data:, agregarlo
      qrCode = `data:image/png;base64,${qrCode}`;
    }

    console.log('[WhatsApp API] Returning QR from Supabase, hasQR:', !!qrCode, 'format:', qrCode?.substring(0, 30));

    return NextResponse.json({ 
      qrCode: qrCode,
      status: data.status || 'disconnected'
    });
  } catch (error: any) {
    console.error('[WhatsApp API] Error getting QR:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener QR',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

