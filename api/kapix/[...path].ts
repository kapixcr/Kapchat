import type { VercelRequest, VercelResponse } from '@vercel/node';

const KAPIX_API_BASE = 'https://kpixs.com/api';
const KAPIX_AUTH_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiS2VubmV0aCIsIm5hbWUiOiJLYXBpeCBBUEkiLCJBUElfVElNRSI6MTcyMTQ0NzI4Nn0.2vfJW3If8KeDoRFTwlRgIHSL6Eitxt1MWAkSVZNvrsM';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, authtoken');

  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Obtener el path de la URL
    // En Vercel, los paths dinámicos vienen en req.query como un array o string
    let path = '';
    if (req.query.path) {
      if (Array.isArray(req.query.path)) {
        path = req.query.path.join('/');
      } else {
        path = req.query.path as string;
      }
    }
    
    // Construir el endpoint completo
    const endpoint = path ? `/${path}` : '';
    const url = `${KAPIX_API_BASE}${endpoint}`;

    console.log(`[Vercel Proxy] ${req.method} ${url}`, { path, endpoint });

    // Preparar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'authtoken': KAPIX_AUTH_TOKEN,
    };

    // Preparar opciones de fetch
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Agregar body si existe
    if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // Hacer la petición
    const response = await fetch(url, fetchOptions);
    const data = await response.text();

    // Intentar parsear como JSON, si falla devolver texto
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = data;
    }

    // Devolver la respuesta con el mismo status code
    res.status(response.status).json(jsonData);
  } catch (error: any) {
    console.error('[Vercel Proxy] Error:', error);
    res.status(500).json({ 
      error: 'Error al conectar con la API de Kapix',
      message: error.message 
    });
  }
}

