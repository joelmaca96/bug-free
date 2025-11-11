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
    coberturaMinima: { peso: 50, activo: true },
    limitesHoras: { peso: 50, activo: true },
    distribucionGuardias: { peso: 50, activo: true },
    distribucionFestivos: { peso: 50, activo: true },
    minimizarCambiosTurno: { peso: 50, activo: true },
  },
  restricciones: {
    descansoMinimoEntreJornadas: 12,
    maxTurnosConsecutivos: 6,
    maxHorasDiarias: 8,
    permitirHorasExtra: false,
    estrategiaAsignacion: 'slots_individuales',
    preferenciaDistribucion: 'igualdad_horas',
  },
  parametrosOptimizacion: {
    maxIteraciones: 1000,
    umbralAceptacion: 0.8,
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
    // Validar que userId no sea vacío
    if (!userId || userId.trim() === '') {
      throw new Error('userId no puede estar vacío');
    }

    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return convertTimestamps({ id: docSnap.id, ...docSnap.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting configuracion by userId:', error);
    throw error;
  }
};

// Obtener configuración por farmacia
export const getConfiguracionByFarmacia = async (
  farmaciaId: string
): Promise<ConfiguracionAlgoritmo | null> => {
  try {
    // Validar que farmaciaId no sea vacío
    if (!farmaciaId || farmaciaId.trim() === '') {
      throw new Error('farmaciaId no puede estar vacío');
    }

    const q = query(collection(db, COLLECTION_NAME), where('farmaciaId', '==', farmaciaId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return convertTimestamps({ id: doc.id, ...doc.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting configuracion by farmacia:', error);
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
    // Validar que farmaciaId no sea vacío, undefined o null
    if (!farmaciaId || farmaciaId.trim() === '') {
      throw new Error('farmaciaId no puede estar vacío. El usuario debe tener una farmacia asignada.');
    }

    let config = await getConfiguracionByFarmacia(farmaciaId);

    if (!config) {
      // Obtener empresaId de la farmacia
      const farmacia = await getFarmaciaById(farmaciaId);
      const empresaId = farmacia?.empresaId;

      // Crear configuración por defecto
      const defaultConfig = getDefaultConfig(userId, farmaciaId);
      const docRef = doc(collection(db, COLLECTION_NAME));

      await setDoc(docRef, {
        ...defaultConfig,
        empresaId,
        fechaModificacion: serverTimestamp(),
      });

      config = {
        id: docRef.id,
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

// Crear nueva versión de configuración
export const createConfiguracionVersion = async (
  userId: string,
  farmaciaId: string,
  configuracion: Partial<Omit<ConfiguracionAlgoritmo, 'id' | 'farmaciaId' | 'version' | 'fechaModificacion'>>
): Promise<ConfiguracionAlgoritmo> => {
  try {
    // Validar que farmaciaId no sea vacío
    if (!farmaciaId || farmaciaId.trim() === '') {
      throw new Error('farmaciaId no puede estar vacío');
    }

    const currentConfig = await getOrCreateConfiguracion(userId, farmaciaId);

    const newConfig = {
      userId,
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
