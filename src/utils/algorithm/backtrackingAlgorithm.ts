import { format, eachDayOfInterval } from 'date-fns';
import {
  Turno,
  Usuario,
  Farmacia,
  ConfiguracionAlgoritmo,
  TimeSlot,
  ResultadoAlgoritmo
} from '@/types';
import { HoursTracker } from './hoursTracker';
import { TurnoValidator } from './validation';
import { ScoringSystem } from './scoring';
import { ConflictDetector } from './conflictDetector';

/**
 * Algoritmo Backtracking para asignación de turnos
 * Busca recursivamente una solución válida retrocediendo cuando encuentra callejones sin salida
 */
export class BacktrackingAlgorithm {
  private config: ConfiguracionAlgoritmo;
  private farmacia: Farmacia;
  private empleados: Usuario[];
  private hoursTracker: HoursTracker;
  private scoringSystem: ScoringSystem;
  private conflictDetector: ConflictDetector;
  private iteraciones: number;
  private mejorSolucion: Turno[] | null;
  private mejorScore: number;

  constructor(
    config: ConfiguracionAlgoritmo,
    farmacia: Farmacia,
    empleados: Usuario[]
  ) {
    this.config = config;
    this.farmacia = farmacia;
    this.empleados = empleados;
    this.hoursTracker = new HoursTracker();
    this.scoringSystem = new ScoringSystem(config, this.hoursTracker);
    this.conflictDetector = new ConflictDetector(config, this.hoursTracker);
    this.iteraciones = 0;
    this.mejorSolucion = null;
    this.mejorScore = -Infinity;

    // Inicializar tracker para todos los empleados
    empleados.forEach((emp) => this.hoursTracker.initEmpleado(emp.uid));
  }

  /**
   * Ejecutar algoritmo backtracking
   */
  async execute(fechaInicio: Date, fechaFin: Date): Promise<ResultadoAlgoritmo> {
    const startTime = Date.now();

    // 1. Generar slots de tiempo necesarios
    const slots = this.generateTimeSlots(fechaInicio, fechaFin);

    // 2. Resetear variables
    this.iteraciones = 0;
    this.mejorSolucion = null;
    this.mejorScore = -Infinity;

    // 3. Búsqueda backtracking
    const solucion = this.backtrack(slots, [], 0);

    // 4. Si no se encontró solución completa, usar la mejor encontrada
    const turnosFinal = solucion || this.mejorSolucion || [];

    // 5. Detectar conflictos
    const conflictos = this.conflictDetector.detectAllConflicts(turnosFinal, slots, this.empleados);

    // 6. Calcular estadísticas
    const estadisticas = this.calculateStatistics(turnosFinal);

    // 7. Calcular score global
    const scoreGlobal = this.scoringSystem.calculateGlobalScore(turnosFinal, slots, this.empleados);

    const tiempoEjecucion = Date.now() - startTime;

    return {
      turnos: turnosFinal,
      conflictos,
      estadisticas,
      scoreGlobal,
      tiempoEjecucion,
    };
  }

  /**
   * Función recursiva de backtracking
   */
  private backtrack(
    slots: TimeSlot[],
    asignacionesActuales: Turno[],
    slotIndex: number
  ): Turno[] | null {
    // Límite de iteraciones
    if (this.iteraciones >= this.config.parametrosOptimizacion.maxIteraciones) {
      return null;
    }

    this.iteraciones++;

    // Caso base: todos los slots procesados
    if (slotIndex >= slots.length) {
      // Calcular score de esta solución
      const score = this.scoringSystem.calculateGlobalScore(
        asignacionesActuales,
        slots,
        this.empleados
      );

      // Actualizar mejor solución si es mejor
      if (score > this.mejorScore) {
        this.mejorScore = score;
        this.mejorSolucion = [...asignacionesActuales];
      }

      // Verificar si alcanza el umbral de aceptación
      if (score >= this.config.parametrosOptimizacion.umbralAceptacion * 1000) {
        return asignacionesActuales;
      }

      return null;
    }

    const slot = slots[slotIndex];

    // Intentar diferentes combinaciones de empleados para este slot
    const combinaciones = this.generarCombinaciones(
      this.empleados,
      slot.trabajadoresNecesarios
    );

    for (const combinacion of combinaciones) {
      // Intentar asignar esta combinación
      const turnosNuevos = this.intentarAsignacion(slot, combinacion, asignacionesActuales);

      if (turnosNuevos.length > 0) {
        // Asignación válida, continuar con siguiente slot
        const resultado = this.backtrack(
          slots,
          [...asignacionesActuales, ...turnosNuevos],
          slotIndex + 1
        );

        if (resultado !== null) {
          return resultado;
        }

        // Backtrack: deshacer asignación
        turnosNuevos.forEach((turno) => {
          this.hoursTracker.removeTurno(turno.empleadoId, turno);
        });
      }
    }

    // Si no se pudo asignar ninguna combinación, intentar con el slot vacío
    const resultado = this.backtrack(slots, asignacionesActuales, slotIndex + 1);
    if (resultado !== null) {
      return resultado;
    }

    return null;
  }

