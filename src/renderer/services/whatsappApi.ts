// Servicio para interactuar con la API de WhatsApp en web
// Puede usar el servidor dedicado o las API routes de Next.js como fallback

interface WhatsAppConnectResponse {
  qrCode?: string;
  connected?: boolean;
  state?: string;
  message?: string;
}

interface WhatsAppStatusResponse {
  hasSession: boolean;
  isConnected: boolean;
  state: string;
}

class WhatsAppApiService {
  // Usar servidor dedicado si está disponible, sino usar API routes de Next.js
  private getBaseUrl(): string {
    // Verificar si hay un servidor dedicado configurado en variables de entorno
    let dedicatedServer =
      (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_WHATSAPP_SERVER_URL) ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_WHATSAPP_SERVER_URL);

    // Si no hay variable definida pero estamos en desarrollo web (no electron),
    // intentar usar el puerto por defecto del servidor (3001)
    if (!dedicatedServer &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost' &&
      !this.isElectron()) {
      dedicatedServer = 'http://localhost:3001';
    }

    if (dedicatedServer) {
      // Remover slash final si existe
      return dedicatedServer.endsWith('/') ? dedicatedServer.slice(0, -1) : dedicatedServer;
    }

    // Fallback a API routes de Next.js
    return '/api/whatsapp';
  }

  private isElectron(): boolean {
    return (
      (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) ||
      (typeof window !== 'undefined' && !!(window as any).api)
    );
  }

  async connect(userId?: string): Promise<WhatsAppConnectResponse> {
    const baseUrl = this.getBaseUrl();
    // Si baseUrl es el servidor dedicado, ya incluye el dominio completo
    // Si es '/api/whatsapp', es una ruta relativa de Next.js
    const url = baseUrl.startsWith('http')
      ? `${baseUrl}/api/whatsapp/connect`
      : `${baseUrl}/connect`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al conectar WhatsApp');
    }

    return await response.json();
  }

  async getStatus(): Promise<WhatsAppStatusResponse> {
    const baseUrl = this.getBaseUrl();
    const url = baseUrl.startsWith('http')
      ? `${baseUrl}/api/whatsapp/status`
      : `${baseUrl}/status`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Error al obtener estado de WhatsApp');
    }

    return await response.json();
  }

  async getQR(): Promise<{ qrCode: string | null; status: string }> {
    const baseUrl = this.getBaseUrl();
    const url = baseUrl.startsWith('http')
      ? `${baseUrl}/api/whatsapp/qr`
      : `${baseUrl}/qr`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Error al obtener QR de WhatsApp');
    }

    return await response.json();
  }
}

export const whatsappApiService = new WhatsAppApiService();

