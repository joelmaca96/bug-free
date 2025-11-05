import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ConfiguracionAlgoritmo } from '@/types';
import { getFarmaciaById } from './farmaciasService';

const COLLECTION_NAME = 'configuracionesAlgoritmo';

// Convertir timestamp de Firestore a Date
const convertTimestamps = (data: any): ConfiguracionAlgoritmo => {
  return {
    ...data,
    fechaModificacion: data.fechaModificacion instanceof Timestamp
      ? data.fechaModificacion.toDate()
      : data.fechaModificacion,
  };
};

// Configuración por defecto
export const getDefaultConfig = (userId: string, farmaciaId: string): Omit<ConfiguracionAlgoritmo, 'id'> => ({
  userId,
  farmaciaId,
  prioridades: {
    coberturaMinima: { peso: 100, activo: true },
    limitesHoras: { peso: 90, activo: true },
    distribucionGuardias: { peso: 70, activo: true },
    distribucionFestivos: { peso: 60, activo: true },
    minimizarCambiosTurno: { peso: 40, activo: true },
  },
  restricciones: {
    descansoMinimoEntreJornadas: 12,
    maxTurnosConsecutivos: 6,
    maxHorasDiarias: 10,
    permitirHorasExtra: false,
    margenSobrecarga: 10,
  },
  parametrosOptimizacion: {
    maxIteraciones: 1000,
    umbralAceptacion: 0.8,
    estrategia: 'greedy',
  },
  version: 1,
  fechaModificacion: new Date(),
});

// Obtener configuración por usuario (solo puede haber una por usuario)
// Usamos userId como ID del documento para garantizar unicidad
export const getConfiguracionByUserId = async (
  userId: string
): Promise<ConfiguracionAlgoritmo | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return convertTimestamps({ id: docSnap.id, ...docSnap.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting configuracion:', error);
    throw error;
  }
};

// Obtener o crear configuración (devuelve default si no existe)
// Usamos userId como ID del documento para garantizar que solo haya una configuración por usuario
export const getOrCreateConfiguracion = async (
  userId: string,
  farmaciaId: string
): Promise<ConfiguracionAlgoritmo> => {
  try {
    let config = await getConfiguracionByUserId(userId);

    if (!config) {
      // Obtener empresaId de la farmacia
      const farmacia = await getFarmaciaById(farmaciaId);
      const empresaId = farmacia?.empresaId;

      // Crear configuración por defecto
      const defaultConfig = getDefaultConfig(farmaciaId);
      const docRef = doc(collection(db, COLLECTION_NAME));

      await setDoc(docRef, {
        ...defaultConfig,
        empresaId,
        fechaModificacion: serverTimestamp(),
      });

      config = {
        id: userId, // El ID es el userId
        ...defaultConfig,
        empresaId,
      };
    }

    return config;
  } catch (error) {
    console.error('Error getting or creating configuracion:', error);
    throw error;
  }
};

// Actualizar configuración (solo se permite una configuración por usuario)
export const updateConfiguracion = async (
  id: string,
  configuracion: Partial<Omit<ConfiguracionAlgoritmo, 'id' | 'userId' | 'farmaciaId' | 'fechaModificacion'>>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const currentDoc = await getDoc(docRef);

    if (!currentDoc.exists()) {
      throw new Error('Configuración no encontrada');
    }

    const currentVersion = currentDoc.data().version || 1;

    await updateDoc(docRef, {
      ...configuracion,
      version: currentVersion + 1,
      fechaModificacion: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating configuracion:', error);
    throw error;
  }
};

// NOTA: Esta función ha sido eliminada porque solo se permite una configuración por usuario.
// Para actualizar la configuración, usa updateConfiguracion() en su lugar.
