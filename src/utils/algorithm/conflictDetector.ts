import { parseISO, differenceInHours } from 'date-fns';
import { Turno, Usuario, ConfiguracionAlgoritmo, TimeSlot, Conflicto, SeveridadConflicto } from '@/types';
import { HoursTracker } from './hoursTracker';

// Función simple para generar IDs únicos
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Detector y clasificador de conflictos en el calendario
 */
export class ConflictDetector {
  private config: ConfiguracionAlgoritmo;
  private hoursTracker: HoursTracker;

  constructor(config: ConfiguracionAlgoritmo, hoursTracker: HoursTracker) {
    this.config = config;
    this.hoursTracker = hoursTracker;
  }

  /**
   * Detectar todos los conflictos en una solución
   */
  detectAllConflicts(
    turnos: Turno[],
    slots: TimeSlot[],
    empleados: Usuario[]
  ): Conflicto[] {
    const conflictos: Conflicto[] = [];

    // Inicializar tracker con turnos existentes
    this.hoursTracker.reset();
    empleados.forEach((emp) => {
      const turnosEmp = turnos.filter((t) => t.empleadoId === emp.uid);
      turnosEmp.forEach((turno) => this.hoursTracker.addTurno(emp.uid, turno));
    });

    // Detectar cobertura insuficiente
    conflictos.push(...this.detectCoberturaInsuficiente(slots));

    // Detectar exceso de horas por empleado
    empleados.forEach((empleado) => {
      const turnosEmpleado = turnos.filter((t) => t.empleadoId === empleado.uid);
      conflictos.push(...this.detectExcesoHoras(empleado, turnosEmpleado));
    });

    // Detectar descanso insuficiente
    empleados.forEach((empleado) => {
      const turnosEmpleado = turnos.filter((t) => t.empleadoId === empleado.uid);
      conflictos.push(...this.detectDescansoInsuficiente(empleado, turnosEmpleado));
    });

    // Detectar turnos consecutivos excesivos
    empleados.forEach((empleado) => {
      const turnosEmpleado = turnos.filter((t) => t.empleadoId === empleado.uid);
      conflictos.push(...this.detectTurnosConsecutivosExcesivos(empleado, turnosEmpleado));
    });

    return conflictos;
  }

  /**
   * Detectar slots con cobertura insuficiente
   */
  private detectCoberturaInsuficiente(slots: TimeSlot[]): Conflicto[] {
    const conflictos: Conflicto[] = [];

    slots.forEach((slot) => {
      const deficit = slot.trabajadoresNecesarios - slot.asignaciones.length;

      if (deficit > 0) {
        const severidad = this.clasificarSeveridadCobertura(deficit, slot.trabajadoresNecesarios);

        conflictos.push({
          id: generateId(),
          tipo: 'cobertura_insuficiente',
          severidad,
          descripcion: `Faltan ${deficit} trabajador(es) en ${slot.fecha} de ${slot.horaInicio}:00 a ${slot.horaFin}:00`,
          fecha: slot.fecha,
          sugerencias: [
            'Asignar empleados adicionales al turno',
            'Reducir la cobertura mínima requerida',
            'Dividir el turno en bloques más pequeños',
          ],
        });
      }
    });

    return conflictos;
  }

  /**
   * Detectar empleados que exceden límites de horas
   */
  private detectExcesoHoras(empleado: Usuario, turnos: Turno[]): Conflicto[] {
    const conflictos: Conflicto[] = [];

    // Verificar cada turno
    turnos.forEach((turno) => {
      const fecha = new Date(turno.fecha);

      // Verificar diarias
      const horasDiarias = this.hoursTracker.getHorasDiarias(empleado.uid, fecha);
      if (horasDiarias > empleado.restricciones.horasMaximasDiarias) {
        const exceso = horasDiarias - empleado.restricciones.horasMaximasDiarias;
        conflictos.push({
          id: generateId(),
          tipo: 'exceso_horas',
          severidad: this.clasificarSeveridadExceso(exceso, empleado.restricciones.horasMaximasDiarias),
          descripcion: `${empleado.datosPersonales.nombre} excede ${exceso.toFixed(1)}h el límite diario en ${turno.fecha}`,
          fecha: turno.fecha,
          empleadoId: empleado.uid,
          turnoId: turno.id,
          sugerencias: [
            'Reducir la duración del turno',
            'Asignar el turno a otro empleado',
            'Activar permitir horas extra en configuración',
          ],
        });
      }

      // Verificar semanales
      const horasSemanales = this.hoursTracker.getHorasSemanales(empleado.uid, fecha);
      if (horasSemanales > empleado.restricciones.horasMaximasSemanales) {
        const exceso = horasSemanales - empleado.restricciones.horasMaximasSemanales;
        conflictos.push({
          id: generateId(),
          tipo: 'exceso_horas',
          severidad: this.clasificarSeveridadExceso(exceso, empleado.restricciones.horasMaximasSemanales),
          descripcion: `${empleado.datosPersonales.nombre} excede ${exceso.toFixed(1)}h el límite semanal`,
          fecha: turno.fecha,
          empleadoId: empleado.uid,
          sugerencias: [
            'Redistribuir turnos a lo largo de la semana',
            'Asignar turnos a otros empleados',
          ],
        });
      }

      // Verificar mensuales
      const horasMensuales = this.hoursTracker.getHorasMensuales(empleado.uid, fecha);
      if (horasMensuales > empleado.restricciones.horasMaximasMensuales) {
        const exceso = horasMensuales - empleado.restricciones.horasMaximasMensuales;
        conflictos.push({
          id: generateId(),
          tipo: 'exceso_horas',
          severidad: this.clasificarSeveridadExceso(exceso, empleado.restricciones.horasMaximasMensuales),
          descripcion: `${empleado.datosPersonales.nombre} excede ${exceso.toFixed(1)}h el límite mensual`,
          fecha: turno.fecha,
          empleadoId: empleado.uid,
          sugerencias: [
            'Redistribuir turnos a lo largo del mes',
            'Contratar personal temporal',
          ],
        });
      }
    });

    return conflictos;
  }

