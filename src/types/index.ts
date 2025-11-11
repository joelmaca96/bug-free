// Usuario y roles
export type UserRole = 'superuser' | 'admin' | 'gestor' | 'empleado';

export interface DatosPersonales {
  nombre: string;
  apellidos: string;
  nif: string;
  email: string;
  telefono: string;
}

export interface RestriccionesHorarias {
  horasMaximasDiarias: number;
  horasMaximasSemanales: number;
  horasMaximasMensuales: number;
  horasMaximasAnuales: number;
  diasFestivos: string[]; // Array de fechas ISO
}

export interface Usuario {
  uid: string;
  datosPersonales: DatosPersonales;
  rol: UserRole;
  farmaciaId: string;
  empresaId: string;
  restricciones: RestriccionesHorarias;
  incluirEnCalendario?: boolean; // Solo para admin y gestor - indica si debe aparecer en el calendario
  createdAt?: Date;
  updatedAt?: Date;
}

// Empresa
export interface Empresa {
  id: string;
  cif: string;
  nombre: string;
  direccion: string;
  contacto: string;
  adminId?: string; // UID del usuario admin asignado a esta empresa (opcional)
  createdAt?: Date;
  updatedAt?: Date;
}

// Configuración de Farmacia
export interface HorarioHabitual {
  dia: number; // 0-6 (domingo-sábado)
  inicio: string; // HH:mm
  fin: string; // HH:mm
}

export interface JornadaGuardia {
  fechaInicio: string; // ISO date
  horaInicio: string; // HH:mm
  fechaFin: string; // ISO date
  horaFin: string; // HH:mm
}

export interface ConfiguracionFarmacia {
  horariosHabituales: HorarioHabitual[];
  jornadasGuardia: JornadaGuardia[];
  festivosRegionales: string[]; // Array de fechas ISO
  trabajadoresMinimos: number;
}

// Farmacia
export interface Farmacia {
  id: string;
  empresaId: string;
  cif: string;
  nombre: string;
  direccion: string;
  gestorId?: string; // UID del usuario gestor asignado a esta farmacia (opcional)
  configuracion: ConfiguracionFarmacia;
  createdAt?: Date;
  updatedAt?: Date;
}

// Turnos
export type TipoTurno = 'laboral' | 'guardia' | 'festivo';
export type EstadoTurno = 'confirmado' | 'pendiente' | 'conflicto';

export interface Turno {
  id: string;
  empleadoId: string;
  fecha: string; // ISO date
  horaInicio: number; // hora en formato 24h
  horaFin: number; // hora en formato 24h
  duracionMinutos?: number; // duración del turno en minutos (calculado si no existe)
  tipo: TipoTurno;
  estado: EstadoTurno;
  createdAt?: Date;
  updatedAt?: Date;
}

// Configuración del Algoritmo
export interface Prioridad {
  peso: number;
  activo: boolean;
}

export interface PrioridadesAlgoritmo {
  coberturaMinima: Prioridad;
  limitesHoras: Prioridad;
  distribucionGuardias: Prioridad;
  distribucionFestivos: Prioridad;
  minimizarCambiosTurno: Prioridad;
}

export interface RestriccionesAlgoritmo {
  descansoMinimoEntreJornadas: number; // horas
  maxTurnosConsecutivos: number; // días
  maxHorasDiarias: number; // horas
  permitirHorasExtra: boolean;
  estrategiaAsignacion: 'turno_completo' | 'slots_individuales'; // Estrategia de asignación de turnos
  preferenciaDistribucion: 'igualdad_horas' | 'horas_seguidas'; // Preferencia al distribuir horas
}

export interface ParametrosOptimizacion {
  maxIteraciones: number;
  umbralAceptacion: number;
}

export interface ConfiguracionAlgoritmo {
  id: string;
  userId: string;
  farmaciaId: string;
  empresaId?: string; // Agregado para optimizar reglas de seguridad
  prioridades: PrioridadesAlgoritmo;
  restricciones: RestriccionesAlgoritmo;
  parametrosOptimizacion: ParametrosOptimizacion;
  version: number;
  fechaModificacion: Date;
}

// Conflictos
export type SeveridadConflicto = 'critico' | 'alto' | 'medio' | 'bajo';

export interface Conflicto {
  id: string;
  tipo: 'cobertura_insuficiente' | 'exceso_horas' | 'descanso_insuficiente' | 'turnos_consecutivos';
  severidad: SeveridadConflicto;
  descripcion: string;
  fecha: string;
  empleadoId?: string;
  turnoId?: string;
  sugerencias: string[];
}

// Slot de tiempo para asignación
export interface TimeSlot {
  fecha: string; // ISO date
  horaInicio: number;
  horaFin: number;
  tipo: TipoTurno;
  trabajadoresNecesarios: number;
  asignaciones: string[]; // Array de empleadoIds
  guardiaId?: string; // ID único para agrupar slots de la misma guardia (incluyendo nocturnas)
}

// Resultado del algoritmo
export interface ResultadoAlgoritmo {
  turnos: Turno[];
  conflictos: Conflicto[];
  estadisticas: {
    empleadoId: string;
    horasTrabajadas: number;
    turnosAsignados: number;
    guardiasAsignadas: number;
    festivosAsignados: number;
  }[];
  scoreGlobal: number;
  tiempoEjecucion: number; // milisegundos
}

// Tracking de horas por empleado
export interface HorasEmpleado {
  diarias: { [fecha: string]: number };
  semanales: { [semana: string]: number };
  mensuales: { [mes: string]: number };
  anuales: { [año: string]: number };
}

// Auth Context
export interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<Usuario>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}
