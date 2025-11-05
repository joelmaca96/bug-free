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
 * Algoritmo Greedy para asignación de turnos
 * Asigna empleados a slots basándose en el mejor score en cada momento
 */
export class GreedyAlgorithm {
  private config: ConfiguracionAlgoritmo;
  private farmacia: Farmacia;
  private empleados: Usuario[];
  private hoursTracker: HoursTracker;
  private scoringSystem: ScoringSystem;
  private conflictDetector: ConflictDetector;

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

    // Inicializar tracker para todos los empleados
    empleados.forEach((emp) => this.hoursTracker.initEmpleado(emp.uid));
  }

  /**
   * Ejecutar algoritmo greedy
   */
  async execute(fechaInicio: Date, fechaFin: Date): Promise<ResultadoAlgoritmo> {
    const startTime = Date.now();

    // 1. Generar slots de tiempo necesarios
    const slots = this.generateTimeSlots(fechaInicio, fechaFin);

    // 2. Asignación greedy
    const turnos: Turno[] = [];

    for (const slot of slots) {
      const asignaciones = this.assignEmployeesToSlot(slot, turnos);
      turnos.push(...asignaciones);

      // Actualizar las asignaciones del slot
      slot.asignaciones = asignaciones.map((t) => t.empleadoId);
    }

    // 3. Detectar conflictos
    const conflictos = this.conflictDetector.detectAllConflicts(turnos, slots, this.empleados);

    // 4. Calcular estadísticas
    const estadisticas = this.calculateStatistics(turnos);

    // 5. Calcular score global
    const scoreGlobal = this.scoringSystem.calculateGlobalScore(turnos, slots, this.empleados);

    const tiempoEjecucion = Date.now() - startTime;

    return {
      turnos,
      conflictos,
      estadisticas,
      scoreGlobal,
      tiempoEjecucion,
    };
  }

  /**
   * Generar slots de tiempo basados en la configuración de la farmacia
   */
  private generateTimeSlots(fechaInicio: Date, fechaFin: Date): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const dias = eachDayOfInterval({ start: fechaInicio, end: fechaFin });

    for (const dia of dias) {
      const fechaStr = format(dia, 'yyyy-MM-dd');
      const diaSemana = dia.getDay();

      // Verificar si es festivo regional
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
   * Asignar empleados a un slot específico
   */
  private assignEmployeesToSlot(slot: TimeSlot, turnosExistentes: Turno[]): Turno[] {
    const asignaciones: Turno[] = [];

    // Intentar asignar hasta cubrir trabajadores necesarios
    for (let i = 0; i < slot.trabajadoresNecesarios; i++) {
      const candidatos = this.getCandidatos(slot, turnosExistentes, asignaciones);

      if (candidatos.length === 0) {
        // No hay más candidatos disponibles
        break;
      }

      // Seleccionar candidato con mejor score
      const mejorCandidato = candidatos.reduce((mejor, actual) =>
        actual.score > mejor.score ? actual : mejor
      );

      // Crear turno
      const turno: Turno = {
        id: this.generateTurnoId(slot, mejorCandidato.empleado),
        empleadoId: mejorCandidato.empleado.uid,
        fecha: slot.fecha,
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        tipo: slot.tipo,
        estado: 'pendiente',
      };

      asignaciones.push(turno);

      // Actualizar tracker de horas
      this.hoursTracker.addTurno(mejorCandidato.empleado.uid, turno);
    }

    return asignaciones;
  }

  /**
   * Obtener candidatos elegibles para un slot
   */
  private getCandidatos(
    slot: TimeSlot,
    turnosExistentes: Turno[],
    asignacionesActuales: Turno[]
  ): Array<{ empleado: Usuario; score: number }> {
    const candidatos: Array<{ empleado: Usuario; score: number }> = [];
    const todosLosTurnos = [...turnosExistentes, ...asignacionesActuales];

    for (const empleado of this.empleados) {
      const turnosEmpleado = todosLosTurnos.filter((t) => t.empleadoId === empleado.uid);

      // Crear turno temporal para validación
      const turnoTemp: Turno = {
        id: 'temp',
        empleadoId: empleado.uid,
        fecha: slot.fecha,
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        tipo: slot.tipo,
        estado: 'pendiente',
      };

      // Verificar restricciones hard
      if (!TurnoValidator.isValidAssignment(turnoTemp, empleado, turnosEmpleado, this.config)) {
        continue;
      }

      // Verificar límites de horas
      if (!this.config.restricciones.permitirHorasExtra) {
        if (this.hoursTracker.wouldExceedLimits(empleado, turnoTemp)) {
          continue;
        }
      }

      // Calcular score
      const score = this.scoringSystem.calculateFitnessScore(
        empleado,
        slot,
        turnosEmpleado,
        todosLosTurnos,
        this.empleados
      );

      candidatos.push({ empleado, score });
    }

    return candidatos;
  }

  /**
   * Calcular estadísticas por empleado
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
   * Parsear hora en formato HH:mm a número
   */
  private parseHora(hora: string): number {
    const [horas] = hora.split(':');
    return parseInt(horas, 10);
  }

  /**
   * Generar ID único para turno
   */
  private generateTurnoId(slot: TimeSlot, empleado: Usuario): string {
    return `${slot.fecha}-${empleado.uid}-${slot.horaInicio}-${Date.now()}`;
  }
}
