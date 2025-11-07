import {
  ref,
  get,
  set,
  update,
} from 'firebase/database';
import { realtimeDb } from './firebase';
import { ConfiguracionAlgoritmo } from '@/types';
import { getFarmaciaById } from './farmaciasRealtimeService';

// Configuración por defecto
export const getDefaultConfig = (userId: string, farmaciaId: string, empresaId?: string): Omit<ConfiguracionAlgoritmo, 'id'> => ({
  userId,
  farmaciaId,
  empresaId,
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

// Obtener configuración por farmacia (usamos farmaciaId como clave)
export const getConfiguracionByFarmacia = async (
  farmaciaId: string
): Promise<ConfiguracionAlgoritmo | null> => {
  try {
    // Validar que farmaciaId no sea vacío
    if (!farmaciaId || farmaciaId.trim() === '') {
      throw new Error('farmaciaId no puede estar vacío');
    }

    const configRef = ref(realtimeDb, `configuracionesAlgoritmo/${farmaciaId}`);
    const snapshot = await get(configRef);

    if (snapshot.exists()) {
      const configData = snapshot.val();
      return {
        id: farmaciaId,
        ...configData,
        fechaModificacion: configData.fechaModificacion
          ? new Date(configData.fechaModificacion)
          : new Date(),
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting configuracion by farmacia:', error);
    throw error;
  }
};

// Obtener configuración por usuario (buscando por userId en las configuraciones)
export const getConfiguracionByUserId = async (
  userId: string
): Promise<ConfiguracionAlgoritmo | null> => {
  try {
    // Validar que userId no sea vacío
    if (!userId || userId.trim() === '') {
      throw new Error('userId no puede estar vacío');
    }

    const configsRef = ref(realtimeDb, 'configuracionesAlgoritmo');
    const snapshot = await get(configsRef);

    if (snapshot.exists()) {
      let foundConfig: ConfiguracionAlgoritmo | null = null;

      snapshot.forEach((childSnapshot) => {
        const configData = childSnapshot.val();
        if (configData.userId === userId) {
          foundConfig = {
            id: childSnapshot.key!,
            ...configData,
            fechaModificacion: configData.fechaModificacion
              ? new Date(configData.fechaModificacion)
              : new Date(),
          };
          return true; // Break forEach
        }
      });

      return foundConfig;
    }

    return null;
  } catch (error) {
    console.error('Error getting configuracion by userId:', error);
    throw error;
  }
};

// Obtener o crear configuración (devuelve default si no existe)
// Usamos farmaciaId como clave para garantizar que solo haya una configuración por farmacia
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

      if (!empresaId) {
        throw new Error('No se pudo obtener empresaId de la farmacia');
      }

      // Crear configuración por defecto
      const defaultConfig = getDefaultConfig(userId, farmaciaId, empresaId);
      const configRef = ref(realtimeDb, `configuracionesAlgoritmo/${farmaciaId}`);

      await set(configRef, {
        ...defaultConfig,
        fechaModificacion: Date.now(),
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
  farmaciaId: string,
  configuracion: Partial<Omit<ConfiguracionAlgoritmo, 'id' | 'userId' | 'farmaciaId' | 'fechaModificacion'>>
): Promise<void> => {
  try {
    const configRef = ref(realtimeDb, `configuracionesAlgoritmo/${farmaciaId}`);
    const snapshot = await get(configRef);

    if (!snapshot.exists()) {
      throw new Error('Configuración no encontrada');
    }

    const currentData = snapshot.val();
    const currentVersion = currentData.version || 1;

    await update(configRef, {
      ...configuracion,
      version: currentVersion + 1,
      fechaModificacion: Date.now(),
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

    // Obtener empresaId de la farmacia
    const farmacia = await getFarmaciaById(farmaciaId);
    const empresaId = farmacia?.empresaId;

    const newConfig = {
      userId,
      farmaciaId,
      empresaId,
      prioridades: configuracion.prioridades || currentConfig.prioridades,
      restricciones: configuracion.restricciones || currentConfig.restricciones,
      parametrosOptimizacion: configuracion.parametrosOptimizacion || currentConfig.parametrosOptimizacion,
      version: currentConfig.version + 1,
      fechaModificacion: Date.now(),
    };

    const configRef = ref(realtimeDb, `configuracionesAlgoritmo/${farmaciaId}`);
    await set(configRef, newConfig);

    return {
      id: farmaciaId,
      ...newConfig,
      fechaModificacion: new Date(newConfig.fechaModificacion),
    };
  } catch (error) {
    console.error('Error creating configuracion version:', error);
    throw error;
  }
};
