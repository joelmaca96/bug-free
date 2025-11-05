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
 * Cromosoma: representa una solución completa (asignación de todos los turnos)
 */
interface Cromosoma {
  turnos: Turno[];
  fitness: number;
}

/**
 * Algoritmo Genético para asignación de turnos
 * Evoluciona una población de soluciones mediante selección, crossover y mutación
 */
export class GeneticAlgorithm {
  private config: ConfiguracionAlgoritmo;
  private farmacia: Farmacia;
  private empleados: Usuario[];
  private hoursTracker: HoursTracker;
  private scoringSystem: ScoringSystem;
  private conflictDetector: ConflictDetector;

  // Parámetros del algoritmo genético
  private readonly POPULATION_SIZE = 50;
  private readonly ELITE_SIZE = 5;
  private readonly MUTATION_RATE = 0.1;
  private readonly CROSSOVER_RATE = 0.7;

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
   * Ejecutar algoritmo genético
   * @param turnosExistentes - Turnos existentes que deben respetarse (nota: genético no implementa modo completar aún)
   */
  async execute(fechaInicio: Date, fechaFin: Date, turnosExistentes: Turno[] = []): Promise<ResultadoAlgoritmo> {
    // TODO: Implementar soporte para turnos existentes en genético
    if (turnosExistentes.length > 0) {
      console.warn('Algoritmo genético no soporta aún el modo completar. Los turnos existentes serán ignorados.');
    }
    const startTime = Date.now();

    // 1. Generar slots de tiempo necesarios
    const slots = this.generateTimeSlots(fechaInicio, fechaFin);

    // 2. Crear población inicial
    let poblacion = this.crearPoblacionInicial(slots);

    // 3. Evolucionar población
    const maxGeneraciones = Math.floor(this.config.parametrosOptimizacion.maxIteraciones / this.POPULATION_SIZE);

    for (let generacion = 0; generacion < maxGeneraciones; generacion++) {
      // Evaluar fitness de toda la población
      poblacion = poblacion.map((cromosoma) => ({
        ...cromosoma,
        fitness: this.evaluarFitness(cromosoma.turnos, slots),
      }));

      // Ordenar por fitness (mayor = mejor)
      poblacion.sort((a, b) => b.fitness - a.fitness);

      // Verificar si alcanzamos solución aceptable
      const mejorFitness = poblacion[0].fitness;
      if (mejorFitness >= this.config.parametrosOptimizacion.umbralAceptacion * 1000) {
        break;
      }

      // Crear nueva generación
      const nuevaPoblacion: Cromosoma[] = [];

      // Elitismo: mantener los mejores
      nuevaPoblacion.push(...poblacion.slice(0, this.ELITE_SIZE));

      // Generar resto de la población
      while (nuevaPoblacion.length < this.POPULATION_SIZE) {
        // Selección por torneo
        const padre1 = this.seleccionTorneo(poblacion);
        const padre2 = this.seleccionTorneo(poblacion);

        // Crossover
        let hijo: Cromosoma;
        if (Math.random() < this.CROSSOVER_RATE) {
          hijo = this.crossover(padre1, padre2, slots);
        } else {
          hijo = Math.random() < 0.5 ? { ...padre1 } : { ...padre2 };
        }

        // Mutación
        if (Math.random() < this.MUTATION_RATE) {
          hijo = this.mutar(hijo, slots);
        }

        nuevaPoblacion.push(hijo);
      }

      poblacion = nuevaPoblacion;
    }

    // 4. Seleccionar mejor solución
    poblacion = poblacion.map((cromosoma) => ({
      ...cromosoma,
      fitness: this.evaluarFitness(cromosoma.turnos, slots),
    }));
    poblacion.sort((a, b) => b.fitness - a.fitness);

    const mejorSolucion = poblacion[0];

    // 5. Detectar conflictos
    const conflictos = this.conflictDetector.detectAllConflicts(
      mejorSolucion.turnos,
      slots,
      this.empleados
    );

    // 6. Calcular estadísticas
    const estadisticas = this.calculateStatistics(mejorSolucion.turnos);

    // 7. Score global
    const scoreGlobal = mejorSolucion.fitness;

    const tiempoEjecucion = Date.now() - startTime;

    return {
      turnos: mejorSolucion.turnos,
      conflictos,
      estadisticas,
      scoreGlobal,
      tiempoEjecucion,
    };
  }

