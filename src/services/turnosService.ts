import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Turno } from '@/types';

// Convertir timestamp de Firestore a Date
const convertTimestamps = (data: any): Turno => {
  return {
    ...data,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
  };
};

// Obtener path de colección de turnos
const getTurnosCollectionPath = (farmaciaId: string) => {
  return `calendarios/${farmaciaId}/turnos`;
};

// Asegurar que el documento del calendario existe
const ensureCalendarioExists = async (farmaciaId: string) => {
  try {
    const calendarioRef = doc(db, 'calendarios', farmaciaId);
    const calendarioSnap = await getDoc(calendarioRef);

    if (!calendarioSnap.exists()) {
      console.log('Creando documento de calendario para farmacia:', farmaciaId);
      await setDoc(calendarioRef, {
        farmaciaId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error ensuring calendario exists:', error);
    // No lanzar error, solo log
  }
};

// Obtener todos los turnos de una farmacia
export const getTurnosByFarmacia = async (farmaciaId: string): Promise<Turno[]> => {
  try {
    const collectionPath = getTurnosCollectionPath(farmaciaId);
    const querySnapshot = await getDocs(collection(db, collectionPath));

    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ id: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting turnos:', error);
    throw error;
  }
};

// Obtener turnos por empleado
export const getTurnosByEmpleado = async (
  farmaciaId: string,
  empleadoId: string
): Promise<Turno[]> => {
  try {
    const collectionPath = getTurnosCollectionPath(farmaciaId);
    const q = query(
      collection(db, collectionPath),
      where('empleadoId', '==', empleadoId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ id: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting turnos by empleado:', error);
    throw error;
  }
};

// Obtener turnos por rango de fechas
export const getTurnosByDateRange = async (
  farmaciaId: string,
  fechaInicio: string,
  fechaFin: string
): Promise<Turno[]> => {
  try {
    const collectionPath = getTurnosCollectionPath(farmaciaId);
    const q = query(
      collection(db, collectionPath),
      where('fecha', '>=', fechaInicio),
      where('fecha', '<=', fechaFin)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ id: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting turnos by date range:', error);
    throw error;
  }
};

// Obtener turnos de un empleado en un rango de fechas
export const getTurnosByEmpleadoAndDateRange = async (
  farmaciaId: string,
  empleadoId: string,
  fechaInicio: string,
  fechaFin: string
): Promise<Turno[]> => {
  try {
    const collectionPath = getTurnosCollectionPath(farmaciaId);
    const q = query(
      collection(db, collectionPath),
      where('empleadoId', '==', empleadoId),
      where('fecha', '>=', fechaInicio),
      where('fecha', '<=', fechaFin)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ id: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting turnos by empleado and date range:', error);
    throw error;
  }
};

// Obtener un turno por ID
export const getTurnoById = async (
  farmaciaId: string,
  turnoId: string
): Promise<Turno | null> => {
  try {
    const collectionPath = getTurnosCollectionPath(farmaciaId);
    const docRef = doc(db, collectionPath, turnoId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return convertTimestamps({ id: docSnap.id, ...docSnap.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting turno:', error);
    throw error;
  }
};

// Crear un turno
export const createTurno = async (
  farmaciaId: string,
  turno: Omit<Turno, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Asegurar que el documento del calendario existe
    await ensureCalendarioExists(farmaciaId);

    const collectionPath = getTurnosCollectionPath(farmaciaId);
    const docRef = doc(collection(db, collectionPath));

    await setDoc(docRef, {
      ...turno,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating turno:', error);
    throw error;
  }
};

// Crear múltiples turnos (batch)
export const createTurnosBatch = async (
  farmaciaId: string,
  turnos: Omit<Turno, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<void> => {
  try {
    // Asegurar que el documento del calendario existe
    await ensureCalendarioExists(farmaciaId);

    const batch = writeBatch(db);
    const collectionPath = getTurnosCollectionPath(farmaciaId);

    for (const turno of turnos) {
      const docRef = doc(collection(db, collectionPath));
      batch.set(docRef, {
        ...turno,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    console.error('Error creating turnos batch:', error);
    throw error;
  }
};

// Actualizar un turno
export const updateTurno = async (
  farmaciaId: string,
  turnoId: string,
  turno: Partial<Omit<Turno, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  try {
    const collectionPath = getTurnosCollectionPath(farmaciaId);
    const docRef = doc(db, collectionPath, turnoId);

    await updateDoc(docRef, {
      ...turno,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating turno:', error);
    throw error;
  }
};

// Eliminar un turno
export const deleteTurno = async (
  farmaciaId: string,
  turnoId: string
): Promise<void> => {
  try {
    // Asegurar que el documento del calendario existe
    await ensureCalendarioExists(farmaciaId);

    const collectionPath = getTurnosCollectionPath(farmaciaId);
    console.log('Eliminando turno:', { farmaciaId, turnoId, collectionPath });
    const docRef = doc(db, collectionPath, turnoId);
    await deleteDoc(docRef);
    console.log('Turno eliminado exitosamente de Firestore');
  } catch (error) {
    console.error('Error deleting turno:', error);
    throw error;
  }
};

// Eliminar turnos de un empleado
export const deleteTurnosByEmpleado = async (
  farmaciaId: string,
  empleadoId: string
): Promise<void> => {
  try {
    const turnos = await getTurnosByEmpleado(farmaciaId, empleadoId);
    const batch = writeBatch(db);
    const collectionPath = getTurnosCollectionPath(farmaciaId);

    for (const turno of turnos) {
      const docRef = doc(db, collectionPath, turno.id);
      batch.delete(docRef);
    }

    await batch.commit();
  } catch (error) {
    console.error('Error deleting turnos by empleado:', error);
    throw error;
  }
};

// Eliminar turnos en un rango de fechas
export const deleteTurnosByDateRange = async (
  farmaciaId: string,
  fechaInicio: string,
  fechaFin: string
): Promise<void> => {
  try {
    // Asegurar que el documento del calendario existe
    await ensureCalendarioExists(farmaciaId);

    console.log('Eliminando turnos por rango de fechas:', { farmaciaId, fechaInicio, fechaFin });
    const turnos = await getTurnosByDateRange(farmaciaId, fechaInicio, fechaFin);
    console.log(`Turnos encontrados para eliminar: ${turnos.length}`);

    if (turnos.length === 0) {
      console.log('No hay turnos para eliminar');
      return;
    }

    const batch = writeBatch(db);
    const collectionPath = getTurnosCollectionPath(farmaciaId);

    for (const turno of turnos) {
      console.log(`Agregando al batch para eliminar: ${turno.id}`);
      const docRef = doc(db, collectionPath, turno.id);
      batch.delete(docRef);
    }

    await batch.commit();
    console.log(`${turnos.length} turnos eliminados exitosamente de Firestore`);
  } catch (error) {
    console.error('Error deleting turnos by date range:', error);
    throw error;
  }
};