  /**
   * Intentar asignar una combinación de empleados a un slot
   */
  private intentarAsignacion(
    slot: TimeSlot,
    empleados: Usuario[],
    turnosExistentes: Turno[]
  ): Turno[] {
    const turnos: Turno[] = [];

    for (const empleado of empleados) {
      const turnosEmpleado = turnosExistentes.filter((t) => t.empleadoId === empleado.uid);

      const turnoTemp: Turno = {
        id: this.generateTurnoId(slot, empleado),
        empleadoId: empleado.uid,
        fecha: slot.fecha,
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        tipo: slot.tipo,
        estado: 'pendiente',
      };

      // Verificar validez
      if (!TurnoValidator.isValidAssignment(turnoTemp, empleado, turnosEmpleado, this.config)) {
        return []; // Combinación inválida
      }

      // Verificar límites de horas
      if (!this.config.restricciones.permitirHorasExtra) {
        if (this.hoursTracker.wouldExceedLimits(empleado, turnoTemp)) {
          return []; // Combinación inválida
        }
      }

      turnos.push(turnoTemp);
      this.hoursTracker.addTurno(empleado.uid, turnoTemp);
    }

    return turnos;
  }

  /**
   * Generar todas las combinaciones posibles de k empleados
   */
  private generarCombinaciones(empleados: Usuario[], k: number): Usuario[][] {
    if (k === 0) return [[]];
    if (empleados.length === 0) return [];

    const resultado: Usuario[][] = [];

    // Limitar el número de combinaciones para evitar explosión combinatoria
    const maxCombinaciones = 100;

    // Usar enfoque greedy para reducir combinaciones
    // Ordenar empleados por disponibilidad o score
    const empleadosOrdenados = [...empleados].sort((a, b) => {
      // Preferir empleados con menos horas acumuladas
      const horasA = Object.values(this.hoursTracker.getHorasEmpleado(a.uid)?.diarias || {})
        .reduce((sum, h) => sum + h, 0);
      const horasB = Object.values(this.hoursTracker.getHorasEmpleado(b.uid)?.diarias || {})
        .reduce((sum, h) => sum + h, 0);
      return horasA - horasB;
    });

    // Generar solo las mejores combinaciones
    for (let i = 0; i <= empleadosOrdenados.length - k && resultado.length < maxCombinaciones; i++) {
      const primer = empleadosOrdenados[i];
      const resto = empleadosOrdenados.slice(i + 1);
      const subCombinaciones = this.generarCombinaciones(resto, k - 1);

      for (const subCombo of subCombinaciones) {
        resultado.push([primer, ...subCombo]);
        if (resultado.length >= maxCombinaciones) break;
      }
    }

    return resultado;
  }

  /**
   * Generar slots de tiempo
   */
  private generateTimeSlots(fechaInicio: Date, fechaFin: Date): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const dias = eachDayOfInterval({ start: fechaInicio, end: fechaFin });

    for (const dia of dias) {
      const fechaStr = format(dia, 'yyyy-MM-dd');
      const diaSemana = dia.getDay();

      const esFestivo = this.farmacia.configuracion.festivosRegionales.includes(fechaStr);

      // Verificar horario habitual del día
      const horarioHabitual = this.farmacia.configuracion.horariosHabituales.find(
        (hh) => hh.dia === diaSemana
      );

      // Agregar horario habitual si existe
      if (horarioHabitual) {
        const horaInicio = this.parseHora(horarioHabitual.inicio);
        const horaFin = this.parseHora(horarioHabitual.fin);

        slots.push({
          fecha: fechaStr,
          horaInicio,
          horaFin,
          tipo: esFestivo ? 'festivo' : 'laboral',
          trabajadoresNecesarios: this.farmacia.configuracion.trabajadoresMinimos,
          asignaciones: [],
        });
      }

      // Verificar si hay jornada de guardia que INICIA en este día
      // Solo crear el slot en el día de inicio para evitar duplicados
      const jornadaGuardia = this.farmacia.configuracion.jornadasGuardia.find(
        (jg) => fechaStr === jg.fechaInicio
      );

      if (jornadaGuardia) {
        // Slot de guardia (adicional al horario habitual)
        const horaInicio = this.parseHora(jornadaGuardia.horaInicio);
        const horaFin = this.parseHora(jornadaGuardia.horaFin);

        slots.push({
          fecha: fechaStr,
          horaInicio,
          horaFin,
          tipo: 'guardia',
          trabajadoresNecesarios: this.farmacia.configuracion.trabajadoresMinimos,
          asignaciones: [],
        });
      }
    }

    return slots;
  }

  /**
   * Calcular estadísticas
   */
  private calculateStatistics(turnos: Turno[]) {
    return this.empleados.map((empleado) => {
      const turnosEmpleado = turnos.filter((t) => t.empleadoId === empleado.uid);

      const horasTrabajadas = turnosEmpleado.reduce(
        (total, turno) => total + (turno.horaFin - turno.horaInicio),
        0
      );

      const guardiasAsignadas = turnosEmpleado.filter((t) => t.tipo === 'guardia').length;
      const festivosAsignados = turnosEmpleado.filter((t) => t.tipo === 'festivo').length;

      return {
        empleadoId: empleado.uid,
        horasTrabajadas,
        turnosAsignados: turnosEmpleado.length,
        guardiasAsignadas,
        festivosAsignados,
      };
    });
  }

  /**
   * Parsear hora
   */
  private parseHora(hora: string): number {
    const [horas] = hora.split(':');
    return parseInt(horas, 10);
  }

  /**
   * Generar ID de turno
   */
  private generateTurnoId(slot: TimeSlot, empleado: Usuario): string {
    return `${slot.fecha}-${empleado.uid}-${slot.horaInicio}-${Date.now()}`;
  }
}