  /**
   * Crear población inicial de soluciones aleatorias
   */
  private crearPoblacionInicial(slots: TimeSlot[]): Cromosoma[] {
    const poblacion: Cromosoma[] = [];

    for (let i = 0; i < this.POPULATION_SIZE; i++) {
      const turnos = this.generarSolucionAleatoria(slots);
      poblacion.push({
        turnos,
        fitness: 0,
      });
    }

    return poblacion;
  }

  /**
   * Generar una solución aleatoria válida
   */
  private generarSolucionAleatoria(slots: TimeSlot[]): Turno[] {
    const turnos: Turno[] = [];
    this.hoursTracker.reset();
    this.empleados.forEach((emp) => this.hoursTracker.initEmpleado(emp.uid));

    for (const slot of slots) {
      // Intentar asignar empleados aleatorios
      const empleadosDisponibles = [...this.empleados];
      this.shuffleArray(empleadosDisponibles);

      let asignados = 0;
      for (const empleado of empleadosDisponibles) {
        if (asignados >= slot.trabajadoresNecesarios) break;

        const turnosEmpleado = turnos.filter((t) => t.empleadoId === empleado.uid);

        // Calcular duración del turno
        const duracionMinutos = this.calculateDuracionMinutos(slot.horaInicio, slot.horaFin);

        const turnoTemp: Turno = {
          id: this.generateTurnoId(slot, empleado),
          empleadoId: empleado.uid,
          fecha: slot.fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          duracionMinutos,
          tipo: slot.tipo,
          estado: 'pendiente',
        };

        // Validación básica
        if (TurnoValidator.isValidAssignment(turnoTemp, empleado, turnosEmpleado, this.config)) {
          if (this.config.restricciones.permitirHorasExtra ||
              !this.hoursTracker.wouldExceedLimits(empleado, turnoTemp)) {
            turnos.push(turnoTemp);
            this.hoursTracker.addTurno(empleado.uid, turnoTemp);
            asignados++;
          }
        }
      }
    }

    return turnos;
  }

  /**
   * Evaluar fitness de un cromosoma
   */
  private evaluarFitness(turnos: Turno[], slots: TimeSlot[]): number {
    // Resetear tracker
    this.hoursTracker.reset();
    this.empleados.forEach((emp) => this.hoursTracker.initEmpleado(emp.uid));

    // Cargar turnos en tracker
    turnos.forEach((turno) => {
      this.hoursTracker.addTurno(turno.empleadoId, turno);
    });

    // Calcular score global
    return this.scoringSystem.calculateGlobalScore(turnos, slots, this.empleados);
  }

  /**
   * Selección por torneo
   */
  private seleccionTorneo(poblacion: Cromosoma[], torneoSize: number = 5): Cromosoma {
    const torneo: Cromosoma[] = [];

    for (let i = 0; i < torneoSize; i++) {
      const randomIndex = Math.floor(Math.random() * poblacion.length);
      torneo.push(poblacion[randomIndex]);
    }

    return torneo.reduce((mejor, actual) =>
      actual.fitness > mejor.fitness ? actual : mejor
    );
  }

  /**
   * Crossover de un punto
   */
  private crossover(padre1: Cromosoma, padre2: Cromosoma, slots: TimeSlot[]): Cromosoma {
    const punto = Math.floor(Math.random() * Math.min(padre1.turnos.length, padre2.turnos.length));

    // Combinar turnos de ambos padres
    const turnosHijo = [
      ...padre1.turnos.slice(0, punto),
      ...padre2.turnos.slice(punto),
    ];

    // Eliminar duplicados y conflictos
    const turnosLimpios = this.limpiarTurnos(turnosHijo);

    return {
      turnos: turnosLimpios,
      fitness: 0,
    };
  }

