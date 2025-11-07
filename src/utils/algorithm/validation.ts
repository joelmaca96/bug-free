import { format, parseISO, differenceInHours } from 'date-fns';
import { Turno, Usuario, ConfiguracionAlgoritmo } from '@/types';

/**
 * Validaciones hard (restricciones que no se pueden violar)
 */
export class TurnoValidator {
  /**
   * Verificar si hay conflicto horario entre dos turnos
   */
  static hasTimeConflict(turno1: Turno, turno2: Turno): boolean {
    if (turno1.fecha !== turno2.fecha) return false;

    // Verificar si los rangos se solapan
    return !(turno1.horaFin <= turno2.horaInicio || turno2.horaFin <= turno1.horaInicio);
  }

  /**
   * Verificar si un empleado tiene conflicto horario con sus turnos existentes
   */
  static hasConflictWithExisting(
    nuevoTurno: Turno,
    turnosExistentes: Turno[]
  ): boolean {
    return turnosExistentes.some((turno) =>
      this.hasTimeConflict(nuevoTurno, turno)
    );
  }

  /**
   * Verificar descanso mínimo entre turnos
   */
  static hasMinimumRest(
    nuevoTurno: Turno,
    turnosExistentes: Turno[],
    horasDescansoMinimo: number
  ): boolean {
    const fechaNueva = parseISO(nuevoTurno.fecha);

    for (const turno of turnosExistentes) {
      const fechaTurno = parseISO(turno.fecha);
      const diffHoras = Math.abs(differenceInHours(fechaNueva, fechaTurno));

      // Si los turnos están muy cerca en el tiempo
      if (diffHoras <= 24) {
        // Calcular tiempo entre fin de un turno e inicio del otro
        const finPrimero = turno.fecha < nuevoTurno.fecha ? turno.horaFin : nuevoTurno.horaFin;
        const inicioSegundo = turno.fecha < nuevoTurno.fecha ? nuevoTurno.horaInicio : turno.horaInicio;

        let descanso: number;
        if (turno.fecha === nuevoTurno.fecha) {
          // Mismo día - el descanso es la diferencia entre fin e inicio
          descanso = Math.abs(inicioSegundo - finPrimero);
        } else {
          // Días diferentes
          const horasDiferenciaDias = diffHoras * 24;
          if (turno.fecha < nuevoTurno.fecha) {
            descanso = (24 - turno.horaFin) + nuevoTurno.horaInicio;
          } else {
            descanso = (24 - nuevoTurno.horaFin) + turno.horaInicio;
          }
        }

        if (descanso < horasDescansoMinimo) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Verificar máximo de turnos consecutivos
   */
  static exceedsConsecutiveTurns(
    nuevoTurno: Turno,
    turnosExistentes: Turno[],
    maxConsecutivos: number
  ): boolean {
    const fechaNueva = parseISO(nuevoTurno.fecha);

    // Obtener turnos ordenados por fecha
    const turnosOrdenados = [...turnosExistentes, nuevoTurno].sort((a, b) =>
      a.fecha.localeCompare(b.fecha)
    );

    // Encontrar el índice del nuevo turno
    const indiceNuevo = turnosOrdenados.findIndex(
      (t) => t.fecha === nuevoTurno.fecha && t.horaInicio === nuevoTurno.horaInicio
    );

    // Contar consecutivos hacia atrás
    let consecutivosAntes = 0;
    for (let i = indiceNuevo - 1; i >= 0; i--) {
      const fechaActual = parseISO(turnosOrdenados[i].fecha);
      const fechaSiguiente = parseISO(turnosOrdenados[i + 1].fecha);
      const diff = Math.abs(differenceInHours(fechaSiguiente, fechaActual));

      if (diff <= 24) {
        consecutivosAntes++;
      } else {
        break;
      }
    }

    // Contar consecutivos hacia adelante
    let consecutivosDespues = 0;
    for (let i = indiceNuevo + 1; i < turnosOrdenados.length; i++) {
      const fechaActual = parseISO(turnosOrdenados[i].fecha);
      const fechaAnterior = parseISO(turnosOrdenados[i - 1].fecha);
      const diff = Math.abs(differenceInHours(fechaActual, fechaAnterior));

      if (diff <= 24) {
        consecutivosDespues++;
      } else {
        break;
      }
    }

    const totalConsecutivos = consecutivosAntes + 1 + consecutivosDespues;
    return totalConsecutivos > maxConsecutivos;
  }

  /**
   * Verificar si es día festivo del empleado
   */
  static isFestivoEmpleado(turno: Turno, empleado: Usuario): boolean {
    if (!empleado.restricciones?.diasFestivos || !Array.isArray(empleado.restricciones.diasFestivos)) {
      return false;
    }
    return empleado.restricciones.diasFestivos.includes(turno.fecha);
  }

  /**
   * Verificar todas las restricciones hard
   */
  static isValidAssignment(
    nuevoTurno: Turno,
    empleado: Usuario,
    turnosEmpleado: Turno[],
    config: ConfiguracionAlgoritmo
  ): boolean {
    // No puede ser día festivo del empleado
    if (this.isFestivoEmpleado(nuevoTurno, empleado)) {
      return false;
    }

    // No puede tener conflicto horario
    if (this.hasConflictWithExisting(nuevoTurno, turnosEmpleado)) {
      return false;
    }

    // Debe respetar descanso mínimo
    if (!this.hasMinimumRest(nuevoTurno, turnosEmpleado, config.restricciones.descansoMinimoEntreJornadas)) {
      return false;
    }

    // No debe exceder turnos consecutivos
    if (this.exceedsConsecutiveTurns(nuevoTurno, turnosEmpleado, config.restricciones.maxTurnosConsecutivos)) {
      return false;
    }

    return true;
  }
}
