import type { VercelRequest, VercelResponse } from '@vercel/node';

// Esto es un placeholder - en producción necesitarías almacenar el estado en una base de datos
// porque las funciones serverless no mantienen estado entre invocaciones

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Por ahora, retornar que no hay sesión
  // En una implementación real, consultarías Supabase para ver si hay una sesión activa
  res.status(200).json({ 
    hasSession: false,
    isConnected: false,
    state: 'disconnected'
  });
}

