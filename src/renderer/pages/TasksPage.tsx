import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Edit,
  Calendar,
  User,
  FileText,
  MessageSquare,
  Loader2,
  Timer,
  Plus,
  DollarSign,
  Play,
  Pause,
  Square,
} from 'lucide-react';
import { useTasksStore } from '../store/tasksStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DOMPurify from 'dompurify';
import type { KapixTask } from '../types';

// Estados de tareas según la API
const TASK_STATUSES = {
  '1': { label: 'No Iniciada', color: 'bg-zinc-500', icon: Clock },
  '2': { label: 'En Progreso', color: 'bg-blue-500', icon: RefreshCw },
  '3': { label: 'En Revisión', color: 'bg-amber-500', icon: Eye },
  '4': { label: 'Completada', color: 'bg-emerald-500', icon: CheckCircle2 },
  '5': { label: 'Finalizada', color: 'bg-purple-500', icon: CheckCircle2 },
};

const PRIORITY_COLORS = {
  '1': 'bg-red-500/20 text-red-400 border-red-500/30',
  '2': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  '3': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  '4': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  '5': 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export function TasksPage() {
  const {
    tasks,
    isLoading,
    error,
    selectedTask,
    currentStaff,
    taskTimesheets,
    timer,
    loadTasks,
    selectTask,
    updateTask,
    refreshTasks,
    createTimesheet,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    updateTimerElapsed,
  } = useTasksStore();

  const { user } = useAuthStore();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTimesheetForm, setShowTimesheetForm] = useState(false);
  const [timesheetForm, setTimesheetForm] = useState({
    start_time: '',
    end_time: '',
    hourly_rate: '0.00',
    note: '',
  });
  const [isCreatingTimesheet, setIsCreatingTimesheet] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Efecto para el cronómetro - actualizar elapsed en el store
  useEffect(() => {
    if (timer.isRunning && timer.startTime) {
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - timer.startTime!) / 1000);
        updateTimerElapsed(elapsed);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timer.isRunning, timer.startTime, updateTimerElapsed]);

  // Abrir modal automáticamente solo cuando se carga la página y hay un timer activo
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    // Solo abrir automáticamente una vez cuando se carga la página
    if (timer.taskId && !showTaskModal && !hasAutoOpenedRef.current && tasks.length > 0) {
      const task = tasks.find(t => t.id === timer.taskId);
      if (task) {
        selectTask(task);
        setShowTaskModal(true);
        hasAutoOpenedRef.current = true;
      }
    }
  }, [timer.taskId, tasks, showTaskModal, selectTask]);

  // Resetear el flag cuando se cierra el modal manualmente
  useEffect(() => {
    if (!showTaskModal) {
      hasAutoOpenedRef.current = false;
    }
  }, [showTaskModal]);

  const groupedTasks = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const status = task.status || '1';
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(task);
      return acc;
    }, {} as Record<string, KapixTask[]>);
  }, [tasks]);

  const handleTaskClick = (task: KapixTask) => {
    selectTask(task);
    setShowTaskModal(true);
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      setIsUpdating(true);
      await updateTask(taskId, { status: newStatus });
      await refreshTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      setIsCreatingTimesheet(true);
      await createTimesheet(selectedTask.id, {
        start_time: timesheetForm.start_time,
        end_time: timesheetForm.end_time,
        hourly_rate: parseFloat(timesheetForm.hourly_rate),
        note: timesheetForm.note || undefined,
      });
      
      // Reset form
      setTimesheetForm({
        start_time: '',
        end_time: '',
        hourly_rate: currentStaff?.hourly_rate || '0.00',
        note: '',
      });
      setShowTimesheetForm(false);
    } catch (error) {
      console.error('Error creating timesheet:', error);
    } finally {
      setIsCreatingTimesheet(false);
    }
  };

  const calculateHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const [startH, startM, startS] = startTime.split(':').map(Number);
    const [endH, endM, endS] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM + startS / 60;
    const endMinutes = endH * 60 + endM + endS / 60;
    return (endMinutes - startMinutes) / 60;
  };

  const getTaskTimesheets = (taskId: string) => {
    return taskTimesheets[taskId] || [];
  };

  const getTotalHours = (taskId: string): number => {
    const timesheets = getTaskTimesheets(taskId);
    return timesheets.reduce((total, ts) => {
      return total + calculateHours(ts.start_time, ts.end_time);
    }, 0);
  };

  const getTotalCost = (taskId: string): number => {
    const timesheets = getTaskTimesheets(taskId);
    return timesheets.reduce((total, ts) => {
      const hours = calculateHours(ts.start_time, ts.end_time);
      return total + (hours * parseFloat(ts.hourly_rate.toString()));
    }, 0);
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatTimeToHHMMSS = (date: Date): string => {
    return date.toTimeString().split(' ')[0];
  };

  const handleStartTimer = () => {
    if (!selectedTask) return;
    startTimer(selectedTask.id, selectedTask.name);
  };

  const handlePauseTimer = () => {
    pauseTimer();
  };

  const handleResumeTimer = () => {
    resumeTimer();
  };

  const handleStopTimer = async () => {
    if (!selectedTask || !timer.startTime) return;

    const startDate = new Date(timer.startTime);
    const endDate = new Date();
    const startTime = formatTimeToHHMMSS(startDate);
    const endTime = formatTimeToHHMMSS(endDate);

    // Pre-llenar el formulario
    setTimesheetForm({
      start_time: startTime,
      end_time: endTime,
      hourly_rate: currentStaff?.hourly_rate || '0.00',
      note: '',
    });

    // Mostrar el formulario
    setShowTimesheetForm(true);

    // Resetear el cronómetro
    stopTimer();
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      '1': 'Urgente',
      '2': 'Alta',
      '3': 'Media',
      '4': 'Baja',
      '5': 'Muy Baja',
    };
    return labels[priority] || 'Sin prioridad';
  };

  if (error) {
    const isUserNotFound = error.includes('No se encontró') || error.includes('no está registrado');
    
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-200 mb-2">
            {isUserNotFound ? 'Usuario no encontrado' : 'Error al cargar tareas'}
          </h3>
          <p className="text-zinc-400 mb-4 whitespace-pre-line">{error}</p>
          {isUserNotFound && user?.email && (
            <div className="bg-zinc-800/50 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm text-zinc-300 mb-2">
                <strong>Email actual:</strong> {user.email}
              </p>
              <p className="text-xs text-zinc-500">
                Verifica que este email esté registrado en el sistema de Kapix. Si el problema persiste, contacta al administrador.
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={loadTasks} variant="outline">
              Reintentar
            </Button>
            <Button onClick={refreshTasks} variant="default">
              Actualizar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-kap-dark">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CheckSquare className="w-6 h-6 text-kap-accent" />
              Mis Tareas
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'} asignadas
            </p>
          </div>
          <Button
            onClick={refreshTasks}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading && tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-kap-accent animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Cargando tareas...</p>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<CheckSquare size={40} />}
            title="No hay tareas asignadas"
            description="No tienes tareas asignadas en este momento."
          />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 min-w-max h-full">
            {Object.entries(TASK_STATUSES).map(([statusId, statusInfo]) => {
              const IconComponent = statusInfo.icon;
              const columnTasks = groupedTasks[statusId] || [];

              return (
                <div
                  key={statusId}
                  className="flex-shrink-0 w-80 flex flex-col bg-kap-darker rounded-xl border border-zinc-800"
                >
                  {/* Column Header */}
                  <div className={`p-4 rounded-t-xl ${statusInfo.color} bg-opacity-20 border-b border-zinc-800`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {React.createElement(IconComponent, { className: 'w-5 h-5' })}
                        <h3 className="font-semibold text-white">{statusInfo.label}</h3>
                      </div>
                      <Badge variant="outline" className="bg-black/20">
                        {columnTasks.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {columnTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className="p-4 bg-kap-dark rounded-lg border border-zinc-800 hover:border-kap-accent/50 cursor-pointer transition-all group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-white group-hover:text-kap-accent transition-colors line-clamp-2">
                            {task.name}
                          </h4>
                        </div>

                        {task.description && (
                          <div
                            className="text-sm text-zinc-400 mb-3 line-clamp-2"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(task.description.substring(0, 100) + '...'),
                            }}
                          />
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`text-xs ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS['5']}`}
                          >
                            {getPriorityLabel(task.priority)}
                          </Badge>

                          {task.duedate && (
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(task.duedate), 'dd MMM', { locale: es })}
                            </div>
                          )}

                          {task.comments && task.comments.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <MessageSquare className="w-3 h-3" />
                              {task.comments.length}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {columnTasks.length === 0 && (
                      <div className="text-center py-8 text-zinc-500 text-sm">
                        No hay tareas en este estado
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          selectTask(null);
        }}
        title={selectedTask?.name || 'Detalle de Tarea'}
        size="lg"
      >
        {selectedTask && (
          <div className="space-y-6">
            {/* Task Info */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-2">Descripción</h3>
              <div
                className="text-zinc-300 prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(selectedTask.description || 'Sin descripción'),
                }}
              />
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-400 mb-2">Prioridad</h3>
                <Badge
                  className={PRIORITY_COLORS[selectedTask.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS['5']}
                >
                  {getPriorityLabel(selectedTask.priority)}
                </Badge>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-400 mb-2">Estado</h3>
                <Badge className="bg-zinc-800 text-zinc-300">
                  {TASK_STATUSES[selectedTask.status as keyof typeof TASK_STATUSES]?.label || 'Desconocido'}
                </Badge>
              </div>

              {selectedTask.startdate && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 mb-2">Fecha de Inicio</h3>
                  <p className="text-zinc-300">
                    {format(new Date(selectedTask.startdate), 'dd MMMM yyyy', { locale: es })}
                  </p>
                </div>
              )}

              {selectedTask.duedate && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 mb-2">Fecha de Vencimiento</h3>
                  <p className="text-zinc-300">
                    {format(new Date(selectedTask.duedate), 'dd MMMM yyyy', { locale: es })}
                  </p>
                </div>
              )}
            </div>

            {/* Comments */}
            {selectedTask.comments && selectedTask.comments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comentarios ({selectedTask.comments.length})
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedTask.comments.map((comment) => (
                    <div key={comment.id} className="p-3 bg-kap-darker rounded-lg border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-zinc-400" />
                          <span className="text-sm font-medium text-zinc-300">
                            {comment.staff_full_name}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {format(new Date(comment.dateadded), 'dd MMM yyyy, HH:mm', { locale: es })}
                        </span>
                      </div>
                      <div
                        className="text-sm text-zinc-400"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(comment.content),
                        }}
                      />
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {comment.attachments.map((attachment) => (
                            <Badge key={attachment.id} variant="outline" className="text-xs">
                              <FileText className="w-3 h-3 mr-1" />
                              {attachment.file_name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timesheets */}
            <div className="pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Registro de Tiempo
                </h3>
                <Button
                  onClick={() => {
                    setTimesheetForm({
                      start_time: '',
                      end_time: '',
                      hourly_rate: currentStaff?.hourly_rate || '0.00',
                      note: '',
                    });
                    setShowTimesheetForm(!showTimesheetForm);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {showTimesheetForm ? 'Cancelar' : 'Registrar Tiempo'}
                </Button>
              </div>

              {/* Cronómetro */}
              {selectedTask && (
                <div className="mb-4 p-4 bg-kap-darker rounded-lg border border-zinc-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-300 mb-1">Cronómetro</h4>
                      <div className="text-3xl font-mono font-bold text-kap-accent">
                        {formatTime(timer.elapsedSeconds)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!timer.isRunning && timer.taskId === selectedTask.id && timer.elapsedSeconds > 0 ? (
                        <>
                          <Button
                            onClick={handleResumeTimer}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            Continuar
                          </Button>
                          <Button
                            onClick={handleStopTimer}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Square className="w-4 h-4" />
                            Detener
                          </Button>
                        </>
                      ) : timer.isRunning && timer.taskId === selectedTask.id ? (
                        <>
                          <Button
                            onClick={handlePauseTimer}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Pause className="w-4 h-4" />
                            Pausar
                          </Button>
                          <Button
                            onClick={handleStopTimer}
                            variant="default"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Square className="w-4 h-4" />
                            Detener
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={handleStartTimer}
                          variant="default"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Iniciar
                        </Button>
                      )}
                    </div>
                  </div>
                  {timer.isRunning && timer.taskId === selectedTask.id && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      <span>Registrando tiempo para: {selectedTask.name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Timesheet Form */}
              {showTimesheetForm && (
                <form onSubmit={handleCreateTimesheet} className="mb-4 p-4 bg-kap-darker rounded-lg border border-zinc-800 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Hora de Inicio (HH:MM:SS)</label>
                      <Input
                        type="text"
                        value={timesheetForm.start_time}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Validar formato HH:MM:SS
                          if (value === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
                            setTimesheetForm({ ...timesheetForm, start_time: value });
                          }
                        }}
                        placeholder="09:00:00"
                        required
                        className="bg-kap-dark font-mono"
                        pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Hora de Fin (HH:MM:SS)</label>
                      <Input
                        type="text"
                        value={timesheetForm.end_time}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Validar formato HH:MM:SS
                          if (value === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
                            setTimesheetForm({ ...timesheetForm, end_time: value });
                          }
                        }}
                        placeholder="17:00:00"
                        required
                        className="bg-kap-dark font-mono"
                        pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Tarifa por Hora</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={timesheetForm.hourly_rate}
                        onChange={(e) => setTimesheetForm({ ...timesheetForm, hourly_rate: e.target.value })}
                        required
                        className="bg-kap-dark"
                      />
                    </div>
                    <div className="flex items-end">
                      {timesheetForm.start_time && timesheetForm.end_time && (
                        <div className="text-sm text-zinc-300">
                          <span className="text-zinc-500">Horas: </span>
                          <span className="font-semibold">{calculateHours(timesheetForm.start_time, timesheetForm.end_time).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Notas (opcional)</label>
                    <Input
                      type="text"
                      value={timesheetForm.note}
                      onChange={(e) => setTimesheetForm({ ...timesheetForm, note: e.target.value })}
                      placeholder="Descripción del trabajo realizado..."
                      className="bg-kap-dark"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isCreatingTimesheet || !timesheetForm.start_time || !timesheetForm.end_time}
                    className="w-full"
                  >
                    {isCreatingTimesheet ? 'Guardando...' : 'Guardar Registro'}
                  </Button>
                </form>
              )}

              {/* Timesheets List */}
              {getTaskTimesheets(selectedTask.id).length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {getTaskTimesheets(selectedTask.id).map((timesheet, index) => {
                    const hours = calculateHours(timesheet.start_time, timesheet.end_time);
                    const cost = hours * parseFloat(timesheet.hourly_rate.toString());
                    return (
                      <div key={timesheet.id || index} className="p-3 bg-kap-darker rounded-lg border border-zinc-800">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-zinc-400" />
                            <span className="text-sm font-medium text-zinc-300">
                              {timesheet.start_time} - {timesheet.end_time}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-zinc-400">{hours.toFixed(2)}h</span>
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {cost.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {timesheet.note && (
                          <p className="text-xs text-zinc-500 mt-1">{timesheet.note}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total Summary */}
              {getTaskTimesheets(selectedTask.id).length > 0 && (
                <div className="mt-3 p-3 bg-kap-accent/10 rounded-lg border border-kap-accent/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-300">Total:</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-zinc-400">
                        {getTotalHours(selectedTask.id).toFixed(2)} horas
                      </span>
                      <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {getTotalCost(selectedTask.id).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {getTaskTimesheets(selectedTask.id).length === 0 && !showTimesheetForm && (
                <p className="text-sm text-zinc-500 text-center py-4">
                  No hay registros de tiempo para esta tarea
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
              <span className="text-sm font-semibold text-zinc-400">Cambiar estado:</span>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(TASK_STATUSES).map(([statusId, statusInfo]) => (
                  <Button
                    key={statusId}
                    onClick={() => handleStatusChange(selectedTask.id, statusId)}
                    disabled={isUpdating || selectedTask.status === statusId}
                    variant={selectedTask.status === statusId ? 'default' : 'outline'}
                    size="sm"
                  >
                    {statusInfo.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

