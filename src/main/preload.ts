import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    reload: () => ipcRenderer.invoke('window:reload'),
  },

  // Supabase
  supabase: {
    init: (config: { url: string; anonKey: string }) =>
      ipcRenderer.invoke('supabase:init', config),
  },

  // WhatsApp
  whatsapp: {
    connect: (userId?: string) => ipcRenderer.invoke('whatsapp:connect', userId),
    checkSession: () => ipcRenderer.invoke('whatsapp:checkSession'),

    // Simple text message (backwards compatible)
    send: (data: { to: string; message: string }) =>
      ipcRenderer.invoke('whatsapp:send', data),

    // Advanced message sending with media support
    sendMessage: (options: {
      to: string;
      message?: string;
      mediaPath?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'audio' | 'document';
      caption?: string;
      fileName?: string;
      quotedMessageId?: string;
      mentions?: string[];
    }) => ipcRenderer.invoke('whatsapp:sendMessage', options),

    // Send typing indicator
    sendTyping: (to: string) =>
      ipcRenderer.invoke('whatsapp:sendTyping', to),

    // Mark messages as read
    markAsRead: (keys: Array<{ id: string; remoteJid: string }>) =>
      ipcRenderer.invoke('whatsapp:markAsRead', keys),

    // Check if a phone number exists on WhatsApp
    checkNumber: (phone: string) =>
      ipcRenderer.invoke('whatsapp:checkNumber', phone),

    // Get profile picture URL
    getProfilePicture: (phone: string) =>
      ipcRenderer.invoke('whatsapp:getProfilePicture', phone),

    // Get connection status
    getStatus: () =>
      ipcRenderer.invoke('whatsapp:getStatus'),

    // Disconnect (maintains session)
    disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),

    // Logout (clears session)
    logout: () => ipcRenderer.invoke('whatsapp:logout'),

    // Event listeners
    onQR: (callback: (qr: string) => void) => {
      ipcRenderer.on('whatsapp:qr', (_, qr) => callback(qr));
    },

    onReady: (callback: (user?: { id: string; name?: string }) => void) => {
      ipcRenderer.on('whatsapp:ready', (_, user) => callback(user));
    },

    onMessage: (callback: (message: any) => void) => {
      ipcRenderer.on('whatsapp:message', (_, message) => callback(message));
    },

    onMessageUpsert: (callback: (message: any) => void) => {
      ipcRenderer.on('whatsapp:messageUpsert', (_, message) => callback(message));
    },

    onMessageUpdate: (callback: (update: { id: string; remoteJid: string; status: string }) => void) => {
      ipcRenderer.on('whatsapp:messageUpdate', (_, update) => callback(update));
    },

    onChatsUpsert: (callback: (chats: any[]) => void) => {
      ipcRenderer.on('whatsapp:chatsUpsert', (_, chats) => callback(chats));
    },

    onContactsUpsert: (callback: (contacts: any[]) => void) => {
      ipcRenderer.on('whatsapp:contactsUpsert', (_, contacts) => callback(contacts));
    },

    onPresenceUpdate: (callback: (presence: any) => void) => {
      ipcRenderer.on('whatsapp:presenceUpdate', (_, presence) => callback(presence));
    },

    onConnectionState: (callback: (state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting') => void) => {
      ipcRenderer.on('whatsapp:connectionState', (_, state) => callback(state));
    },

    onDisconnected: (callback: () => void) => {
      ipcRenderer.on('whatsapp:disconnected', () => callback());
    },

    onLoggedOut: (callback: () => void) => {
      ipcRenderer.on('whatsapp:loggedOut', () => callback());
    },

    onError: (callback: (error: { message: string }) => void) => {
      ipcRenderer.on('whatsapp:error', (_, error) => callback(error));
    },

    // Remove listeners (useful for cleanup)
    removeAllListeners: () => {
      const events = [
        'whatsapp:qr', 'whatsapp:ready', 'whatsapp:message',
        'whatsapp:messageUpsert', 'whatsapp:messageUpdate',
        'whatsapp:chatsUpsert', 'whatsapp:contactsUpsert',
        'whatsapp:presenceUpdate', 'whatsapp:connectionState',
        'whatsapp:disconnected', 'whatsapp:loggedOut', 'whatsapp:error'
      ];
      events.forEach(event => ipcRenderer.removeAllListeners(event));
    },
  },

  // Email
  email: {
    connect: (config: {
      user: string;
      password: string;
      host: string;
      port: number;
      smtpHost: string;
      smtpPort: number;
    }) => ipcRenderer.invoke('email:connect', config),

    send: (data: {
      to: string;
      subject: string;
      html: string;
      attachments?: any[];
    }) => ipcRenderer.invoke('email:send', data),

    fetch: () => ipcRenderer.invoke('email:fetch'),

    getStatus: () => ipcRenderer.invoke('email:getStatus'),

    disconnect: () => ipcRenderer.invoke('email:disconnect'),

    onNew: (callback: (mail: any) => void) => {
      ipcRenderer.on('email:new', (_, mail) => callback(mail));
    },

    onError: (callback: (err: { message: string; source?: string }) => void) => {
      ipcRenderer.on('email:error', (_, err) => callback(err));
    },

    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('email:new');
      ipcRenderer.removeAllListeners('email:error');
    },
  },

  // Kapix API
  kapix: {
    getTasks: () => ipcRenderer.invoke('kapix:getTasks'),
    getTaskById: (id: string) => ipcRenderer.invoke('kapix:getTaskById', id),
    updateTask: (id: string, updates: any) => ipcRenderer.invoke('kapix:updateTask', id, updates),
    getStaffs: () => ipcRenderer.invoke('kapix:getStaffs'),
    createTimesheet: (data: {
      task_id: string;
      start_time: string;
      end_time: string;
      staff_id: string;
      hourly_rate: number;
      note?: string;
    }) => ipcRenderer.invoke('kapix:createTimesheet', data),
    getTimesheet: (id: string) => ipcRenderer.invoke('kapix:getTimesheet', id),
    updateTimesheet: (id: string, updates: any) => ipcRenderer.invoke('kapix:updateTimesheet', id, updates),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type API = typeof api;
