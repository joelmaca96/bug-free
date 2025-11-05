// Usuario y roles
export type UserRole = 'admin' | 'gestor' | 'empleado';

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
  margenSobrecarga: number; // porcentaje
}

export type EstrategiaOptimizacion = 'greedy' | 'backtracking' | 'genetico';

export interface ParametrosOptimizacion {
  maxIteraciones: number;
  umbralAceptacion: number;
  estrategia: EstrategiaOptimizacion;
}

export interface ConfiguracionAlgoritmo {
  id: string;
  farmaciaId: string;
  prioridades: PrioridadesAlgoritmo;
  restricciones: RestriccionesAlgoritmo;
  parametrosOptimizacion: ParametrosOptimizacion;
  version: number;
  fechaModificacion: Date;
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
