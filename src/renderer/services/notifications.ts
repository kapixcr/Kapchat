/**
 * Servicio de notificaciones del sistema
 */

interface NotificationPreferences {
  chat: boolean;
  whatsapp: boolean;
  email: boolean;
  sounds: boolean;
}

class NotificationService {
  private preferences: NotificationPreferences = {
    chat: true,
    whatsapp: true,
    email: true,
    sounds: true,
  };

  constructor() {
    this.loadPreferences();
    
    // Solicitar permiso para notificaciones
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  private loadPreferences() {
    const saved = localStorage.getItem('kapchat_notifications');
    if (saved) {
      try {
        this.preferences = { ...this.preferences, ...JSON.parse(saved) };
      } catch (err) {
        console.error('Error loading notification preferences:', err);
      }
    }
  }

  private canNotify(type: 'chat' | 'whatsapp' | 'email'): boolean {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission !== 'granted') {
      return false;
    }

    return this.preferences[type] ?? true;
  }

  private playSound() {
    if (!this.preferences.sounds) return;

    try {
      // Crear un audio context para reproducir un sonido simple
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (err) {
      console.warn('Error playing notification sound:', err);
    }
  }

  notifyChannelMessage(channelName: string, senderName: string, content: string) {
    if (!this.canNotify('chat')) return;

    const notification = new Notification(`Nuevo mensaje en #${channelName}`, {
      body: `${senderName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
      icon: '/favicon.ico',
      tag: `channel-${channelName}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    this.playSound();
  }

  notifyDirectMessage(senderName: string, content: string) {
    if (!this.canNotify('chat')) return;

    const notification = new Notification(`Mensaje de ${senderName}`, {
      body: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      icon: '/favicon.ico',
      tag: `dm-${senderName}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    this.playSound();
  }

  notifyWhatsAppMessage(senderName: string, content: string) {
    if (!this.canNotify('whatsapp')) return;

    const notification = new Notification(`WhatsApp: ${senderName}`, {
      body: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      icon: '/favicon.ico',
      tag: `whatsapp-${senderName}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    this.playSound();
  }

  notifyEmail(sender: string, subject: string) {
    if (!this.canNotify('email')) return;

    const notification = new Notification(`Nuevo correo de ${sender}`, {
      body: subject,
      icon: '/favicon.ico',
      tag: `email-${sender}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    this.playSound();
  }

  updatePreferences(preferences: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...preferences };
    localStorage.setItem('kapchat_notifications', JSON.stringify(this.preferences));
  }
}

export const notificationService = new NotificationService();

