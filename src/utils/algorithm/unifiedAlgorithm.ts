import {
  addDays,
  eachDayOfInterval,
  format,
  getDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  differenceInHours,
} from 'date-fns';
import {
  Usuario,
  Farmacia,
  ConfiguracionAlgoritmo,
  ResultadoAlgoritmo,
  Turno,
  TimeSlot,
  TipoTurno,
  HorasEmpleado,
  Conflicto,
} from '@/types';
import { HoursTracker } from './hoursTracker';
import { TurnoValidator } from './validation';
import { ScoringSystem } from './scoring';
import { ConflictDetector } from './conflictDetector';

/**
 * Estado de un empleado durante la ejecución del algoritmo
 */
interface EmpleadoState {
  empleadoId: string;
  horasAcumuladas: HorasEmpleado;
  guardiasRealizadas: number;
  festivosRealizados: number;
  turnosConsecutivos: number;
  ultimoTurno: Turno | null;
  disponibilidad: Map<string, boolean>; // fecha -> disponible
}

/**
 * Plantilla de turno para patrones semanales
 */
interface PlantillaTurno {
  dia: number; // 0-6
  horaInicio: number;
  horaFin: number;
  tipo: TipoTurno;
  empleadoAsignadoSemanaAnterior?: string; // Para mantener estabilidad
}

/**
 * Generador de IDs únicos
 */
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Algoritmo unificado de asignación de turnos
 * Implementa un enfoque de múltiples fases para optimizar la asignación
 */
export class UnifiedSchedulingAlgorithm {
  private config: ConfiguracionAlgoritmo;
  private farmacia: Farmacia;
  private empleados: Usuario[];
  private hoursTracker: HoursTracker;
  private scoringSystem: ScoringSystem;
  private conflictDetector: ConflictDetector;

  // Estado del algoritmo
  private timeSlots: TimeSlot[] = [];
  private empleadosState: Map<string, EmpleadoState> = new Map();
  private turnos: Turno[] = [];
  private turnosPorEmpleado: Map<string, Turno[]> = new Map();

  constructor(
    config: ConfiguracionAlgoritmo,
    farmacia: Farmacia,
    empleados: Usuario[]
  ) {
    this.config = config;
    this.farmacia = farmacia;
    // Filtrar empleados excluidos del calendario
    this.empleados = empleados.filter(
      (emp) => emp.incluirEnCalendario !== false
    );

    this.hoursTracker = new HoursTracker();
    this.scoringSystem = new ScoringSystem(config, this.hoursTracker);
    this.conflictDetector = new ConflictDetector(config, this.hoursTracker);
  }

  /**
   * Ejecutar el algoritmo completo
   */
  async execute(
    fechaInicio: Date,
    fechaFin: Date,
    turnosExistentes: Turno[] = []
  ): Promise<ResultadoAlgoritmo> {
    const startTime = Date.now();

    try {
      // FASE 0: Inicialización
      await this.fase0_inicializacion(fechaInicio, fechaFin, turnosExistentes);

      // FASE 1: Asignación de turnos críticos (guardias y festivos)
      await this.fase1_turnosCriticos();

      // FASE 2: Asignación de turnos laborales base
      await this.fase2_turnosLaborales(fechaInicio, fechaFin);

      // FASE 3: Cobertura de huecos
      await this.fase3_coberturaHuecos();

      // FASE 4: Optimización de calidad
      await this.fase4_optimizacion();

      // FASE 5: Detección y reporte de conflictos
      const conflictos = this.fase5_deteccionConflictos();

      // Calcular score global
      const scoreGlobal = this.scoringSystem.calculateGlobalScore(
        this.turnos,
        this.timeSlots,
        this.empleados
      );

      // Calcular estadísticas
      const estadisticas = this.calcularEstadisticas();

      const tiempoEjecucion = Date.now() - startTime;

      return {
        turnos: this.turnos,
        conflictos,
        estadisticas,
        scoreGlobal,
        tiempoEjecucion,
      };
    } catch (error) {
      console.error('Error ejecutando algoritmo:', error);
      throw error;
    }
  }