  /**
   * Detectar descanso insuficiente entre turnos
   */
  private detectDescansoInsuficiente(empleado: Usuario, turnos: Turno[]): Conflicto[] {
    const conflictos: Conflicto[] = [];

    const turnosOrdenados = [...turnos].sort((a, b) => a.fecha.localeCompare(b.fecha));

    for (let i = 0; i < turnosOrdenados.length - 1; i++) {
      const turno1 = turnosOrdenados[i];
      const turno2 = turnosOrdenados[i + 1];

      const fecha1 = parseISO(turno1.fecha);
      const fecha2 = parseISO(turno2.fecha);
      const diffHoras = Math.abs(differenceInHours(fecha2, fecha1));

      if (diffHoras <= 24) {
        let descanso: number;
        if (turno1.fecha === turno2.fecha) {
          descanso = Math.abs(turno2.horaInicio - turno1.horaFin);
        } else {
          descanso = (24 - turno1.horaFin) + turno2.horaInicio;
        }

        if (descanso < this.config.restricciones.descansoMinimoEntreJornadas) {
          const deficit = this.config.restricciones.descansoMinimoEntreJornadas - descanso;

          conflictos.push({
            id: generateId(),
            tipo: 'descanso_insuficiente',
            severidad: deficit >= 4 ? 'critico' : deficit >= 2 ? 'alto' : 'medio',
            descripcion: `${empleado.datosPersonales.nombre} tiene solo ${descanso}h de descanso entre turnos (mínimo: ${this.config.restricciones.descansoMinimoEntreJornadas}h)`,
            fecha: turno2.fecha,
            empleadoId: empleado.uid,
            turnoId: turno2.id,
            sugerencias: [
              'Cambiar uno de los turnos a otro empleado',
              'Ajustar horarios para aumentar descanso',
              'Reducir el descanso mínimo en configuración',
            ],
          });
        }
      }
    }

    return conflictos;
  }

  /**
   * Detectar turnos consecutivos excesivos
   */
  private detectTurnosConsecutivosExcesivos(empleado: Usuario, turnos: Turno[]): Conflicto[] {
    const conflictos: Conflicto[] = [];

    const turnosOrdenados = [...turnos].sort((a, b) => a.fecha.localeCompare(b.fecha));

    let consecutivos = 1;

    for (let i = 1; i < turnosOrdenados.length; i++) {
      const fecha1 = parseISO(turnosOrdenados[i - 1].fecha);
      const fecha2 = parseISO(turnosOrdenados[i].fecha);
      const diffHoras = Math.abs(differenceInHours(fecha2, fecha1));

      if (diffHoras <= 24) {
        consecutivos++;

        if (consecutivos > this.config.restricciones.maxTurnosConsecutivos) {
          const exceso = consecutivos - this.config.restricciones.maxTurnosConsecutivos;

          conflictos.push({
            id: generateId(),
            tipo: 'turnos_consecutivos',
            severidad: exceso >= 3 ? 'critico' : exceso >= 2 ? 'alto' : 'medio',
            descripcion: `${empleado.datosPersonales.nombre} tiene ${consecutivos} turnos consecutivos (máximo: ${this.config.restricciones.maxTurnosConsecutivos})`,
            fecha: turnosOrdenados[i].fecha,
            empleadoId: empleado.uid,
            sugerencias: [
              'Agregar días de descanso',
              'Redistribuir turnos entre empleados',
              'Aumentar el máximo de turnos consecutivos en configuración',
            ],
          });
        }
      } else {
        consecutivos = 1;
      }
    }

    return conflictos;
  }

  /**
   * Clasificar severidad de cobertura insuficiente
   */
  private clasificarSeveridadCobertura(deficit: number, total: number): SeveridadConflicto {
    const ratio = deficit / total;

    if (ratio >= 0.5) return 'critico';
    if (ratio >= 0.3) return 'alto';
    if (ratio >= 0.15) return 'medio';
    return 'bajo';
  }

  /**
   * Clasificar severidad de exceso de horas
   */
  private clasificarSeveridadExceso(exceso: number, limite: number): SeveridadConflicto {
    const ratio = exceso / limite;

    if (ratio >= 0.2) return 'critico';
    if (ratio >= 0.1) return 'alto';
    if (ratio >= 0.05) return 'medio';
    return 'bajo';
  }
}
