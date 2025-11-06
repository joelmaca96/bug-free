import {
  ref,
  get,
  set,
  update,
  remove,
  push,
} from 'firebase/database';
import { realtimeDb } from './firebase';
import { Farmacia } from '@/types';

// Obtener todas las farmacias
export const getFarmacias = async (): Promise<Farmacia[]> => {
  try {
    const farmaciasRef = ref(realtimeDb, 'farmacias');
    const snapshot = await get(farmaciasRef);

    if (!snapshot.exists()) {
      return [];
    }

    const farmacias: Farmacia[] = [];
    snapshot.forEach((childSnapshot) => {
      const farmaciaData = childSnapshot.val();
      farmacias.push({
        id: childSnapshot.key!,
        ...farmaciaData,
        createdAt: farmaciaData.createdAt ? new Date(farmaciaData.createdAt) : undefined,
        updatedAt: farmaciaData.updatedAt ? new Date(farmaciaData.updatedAt) : undefined,
      });
    });

    return farmacias;
  } catch (error) {
    console.error('Error getting farmacias:', error);
    throw error;
  }
};

// Obtener farmacias por empresa
export const getFarmaciasByEmpresa = async (empresaId: string): Promise<Farmacia[]> => {
  try {
    const allFarmacias = await getFarmacias();
    return allFarmacias.filter(farmacia => farmacia.empresaId === empresaId);
  } catch (error) {
    console.error('Error getting farmacias by empresa:', error);
    throw error;
  }
};

// Obtener una farmacia por ID
export const getFarmaciaById = async (id: string): Promise<Farmacia | null> => {
  try {
    const farmaciaRef = ref(realtimeDb, `farmacias/${id}`);
    const snapshot = await get(farmaciaRef);

    if (snapshot.exists()) {
      const farmaciaData = snapshot.val();
      return {
        id,
        ...farmaciaData,
        createdAt: farmaciaData.createdAt ? new Date(farmaciaData.createdAt) : undefined,
        updatedAt: farmaciaData.updatedAt ? new Date(farmaciaData.updatedAt) : undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting farmacia:', error);
    throw error;
  }
};

// Crear una nueva farmacia
export const createFarmacia = async (
  farmacia: Omit<Farmacia, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Si no tiene configuración, usar valores por defecto
    const farmaciaData = {
      ...farmacia,
      configuracion: farmacia.configuracion || {
        horariosHabituales: [],
        jornadasGuardia: [],
        festivosRegionales: [],
        trabajadoresMinimos: 1,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const farmaciasRef = ref(realtimeDb, 'farmacias');
    const newFarmaciaRef = push(farmaciasRef);

    await set(newFarmaciaRef, farmaciaData);

    return newFarmaciaRef.key!;
  } catch (error) {
    console.error('Error creating farmacia:', error);
    throw error;
  }
};

// Actualizar una farmacia
export const updateFarmacia = async (
  id: string,
  farmacia: Partial<Omit<Farmacia, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  try {
    const farmaciaRef = ref(realtimeDb, `farmacias/${id}`);
    await update(farmaciaRef, {
      ...farmacia,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error updating farmacia:', error);
    throw error;
  }
};

// Eliminar una farmacia
export const deleteFarmacia = async (id: string): Promise<void> => {
  try {
    const farmaciaRef = ref(realtimeDb, `farmacias/${id}`);
    await remove(farmaciaRef);
  } catch (error) {
    console.error('Error deleting farmacia:', error);
    throw error;
  }
};

// Buscar farmacia por CIF
export const getFarmaciaByCif = async (cif: string): Promise<Farmacia | null> => {
  try {
    const allFarmacias = await getFarmacias();
    const farmacia = allFarmacias.find(f => f.cif === cif);
    return farmacia || null;
  } catch (error) {
    console.error('Error getting farmacia by CIF:', error);
    throw error;
  }
};
