import type { KapixTask, KapixStaff, KapixTimesheet } from '../types';

// Constantes de la API
const API_BASE_URL = 'https://kpixs.com/api';
const AUTH_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiS2VubmV0aCIsIm5hbWUiOiJLYXBpeCBBUEkiLCJBUElfVElNRSI6MTcyMTQ0NzI4Nn0.2vfJW3If8KeDoRFTwlRgIHSL6Eitxt1MWAkSVZNvrsM';

// Función helper para verificar si estamos en Electron y esperar a que window.api esté disponible
const ensureElectronAPI = async (): Promise<boolean> => {
  // Primero verificar si estamos en un navegador web real (no Electron)
  if (typeof window !== 'undefined' && typeof (window as any).process === 'undefined') {
    // Si no hay process, probablemente es un navegador web real
    // Verificar si realmente es Electron por userAgent
    const isElectronUA = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
    if (!isElectronUA) {
      console.log('[KapixAPI] 🔍 Detectado navegador web, usando fetch');
      return false;
    }
  }

  // Verificar si window.api existe
  const hasApi = typeof window !== 'undefined' && !!(window as any).api;
  if (!hasApi) {
    console.log('[KapixAPI] 🔍 window.api no disponible, usando fetch');
    return false;
  }

  // Esperar a que window.api.kapix esté disponible
  let retries = 20;
  while (retries > 0 && (typeof window === 'undefined' || !window.api || !window.api.kapix)) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries--;
  }

  const hasKapixAPI = typeof window !== 'undefined' && !!window.api && !!window.api.kapix;
  if (hasKapixAPI) {
    console.log('[KapixAPI] ✅ Usando IPC de Electron');
  } else {
    console.log('[KapixAPI] ⚠️ window.api.kapix no disponible después de esperar, usando fetch');
  }

  return hasKapixAPI;
};

// Función helper para hacer peticiones fetch en web (fallback)
const makeWebRequest = async (endpoint: string, method: string = 'GET', body?: any): Promise<any> => {
  // Asegurar que el endpoint empiece con /
  const endpointPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Determinar qué proxy usar
  const isDev = import.meta.env.DEV;
  const isVercel = typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('vercel.com')
  );
  
  let url: string;
  let useProxy = false;
  
  if (isDev) {
    // En desarrollo, usar el proxy de Vite
    url = `/api/kapix${endpointPath}`;
    useProxy = true;
    console.log(`[KapixAPI] 🌐 Web Request (via Vite proxy): ${method} ${url}`);
  } else if (isVercel) {
    // En producción en Vercel, usar la función serverless
    // El endpointPath ya incluye el / inicial, solo necesitamos agregarlo al path
    url = `/api/kapix${endpointPath}`;
    useProxy = true;
    console.log(`[KapixAPI] 🌐 Web Request (via Vercel function): ${method} ${url}`);
  } else {
    // En producción en otros servidores, usar la URL directa
    url = `${API_BASE_URL}${endpointPath}`;
    console.log(`[KapixAPI] 🌐 Web Request (direct): ${method} ${url}`);
  }
  
  const options: RequestInit = {
    method,
    mode: 'cors', // Asegurar que use CORS
    credentials: 'omit', // No enviar cookies
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // En producción con proxy, el authtoken se agrega en el servidor
      // En desarrollo o sin proxy, lo agregamos aquí
      ...(useProxy ? {} : { 'authtoken': AUTH_TOKEN }),
    },
  };

  // Log para debugging
  if (useProxy) {
    console.log(`[KapixAPI] 🔄 Usando proxy (${isDev ? 'Vite' : 'Vercel'}), el header authtoken será agregado por el proxy`);
  } else {
    console.log('[KapixAPI] 🔄 Usando URL directa, header authtoken incluido en la petición');
  }

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
    console.log('[KapixAPI] 📦 Request body:', JSON.stringify(body, null, 2));
  }

  try {
    const response = await fetch(url, options);
    
    console.log(`[KapixAPI] 📡 Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = `Error ${response.status} ${response.statusText}`;
      }
      console.error('[KapixAPI] ❌ Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500),
        url: response.url,
      });
      
      // Si es un error 500, podría ser un problema del servidor, intentar de nuevo
      if (response.status === 500 && !useProxy) {
        console.log('[KapixAPI] 🔄 Error 500, podría ser un problema temporal del servidor');
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200) || response.statusText}`);
    }

    const data = await response.json();
    console.log('[KapixAPI] ✅ Request exitoso');
    return data;
  } catch (error: any) {
    // Si es un error de CORS, dar un mensaje más claro
    if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
      console.error('[KapixAPI] ❌ Error de CORS:', error);
      if (useProxy) {
        throw new Error('Error al conectar con la API de Kapix a través del proxy. Verifica que el servidor de desarrollo esté corriendo.');
      } else {
        throw new Error('Error de CORS al conectar con la API de Kapix. En producción, considera usar un proxy o configurar CORS en el servidor.');
      }
    }
    throw error;
  }
};

