import { Turno, Usuario, ConfiguracionAlgoritmo, TimeSlot } from '@/types';
import { HoursTracker } from './hoursTracker';

/**
 * Sistema de scoring para evaluar la calidad de las asignaciones
 */
export class ScoringSystem {
  private config: ConfiguracionAlgoritmo;
  private hoursTracker: HoursTracker;

  constructor(config: ConfiguracionAlgoritmo, hoursTracker: HoursTracker) {
    this.config = config;
    this.hoursTracker = hoursTracker;
  }

  /**
   * Calcular score de aptitud para asignar un empleado a un slot
   * Mayor score = mejor aptitud
   */
  calculateFitnessScore(
    empleado: Usuario,
    slot: TimeSlot,
    turnosEmpleado: Turno[],
    todosLosTurnos: Turno[],
    empleados: Usuario[]
  ): number {
    let score = 0;

    const { prioridades } = this.config;

    // Factor 1: Cobertura mínima
    if (prioridades.coberturaMinima.activo) {
      const coberturaNecesaria = slot.trabajadoresNecesarios - slot.asignaciones.length;
      const bonusCobertura = coberturaNecesaria > 0 ? 1 : 0.5;
      score += bonusCobertura * prioridades.coberturaMinima.peso;
    }

    // Factor 2: Límites de horas
    if (prioridades.limitesHoras.activo) {
      const turnoTemporal: Turno = {
        id: 'temp',
        empleadoId: empleado.uid,
        fecha: slot.fecha,
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        tipo: slot.tipo,
        estado: 'pendiente',
      };

      const proximidad = this.hoursTracker.getProximidadLimites(empleado, turnoTemporal);
      // Penalización proporcional a la cercanía con los límites
      const penalizacion = proximidad * prioridades.limitesHoras.peso;
      score -= penalizacion;
    }

    // Factor 3: Distribución equitativa de guardias
    if (prioridades.distribucionGuardias.activo && slot.tipo === 'guardia') {
      const guardiasEmpleado = turnosEmpleado.filter((t) => t.tipo === 'guardia').length;
      const promedioGuardias = this.calcularPromedioGuardias(todosLosTurnos, empleados);

      if (guardiasEmpleado < promedioGuardias) {
        score += prioridades.distribucionGuardias.peso * 0.5;
      } else {
        score -= prioridades.distribucionGuardias.peso * 0.3;
      }
    }

    // Factor 4: Distribución equitativa de festivos
    if (prioridades.distribucionFestivos.activo && slot.tipo === 'festivo') {
      const festivosEmpleado = turnosEmpleado.filter((t) => t.tipo === 'festivo').length;
      const promedioFestivos = this.calcularPromedioFestivos(todosLosTurnos, empleados);

      if (festivosEmpleado < promedioFestivos) {
        score += prioridades.distribucionFestivos.peso * 0.5;
      } else {
        score -= prioridades.distribucionFestivos.peso * 0.3;
      }
    }

    // Factor 5: Minimizar cambios de turno
    if (prioridades.minimizarCambiosTurno.activo) {
      const tienePatronConsistente = this.tienePatronConsistente(
        empleado.uid,
        slot,
        turnosEmpleado
      );
      if (tienePatronConsistente) {
        score += prioridades.minimizarCambiosTurno.peso * 0.3;
      }
    }

    return score;
  }

  /**
   * Calcular score global de una solución completa
   */
  calculateGlobalScore(
    turnos: Turno[],
    slots: TimeSlot[],
    empleados: Usuario[]
  ): number {
    let score = 1000; // Comenzar con score base

    const { prioridades, restricciones } = this.config;

    // Penalizar slots sin cobertura completa
    if (prioridades.coberturaMinima.activo) {
      slots.forEach((slot) => {
        const deficit = slot.trabajadoresNecesarios - slot.asignaciones.length;
        if (deficit > 0) {
          score -= deficit * prioridades.coberturaMinima.peso * 2;
        }
      });
    }

    // Bonificar distribución equitativa
    if (prioridades.distribucionGuardias.activo) {
      const desviacionGuardias = this.calcularDesviacionGuardias(turnos, empleados);
      score -= desviacionGuardias * prioridades.distribucionGuardias.peso;
    }

    if (prioridades.distribucionFestivos.activo) {
      const desviacionFestivos = this.calcularDesviacionFestivos(turnos, empleados);
      score -= desviacionFestivos * prioridades.distribucionFestivos.peso;
    }

    // Bonificar uso eficiente de horas
    if (prioridades.limitesHoras.activo) {
      empleados.forEach((empleado) => {
        const turnosEmpleado = turnos.filter((t) => t.empleadoId === empleado.uid);
        turnosEmpleado.forEach((turno) => {
          this.hoursTracker.addTurno(empleado.uid, turno);
        });

        const fecha = new Date();
        const proximidad = this.hoursTracker.getProximidadLimites(empleado, {
          id: 'temp',
          empleadoId: empleado.uid,
          fecha: fecha.toISOString(),
          horaInicio: 9,
          horaFin: 17,
          tipo: 'laboral',
          estado: 'pendiente',
        });

        if (proximidad > 0.9) {
          score -= prioridades.limitesHoras.peso * 0.5;
        }
      });
    }

    return Math.max(0, score);
  }

  /**
   * Calcular promedio de guardias por empleado
   */
  private calcularPromedioGuardias(turnos: Turno[], empleados: Usuario[]): number {
    const totalGuardias = turnos.filter((t) => t.tipo === 'guardia').length;
    return empleados.length > 0 ? totalGuardias / empleados.length : 0;
  }

  /**
   * Calcular promedio de festivos por empleado
   */
  private calcularPromedioFestivos(turnos: Turno[], empleados: Usuario[]): number {
    const totalFestivos = turnos.filter((t) => t.tipo === 'festivo').length;
    return empleados.length > 0 ? totalFestivos / empleados.length : 0;
  }

  /**
   * Calcular desviación estándar de guardias entre empleados
   */
  private calcularDesviacionGuardias(turnos: Turno[], empleados: Usuario[]): number {
    const guardiasPorEmpleado = empleados.map(
      (emp) => turnos.filter((t) => t.empleadoId === emp.uid && t.tipo === 'guardia').length
    );
    return this.calcularDesviacionEstandar(guardiasPorEmpleado);
  }

  /**
   * Calcular desviación estándar de festivos entre empleados
   */
  private calcularDesviacionFestivos(turnos: Turno[], empleados: Usuario[]): number {
    const festivosPorEmpleado = empleados.map(
      (emp) => turnos.filter((t) => t.empleadoId === emp.uid && t.tipo === 'festivo').length
    );
    return this.calcularDesviacionEstandar(festivosPorEmpleado);
  }

  /**
   * Calcular desviación estándar
   */
  private calcularDesviacionEstandar(valores: number[]): number {
    if (valores.length === 0) return 0;

    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    const varianza = valores.reduce((acc, val) => acc + Math.pow(val - promedio, 2), 0) / valores.length;
    return Math.sqrt(varianza);
  }

  /**
   * Verificar si hay patrón consistente de turnos
   */
  private tienePatronConsistente(
    empleadoId: string,
    slot: TimeSlot,
    turnosEmpleado: Turno[]
  ): boolean {
    // Verificar si el empleado suele trabajar a esta hora
    const turnosSimila = turnosEmpleado.filter(
      (t) =>
        Math.abs(t.horaInicio - slot.horaInicio) <= 1 &&
        Math.abs(t.horaFin - slot.horaFin) <= 1
    );

    return turnosSimila.length >= 2;
  }
}
