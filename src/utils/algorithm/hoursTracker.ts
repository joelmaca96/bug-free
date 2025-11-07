import { format, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { Turno, HorasEmpleado, Usuario } from '@/types';

/**
 * Clase para hacer seguimiento de las horas trabajadas por cada empleado
 */
export class HoursTracker {
  private horasPorEmpleado: Map<string, HorasEmpleado>;

  constructor() {
    this.horasPorEmpleado = new Map();
  }

  /**
   * Inicializar tracking para un empleado
   */
  initEmpleado(empleadoId: string): void {
    if (!this.horasPorEmpleado.has(empleadoId)) {
      this.horasPorEmpleado.set(empleadoId, {
        diarias: {},
        semanales: {},
        mensuales: {},
        anuales: {},
      });
    }
  }

  /**
   * Agregar un turno al tracking
   */
  addTurno(empleadoId: string, turno: Turno): void {
    this.initEmpleado(empleadoId);

    const horas = turno.horaFin - turno.horaInicio;
    const fecha = new Date(turno.fecha);
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    const semanaStr = format(startOfWeek(fecha), 'yyyy-MM-dd');
    const mesStr = format(startOfMonth(fecha), 'yyyy-MM');
    const añoStr = format(startOfYear(fecha), 'yyyy');

    const empleadoHoras = this.horasPorEmpleado.get(empleadoId)!;

    // Acumular horas
    empleadoHoras.diarias[fechaStr] = (empleadoHoras.diarias[fechaStr] || 0) + horas;
    empleadoHoras.semanales[semanaStr] = (empleadoHoras.semanales[semanaStr] || 0) + horas;
    empleadoHoras.mensuales[mesStr] = (empleadoHoras.mensuales[mesStr] || 0) + horas;
    empleadoHoras.anuales[añoStr] = (empleadoHoras.anuales[añoStr] || 0) + horas;
  }

  /**
   * Remover un turno del tracking
   */
  removeTurno(empleadoId: string, turno: Turno): void {
    const empleadoHoras = this.horasPorEmpleado.get(empleadoId);
    if (!empleadoHoras) return;

    const horas = turno.horaFin - turno.horaInicio;
    const fecha = new Date(turno.fecha);
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    const semanaStr = format(startOfWeek(fecha), 'yyyy-MM-dd');
    const mesStr = format(startOfMonth(fecha), 'yyyy-MM');
    const añoStr = format(startOfYear(fecha), 'yyyy');

    // Restar horas
    empleadoHoras.diarias[fechaStr] = Math.max(0, (empleadoHoras.diarias[fechaStr] || 0) - horas);
    empleadoHoras.semanales[semanaStr] = Math.max(0, (empleadoHoras.semanales[semanaStr] || 0) - horas);
    empleadoHoras.mensuales[mesStr] = Math.max(0, (empleadoHoras.mensuales[mesStr] || 0) - horas);
    empleadoHoras.anuales[añoStr] = Math.max(0, (empleadoHoras.anuales[añoStr] || 0) - horas);
  }

  /**
   * Obtener horas trabajadas en una fecha específica
   */
  getHorasDiarias(empleadoId: string, fecha: Date): number {
    const empleadoHoras = this.horasPorEmpleado.get(empleadoId);
    if (!empleadoHoras) return 0;

    const fechaStr = format(fecha, 'yyyy-MM-dd');
    return empleadoHoras.diarias[fechaStr] || 0;
  }

  /**
   * Obtener horas trabajadas en una semana
   */
  getHorasSemanales(empleadoId: string, fecha: Date): number {
    const empleadoHoras = this.horasPorEmpleado.get(empleadoId);
    if (!empleadoHoras) return 0;

    const semanaStr = format(startOfWeek(fecha), 'yyyy-MM-dd');
    return empleadoHoras.semanales[semanaStr] || 0;
  }

  /**
   * Obtener horas trabajadas en un mes
   */
  getHorasMensuales(empleadoId: string, fecha: Date): number {
    const empleadoHoras = this.horasPorEmpleado.get(empleadoId);
    if (!empleadoHoras) return 0;

    const mesStr = format(startOfMonth(fecha), 'yyyy-MM');
    return empleadoHoras.mensuales[mesStr] || 0;
  }

  /**
   * Obtener horas trabajadas en un año
   */
  getHorasAnuales(empleadoId: string, fecha: Date): number {
    const empleadoHoras = this.horasPorEmpleado.get(empleadoId);
    if (!empleadoHoras) return 0;

    const añoStr = format(startOfYear(fecha), 'yyyy');
    return empleadoHoras.anuales[añoStr] || 0;
  }

  /**
   * Verificar si el empleado excedería los límites al agregar un turno
   * @param turnoIdToReplace - ID del turno que se va a reemplazar/extender (opcional)
   */
  wouldExceedLimits(empleado: Usuario, turno: Turno, turnoIdToReplace?: string): boolean {
    const fecha = new Date(turno.fecha);
    const horasNuevas = turno.horaFin - turno.horaInicio;

    // Si estamos reemplazando un turno, obtener sus horas para restarlas
    let horasARestar = 0;
    if (turnoIdToReplace) {
      // Las horas a restar son las del turno original que se va a extender
      // Esto se calculará desde el unifiedAlgorithm
      // Por ahora, no hacemos nada especial aquí
    }

    const horasDiariasActuales = this.getHorasDiarias(empleado.uid, fecha);
    const horasSemanalesActuales = this.getHorasSemanales(empleado.uid, fecha);
    const horasMensualesActuales = this.getHorasMensuales(empleado.uid, fecha);
    const horasAnualesActuales = this.getHorasAnuales(empleado.uid, fecha);

    return (
      horasDiariasActuales + horasNuevas > empleado.restricciones.horasMaximasDiarias ||
      horasSemanalesActuales + horasNuevas > empleado.restricciones.horasMaximasSemanales ||
      horasMensualesActuales + horasNuevas > empleado.restricciones.horasMaximasMensuales ||
      horasAnualesActuales + horasNuevas > empleado.restricciones.horasMaximasAnuales
    );
  }

  /**
   * Actualizar las horas de un turno existente (para cuando se extiende)
   */
  updateTurno(empleadoId: string, turnoAntiguo: Turno, turnoNuevo: Turno): void {
    // Remover las horas del turno antiguo
    this.removeTurno(empleadoId, turnoAntiguo);
    // Agregar las horas del turno nuevo
    this.addTurno(empleadoId, turnoNuevo);
  }

  /**
   * Obtener todas las horas de un empleado
   */
  getHorasEmpleado(empleadoId: string): HorasEmpleado | null {
    return this.horasPorEmpleado.get(empleadoId) || null;
  }

  /**
   * Calcular cercanía a los límites (0-1, donde 1 es en el límite)
   */
  getProximidadLimites(empleado: Usuario, turno: Turno): number {
    const fecha = new Date(turno.fecha);
    const horasNuevas = turno.horaFin - turno.horaInicio;

    const ratios = [
      (this.getHorasDiarias(empleado.uid, fecha) + horasNuevas) / empleado.restricciones.horasMaximasDiarias,
      (this.getHorasSemanales(empleado.uid, fecha) + horasNuevas) / empleado.restricciones.horasMaximasSemanales,
      (this.getHorasMensuales(empleado.uid, fecha) + horasNuevas) / empleado.restricciones.horasMaximasMensuales,
      (this.getHorasAnuales(empleado.uid, fecha) + horasNuevas) / empleado.restricciones.horasMaximasAnuales,
    ];

    return Math.max(...ratios);
  }

  /**
   * Resetear el tracker
   */
  reset(): void {
    this.horasPorEmpleado.clear();
  }
}
