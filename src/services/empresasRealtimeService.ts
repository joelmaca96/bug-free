import {
  ref,
  get,
  set,
  update,
  remove,
  push,
} from 'firebase/database';
import { realtimeDb } from './firebase';
import { Empresa } from '@/types';
import { deleteUsuarioComplete, getUsuariosByEmpresa } from './usuariosRealtimeService';
import { getFarmaciasByEmpresa, updateFarmacia, deleteFarmacia } from './farmaciasRealtimeService';

// Obtener todas las empresas
export const getEmpresas = async (): Promise<Empresa[]> => {
  try {
    const empresasRef = ref(realtimeDb, 'empresas');
    const snapshot = await get(empresasRef);

    if (!snapshot.exists()) {
      return [];
    }

    const empresas: Empresa[] = [];
    snapshot.forEach((childSnapshot) => {
      const empresaData = childSnapshot.val();
      empresas.push({
        id: childSnapshot.key!,
        ...empresaData,
        createdAt: empresaData.createdAt ? new Date(empresaData.createdAt) : undefined,
        updatedAt: empresaData.updatedAt ? new Date(empresaData.updatedAt) : undefined,
      });
    });

    return empresas;
  } catch (error) {
    console.error('Error getting empresas:', error);
    throw error;
  }
};

// Obtener una empresa por ID
export const getEmpresaById = async (id: string): Promise<Empresa | null> => {
  try {
    const empresaRef = ref(realtimeDb, `empresas/${id}`);
    const snapshot = await get(empresaRef);

    if (snapshot.exists()) {
      const empresaData = snapshot.val();
      return {
        id,
        ...empresaData,
        createdAt: empresaData.createdAt ? new Date(empresaData.createdAt) : undefined,
        updatedAt: empresaData.updatedAt ? new Date(empresaData.updatedAt) : undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting empresa:', error);
    throw error;
  }
};

// Crear una nueva empresa
export const createEmpresa = async (
  empresa: Omit<Empresa, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Verificar que el adminId no esté ya asignado a otra empresa
    if (empresa.adminId) {
      const existingEmpresa = await getEmpresaByAdminId(empresa.adminId);
      if (existingEmpresa) {
        throw new Error('El usuario admin ya está asignado a otra empresa');
      }
    }

    const empresasRef = ref(realtimeDb, 'empresas');
    const newEmpresaRef = push(empresasRef);

    await set(newEmpresaRef, {
      ...empresa,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return newEmpresaRef.key!;
  } catch (error) {
    console.error('Error creating empresa:', error);
    throw error;
  }
};

// Actualizar una empresa
export const updateEmpresa = async (
  id: string,
  empresa: Partial<Omit<Empresa, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  try {
    // Si se está actualizando el adminId, verificar que no esté asignado a otra empresa
    if (empresa.adminId) {
      const existingEmpresa = await getEmpresaByAdminId(empresa.adminId);
      if (existingEmpresa && existingEmpresa.id !== id) {
        throw new Error('El usuario admin ya está asignado a otra empresa');
      }
    }

    const empresaRef = ref(realtimeDb, `empresas/${id}`);
    await update(empresaRef, {
      ...empresa,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error updating empresa:', error);
    throw error;
  }
};

// Eliminar una empresa
export const deleteEmpresa = async (id: string): Promise<void> => {
  try {
    const empresaRef = ref(realtimeDb, `empresas/${id}`);
    await remove(empresaRef);
  } catch (error) {
    console.error('Error deleting empresa:', error);
    throw error;
  }
};

// Buscar empresa por CIF
export const getEmpresaByCif = async (cif: string): Promise<Empresa | null> => {
  try {
    const allEmpresas = await getEmpresas();
    const empresa = allEmpresas.find(e => e.cif === cif);
    return empresa || null;
  } catch (error) {
    console.error('Error getting empresa by CIF:', error);
    throw error;
  }
};

// Buscar empresa por adminId
export const getEmpresaByAdminId = async (adminId: string): Promise<Empresa | null> => {
  try {
    const allEmpresas = await getEmpresas();
    const empresa = allEmpresas.find(e => e.adminId === adminId);
    return empresa || null;
  } catch (error) {
    console.error('Error getting empresa by adminId:', error);
    throw error;
  }
};

// Eliminar empresa en cascada (con opción de eliminar farmacias y usuarios)
export const deleteEmpresaCascade = async (
  empresaId: string,
  deleteFarmaciasFlag: boolean = false,
  deleteUsersFlag: boolean = false
): Promise<void> => {
  try {
    // Obtener farmacias de la empresa
    const farmacias = await getFarmaciasByEmpresa(empresaId);

    if (deleteFarmaciasFlag) {
      // Eliminar cada farmacia
      for (const farmacia of farmacias) {
        if (deleteUsersFlag) {
          // Obtener usuarios de la farmacia
          const usuarios = await import('./usuariosRealtimeService').then(m =>
            m.getUsuariosByFarmacia(farmacia.id)
          );

          // Eliminar usuarios incluyendo Auth
          for (const usuario of usuarios) {
            await deleteUsuarioComplete(usuario.uid);
          }
        }

        // Eliminar la farmacia
        await deleteFarmacia(farmacia.id);
      }
    } else {
      // Si no se eliminan farmacias, desasignar empresaId de las farmacias
      for (const farmacia of farmacias) {
        await updateFarmacia(farmacia.id, { empresaId: '' });
      }
    }

    if (deleteUsersFlag) {
      // Obtener usuarios de la empresa
      const usuarios = await getUsuariosByEmpresa(empresaId);

      // Eliminar usuarios incluyendo Auth
      for (const usuario of usuarios) {
        await deleteUsuarioComplete(usuario.uid);
      }
    } else {
      // Desasignar empresaId de los usuarios
      const usuarios = await getUsuariosByEmpresa(empresaId);
      const { updateUsuario } = await import('./usuariosRealtimeService');

      for (const usuario of usuarios) {
        await updateUsuario(usuario.uid, { empresaId: '' });
      }
    }

    // Eliminar la empresa
    await deleteEmpresa(empresaId);
  } catch (error) {
    console.error('Error deleting empresa cascade:', error);
    throw error;
  }
};
