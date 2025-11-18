import {
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue,
  off,
} from 'firebase/database';
import { realtimeDb } from './firebase';
import { Turno } from '@/types';
import { format } from 'date-fns';

// Interfaces para el calendario en Realtime Database
export interface CalendarioMetadata {
  farmaciaId: string;
  empresaId: string;
  año: number;
  mes: number;
  createdAt: number;
  updatedAt: number;
}

export interface CalendarioMes {
  metadata: CalendarioMetadata;
  turnos: { [turnoId: string]: TurnoRealtime };
}

export interface TurnoRealtime {
  empleadoId: string;
  fecha: string;
  horaInicio: number;
  horaFin: number;
  duracionMinutos: number;
  tipo: 'laboral' | 'guardia' | 'festivo';
  estado: 'confirmado' | 'pendiente' | 'conflicto';
  createdAt: number;
  updatedAt: number;
}

// Obtener la clave año-mes de una fecha
const getYearMonthKey = (fecha: Date | string): string => {
  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return format(date, 'yyyy-MM');
};

// Obtener referencia al calendario de un mes específico
const getCalendarioRef = (farmaciaId: string, yearMonth: string) => {
  return ref(realtimeDb, `calendarios/${farmaciaId}/${yearMonth}`);
};

// Obtener referencia a los turnos de un mes específico
const getTurnosRef = (farmaciaId: string, yearMonth: string) => {
  return ref(realtimeDb, `calendarios/${farmaciaId}/${yearMonth}/turnos`);
};

// Obtener referencia a un turno específico
const getTurnoRef = (farmaciaId: string, yearMonth: string, turnoId: string) => {
  return ref(realtimeDb, `calendarios/${farmaciaId}/${yearMonth}/turnos/${turnoId}`);
};

// Asegurar que el calendario existe para un mes específico
export const ensureCalendarioExists = async (
  farmaciaId: string,
  empresaId: string,
  fecha: Date | string
): Promise<void> => {
  const yearMonth = getYearMonthKey(fecha);
  const calendarioRef = getCalendarioRef(farmaciaId, yearMonth);

  const snapshot = await get(calendarioRef);

  if (!snapshot.exists()) {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
    const metadata: CalendarioMetadata = {
      farmaciaId,
      empresaId,
      año: date.getFullYear(),
      mes: date.getMonth() + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await set(ref(realtimeDb, `calendarios/${farmaciaId}/${yearMonth}/metadata`), metadata);
  }
};

// Obtener todos los turnos de un mes específico
export const getTurnosByMonth = async (
  farmaciaId: string,
  fecha: Date | string
): Promise<Turno[]> => {
  try {
    const yearMonth = getYearMonthKey(fecha);
    const turnosRef = getTurnosRef(farmaciaId, yearMonth);

    const snapshot = await get(turnosRef);

    if (!snapshot.exists()) {
      return [];
    }

    const turnos: Turno[] = [];
    snapshot.forEach((childSnapshot) => {
      const turnoData = childSnapshot.val() as TurnoRealtime;
      turnos.push({
        id: childSnapshot.key!,
        empleadoId: turnoData.empleadoId,
        fecha: turnoData.fecha,
        horaInicio: turnoData.horaInicio,
        horaFin: turnoData.horaFin,
        duracionMinutos: turnoData.duracionMinutos,
        tipo: turnoData.tipo,
        estado: turnoData.estado,
        createdAt: new Date(turnoData.createdAt),
        updatedAt: new Date(turnoData.updatedAt),
      });
    });

    return turnos;
  } catch (error) {
    console.error('Error getting turnos by month:', error);
    throw error;
  }
};

// Obtener turnos de un empleado en un mes específico
export const getTurnosByEmpleadoAndMonth = async (
  farmaciaId: string,
  empleadoId: string,
  fecha: Date | string
): Promise<Turno[]> => {
  try {
    const allTurnos = await getTurnosByMonth(farmaciaId, fecha);
    return allTurnos.filter(turno => turno.empleadoId === empleadoId);
  } catch (error) {
    console.error('Error getting turnos by empleado and month:', error);
    throw error;
  }
};

// Obtener turnos por rango de fechas (puede abarcar múltiples meses)
export const getTurnosByDateRange = async (
  farmaciaId: string,
  fechaInicio: string,
  fechaFin: string
): Promise<Turno[]> => {
  try {
    const startDate = new Date(fechaInicio);
    const endDate = new Date(fechaFin);

    // Obtener todos los meses en el rango
    const meses = new Set<string>();
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      meses.add(getYearMonthKey(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Obtener turnos de todos los meses
    const allTurnos: Turno[] = [];
    for (const mes of Array.from(meses)) {
      const turnosRef = getTurnosRef(farmaciaId, mes);
      const snapshot = await get(turnosRef);

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const turnoData = childSnapshot.val() as TurnoRealtime;
          const turno: Turno = {
            id: childSnapshot.key!,
            empleadoId: turnoData.empleadoId,
            fecha: turnoData.fecha,
            horaInicio: turnoData.horaInicio,
            horaFin: turnoData.horaFin,
            duracionMinutos: turnoData.duracionMinutos,
            tipo: turnoData.tipo,
            estado: turnoData.estado,
            createdAt: new Date(turnoData.createdAt),
            updatedAt: new Date(turnoData.updatedAt),
          };

          // Filtrar por rango de fechas
          if (turno.fecha >= fechaInicio && turno.fecha <= fechaFin) {
            allTurnos.push(turno);
          }
        });
      }
    }

    return allTurnos;
  } catch (error) {
    console.error('Error getting turnos by date range:', error);
    throw error;
  }
};