export class KapixApiService {
  /**
   * Obtiene todas las tareas
   */
  static async getTasks(): Promise<KapixTask[]> {
    try {
      const hasElectronAPI = await ensureElectronAPI();
      
      if (hasElectronAPI) {
        console.log('[KapixAPI] Usando IPC de Electron para obtener tareas');
        return await window.api.kapix.getTasks();
      } else {
        console.warn('[KapixAPI] window.api.kapix no disponible, usando fetch (puede tener problemas de CORS)');
        // Fallback para web (puede tener problemas de CORS)
        const data = await makeWebRequest('/tasks', 'GET');
        return Array.isArray(data) ? data : [];
      }
    } catch (error) {
      console.error('[KapixAPI] Error fetching tasks:', error);
      throw error;
    }
  }

  /**
   * Obtiene una tarea por ID
   */
  static async getTaskById(id: string): Promise<KapixTask> {
    try {
      const hasElectronAPI = await ensureElectronAPI();
      if (hasElectronAPI) {
        return await window.api.kapix.getTaskById(id);
      } else {
        console.warn('[KapixAPI] Usando fetch para obtener tarea (puede tener problemas de CORS)');
        return await makeWebRequest(`/tasks/${id}`, 'GET');
      }
    } catch (error) {
      console.error('[KapixAPI] Error fetching task:', error);
      throw error;
    }
  }

