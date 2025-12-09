import { create } from 'zustand';
import { KapixApiService } from '../services/kapixApi';
import type { KapixTask, KapixStaff, KapixTimesheet } from '../types';
import { useAuthStore } from './authStore';

interface TimerState {
  isRunning: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  taskId: string | null;
  taskName: string | null;
}

interface TasksState {
  tasks: KapixTask[];
  currentStaff: KapixStaff | null;
  isLoading: boolean;
  error: string | null;
  selectedTask: KapixTask | null;
  taskTimesheets: Record<string, KapixTimesheet[]>; // task_id -> timesheets
  timer: TimerState;
  
  // Actions
  loadTasks: () => Promise<void>;
  loadCurrentStaff: () => Promise<void>;
  updateTask: (id: string, updates: Partial<KapixTask>) => Promise<void>;
  selectTask: (task: KapixTask | null) => void;
  refreshTasks: () => Promise<void>;
  createTimesheet: (taskId: string, data: {
    start_time: string;
    end_time: string;
    hourly_rate: number;
    note?: string;
  }) => Promise<void>;
  loadTaskTimesheets: (taskId: string) => Promise<void>;
  // Timer actions
  startTimer: (taskId: string, taskName: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  updateTimerElapsed: (seconds: number) => void;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  currentStaff: null,
  isLoading: false,
  error: null,
  selectedTask: null,
  taskTimesheets: {},
  timer: {
    isRunning: false,
    startTime: null,
    elapsedSeconds: 0,
    taskId: null,
    taskName: null,
  },

  loadCurrentStaff: async () => {
    const { user } = useAuthStore.getState();
    if (!user?.email) {
      console.error('[TasksStore] ❌ Usuario no autenticado');
      set({ error: 'Usuario no autenticado. Por favor, inicia sesión nuevamente.' });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      console.log('[TasksStore] 👤 Usuario actual:', {
        id: user.id,
        email: user.email,
        name: user.name,
      });
      console.log('[TasksStore] 🔍 Buscando staff en API de Kapix...');
      
      const staff = await KapixApiService.getStaffByEmail(user.email);
      
      if (!staff) {
        console.warn('[TasksStore] ⚠️ No se encontró staff');
        set({ 
          error: `No se encontró tu usuario en el sistema de Kapix.\n\nEmail buscado: ${user.email}\n\nPor favor, verifica que tu email esté registrado en la API de Kapix o contacta al administrador.`, 
          isLoading: false,
          currentStaff: null 
        });
        return;
      }

      console.log('[TasksStore] ✅ Staff encontrado exitosamente');
      console.log('[TasksStore] 📝 Datos del staff:', {
        staffid: staff.staffid,
        email: staff.email,
        full_name: staff.full_name,
      });
      
      set({ currentStaff: staff, isLoading: false, error: null });
    } catch (error: any) {
      console.error('[TasksStore] ❌ Error loading staff:', error);
      set({ 
        error: error.message || 'Error al cargar información del usuario. Verifica tu conexión a internet y que la API de Kapix esté disponible.', 
        isLoading: false,
        currentStaff: null 
      });
    }
  },

  loadTasks: async () => {
    const { currentStaff } = get();
    
    if (!currentStaff) {
      await get().loadCurrentStaff();
    }

    const staff = get().currentStaff;
    if (!staff) {
      // Si no hay staff, el error ya fue establecido en loadCurrentStaff
      return;
    }

    try {
      set({ isLoading: true, error: null });
      console.log('[TasksStore] Cargando tareas para staff:', staff.staffid);
      const tasks = await KapixApiService.getTasksByStaffId(staff.staffid);
      console.log('[TasksStore] Tareas encontradas:', tasks.length);
      set({ tasks, isLoading: false, error: null });
    } catch (error: any) {
      console.error('[TasksStore] Error loading tasks:', error);
      set({ error: error.message || 'Error al cargar tareas. Verifica tu conexión a internet.', isLoading: false });
    }
  },

  updateTask: async (id: string, updates: Partial<KapixTask>) => {
    try {
      set({ isLoading: true, error: null });
      const updatedTask = await KapixApiService.updateTask(id, updates);
      
      set((state) => ({
        tasks: state.tasks.map(task => task.id === id ? updatedTask : task),
        selectedTask: state.selectedTask?.id === id ? updatedTask : state.selectedTask,
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('Error updating task:', error);
      set({ error: error.message || 'Error al actualizar tarea', isLoading: false });
      throw error;
    }
  },

  selectTask: (task: KapixTask | null) => {
    set({ selectedTask: task });
  },

  refreshTasks: async () => {
    await get().loadTasks();
  },

  createTimesheet: async (taskId: string, data: {
    start_time: string;
    end_time: string;
    hourly_rate: number;
    note?: string;
  }) => {
    const { currentStaff } = get();
    if (!currentStaff) {
      throw new Error('Staff no encontrado');
    }

    // Validar que todos los campos requeridos estén presentes
    if (!taskId || !data.start_time || !data.end_time || !currentStaff.staffid) {
      console.error('[TasksStore] ❌ Campos faltantes:', {
        taskId,
        start_time: data.start_time,
        end_time: data.end_time,
        staff_id: currentStaff.staffid,
      });
      throw new Error('Faltan campos requeridos para crear el timesheet');
    }

    try {
      set({ isLoading: true, error: null });
      console.log('[TasksStore] Creando timesheet para tarea:', taskId);
      console.log('[TasksStore] Datos del timesheet:', {
        task_id: taskId,
        staff_id: currentStaff.staffid,
        start_time: data.start_time,
        end_time: data.end_time,
        hourly_rate: data.hourly_rate,
        note: data.note,
      });
      
      const timesheet = await KapixApiService.createTimesheet({
        task_id: taskId,
        staff_id: currentStaff.staffid,
        start_time: data.start_time,
        end_time: data.end_time,
        hourly_rate: data.hourly_rate,
        note: data.note,
      });

      // Actualizar timesheets de la tarea
      const currentTimesheets = get().taskTimesheets[taskId] || [];
      set((state) => ({
        taskTimesheets: {
          ...state.taskTimesheets,
          [taskId]: [...currentTimesheets, timesheet],
        },
        isLoading: false,
      }));

      console.log('[TasksStore] ✅ Timesheet creado exitosamente');
    } catch (error: any) {
      console.error('[TasksStore] Error creating timesheet:', error);
      set({ error: error.message || 'Error al crear registro de tiempo', isLoading: false });
      throw error;
    }
  },

  loadTaskTimesheets: async (taskId: string) => {
    // Por ahora, los timesheets se cargan cuando se crean
    // En el futuro se puede agregar un endpoint para obtener todos los timesheets de una tarea
    console.log('[TasksStore] loadTaskTimesheets no implementado aún');
  },

  startTimer: (taskId: string, taskName: string) => {
    const now = Date.now();
    set({
      timer: {
        isRunning: true,
        startTime: now,
        elapsedSeconds: 0,
        taskId,
        taskName,
      },
    });
  },

  pauseTimer: () => {
    set((state) => ({
      timer: {
        ...state.timer,
        isRunning: false,
      },
    }));
  },

  resumeTimer: () => {
    const { timer } = get();
    if (!timer.startTime) return;

    const now = Date.now();
    const adjustedStartTime = now - (timer.elapsedSeconds * 1000);

    set({
      timer: {
        ...timer,
        isRunning: true,
        startTime: adjustedStartTime,
      },
    });
  },

  stopTimer: () => {
    set({
      timer: {
        isRunning: false,
        startTime: null,
        elapsedSeconds: 0,
        taskId: null,
        taskName: null,
      },
    });
  },

  updateTimerElapsed: (seconds: number) => {
    set((state) => ({
      timer: {
        ...state.timer,
        elapsedSeconds: seconds,
      },
    }));
  },
}));