  /**
   * FASE 0: Inicialización y preparación
   */
  private async fase0_inicializacion(
    fechaInicio: Date,
    fechaFin: Date,
    turnosExistentes: Turno[]
  ): Promise<void> {
    console.log('[FASE 0] Inicializando algoritmo...');

    // 1. Generar TimeSlots para todo el período
    this.generarTimeSlots(fechaInicio, fechaFin);

    // 2. Cargar histórico del año (horas acumuladas, guardias, festivos)
    await this.cargarHistoricoAnual(fechaInicio);

    // 3. Procesar turnos existentes
    this.procesarTurnosExistentes(turnosExistentes);

    // 4. Inicializar estados de empleados
    this.inicializarEstadosEmpleados();

    console.log(`[FASE 0] Completada. ${this.timeSlots.length} slots generados`);
  }

  /**
   * Generar todos los TimeSlots del período
   */
  private generarTimeSlots(fechaInicio: Date, fechaFin: Date): void {
    const dias = eachDayOfInterval({ start: fechaInicio, end: fechaFin });
    const festivosRegionales = this.farmacia.configuracion.festivosRegionales || [];

    dias.forEach((dia) => {
      const fechaStr = format(dia, 'yyyy-MM-dd');
      const diaSemana = getDay(dia);
      const esFestivo = festivosRegionales.includes(fechaStr);

      // Verificar si hay guardias este día
      const guardias = this.farmacia.configuracion.jornadasGuardia?.filter((g) => {
        const inicioGuardia = parseISO(g.fechaInicio);
        const finGuardia = parseISO(g.fechaFin);
        return isWithinInterval(dia, { start: inicioGuardia, end: finGuardia });
      }) || [];

      // Si hay guardias, crear slots de guardia
      guardias.forEach((guardia) => {
        const horaInicio = parseInt(guardia.horaInicio.split(':')[0]);
        const horaFin = parseInt(guardia.horaFin.split(':')[0]);

        for (let hora = horaInicio; hora < horaFin; hora++) {
          this.timeSlots.push({
            fecha: fechaStr,
            horaInicio: hora,
            horaFin: hora + 1,
            tipo: 'guardia',
            trabajadoresNecesarios: this.farmacia.configuracion.trabajadoresMinimos,
            asignaciones: [],
          });
        }
      });

      // Si es festivo sin guardia, la farmacia está cerrada - no crear slots
      if (esFestivo && guardias.length === 0) {
        return;
      }

      // Si no es festivo o tiene guardia, crear slots de horario habitual
      if (guardias.length === 0) {
        const horariosDelDia = this.farmacia.configuracion.horariosHabituales.filter(
          (h) => h.dia === diaSemana
        );

        horariosDelDia.forEach((horario) => {
          const horaInicio = parseInt(horario.inicio.split(':')[0]);
          const horaFin = parseInt(horario.fin.split(':')[0]);

          for (let hora = horaInicio; hora < horaFin; hora++) {
            this.timeSlots.push({
              fecha: fechaStr,
              horaInicio: hora,
              horaFin: hora + 1,
              tipo: esFestivo ? 'festivo' : 'laboral',
              trabajadoresNecesarios: this.farmacia.configuracion.trabajadoresMinimos,
              asignaciones: [],
            });
          }
        });
      }
    });
  }

  /**
   * Cargar histórico del año para equilibrar guardias/festivos
   */
  private async cargarHistoricoAnual(fechaActual: Date): Promise<void> {
    // TODO: Implementar carga de turnos de meses anteriores del mismo año
    // Por ahora, inicializar en 0
    this.empleados.forEach((empleado) => {
      this.empleadosState.set(empleado.uid, {
        empleadoId: empleado.uid,
        horasAcumuladas: {
          diarias: {},
          semanales: {},
          mensuales: {},
          anuales: {},
        },
        guardiasRealizadas: 0,
        festivosRealizados: 0,
        turnosConsecutivos: 0,
        ultimoTurno: null,
        disponibilidad: new Map(),
      });
    });
  }

