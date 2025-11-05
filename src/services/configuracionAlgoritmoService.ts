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
export const getDefaultConfig = (farmaciaId: string): Omit<ConfiguracionAlgoritmo, 'id'> => ({
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

// Obtener configuración por farmacia
export const getConfiguracionByFarmacia = async (
  farmaciaId: string
): Promise<ConfiguracionAlgoritmo | null> => {
  try {
    // Usar el farmaciaId como ID del documento para consistencia con las reglas de Firestore
    const docRef = doc(db, COLLECTION_NAME, farmaciaId);
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
export const getOrCreateConfiguracion = async (
  farmaciaId: string
): Promise<ConfiguracionAlgoritmo> => {
  try {
    let config = await getConfiguracionByFarmacia(farmaciaId);

    if (!config) {
      // Crear configuración por defecto usando farmaciaId como ID del documento
      const defaultConfig = getDefaultConfig(farmaciaId);
      const docRef = doc(db, COLLECTION_NAME, farmaciaId);

      await setDoc(docRef, {
        ...defaultConfig,
        fechaModificacion: serverTimestamp(),
      });

      config = {
        id: farmaciaId,
        ...defaultConfig,
      };
    }

    return config;
  } catch (error) {
    console.error('Error getting or creating configuracion:', error);
    throw error;
  }
};

// Actualizar configuración
export const updateConfiguracion = async (
  id: string,
  configuracion: Partial<Omit<ConfiguracionAlgoritmo, 'id' | 'farmaciaId' | 'fechaModificacion'>>
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

// Crear nueva versión de configuración
export const createConfiguracionVersion = async (
  farmaciaId: string,
  configuracion: Partial<Omit<ConfiguracionAlgoritmo, 'id' | 'farmaciaId' | 'version' | 'fechaModificacion'>>
): Promise<ConfiguracionAlgoritmo> => {
  try {
    const currentConfig = await getOrCreateConfiguracion(farmaciaId);

    const newConfig = {
      farmaciaId,
      prioridades: configuracion.prioridades || currentConfig.prioridades,
      restricciones: configuracion.restricciones || currentConfig.restricciones,
      parametrosOptimizacion: configuracion.parametrosOptimizacion || currentConfig.parametrosOptimizacion,
      version: currentConfig.version + 1,
      fechaModificacion: serverTimestamp(),
    };

    const docRef = doc(collection(db, COLLECTION_NAME));
    await setDoc(docRef, newConfig);

    return {
      id: docRef.id,
      ...newConfig,
      fechaModificacion: new Date(),
    };
  } catch (error) {
    console.error('Error creating configuracion version:', error);
    throw error;
  }
};
