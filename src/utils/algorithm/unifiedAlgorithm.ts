import {
  addDays,
  eachDayOfInterval,
  format,
  getDay,
  isSameDay,
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

      console.log(`\n[ALGORITMO] Finalizado: ${this.turnos.length} turnos generados en ${tiempoEjecucion}ms`);
      console.log(`[ALGORITMO] Resumen por empleado:`);
      estadisticas.forEach(stat => {
        const empleado = this.empleados.find(e => e.uid === stat.empleadoId);
        console.log(`  - ${empleado?.datosPersonales.nombre}: ${stat.turnosAsignados} turnos, ${stat.horasTrabajadas}h (${stat.guardiasAsignadas} guardias, ${stat.festivosAsignados} festivos)`);
      });

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
      // IMPORTANTE: Solo procesar guardias en su fecha de inicio para evitar duplicación
      // Las guardias que cruzan medianoche generan slots en ambos días automáticamente
      const guardias = this.farmacia.configuracion.jornadasGuardia?.filter((g) => {
        const inicioGuardia = parseISO(g.fechaInicio);
        return isSameDay(dia, inicioGuardia); // Solo procesar en fecha de inicio
      }) || [];

      // Si es festivo sin guardia, la farmacia está cerrada - no crear slots
      if (esFestivo && guardias.length === 0) {
        return;
      }

      // Crear slots de horario habitual (si no es festivo sin guardia)
      const horariosDelDia = this.farmacia.configuracion.horariosHabituales.filter(
        (h) => h.dia === diaSemana
      );

      // Recopilar horas ocupadas por guardias EN ESTE DÍA ESPECÍFICO para evitar solapamientos
      const horasGuardia = new Set<number>();
      guardias.forEach((guardia) => {
        const horaInicio = parseInt(guardia.horaInicio.split(':')[0]);
        const horaFin = parseInt(guardia.horaFin.split(':')[0]);

        // Manejar guardias que cruzan medianoche
        if (horaFin < horaInicio) {
          // Guardia nocturna (ej: 20:00 a 05:00 del día siguiente)
          // Para el día actual (fecha de inicio), solo bloquear desde horaInicio hasta medianoche
          for (let hora = horaInicio; hora < 24; hora++) {
            horasGuardia.add(hora);
          }
          // Las horas 00:00-05:00 se bloquearán cuando se procese el día siguiente
        } else {
          // Guardia normal en el mismo día
          for (let hora = horaInicio; hora < horaFin; hora++) {
            horasGuardia.add(hora);
          }
        }
      });

      // También verificar si hay guardias del DÍA ANTERIOR que terminan en este día
      const diaAnterior = addDays(dia, -1);
      const guardiasDelDiaAnterior = this.farmacia.configuracion.jornadasGuardia?.filter((g) => {
        const inicioGuardia = parseISO(g.fechaInicio);
        return isSameDay(diaAnterior, inicioGuardia);
      }) || [];

      guardiasDelDiaAnterior.forEach((guardia) => {
        const horaInicio = parseInt(guardia.horaInicio.split(':')[0]);
        const horaFin = parseInt(guardia.horaFin.split(':')[0]);

        // Si la guardia cruza medianoche (horaFin < horaInicio), bloquear las horas del día siguiente
        if (horaFin < horaInicio) {
          for (let hora = 0; hora < horaFin; hora++) {
            horasGuardia.add(hora);
          }
        }
      });

      // Crear slots de horario habitual (excluyendo horas de guardia)
      horariosDelDia.forEach((horario) => {
        const horaInicio = parseInt(horario.inicio.split(':')[0]);
        const horaFin = parseInt(horario.fin.split(':')[0]);

        for (let hora = horaInicio; hora < horaFin; hora++) {
          // No crear slot si esta hora está ocupada por una guardia
          if (!horasGuardia.has(hora)) {
            this.timeSlots.push({
              fecha: fechaStr,
              horaInicio: hora,
              horaFin: hora + 1,
              tipo: esFestivo ? 'festivo' : 'laboral',
              trabajadoresNecesarios: this.farmacia.configuracion.trabajadoresMinimos,
              asignaciones: [],
            });
          }
        }
      });

      // Crear slots de guardia
      guardias.forEach((guardia) => {
        const horaInicio = parseInt(guardia.horaInicio.split(':')[0]);
        const horaFin = parseInt(guardia.horaFin.split(':')[0]);

        // Crear ID único para esta guardia (fecha de inicio + hora de inicio)
        const guardiaId = `guardia-${guardia.fechaInicio}-${guardia.horaInicio}`;

        // Manejar guardias que cruzan medianoche
        if (horaFin < horaInicio) {
          // Guardia nocturna (ej: 22:00 a 6:00 del día siguiente)
          // Parte 1: Desde horaInicio hasta medianoche (mismo día)
          for (let hora = horaInicio; hora < 24; hora++) {
            this.timeSlots.push({
              fecha: fechaStr,
              horaInicio: hora,
              horaFin: hora + 1,
              tipo: 'guardia',
              trabajadoresNecesarios: this.farmacia.configuracion.trabajadoresMinimos,
              asignaciones: [],
              guardiaId, // Mismo ID para todos los slots de esta guardia
            });
          }
          // Parte 2: Desde medianoche hasta horaFin (día siguiente)
          const diaSiguiente = addDays(dia, 1);
          const fechaSiguienteStr = format(diaSiguiente, 'yyyy-MM-dd');
          for (let hora = 0; hora < horaFin; hora++) {
            this.timeSlots.push({
              fecha: fechaSiguienteStr,
              horaInicio: hora,
              horaFin: hora + 1,
              tipo: 'guardia',
              trabajadoresNecesarios: this.farmacia.configuracion.trabajadoresMinimos,
              asignaciones: [],
              guardiaId, // Mismo ID para vincular con la parte 1
            });
          }
        } else {
          // Guardia normal
          for (let hora = horaInicio; hora < horaFin; hora++) {
            this.timeSlots.push({
              fecha: fechaStr,
              horaInicio: hora,
              horaFin: hora + 1,
              tipo: 'guardia',
              trabajadoresNecesarios: this.farmacia.configuracion.trabajadoresMinimos,
              asignaciones: [],
              guardiaId, // ID único para esta guardia
            });
          }
        }
      });
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

    // Agrupar slots críticos:
    // - Guardias: por guardiaId (para agrupar guardias nocturnas que cruzan medianoche)
    // - Festivos: por fecha
    const turnosCriticosMap = new Map<string, TimeSlot[]>();

    this.timeSlots
      .filter(slot => (slot.tipo === 'guardia' || slot.tipo === 'festivo'))
      .forEach(slot => {
        // Para guardias, usar guardiaId para agrupar toda la guardia (incluso si cruza medianoche)
        // Para festivos, usar fecha-tipo como antes
        const key = slot.tipo === 'guardia' && slot.guardiaId
          ? slot.guardiaId
          : `${slot.fecha}-${slot.tipo}`;

        if (!turnosCriticosMap.has(key)) {
          turnosCriticosMap.set(key, []);
        }
        turnosCriticosMap.get(key)!.push(slot);
      });

    let asignacionesRealizadas = 0;

    // Procesar cada turno crítico
    turnosCriticosMap.forEach((slots, key) => {
      if (slots.length === 0) return;

      // Ordenar slots por hora
      slots.sort((a, b) => a.horaInicio - b.horaInicio);

      console.log(`[FASE 1] Procesando turno crítico ${key}: ${slots.length} slots, necesita ${slots[0].trabajadoresNecesarios} trabajadores`);

      // IMPORTANTE: Las guardias SIEMPRE se asignan como turno completo para que las haga el mismo empleado
      // Los festivos pueden usar la estrategia configurada
      const esGuardia = slots[0].tipo === 'guardia';
      const usarTurnoCompleto = esGuardia || this.config.restricciones.estrategiaAsignacion === 'turno_completo';

      if (usarTurnoCompleto) {
        // Asignar turno completo (todas las guardias usan esta estrategia)
        // Para guardias largas que excedan límites de horas, se dividirán en bloques consecutivos
        const trabajadoresNecesarios = slots[0].trabajadoresNecesarios;

        // Continuar asignando empleados hasta que todos los slots de todas las posiciones estén cubiertos
        let intentos = 0;
        const maxIntentos = trabajadoresNecesarios * 20; // Límite de seguridad

        while (intentos < maxIntentos) {
          // Obtener slots sin asignar para esta posición de trabajador
          const slotsSinAsignar = slots.filter(slot => slot.asignaciones.length < trabajadoresNecesarios);

          if (slotsSinAsignar.length === 0) {
            break; // Ya están todos asignados
          }

          const empleadosOrdenados = this.ordenarEmpleadosPorEquidad();
          const empleadoAsignado = this.asignarEmpleadoATurnoParcial(slotsSinAsignar, empleadosOrdenados);
          if (empleadoAsignado) {
            asignacionesRealizadas++;
          } else {
            // No se pudo asignar ningún empleado, salir para evitar bucle infinito
            console.log(`[FASE 1] ⚠ No se pudo asignar más empleados para ${key}, quedan ${slotsSinAsignar.length} slots sin asignar`);
            break;
          }

          intentos++;
        }
      } else {
        // Asignar slots individuales respetando límite de horas (solo para festivos si está configurado)
        asignacionesRealizadas += this.asignarSlotsCriticosIndividuales(slots);
      }
    });

    console.log(`[FASE 1] Completada. ${asignacionesRealizadas} ${this.config.restricciones.estrategiaAsignacion === 'slots_individuales' ? 'slots críticos' : 'turnos críticos'} asignados`);
  }

  /**
   * Asignar un empleado a un turno parcial o completo (máximo de slots consecutivos posibles)
   * Si el turno excede límites de horas, asigna el máximo posible y deja el resto para otro empleado
   */
  private asignarEmpleadoATurnoParcial(slots: TimeSlot[], empleadosCandidatos: Usuario[]): boolean {
    if (slots.length === 0) return false;

    // Ordenar slots por fecha y hora para asegurar que son consecutivos
    const slotsOrdenados = [...slots].sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return a.horaInicio - b.horaInicio;
    });

    const primerSlot = slotsOrdenados[0];
    const esGuardia = primerSlot.tipo === 'guardia';

    console.log(`[asignarEmpleadoATurnoParcial] Intentando asignar ${slotsOrdenados.length} slots desde ${primerSlot.fecha} ${primerSlot.horaInicio}:00 (tipo: ${primerSlot.tipo})`);

    // Intentar asignar a cada empleado candidato
    for (const empleado of empleadosCandidatos) {
      // Verificar disponibilidad en fecha
      const state = this.empleadosState.get(empleado.uid);
      if (state?.disponibilidad.get(primerSlot.fecha) === false) {
        continue;
      }

      // Verificar que no esté ya asignado en alguno de los slots
      const yaAsignado = slotsOrdenados.some(slot => slot.asignaciones.includes(empleado.uid));
      if (yaAsignado) {
        continue;
      }

      const turnosEmpleado = this.turnosPorEmpleado.get(empleado.uid) || [];

      // Calcular cuántos slots consecutivos puede tomar sin exceder límites
      let maxSlots = 0;
      for (let i = 1; i <= slotsOrdenados.length; i++) {
        const slotsParaProbar = slotsOrdenados.slice(0, i);
        const ultimoSlot = slotsParaProbar[slotsParaProbar.length - 1];

        // Calcular duración real en minutos contando los slots (para manejar guardias nocturnas)
        const duracionMinutos = slotsParaProbar.length * 60;

        // Crear turno temporal
        const turnoTemporal: Turno = {
          id: 'temp',
          empleadoId: empleado.uid,
          fecha: primerSlot.fecha,
          horaInicio: primerSlot.horaInicio,
          horaFin: ultimoSlot.horaFin,
          duracionMinutos,
          tipo: primerSlot.tipo,
          estado: 'pendiente',
        };

        // Validar restricciones duras
        const isValid = TurnoValidator.isValidAssignment(turnoTemporal, empleado, turnosEmpleado, this.config);
        if (!isValid) {
          break; // No puede tomar ni este ni más slots
        }

        // Verificar límites de horas
        const exceedsLimits = this.hoursTracker.wouldExceedLimits(empleado, turnoTemporal);
        if (!exceedsLimits) {
          maxSlots = i; // Puede tomar este número de slots
        } else {
          break; // Excede límites, no puede tomar más
        }
      }

      if (maxSlots > 0) {
        // Asignar los slots consecutivos que puede tomar
        const slotsAAsignar = slotsOrdenados.slice(0, maxSlots);
        const ultimoSlotAsignado = slotsAAsignar[slotsAAsignar.length - 1];

        console.log(`[asignarEmpleadoATurnoParcial] ✓ Asignando ${maxSlots} slots a ${empleado.datosPersonales.nombre}: ${primerSlot.fecha} ${primerSlot.horaInicio}:00-${ultimoSlotAsignado.horaFin}:00 (${maxSlots}h)`);

        slotsAAsignar.forEach(slot => {
          this.asignarEmpleadoASlot(empleado, slot);
        });

        return true;
      }
    }

    console.log(`[asignarEmpleadoATurnoParcial] ✗ No se pudo asignar ningún empleado`);
    return false;
  }

  /**
   * Asignar un empleado a un turno completo (todos los slots consecutivos)
   */
  private asignarEmpleadoATurnoCompleto(slots: TimeSlot[], empleadosCandidatos: Usuario[]): boolean {
    if (slots.length === 0) return false;

    // Ordenar slots por hora
    const slotsOrdenados = [...slots].sort((a, b) => a.horaInicio - b.horaInicio);
    const primerSlot = slotsOrdenados[0];
    const ultimoSlot = slotsOrdenados[slotsOrdenados.length - 1];

    // Crear turno temporal que representa el turno completo
    const turnoCompleto: Turno = {
      id: 'temp',
      empleadoId: '', // Se asignará después
      fecha: primerSlot.fecha,
      horaInicio: primerSlot.horaInicio,
      horaFin: ultimoSlot.horaFin,
      duracionMinutos: (ultimoSlot.horaFin - primerSlot.horaInicio) * 60,
      tipo: primerSlot.tipo,
      estado: 'pendiente',
    };

    console.log(`[asignarEmpleadoATurnoCompleto] Intentando asignar turno: ${primerSlot.fecha} ${primerSlot.horaInicio}:00-${ultimoSlot.horaFin}:00 (${slotsOrdenados.length} slots, tipo: ${primerSlot.tipo})`);

    // Intentar asignar a cada empleado candidato
    for (const empleado of empleadosCandidatos) {
      turnoCompleto.empleadoId = empleado.uid;

      // Verificar disponibilidad en fecha
      const state = this.empleadosState.get(empleado.uid);
      if (state?.disponibilidad.get(primerSlot.fecha) === false) {
        continue;
      }

      // Verificar que no esté ya asignado en ninguno de los slots
      const yaAsignado = slotsOrdenados.some(slot => slot.asignaciones.includes(empleado.uid));
      if (yaAsignado) {
        continue;
      }

      // Obtener turnos del empleado
      const turnosEmpleado = this.turnosPorEmpleado.get(empleado.uid) || [];

      // Validar restricciones duras para el turno completo
      const isValid = TurnoValidator.isValidAssignment(turnoCompleto, empleado, turnosEmpleado, this.config);
      if (!isValid) {
        console.log(`[asignarEmpleadoATurnoCompleto] → ${empleado.datosPersonales.nombre}: FALLA validación TurnoValidator`);
        continue;
      }

      // Verificar límites de horas para el turno completo
      const exceedsLimits = this.hoursTracker.wouldExceedLimits(empleado, turnoCompleto);
      if (exceedsLimits) {
        const horasEmpleado = this.hoursTracker.getHorasEmpleado(empleado.uid);
        const horasDiarias = horasEmpleado?.diarias[turnoCompleto.fecha] || 0;
        console.log(`[asignarEmpleadoATurnoCompleto] → ${empleado.datosPersonales.nombre}: FALLA límite de horas (tiene ${horasDiarias}h, turno es ${turnoCompleto.duracionMinutos/60}h, límite: ${this.config.restricciones.maxHorasDiarias}h)`);
        continue;
      }

      console.log(`[asignarEmpleadoATurnoCompleto] ✓ Asignando empleado ${empleado.datosPersonales.nombre} a ${slotsOrdenados.length} slots`);
      // Asignar el empleado a TODOS los slots del turno
      slotsOrdenados.forEach(slot => {
        this.asignarEmpleadoASlot(empleado, slot);
      });
      return true;
    }

    console.log(`[asignarEmpleadoATurnoCompleto] ✗ No se pudo asignar ningún empleado (validaciones fallaron)`);

    // Si no se pudo con restricciones normales, intentar con horas extra
    if (this.config.restricciones.permitirHorasExtra) {
      for (const empleado of empleadosCandidatos) {
        turnoCompleto.empleadoId = empleado.uid;

        const state = this.empleadosState.get(empleado.uid);
        if (state?.disponibilidad.get(primerSlot.fecha) === false) {
          continue;
        }

        const yaAsignado = slotsOrdenados.some(slot => slot.asignaciones.includes(empleado.uid));
        if (yaAsignado) {
          continue;
        }

        const turnosEmpleado = this.turnosPorEmpleado.get(empleado.uid) || [];

        // Solo validar descanso y turnos consecutivos, no horas
        if (!TurnoValidator.hasMinimumRest(turnoCompleto, turnosEmpleado, this.config.restricciones.descansoMinimoEntreJornadas)) {
          continue;
        }

        if (TurnoValidator.exceedsConsecutiveTurns(turnoCompleto, turnosEmpleado, this.config.restricciones.maxTurnosConsecutivos)) {
          continue;
        }

        // Asignar con horas extra
        console.log(`[asignarEmpleadoATurnoCompleto] ⚠ Asignando empleado ${empleado.datosPersonales.nombre} CON HORAS EXTRA a ${slotsOrdenados.length} slots`);
        slotsOrdenados.forEach(slot => {
          this.asignarEmpleadoASlot(empleado, slot);
        });
        return true;
      }
    }

    console.log(`[asignarEmpleadoATurnoCompleto] ✗ No se pudo asignar ningún empleado (ni con horas extra)`);
    return false;
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
   * Ordenar empleados por continuidad para maximizar horas seguidas
   * Prioriza empleados que ya tienen turnos en el día dado
   */
  private ordenarEmpleadosPorContinuidad(fecha: string): Usuario[] {
    return [...this.empleados].sort((a, b) => {
      // Obtener turnos del día para cada empleado
      const turnosA = (this.turnosPorEmpleado.get(a.uid) || [])
        .filter(t => t.fecha === fecha);
      const turnosB = (this.turnosPorEmpleado.get(b.uid) || [])
        .filter(t => t.fecha === fecha);

      // Priorizar empleados que ya tienen turnos en este día
      if (turnosA.length > 0 && turnosB.length === 0) return -1;
      if (turnosA.length === 0 && turnosB.length > 0) return 1;

      // Si ambos tienen turnos, ordenar por equidad global
      const stateA = this.empleadosState.get(a.uid)!;
      const stateB = this.empleadosState.get(b.uid)!;
      const totalA = stateA.guardiasRealizadas + stateA.festivosRealizados;
      const totalB = stateB.guardiasRealizadas + stateB.festivosRealizados;

      return totalA - totalB;
    });
  }

  /**
   * Asignar slots críticos (guardias/festivos) de forma individual
   * Permite que múltiples empleados cubran un mismo día respetando límites de horas
   */
  private asignarSlotsCriticosIndividuales(slots: TimeSlot[]): number {
    let asignacionesRealizadas = 0;

    // Función para ordenar empleados según la preferencia configurada
    const ordenarEmpleados = () => {
      if (this.config.restricciones.preferenciaDistribucion === 'igualdad_horas') {
        return this.ordenarEmpleadosPorEquidad();
      } else {
        // Para "horas_seguidas", priorizar empleados que ya trabajaron en slots previos
        return this.ordenarEmpleadosPorContinuidad(slots[0].fecha);
      }
    };

    // Asignar cada slot individualmente
    slots.forEach((slot) => {
      const trabajadoresNecesarios = slot.trabajadoresNecesarios - slot.asignaciones.length;

      for (let i = 0; i < trabajadoresNecesarios; i++) {
        // PRIORIDAD 1: Buscar empleados con turnos extendibles (que terminan justo cuando empieza este slot)
        const empleadosConTurnoExtendible = this.empleados.filter(empleado => {
          const turnosDelDia = (this.turnosPorEmpleado.get(empleado.uid) || []).filter(
            t => t.fecha === slot.fecha && t.tipo === slot.tipo
          );

          // Buscar si tiene un turno que termina exactamente cuando empieza este slot
          const tieneExtendible = turnosDelDia.some(t => t.horaFin === slot.horaInicio);

          return tieneExtendible;
        });

        let asignado = false;

        // Intentar primero con empleados que pueden extender
        if (empleadosConTurnoExtendible.length > 0) {
          for (const empleado of empleadosConTurnoExtendible) {
            if (this.puedeAsignarEmpleadoASlot(empleado, slot)) {
              this.asignarEmpleadoASlot(empleado, slot);
              asignacionesRealizadas++;
              asignado = true;
              break;
            } else if (
              this.config.restricciones.permitirHorasExtra &&
              this.puedeAsignarConHorasExtra(empleado, slot)
            ) {
              this.asignarEmpleadoASlot(empleado, slot);
              asignacionesRealizadas++;
              asignado = true;
              break;
            }
          }
        }

        // PRIORIDAD 2: Si no se pudo extender, usar orden normal
        if (!asignado) {
          const empleadosOrdenados = ordenarEmpleados();

          for (const empleado of empleadosOrdenados) {
            if (this.puedeAsignarEmpleadoASlot(empleado, slot)) {
              this.asignarEmpleadoASlot(empleado, slot);
              asignacionesRealizadas++;
              break;
            } else if (
              this.config.restricciones.permitirHorasExtra &&
              this.puedeAsignarConHorasExtra(empleado, slot)
            ) {
              this.asignarEmpleadoASlot(empleado, slot);
              asignacionesRealizadas++;
              break;
            }
          }
        }
      }
    });

    return asignacionesRealizadas;
  }

  /**
   * Asignar slots laborales de forma individual
   * Similar a asignarSlotsCriticosIndividuales pero usa ordenación por carga
   */
  private asignarSlotsLaboralesIndividuales(slots: TimeSlot[]): number {
    let asignacionesRealizadas = 0;

    // Función para ordenar empleados según la preferencia configurada
    const ordenarEmpleados = () => {
      if (this.config.restricciones.preferenciaDistribucion === 'igualdad_horas') {
        return this.ordenarEmpleadosPorCarga();
      } else {
        // Para "horas_seguidas", priorizar empleados que ya trabajaron en slots previos
        return this.ordenarEmpleadosPorContinuidad(slots[0].fecha);
      }
    };

    // Asignar cada slot individualmente
    slots.forEach((slot) => {
      const trabajadoresNecesarios = slot.trabajadoresNecesarios - slot.asignaciones.length;

      for (let i = 0; i < trabajadoresNecesarios; i++) {
        // PRIORIDAD 1: Buscar empleados con turnos extendibles (terminan justo antes de este slot)
        const empleadosConTurnoExtendible = this.empleados.filter(empleado => {
          const turnosDelDia = (this.turnosPorEmpleado.get(empleado.uid) || []).filter(
            t => t.fecha === slot.fecha && t.tipo === slot.tipo
          );
          return turnosDelDia.some(t => t.horaFin === slot.horaInicio);
        });

        let asignado = false;

        // Intentar extender turno existente primero
        if (empleadosConTurnoExtendible.length > 0) {
          for (const empleado of empleadosConTurnoExtendible) {
            if (this.puedeAsignarEmpleadoASlot(empleado, slot)) {
              this.asignarEmpleadoASlot(empleado, slot);
              asignacionesRealizadas++;
              asignado = true;
              break;
            } else if (
              this.config.restricciones.permitirHorasExtra &&
              this.puedeAsignarConHorasExtra(empleado, slot)
            ) {
              this.asignarEmpleadoASlot(empleado, slot);
              asignacionesRealizadas++;
              asignado = true;
              break;
            }
          }
        }

        // PRIORIDAD 2: Si no se pudo extender, usar orden normal de empleados
        if (!asignado) {
          const empleadosOrdenados = ordenarEmpleados();

          for (const empleado of empleadosOrdenados) {
            if (this.puedeAsignarEmpleadoASlot(empleado, slot)) {
              this.asignarEmpleadoASlot(empleado, slot);
              asignacionesRealizadas++;
              break;
            } else if (
              this.config.restricciones.permitirHorasExtra &&
              this.puedeAsignarConHorasExtra(empleado, slot)
            ) {
              this.asignarEmpleadoASlot(empleado, slot);
              asignacionesRealizadas++;
              break;
            }
          }
        }
      }
    });

    return asignacionesRealizadas;
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
    // Agrupar slots laborales por día para formar turnos completos
    const turnosPorDia = new Map<string, TimeSlot[]>();

    this.timeSlots
      .filter(slot =>
        slot.tipo === 'laboral' &&
        diasSemana.some(dia => format(dia, 'yyyy-MM-dd') === slot.fecha)
      )
      .forEach(slot => {
        const fecha = slot.fecha;
        if (!turnosPorDia.has(fecha)) {
          turnosPorDia.set(fecha, []);
        }
        turnosPorDia.get(fecha)!.push(slot);
      });

    if (turnosPorDia.size === 0) return;

    // Procesar cada día de la semana
    turnosPorDia.forEach((slots, fecha) => {
      if (slots.length === 0) return;

      // Ordenar slots por hora
      slots.sort((a, b) => a.horaInicio - b.horaInicio);

      const trabajadoresNecesarios = slots[0].trabajadoresNecesarios;

      console.log(`[FASE 2] Procesando día laboral ${fecha}: ${slots.length} slots, necesita ${trabajadoresNecesarios} trabajadores`);

      // CAMBIO: Usar estrategia configurada
      if (this.config.restricciones.estrategiaAsignacion === 'slots_individuales') {
        // Asignar slots individuales respetando límite de horas
        const asignados = this.asignarSlotsLaboralesIndividuales(slots);
        if (asignados === 0) {
          console.warn(`[FASE 2] ✗ No se pudo asignar ningún slot para ${fecha}`);
        }
      } else {
        // Mantener comportamiento original: asignar día completo
        const empleadosOrdenadosPorCarga = this.ordenarEmpleadosPorCarga();

        for (let i = 0; i < trabajadoresNecesarios; i++) {
          const empleadoAsignado = this.asignarEmpleadoATurnoCompleto(slots, empleadosOrdenadosPorCarga);

          if (!empleadoAsignado) {
            console.warn(`[FASE 2] ✗ No se pudo asignar empleado para ${fecha}`);
          }
        }
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

    // IMPORTANTE: Buscar turno extendible justo antes de intentar extender
    // para asegurar que incluye turnos recién creados en iteraciones anteriores
    const turnosDelDia = (this.turnosPorEmpleado.get(empleado.uid) || []).filter(
      (t) => t.fecha === slot.fecha
    );

    let turnoExtendido = false;

    // Buscar turno que termine exactamente donde empieza este slot
    for (const turno of turnosDelDia) {
      // Intentar extender turno existente si es contiguo y del mismo tipo
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
      // Crear nuevo turno solo si no se pudo extender ninguno existente
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