  /**
   * Procesar turnos existentes (modo completar)
   */
  private procesarTurnosExistentes(turnosExistentes: Turno[]): void {
    if (turnosExistentes.length === 0) return;

    console.log(`[FASE 0] Procesando ${turnosExistentes.length} turnos existentes`);

    turnosExistentes.forEach((turno) => {
      // Agregar al array de turnos
      this.turnos.push(turno);

      // Agregar al tracker de horas
      this.hoursTracker.addTurno(turno.empleadoId, turno);

      // Marcar slots como ocupados
      const slotsDelTurno = this.timeSlots.filter(
        (slot) =>
          slot.fecha === turno.fecha &&
          slot.horaInicio >= turno.horaInicio &&
          slot.horaFin <= turno.horaFin
      );

      slotsDelTurno.forEach((slot) => {
        if (!slot.asignaciones.includes(turno.empleadoId)) {
          slot.asignaciones.push(turno.empleadoId);
        }
      });

      // Actualizar mapa de turnos por empleado
      if (!this.turnosPorEmpleado.has(turno.empleadoId)) {
        this.turnosPorEmpleado.set(turno.empleadoId, []);
      }
      this.turnosPorEmpleado.get(turno.empleadoId)!.push(turno);
    });
  }

  /**
   * Inicializar estados de empleados
   */
  private inicializarEstadosEmpleados(): void {
    this.empleados.forEach((empleado) => {
      if (!this.empleadosState.has(empleado.uid)) {
        this.empleadosState.set(empleado.uid, {
          empleadoId: empleado.uid,
          horasAcumuladas: {
            diarias: {},
            semanales: {},
            mensuales: {},
            anuales: {},
          },
          guardiasRealizadas: 0,
          festivosRealizados: 0,
          turnosConsecutivos: 0,
          ultimoTurno: null,
          disponibilidad: new Map(),
        });
      }

      // Calcular disponibilidad (marcar festivos personales como no disponibles)
      const state = this.empleadosState.get(empleado.uid)!;
      if (empleado.restricciones?.diasFestivos) {
        empleado.restricciones.diasFestivos.forEach((fecha) => {
          state.disponibilidad.set(fecha, false);
        });
      }

      // Actualizar contadores de guardias y festivos
      const turnosEmpleado = this.turnosPorEmpleado.get(empleado.uid) || [];
      state.guardiasRealizadas = turnosEmpleado.filter((t) => t.tipo === 'guardia').length;
      state.festivosRealizados = turnosEmpleado.filter((t) => t.tipo === 'festivo').length;

      if (!this.turnosPorEmpleado.has(empleado.uid)) {
        this.turnosPorEmpleado.set(empleado.uid, []);
      }
    });
  }

  /**
   * FASE 1: Asignación de turnos críticos (guardias y festivos)
   */
  private async fase1_turnosCriticos(): Promise<void> {
    console.log('[FASE 1] Asignando turnos críticos (guardias y festivos)...');

    // Obtener slots críticos no asignados
    const slotsCriticos = this.timeSlots.filter(
      (slot) =>
        (slot.tipo === 'guardia' || slot.tipo === 'festivo') &&
        slot.asignaciones.length < slot.trabajadoresNecesarios
    );

    // Ordenar empleados por equidad (menos guardias/festivos realizados)
    const empleadosOrdenados = this.ordenarEmpleadosPorEquidad();

    let asignacionesRealizadas = 0;

    slotsCriticos.forEach((slot) => {
      const necesarios = slot.trabajadoresNecesarios - slot.asignaciones.length;

      for (let i = 0; i < necesarios; i++) {
        const empleadoAsignado = this.asignarMejorEmpleadoASlot(
          slot,
          empleadosOrdenados
        );

        if (empleadoAsignado) {
          asignacionesRealizadas++;
        }
      }
    });

    console.log(`[FASE 1] Completada. ${asignacionesRealizadas} asignaciones realizadas`);
  }

  /**
   * Ordenar empleados por equidad en guardias/festivos
   */
  private ordenarEmpleadosPorEquidad(): Usuario[] {
    return [...this.empleados].sort((a, b) => {
      const stateA = this.empleadosState.get(a.uid)!;
      const stateB = this.empleadosState.get(b.uid)!;

      const totalA = stateA.guardiasRealizadas + stateA.festivosRealizados;
      const totalB = stateB.guardiasRealizadas + stateB.festivosRealizados;

      if (totalA !== totalB) return totalA - totalB;

      // Si tienen igual guardias/festivos, ordenar por horas trabajadas
      const horasA = this.hoursTracker.getHorasEmpleado(a.uid);
      const horasB = this.hoursTracker.getHorasEmpleado(b.uid);

      const totalHorasA = horasA ? Object.values(horasA.mensuales).reduce((a, b) => a + b, 0) : 0;
      const totalHorasB = horasB ? Object.values(horasB.mensuales).reduce((a, b) => a + b, 0) : 0;

      return totalHorasA - totalHorasB;
    });
  }

