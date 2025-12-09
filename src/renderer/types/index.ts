export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'agent' | 'user';
  status: 'online' | 'offline' | 'away' | 'busy';
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
  members?: string[];
  unread_count?: number;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments?: Attachment[];
  created_at: string;
  updated_at?: string;
  user?: User;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface WhatsAppConversation {
  id: string;
  phone: string;
  name: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  assigned_agent_id?: string;
  assigned_agent?: User;
  department_id?: string;
  department?: {
    id: string;
    name: string;
    color: string;
    description?: string;
  };
  status: 'pending' | 'assigned' | 'resolved';
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  from: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact';
  is_from_me: boolean;
  timestamp: number;
  status?: 'pending' | 'sent' | 'delivered' | 'read';
  media_url?: string;
  media_mimetype?: string;
  caption?: string;
  file_name?: string;
  quoted_message_id?: string;
  sent_by_user_id?: string;
  sent_by_user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface Email {
  id: string;
  from: string;
  from_name: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  date: string;
  is_read: boolean;
  assigned_agent_id?: string;
  assigned_agent?: User;
  status: 'pending' | 'assigned' | 'resolved';
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content_type: string;
  size: number;
}

export interface AppConfig {
  supabase_url: string;
  supabase_anon_key: string;
  smtp_host?: string;
  smtp_port?: number;
  imap_host?: string;
  imap_port?: number;
  email_user?: string;
}

// WhatsApp Flow types
export interface WhatsAppFlow {
  id: string;
  name: string;
  description?: string;
  trigger_type: 'keyword' | 'first_message' | 'webhook' | 'schedule';
  trigger_value?: string;
  is_active: boolean;
  nodes: FlowNode[];
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  type: 'message' | 'question' | 'condition' | 'action' | 'delay' | 'transfer';
  position: { x: number; y: number };
  data: FlowNodeData;
  connections: FlowConnection[];
}

export interface FlowNodeData {
  // For message nodes
  message?: string;
  media_type?: 'text' | 'image' | 'video' | 'audio' | 'document';
  media_url?: string;

  // For question nodes
  question?: string;
  options?: Array<{ label: string; value: string }>;
  variable_name?: string;

  // For condition nodes
  condition?: {
    variable: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
    value: string;
  };

  // For action nodes
  action_type?: 'set_variable' | 'http_request' | 'assign_agent' | 'tag_conversation';
  action_config?: Record<string, any>;

  // For delay nodes
  delay_seconds?: number;

  // For transfer nodes
  transfer_to_agent?: string;
  transfer_message?: string;
}

export interface FlowConnection {
  id: string;
  target_node_id: string;
  label?: string;
  condition?: string;
}

export interface FlowExecution {
  id: string;
  flow_id: string;
  conversation_id: string;
  current_node_id: string;
  variables: Record<string, any>;
  status: 'running' | 'completed' | 'paused' | 'failed';
  started_at: string;
  completed_at?: string;
}

declare global {
  interface Window {
    api: {
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        reload: () => Promise<void>;
      };
      supabase: {
        init: (config: { url: string; anonKey: string }) => Promise<boolean>;
      };
      whatsapp: {
        connect: (userId?: string) => Promise<boolean>;
        checkSession: () => Promise<{ hasSession: boolean; isConnected: boolean }>;
        send: (data: { to: string; message: string }) => Promise<boolean>;
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
        }) => Promise<{ id: string; timestamp: number }>;
        sendTyping: (to: string) => Promise<void>;
        markAsRead: (keys: Array<{ id: string; remoteJid: string }>) => Promise<void>;
        checkNumber: (phone: string) => Promise<boolean>;
        getProfilePicture: (phone: string) => Promise<string | undefined>;
        getStatus: () => Promise<{ connected: boolean; state: string; user?: { id: string; name?: string } }>;
        disconnect: () => Promise<boolean>;
        logout: () => Promise<boolean>;
        onQR: (callback: (qr: string) => void) => void;
        onReady: (callback: (user?: { id: string; name?: string }) => void) => void;
        onMessage: (callback: (message: any) => void) => void;
        onMessageUpsert: (callback: (message: any) => void) => void;
        onMessageUpdate: (callback: (update: { id: string; remoteJid: string; status: string }) => void) => void;
        onChatsUpsert: (callback: (chats: any[]) => void) => void;
        onContactsUpsert: (callback: (contacts: any[]) => void) => void;
        onPresenceUpdate: (callback: (presence: any) => void) => void;
        onConnectionState: (callback: (state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting') => void) => void;
        onDisconnected: (callback: () => void) => void;
        onLoggedOut: (callback: () => void) => void;
        onError: (callback: (error: { message: string }) => void) => void;
        removeAllListeners: () => void;
      };
      email: {
        connect: (config: {
          user: string;
          password: string;
          host: string;
          port: number;
          smtpHost: string;
          smtpPort: number;
        }) => Promise<boolean>;
        send: (data: {
          to: string;
          subject: string;
          html: string;
          attachments?: any[];
        }) => Promise<boolean>;
        fetch: () => Promise<any[]>;
        getStatus: () => Promise<{ connected: boolean; reconnectAttempts: number }>;
        disconnect: () => Promise<boolean>;
        onNew: (callback: (mail: any) => void) => void;
        onError: (callback: (err: { message: string; source?: string }) => void) => void;
        removeAllListeners: () => void;
      };
      kapix: {
        getTasks: () => Promise<KapixTask[]>;
        getTaskById: (id: string) => Promise<KapixTask>;
        updateTask: (id: string, updates: any) => Promise<KapixTask>;
        getStaffs: () => Promise<KapixStaff[]>;
        createTimesheet: (data: {
          task_id: string;
          start_time: string;
          end_time: string;
          staff_id: string;
          hourly_rate: number;
          note?: string;
        }) => Promise<KapixTimesheet>;
        getTimesheet: (id: string) => Promise<KapixTimesheet>;
        updateTimesheet: (id: string, updates: any) => Promise<KapixTimesheet>;
      };
    };
  }
}