  /**
   * Actualiza una tarea
   */
  static async updateTask(id: string, updates: Partial<KapixTask>): Promise<KapixTask> {
    try {
      const hasElectronAPI = await ensureElectronAPI();
      if (hasElectronAPI) {
        return await window.api.kapix.updateTask(id, updates);
      } else {
        console.warn('[KapixAPI] Usando fetch para actualizar tarea (puede tener problemas de CORS)');
        return await makeWebRequest(`/tasks/${id}`, 'PUT', updates);
      }
    } catch (error) {
      console.error('[KapixAPI] Error updating task:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los staffs
   */
  static async getStaffs(): Promise<KapixStaff[]> {
    try {
      const hasElectronAPI = await ensureElectronAPI();
      if (hasElectronAPI) {
        console.log('[KapixAPI] Obteniendo staffs vía IPC...');
        const staffs = await window.api.kapix.getStaffs();
        console.log('[KapixAPI] Staffs recibidos:', staffs?.length || 0);
        return Array.isArray(staffs) ? staffs : [];
      } else {
        console.warn('[KapixAPI] Usando fetch para obtener staffs (puede tener problemas de CORS)');
        const staffs = await makeWebRequest('/staffs', 'GET');
        console.log('[KapixAPI] Staffs recibidos:', Array.isArray(staffs) ? staffs.length : 0);
        return Array.isArray(staffs) ? staffs : [];
      }
    } catch (error) {
      console.error('[KapixAPI] Error fetching staffs:', error);
      throw error;
    }
  }

  /**
   * Obtiene un staff por email
   */
  static async getStaffByEmail(email: string): Promise<KapixStaff | null> {
    try {
      console.log('[KapixAPI] 🔍 Buscando staff con email:', email);
      const staffs = await this.getStaffs();
      console.log('[KapixAPI] 📊 Total de staffs encontrados:', staffs.length);
      
      if (staffs.length === 0) {
        console.warn('[KapixAPI] ⚠️ No se encontraron staffs en la API');
        return null;
      }
      
      // Normalizar el email de búsqueda
      const searchEmail = email.toLowerCase().trim();
      console.log('[KapixAPI] 🔎 Email normalizado para búsqueda:', searchEmail);
      
      // Buscar coincidencia exacta primero
      let staff = staffs.find(s => {
        const staffEmail = s.email?.toLowerCase().trim() || '';
        return staffEmail === searchEmail;
      });
      
      // Si no hay coincidencia exacta, buscar coincidencia parcial
      if (!staff) {
        console.log('[KapixAPI] 🔄 No se encontró coincidencia exacta, buscando parcial...');
        staff = staffs.find(s => {
          const staffEmail = s.email?.toLowerCase().trim() || '';
          // Comparar sin espacios y caracteres especiales
          const normalizedStaff = staffEmail.replace(/\s+/g, '').replace(/[._-]/g, '');
          const normalizedSearch = searchEmail.replace(/\s+/g, '').replace(/[._-]/g, '');
          return normalizedStaff === normalizedSearch;
        });
      }
      
      if (staff) {
        console.log('[KapixAPI] ✅ Staff encontrado!');
        console.log('[KapixAPI]   - ID:', staff.staffid);
        console.log('[KapixAPI]   - Email:', staff.email);
        console.log('[KapixAPI]   - Nombre:', staff.full_name);
        return staff;
      } else {
        console.warn('[KapixAPI] ❌ No se encontró staff con email:', email);
        console.log('[KapixAPI] 📋 Emails disponibles en la API:');
        staffs.slice(0, 10).forEach((s, i) => {
          console.log(`[KapixAPI]   ${i + 1}. "${s.email}" (${s.full_name})`);
        });
        return null;
      }
    } catch (error) {
      console.error('[KapixAPI] ❌ Error fetching staff by email:', error);
      throw error;
    }
  }

  /**
   * Obtiene un staff por ID
   */
  static async getStaffById(staffid: string): Promise<KapixStaff | null> {
    try {
      const staffs = await this.getStaffs();
      return staffs.find(staff => staff.staffid === staffid) || null;
    } catch (error) {
      console.error('Error fetching staff by id:', error);
      throw error;
    }
  }

  /**
   * Filtra tareas por staffid (usuario asignado)
   */
  static async getTasksByStaffId(staffid: string): Promise<KapixTask[]> {
    try {
      const allTasks = await this.getTasks();
      // Filtrar tareas donde el addedfrom coincide con el staffid
      return allTasks.filter(task => task.addedfrom === staffid);
    } catch (error) {
      console.error('Error filtering tasks by staff:', error);
      throw error;
    }
  }

  /**
   * Crea un timesheet (registro de tiempo)
   */
  static async createTimesheet(data: {
    task_id: string;
    start_time: string;
    end_time: string;
    staff_id: string;
    hourly_rate: number;
    note?: string;
  }): Promise<KapixTimesheet> {
    try {
      const hasElectronAPI = await ensureElectronAPI();
      if (hasElectronAPI) {
        console.log('[KapixAPI] Creando timesheet vía IPC...', data);
        return await window.api.kapix.createTimesheet(data);
      } else {
        console.warn('[KapixAPI] Usando fetch para crear timesheet (puede tener problemas de CORS)');
        return await makeWebRequest('/timesheets/', 'POST', data);
      }
    } catch (error) {
      console.error('[KapixAPI] Error creating timesheet:', error);
      throw error;
    }
  }

  /**
   * Obtiene un timesheet por ID
   */
  static async getTimesheet(id: string): Promise<KapixTimesheet> {
    try {
      const hasElectronAPI = await ensureElectronAPI();
      if (hasElectronAPI) {
        return await window.api.kapix.getTimesheet(id);
      } else {
        console.warn('[KapixAPI] Usando fetch para obtener timesheet (puede tener problemas de CORS)');
        return await makeWebRequest(`/timesheets/${id}`, 'GET');
      }
    } catch (error) {
      console.error('[KapixAPI] Error fetching timesheet:', error);
      throw error;
    }
  }

  /**
   * Actualiza un timesheet
   */
  static async updateTimesheet(id: string, updates: Partial<KapixTimesheet>): Promise<KapixTimesheet> {
    try {
      const hasElectronAPI = await ensureElectronAPI();
      if (hasElectronAPI) {
        return await window.api.kapix.updateTimesheet(id, updates);
      } else {
        console.warn('[KapixAPI] Usando fetch para actualizar timesheet (puede tener problemas de CORS)');
        return await makeWebRequest(`/timesheets/${id}`, 'PUT', updates);
      }
    } catch (error) {
      console.error('[KapixAPI] Error updating timesheet:', error);
      throw error;
    }
  }
}