  /**
   * FASE 2: Asignación de turnos laborales base
   */
  private async fase2_turnosLaborales(
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<void> {
    console.log('[FASE 2] Asignando turnos laborales base...');

    // Dividir el período en semanas
    const semanas = this.dividirEnSemanas(fechaInicio, fechaFin);

    semanas.forEach((semana, index) => {
      console.log(`[FASE 2] Procesando semana ${index + 1}/${semanas.length}`);
      this.asignarTurnosSemana(semana);
    });

    console.log('[FASE 2] Completada');
  }

  /**
   * Dividir período en semanas
   */
  private dividirEnSemanas(fechaInicio: Date, fechaFin: Date): Date[][] {
    const semanas: Date[][] = [];
    let fechaActual = startOfWeek(fechaInicio, { weekStartsOn: 1 });

    while (fechaActual <= fechaFin) {
      const finSemana = endOfWeek(fechaActual, { weekStartsOn: 1 });
      const diasSemana = eachDayOfInterval({
        start: fechaActual > fechaInicio ? fechaActual : fechaInicio,
        end: finSemana < fechaFin ? finSemana : fechaFin,
      });

      if (diasSemana.length > 0) {
        semanas.push(diasSemana);
      }

      fechaActual = addDays(finSemana, 1);
    }

    return semanas;
  }

  /**
   * Asignar turnos para una semana completa
   */
  private asignarTurnosSemana(diasSemana: Date[]): void {
    // Obtener slots laborales de la semana
    const slotsLaborales = this.timeSlots.filter((slot) => {
      const slotDate = parseISO(slot.fecha);
      return (
        slot.tipo === 'laboral' &&
        diasSemana.some((dia) => format(dia, 'yyyy-MM-dd') === slot.fecha) &&
        slot.asignaciones.length < slot.trabajadoresNecesarios
      );
    });

    if (slotsLaborales.length === 0) return;

    // Ordenar empleados por carga actual (menos horas trabajadas primero)
    const empleadosOrdenadosPorCarga = this.ordenarEmpleadosPorCarga();

    // Asignar slots de forma round-robin ponderada
    slotsLaborales.forEach((slot) => {
      const necesarios = slot.trabajadoresNecesarios - slot.asignaciones.length;

      for (let i = 0; i < necesarios; i++) {
        this.asignarMejorEmpleadoASlot(slot, empleadosOrdenadosPorCarga);
      }
    });
  }

  /**
   * Ordenar empleados por carga actual (horas trabajadas / horas máximas)
   */
  private ordenarEmpleadosPorCarga(): Usuario[] {
    return [...this.empleados].sort((a, b) => {
      const cargaA = this.calcularCargaEmpleado(a);
      const cargaB = this.calcularCargaEmpleado(b);
      return cargaA - cargaB;
    });
  }

  /**
   * Calcular carga actual de un empleado (0-1)
   */
  private calcularCargaEmpleado(empleado: Usuario): number {
    const horasEmpleado = this.hoursTracker.getHorasEmpleado(empleado.uid);
    if (!horasEmpleado) return 0;

    const totalHoras = Object.values(horasEmpleado.mensuales).reduce((a, b) => a + b, 0);
    const maxHoras = empleado.restricciones.horasMaximasMensuales;

    return maxHoras > 0 ? totalHoras / maxHoras : 0;
  }

  /**
   * Asignar el mejor empleado disponible a un slot
   */
  private asignarMejorEmpleadoASlot(
    slot: TimeSlot,
    empleadosCandidatos: Usuario[]
  ): boolean {
    // Intentar encontrar empleado válido
    for (const empleado of empleadosCandidatos) {
      if (this.puedeAsignarEmpleadoASlot(empleado, slot)) {
        this.asignarEmpleadoASlot(empleado, slot);
        return true;
      }
    }

    // Si no se pudo asignar nadie, verificar si se permiten horas extra
    if (this.config.restricciones.permitirHorasExtra) {
      for (const empleado of empleadosCandidatos) {
        if (this.puedeAsignarConHorasExtra(empleado, slot)) {
          this.asignarEmpleadoASlot(empleado, slot);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Verificar si se puede asignar un empleado a un slot
   */
  private puedeAsignarEmpleadoASlot(empleado: Usuario, slot: TimeSlot): boolean {
    // Verificar disponibilidad en fecha
    const state = this.empleadosState.get(empleado.uid);
    if (state?.disponibilidad.get(slot.fecha) === false) {
      console.log(`[VALIDACIÓN] ✗ Empleado ${empleado.nombre} no disponible en ${slot.fecha}`);
      return false;
    }

    // Verificar que no esté ya asignado
    if (slot.asignaciones.includes(empleado.uid)) {
      console.log(`[VALIDACIÓN] ✗ Empleado ${empleado.nombre} ya asignado a slot ${slot.fecha} ${slot.horaInicio}:00`);
      return false;
    }

    // Buscar si ya existe un turno que se pueda extender
    const turnosDelDia = (this.turnosPorEmpleado.get(empleado.uid) || []).filter(
      (t) => t.fecha === slot.fecha
    );

    let turnoExtendible = turnosDelDia.find(
      (t) => t.horaFin === slot.horaInicio && t.tipo === slot.tipo
    );

    // Crear turno temporal para validación (con duración final si se va a extender)
    const horaInicio = turnoExtendible ? turnoExtendible.horaInicio : slot.horaInicio;
    const horaFin = slot.horaFin;
    const duracionFinal = (horaFin - horaInicio) * 60;

    const turnoTemporal: Turno = {
      id: 'temp',
      empleadoId: empleado.uid,
      fecha: slot.fecha,
      horaInicio: horaInicio,
      horaFin: horaFin,
      duracionMinutos: duracionFinal,
      tipo: slot.tipo,
      estado: 'pendiente',
    };

    console.log(`[VALIDACIÓN] Validando para ${empleado.nombre}: ${slot.fecha} ${turnoTemporal.horaInicio}:00-${turnoTemporal.horaFin}:00 (${duracionFinal/60}h, ${turnoExtendible ? 'EXTENSIÓN' : 'NUEVO'})`);

    // Obtener turnos del empleado (sin el que vamos a extender si existe)
    const turnosEmpleado = turnoExtendible
      ? (this.turnosPorEmpleado.get(empleado.uid) || []).filter(t => t.id !== turnoExtendible!.id)
      : (this.turnosPorEmpleado.get(empleado.uid) || []);

    // Validar restricciones duras
    if (!TurnoValidator.isValidAssignment(turnoTemporal, empleado, turnosEmpleado, this.config)) {
      console.log(`[VALIDACIÓN] ✗ Falla TurnoValidator (festivos/conflictos/descanso/consecutivos)`);
      return false;
    }

    // Verificar límites de horas (con el turno extendido completo)
    if (this.hoursTracker.wouldExceedLimits(empleado, turnoTemporal, turnoExtendible?.id)) {
      const horasActuales = this.hoursTracker.getHorasEmpleado(empleado.uid);
      console.log(`[VALIDACIÓN] ✗ Excede límites de horas. Diarias: ${horasActuales?.diarias[slot.fecha] || 0}h + ${duracionFinal/60}h > ${empleado.restricciones.horasMaximasDiarias}h`);
      return false;
    }

    console.log(`[VALIDACIÓN] ✓ VÁLIDO`);
    return true;
  }

  /**
   * Verificar si se puede asignar con horas extra
   */
  private puedeAsignarConHorasExtra(empleado: Usuario, slot: TimeSlot): boolean {
    // Mismas validaciones excepto límites de horas
    const state = this.empleadosState.get(empleado.uid);
    if (state?.disponibilidad.get(slot.fecha) === false) {
      return false;
    }

    if (slot.asignaciones.includes(empleado.uid)) {
      return false;
    }

    const turnoTemporal: Turno = {
      id: 'temp',
      empleadoId: empleado.uid,
      fecha: slot.fecha,
      horaInicio: slot.horaInicio,
      horaFin: slot.horaFin,
      tipo: slot.tipo,
      estado: 'pendiente',
    };

    const turnosEmpleado = this.turnosPorEmpleado.get(empleado.uid) || [];

    // Solo validar descanso y turnos consecutivos, no horas
    if (!TurnoValidator.hasMinimumRest(turnoTemporal, turnosEmpleado, this.config.restricciones.descansoMinimoEntreJornadas)) {
      return false;
    }

    if (TurnoValidator.exceedsConsecutiveTurns(turnoTemporal, turnosEmpleado, this.config.restricciones.maxTurnosConsecutivos)) {
      return false;
    }

    return true;
  }

  /**
   * Asignar un empleado a un slot
   */
  private asignarEmpleadoASlot(empleado: Usuario, slot: TimeSlot): void {
    slot.asignaciones.push(empleado.uid);

    // Actualizar estado del empleado
    const state = this.empleadosState.get(empleado.uid)!;
    if (slot.tipo === 'guardia') {
      state.guardiasRealizadas++;
    } else if (slot.tipo === 'festivo') {
      state.festivosRealizados++;
    }

    // Buscar si ya existe un turno que pueda extenderse
    const turnosDelDia = (this.turnosPorEmpleado.get(empleado.uid) || []).filter(
      (t) => t.fecha === slot.fecha
    );

    let turnoExtendido = false;

    for (const turno of turnosDelDia) {
      // Intentar extender turno existente si es contiguo
      if (turno.horaFin === slot.horaInicio && turno.tipo === slot.tipo) {
        // Guardar copia del turno antiguo para actualizar hoursTracker
        const turnoAntiguo: Turno = {
          ...turno,
          horaInicio: turno.horaInicio,
          horaFin: turno.horaFin,
          duracionMinutos: turno.duracionMinutos || (turno.horaFin - turno.horaInicio) * 60,
        };

        // Extender el turno
        turno.horaFin = slot.horaFin;
        turno.duracionMinutos = (turno.horaFin - turno.horaInicio) * 60;

        // ¡CRÍTICO! Actualizar hoursTracker con el turno extendido
        this.hoursTracker.updateTurno(empleado.uid, turnoAntiguo, turno);

        console.log(`[ASIGNACIÓN] → EXTENDIENDO turno ${turno.fecha} ${turno.horaInicio}:00-${turno.horaFin}:00 (${turno.duracionMinutos/60}h, tipo: ${turno.tipo})`);

        turnoExtendido = true;
        state.ultimoTurno = turno;
        break;
      }
    }

    if (!turnoExtendido) {
      // Crear nuevo turno
      const nuevoTurno: Turno = {
        id: generateId(),
        empleadoId: empleado.uid,
        fecha: slot.fecha,
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        duracionMinutos: (slot.horaFin - slot.horaInicio) * 60,
        tipo: slot.tipo,
        estado: 'confirmado',
      };

      this.turnos.push(nuevoTurno);
      this.turnosPorEmpleado.get(empleado.uid)!.push(nuevoTurno);
      this.hoursTracker.addTurno(empleado.uid, nuevoTurno);

      console.log(`[ASIGNACIÓN] → NUEVO turno ${nuevoTurno.fecha} ${nuevoTurno.horaInicio}:00-${nuevoTurno.horaFin}:00 (${nuevoTurno.duracionMinutos/60}h, tipo: ${nuevoTurno.tipo})`);

      state.ultimoTurno = nuevoTurno;
    }
  }

  /**
   * FASE 3: Cobertura de huecos
   */
  private async fase3_coberturaHuecos(): Promise<void> {
    console.log('[FASE 3] Cubriendo huecos...');

    const slotsIncompletos = this.timeSlots.filter(
      (slot) => slot.asignaciones.length < slot.trabajadoresNecesarios
    );

    console.log(`[FASE 3] ${slotsIncompletos.length} slots incompletos`);

    let huecosCubiertos = 0;

    slotsIncompletos.forEach((slot) => {
      const necesarios = slot.trabajadoresNecesarios - slot.asignaciones.length;

      for (let i = 0; i < necesarios; i++) {
        // Calcular score para todos los empleados
        const empleadosConScore = this.empleados.map((empleado) => {
          const turnosEmpleado = this.turnosPorEmpleado.get(empleado.uid) || [];
          const score = this.scoringSystem.calculateFitnessScore(
            empleado,
            slot,
            turnosEmpleado,
            this.turnos,
            this.empleados
          );
          return { empleado, score };
        });

        // Ordenar por mejor score
        empleadosConScore.sort((a, b) => b.score - a.score);

        // Intentar asignar al empleado con mejor score
        for (const { empleado } of empleadosConScore) {
          if (this.puedeAsignarEmpleadoASlot(empleado, slot)) {
            this.asignarEmpleadoASlot(empleado, slot);
            huecosCubiertos++;
            break;
          } else if (
            this.config.restricciones.permitirHorasExtra &&
            this.puedeAsignarConHorasExtra(empleado, slot)
          ) {
            this.asignarEmpleadoASlot(empleado, slot);
            huecosCubiertos++;
            break;
          }
        }
      }
    });

    console.log(`[FASE 3] Completada. ${huecosCubiertos} huecos cubiertos`);
  }

  /**
   * FASE 4: Optimización de calidad
   */
  private async fase4_optimizacion(): Promise<void> {
    console.log('[FASE 4] Optimizando calidad de la solución...');

    // 1. Consolidar turnos (fusionar turnos pequeños contiguos)
    this.consolidarTurnos();

    // 2. Intentar equilibrar horas entre empleados
    this.equilibrarHorasEmpleados();

    console.log('[FASE 4] Completada');
  }

  /**
   * Consolidar turnos contiguos del mismo empleado
   */
  private consolidarTurnos(): void {
    this.empleados.forEach((empleado) => {
      const turnosEmpleado = this.turnosPorEmpleado.get(empleado.uid) || [];
      const turnosOrdenados = [...turnosEmpleado].sort((a, b) =>
        a.fecha === b.fecha
          ? a.horaInicio - b.horaInicio
          : a.fecha.localeCompare(b.fecha)
      );

      const turnosConsolidados: Turno[] = [];

      for (let i = 0; i < turnosOrdenados.length; i++) {
        const turnoActual = turnosOrdenados[i];

        // Buscar turnos contiguos
        let turnoFinal = turnoActual;
        for (let j = i + 1; j < turnosOrdenados.length; j++) {
          const siguienteTurno = turnosOrdenados[j];

          if (
            siguienteTurno.fecha === turnoFinal.fecha &&
            siguienteTurno.horaInicio === turnoFinal.horaFin &&
            siguienteTurno.tipo === turnoFinal.tipo
          ) {
            turnoFinal = siguienteTurno;
            i = j;
          } else {
            break;
          }
        }

        // Si se consolidaron varios turnos
        if (turnoFinal !== turnoActual) {
          turnosConsolidados.push({
            ...turnoActual,
            horaFin: turnoFinal.horaFin,
            duracionMinutos: (turnoFinal.horaFin - turnoActual.horaInicio) * 60,
          });
        } else {
          turnosConsolidados.push(turnoActual);
        }
      }

      // Actualizar turnos si hubo consolidación
      if (turnosConsolidados.length < turnosOrdenados.length) {
        this.turnosPorEmpleado.set(empleado.uid, turnosConsolidados);

        // Actualizar array global de turnos
        this.turnos = this.turnos.filter((t) => t.empleadoId !== empleado.uid);
        this.turnos.push(...turnosConsolidados);
      }
    });
  }

  /**
   * Intentar equilibrar horas entre empleados mediante intercambios
   */
  private equilibrarHorasEmpleados(): void {
    const maxIntercambios = Math.min(50, this.config.parametrosOptimizacion.maxIteraciones / 10);

    for (let i = 0; i < maxIntercambios; i++) {
      const mejora = this.intentarIntercambioOptimizante();
      if (!mejora) break;
    }
  }

  /**
   * Intentar un intercambio que mejore el equilibrio
   */
  private intentarIntercambioOptimizante(): boolean {
    // Calcular desviación actual
    const desviacionActual = this.calcularDesviacionHoras();

    // Seleccionar dos empleados aleatorios con cargas diferentes
    const empleadosOrdenados = this.ordenarEmpleadosPorCarga();
    const empleadoSobrecargado = empleadosOrdenados[empleadosOrdenados.length - 1];
    const empleadoSubcargado = empleadosOrdenados[0];

    if (!empleadoSobrecargado || !empleadoSubcargado) return false;

    const turnosSobrecargado = this.turnosPorEmpleado.get(empleadoSobrecargado.uid) || [];
    const turnosSubcargado = this.turnosPorEmpleado.get(empleadoSubcargado.uid) || [];

    // Intentar intercambiar turnos
    for (const turno1 of turnosSobrecargado) {
      for (const turno2 of turnosSubcargado) {
        // Verificar si el intercambio es válido
        if (this.esIntercambioValido(turno1, turno2, empleadoSobrecargado, empleadoSubcargado)) {
          // Realizar intercambio temporal
          this.realizarIntercambio(turno1, turno2);

          // Verificar si mejora
          const nuevaDesviacion = this.calcularDesviacionHoras();

          if (nuevaDesviacion < desviacionActual) {
            return true; // Intercambio exitoso
          } else {
            // Revertir
            this.realizarIntercambio(turno2, turno1);
          }
        }
      }
    }

    return false;
  }

  /**
   * Verificar si un intercambio de turnos es válido
   */
  private esIntercambioValido(
    turno1: Turno,
    turno2: Turno,
    empleado1: Usuario,
    empleado2: Usuario
  ): boolean {
    // No intercambiar turnos de la misma fecha
    if (turno1.fecha === turno2.fecha) return false;

    // Crear turnos temporales para validación
    const turno1Modificado = { ...turno1, empleadoId: empleado2.uid };
    const turno2Modificado = { ...turno2, empleadoId: empleado1.uid };

    // Validar para empleado 1
    const turnos1 = (this.turnosPorEmpleado.get(empleado1.uid) || [])
      .filter((t) => t.id !== turno1.id)
      .concat([turno2Modificado]);

    if (!TurnoValidator.isValidAssignment(turno2Modificado, empleado1, turnos1, this.config)) {
      return false;
    }

    // Validar para empleado 2
    const turnos2 = (this.turnosPorEmpleado.get(empleado2.uid) || [])
      .filter((t) => t.id !== turno2.id)
      .concat([turno1Modificado]);

    if (!TurnoValidator.isValidAssignment(turno1Modificado, empleado2, turnos2, this.config)) {
      return false;
    }

    return true;
  }

  /**
   * Realizar intercambio de empleados en dos turnos
   */
  private realizarIntercambio(turno1: Turno, turno2: Turno): void {
    const emp1 = turno1.empleadoId;
    const emp2 = turno2.empleadoId;

    turno1.empleadoId = emp2;
    turno2.empleadoId = emp1;

    // Actualizar mapas
    const turnos1 = this.turnosPorEmpleado.get(emp1) || [];
    const turnos2 = this.turnosPorEmpleado.get(emp2) || [];

    this.turnosPorEmpleado.set(
      emp1,
      turnos1.filter((t) => t.id !== turno1.id).concat([turno2])
    );
    this.turnosPorEmpleado.set(
      emp2,
      turnos2.filter((t) => t.id !== turno2.id).concat([turno1])
    );

    // Recalcular horas
    this.hoursTracker.reset();
    this.turnos.forEach((turno) => {
      this.hoursTracker.addTurno(turno.empleadoId, turno);
    });
  }

  /**
   * Calcular desviación estándar de horas entre empleados
   */
  private calcularDesviacionHoras(): number {
    const horasPorEmpleado = this.empleados.map((emp) => {
      const horas = this.hoursTracker.getHorasEmpleado(emp.uid);
      return horas
        ? Object.values(horas.mensuales).reduce((a, b) => a + b, 0)
        : 0;
    });

    const promedio = horasPorEmpleado.reduce((a, b) => a + b, 0) / horasPorEmpleado.length;
    const varianza = horasPorEmpleado.reduce(
      (acc, val) => acc + Math.pow(val - promedio, 2),
      0
    ) / horasPorEmpleado.length;

    return Math.sqrt(varianza);
  }

  /**
   * FASE 5: Detección y reporte de conflictos
   */
  private fase5_deteccionConflictos(): Conflicto[] {
    console.log('[FASE 5] Detectando conflictos...');

    const conflictos = this.conflictDetector.detectAllConflicts(
      this.turnos,
      this.timeSlots,
      this.empleados
    );

    console.log(`[FASE 5] Completada. ${conflictos.length} conflictos detectados`);

    return conflictos;
  }

  /**
   * Calcular estadísticas finales
   */
  private calcularEstadisticas() {
    return this.empleados.map((empleado) => {
      const turnosEmpleado = this.turnosPorEmpleado.get(empleado.uid) || [];
      const horas = this.hoursTracker.getHorasEmpleado(empleado.uid);

      return {
        empleadoId: empleado.uid,
        horasTrabajadas: horas
          ? Object.values(horas.mensuales).reduce((a, b) => a + b, 0)
          : 0,
        turnosAsignados: turnosEmpleado.length,
        guardiasAsignadas: turnosEmpleado.filter((t) => t.tipo === 'guardia').length,
        festivosAsignados: turnosEmpleado.filter((t) => t.tipo === 'festivo').length,
      };
    });
  }
}