// Crear un turno
export const createTurno = async (
  farmaciaId: string,
  empresaId: string,
  turno: Omit<Turno, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Asegurar que el calendario existe
    await ensureCalendarioExists(farmaciaId, empresaId, turno.fecha);

    const yearMonth = getYearMonthKey(turno.fecha);
    const turnosRef = getTurnosRef(farmaciaId, yearMonth);
    const newTurnoRef = push(turnosRef);

    const turnoData: TurnoRealtime = {
      empleadoId: turno.empleadoId,
      fecha: turno.fecha,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      duracionMinutos: turno.duracionMinutos || 0,
      tipo: turno.tipo,
      estado: turno.estado,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await set(newTurnoRef, turnoData);

    // Actualizar metadata del calendario
    await update(ref(realtimeDb, `calendarios/${farmaciaId}/${yearMonth}/metadata`), {
      updatedAt: Date.now(),
    });

    return newTurnoRef.key!;
  } catch (error) {
    console.error('Error creating turno:', error);
    throw error;
  }
};

// Crear múltiples turnos (batch)
export const createTurnosBatch = async (
  farmaciaId: string,
  empresaId: string,
  turnos: Omit<Turno, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<void> => {
  try {
    if (turnos.length === 0) return;

    // Agrupar turnos por mes
    const turnosPorMes = new Map<string, Omit<Turno, 'id' | 'createdAt' | 'updatedAt'>[]>();

    for (const turno of turnos) {
      const yearMonth = getYearMonthKey(turno.fecha);
      if (!turnosPorMes.has(yearMonth)) {
        turnosPorMes.set(yearMonth, []);
      }
      turnosPorMes.get(yearMonth)!.push(turno);
    }

    // Crear turnos por mes
    for (const [yearMonth, turnosMes] of turnosPorMes.entries()) {
      // Asegurar que el calendario existe
      await ensureCalendarioExists(farmaciaId, empresaId, turnosMes[0].fecha);

      const updates: { [key: string]: any } = {};

      for (const turno of turnosMes) {
        const newTurnoRef = push(getTurnosRef(farmaciaId, yearMonth));
        const turnoData: TurnoRealtime = {
          empleadoId: turno.empleadoId,
          fecha: turno.fecha,
          horaInicio: turno.horaInicio,
          horaFin: turno.horaFin,
          duracionMinutos: turno.duracionMinutos || 0,
          tipo: turno.tipo,
          estado: turno.estado,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        updates[`calendarios/${farmaciaId}/${yearMonth}/turnos/${newTurnoRef.key}`] = turnoData;
      }

      // Actualizar metadata
      updates[`calendarios/${farmaciaId}/${yearMonth}/metadata/updatedAt`] = Date.now();

      // Ejecutar todas las actualizaciones
      await update(ref(realtimeDb), updates);
    }
  } catch (error) {
    console.error('Error creating turnos batch:', error);
    throw error;
  }
};

// Actualizar un turno
export const updateTurno = async (
  farmaciaId: string,
  turnoId: string,
  turnoFecha: string,
  turnoData: Partial<Omit<Turno, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  try {
    const yearMonth = getYearMonthKey(turnoFecha);
    const turnoRef = getTurnoRef(farmaciaId, yearMonth, turnoId);

    const updates: { [key: string]: any } = {
      ...turnoData,
      updatedAt: Date.now(),
    };

    await update(turnoRef, updates);

    // Actualizar metadata del calendario
    await update(ref(realtimeDb, `calendarios/${farmaciaId}/${yearMonth}/metadata`), {
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error updating turno:', error);
    throw error;
  }
};

// Eliminar un turno
export const deleteTurno = async (
  farmaciaId: string,
  turnoId: string,
  turnoFecha: string
): Promise<void> => {
  try {
    const yearMonth = getYearMonthKey(turnoFecha);
    const turnoRef = getTurnoRef(farmaciaId, yearMonth, turnoId);

    await remove(turnoRef);

    // Actualizar metadata del calendario
    await update(ref(realtimeDb, `calendarios/${farmaciaId}/${yearMonth}/metadata`), {
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error deleting turno:', error);
    throw error;
  }
};

// Eliminar todos los turnos de un mes
export const deleteTurnosByMonth = async (
  farmaciaId: string,
  fecha: Date | string
): Promise<void> => {
  try {
    const yearMonth = getYearMonthKey(fecha);
    const turnosRef = getTurnosRef(farmaciaId, yearMonth);

    await remove(turnosRef);

    // Actualizar metadata del calendario
    await update(ref(realtimeDb, `calendarios/${farmaciaId}/${yearMonth}/metadata`), {
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error deleting turnos by month:', error);
    throw error;
  }
};

// Eliminar turnos por rango de fechas
export const deleteTurnosByDateRange = async (
  farmaciaId: string,
  fechaInicio: string,
  fechaFin: string
): Promise<void> => {
  try {
    const turnos = await getTurnosByDateRange(farmaciaId, fechaInicio, fechaFin);

    // Agrupar turnos por mes para eliminar
    const turnosPorMes = new Map<string, string[]>();

    for (const turno of turnos) {
      const yearMonth = getYearMonthKey(turno.fecha);
      if (!turnosPorMes.has(yearMonth)) {
        turnosPorMes.set(yearMonth, []);
      }
      turnosPorMes.get(yearMonth)!.push(turno.id);
    }

    // Eliminar turnos por mes
    for (const [yearMonth, turnoIds] of turnosPorMes.entries()) {
      const updates: { [key: string]: any } = {};

      for (const turnoId of turnoIds) {
        updates[`calendarios/${farmaciaId}/${yearMonth}/turnos/${turnoId}`] = null;
      }

      // Actualizar metadata
      updates[`calendarios/${farmaciaId}/${yearMonth}/metadata/updatedAt`] = Date.now();

      await update(ref(realtimeDb), updates);
    }
  } catch (error) {
    console.error('Error deleting turnos by date range:', error);
    throw error;
  }
};

// Suscribirse a cambios en tiempo real de un mes específico
export const subscribeTurnosByMonth = (
  farmaciaId: string,
  fecha: Date | string,
  callback: (turnos: Turno[]) => void
): (() => void) => {
  const yearMonth = getYearMonthKey(fecha);
  const turnosRef = getTurnosRef(farmaciaId, yearMonth);

  const listener = onValue(turnosRef, (snapshot) => {
    const turnos: Turno[] = [];

    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const turnoData = childSnapshot.val() as TurnoRealtime;
        turnos.push({
          id: childSnapshot.key!,
          empleadoId: turnoData.empleadoId,
          fecha: turnoData.fecha,
          horaInicio: turnoData.horaInicio,
          horaFin: turnoData.horaFin,
          duracionMinutos: turnoData.duracionMinutos,
          tipo: turnoData.tipo,
          estado: turnoData.estado,
          createdAt: new Date(turnoData.createdAt),
          updatedAt: new Date(turnoData.updatedAt),
        });
      });
    }

    callback(turnos);
  });

  // Retornar función para desuscribirse
  return () => off(turnosRef, 'value', listener);
};

// Obtener todos los calendarios de una empresa (para admin)
export const getCalendariosByEmpresa = async (
  empresaId: string,
  yearMonth: string
): Promise<{ farmaciaId: string; metadata: CalendarioMetadata; turnos: Turno[] }[]> => {
  try {
    const calendariosRef = ref(realtimeDb, 'calendarios');
    const snapshot = await get(calendariosRef);

    const calendarios: { farmaciaId: string; metadata: CalendarioMetadata; turnos: Turno[] }[] = [];

    if (snapshot.exists()) {
      // Iterar por cada farmacia
      snapshot.forEach((farmaciaSnapshot) => {
        const farmaciaId = farmaciaSnapshot.key!;

        // Verificar si existe el mes específico
        const mesSnapshot = farmaciaSnapshot.child(yearMonth);
        if (mesSnapshot.exists()) {
          const metadata = mesSnapshot.child('metadata').val() as CalendarioMetadata;

          // Verificar si pertenece a la empresa
          if (metadata && metadata.empresaId === empresaId) {
            const turnos: Turno[] = [];
            const turnosSnapshot = mesSnapshot.child('turnos');

            if (turnosSnapshot.exists()) {
              turnosSnapshot.forEach((turnoSnapshot) => {
                const turnoData = turnoSnapshot.val() as TurnoRealtime;
                turnos.push({
                  id: turnoSnapshot.key!,
                  empleadoId: turnoData.empleadoId,
                  fecha: turnoData.fecha,
                  horaInicio: turnoData.horaInicio,
                  horaFin: turnoData.horaFin,
                  duracionMinutos: turnoData.duracionMinutos,
                  tipo: turnoData.tipo,
                  estado: turnoData.estado,
                  createdAt: new Date(turnoData.createdAt),
                  updatedAt: new Date(turnoData.updatedAt),
                });
              });
            }

            calendarios.push({ farmaciaId, metadata, turnos });
          }
        }
      });
    }

    return calendarios;
  } catch (error) {
    console.error('Error getting calendarios by empresa:', error);
    throw error;
  }
};