export interface Sticker {
  id: string;
  name: string;
  file_url: string;
  file_path?: string;
  mime_type: string;
  uploaded_by?: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Kapix API Types
export interface KapixTask {
  id: string;
  name: string;
  description: string;
  priority: string;
  dateadded: string;
  startdate: string;
  duedate: string;
  datefinished: string | null;
  addedfrom: string;
  is_added_from_contact: string;
  status: string;
  recurring_type: string | null;
  repeat_every: string;
  recurring: string;
  is_recurring_from: string | null;
  cycles: string;
  total_cycles: string;
  custom_recurring: string;
  last_recurring_date: string | null;
  rel_id: string;
  rel_type: string;
  is_public: string;
  billable: string;
  billed: string;
  invoice_id: string;
  hourly_rate: string;
  milestone: string;
  es_status_change_date: string | null;
  kanban_order: string;
  milestone_order: string;
  visible_to_client: string;
  deadline_notified: string;
  task_type: string | null;
  comments?: KapixTaskComment[];
}

export interface KapixTaskComment {
  id: string;
  dateadded: string;
  content: string;
  firstname: string;
  lastname: string;
  staffid: string;
  contact_id: string;
  file_id: string;
  staff_full_name: string;
  attachments: KapixTaskAttachment[];
}

export interface KapixTaskAttachment {
  id: string;
  rel_id: string;
  rel_type: string;
  file_name: string;
  filetype: string;
  visible_to_customer: string;
  attachment_key: string;
  external: string | null;
  external_link: string | null;
  thumbnail_link: string | null;
  staffid: string;
  contact_id: string;
  task_comment_id: string;
  deal_comment_id: string | null;
  dateadded: string;
  comment_file_id: string | null;
}

export interface KapixStaff {
  staffid: string;
  email: string;
  firstname: string;
  lastname: string;
  facebook: string;
  linkedin: string;
  phonenumber: string;
  skype: string;
  password: string;
  datecreated: string;
  profile_image: string | null;
  last_ip: string;
  last_login: string;
  last_activity: string;
  last_password_change: string;
  new_pass_key: string;
  new_pass_key_requested: string;
  admin: string;
  role: string;
  active: string;
  default_language: string;
  direction: string;
  media_path_slug: string;
  is_not_staff: string;
  hourly_rate: string;
  two_factor_auth_enabled: string;
  two_factor_auth_code: string | null;
  two_factor_auth_code_requested: string | null;
  email_signature: string;
  google_auth_secret: string | null;
  vehicle_plate: string | null;
  mail_password: string | null;
  mail_signature: string | null;
  last_email_check: string | null;
  token: string | null;
  store_id: string | null;
  whatsapp_auth_enabled: string;
  whatsapp_auth_code: string | null;
  whatsapp_auth_code_requested: string | null;
  full_name: string;
  customfields: Array<{
    label: string;
    value: string;
  }>;
}

export interface KapixTimesheet {
  id?: string;
  task_id: string;
  start_time: string;
  end_time: string;
  staff_id: string;
  hourly_rate: number;
  note?: string;
  dateadded?: string;
  date_created?: string;
}

export { };