  /**
   * Mutación: cambiar aleatoriamente algunos turnos
   */
  private mutar(cromosoma: Cromosoma, slots: TimeSlot[]): Cromosoma {
    const turnos = [...cromosoma.turnos];

    // Mutar algunos turnos aleatorios
    const numMutaciones = Math.floor(turnos.length * 0.1);

    for (let i = 0; i < numMutaciones; i++) {
      if (turnos.length === 0) break;

      // Eliminar turno aleatorio
      const indexEliminar = Math.floor(Math.random() * turnos.length);
      turnos.splice(indexEliminar, 1);

      // Intentar agregar nuevo turno aleatorio
      const slotAleatorio = slots[Math.floor(Math.random() * slots.length)];
      const empleadoAleatorio = this.empleados[Math.floor(Math.random() * this.empleados.length)];

      // Calcular duración del turno
      const duracionMinutos = this.calculateDuracionMinutos(slotAleatorio.horaInicio, slotAleatorio.horaFin);

      const turnoNuevo: Turno = {
        id: this.generateTurnoId(slotAleatorio, empleadoAleatorio),
        empleadoId: empleadoAleatorio.uid,
        fecha: slotAleatorio.fecha,
        horaInicio: slotAleatorio.horaInicio,
        horaFin: slotAleatorio.horaFin,
        duracionMinutos,
        tipo: slotAleatorio.tipo,
        estado: 'pendiente',
      };

      const turnosEmpleado = turnos.filter((t) => t.empleadoId === empleadoAleatorio.uid);

      if (TurnoValidator.isValidAssignment(turnoNuevo, empleadoAleatorio, turnosEmpleado, this.config)) {
        turnos.push(turnoNuevo);
      }
    }

    return {
      turnos,
      fitness: 0,
    };
  }

  /**
   * Limpiar turnos eliminando duplicados y conflictos
   */
  private limpiarTurnos(turnos: Turno[]): Turno[] {
    const turnosLimpios: Turno[] = [];
    const turnosPorEmpleado = new Map<string, Turno[]>();

    // Agrupar por empleado
    for (const turno of turnos) {
      if (!turnosPorEmpleado.has(turno.empleadoId)) {
        turnosPorEmpleado.set(turno.empleadoId, []);
      }
      turnosPorEmpleado.get(turno.empleadoId)!.push(turno);
    }

    // Validar turnos de cada empleado
    for (const [empleadoId, turnosEmp] of turnosPorEmpleado) {
      const empleado = this.empleados.find((e) => e.uid === empleadoId);
      if (!empleado) continue;

      for (const turno of turnosEmp) {
        const turnosValidados = turnosLimpios.filter((t) => t.empleadoId === empleadoId);

        if (TurnoValidator.isValidAssignment(turno, empleado, turnosValidados, this.config)) {
          turnosLimpios.push(turno);
        }
      }
    }

    return turnosLimpios;
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
   * Calcular duración del turno en minutos
   * Maneja correctamente turnos que cruzan medianoche
   */
  private calculateDuracionMinutos(horaInicio: number, horaFin: number): number {
    if (horaFin >= horaInicio) {
      // Turno normal (ej: 9:00 a 17:00)
      return (horaFin - horaInicio) * 60;
    } else {
      // Turno que cruza medianoche (ej: 22:00 a 6:00)
      return (24 - horaInicio + horaFin) * 60;
    }
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
    return `${slot.fecha}-${empleado.uid}-${slot.horaInicio}-${Date.now()}-${Math.random()}`;
  }

  /**
   * Mezclar array (Fisher-Yates shuffle)
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
