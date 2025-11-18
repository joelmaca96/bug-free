import {
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  off,
} from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { realtimeDb, functions, auth } from './firebase';
import { Usuario } from '@/types';

// Valores por defecto para restricciones
const defaultRestricciones = {
  horasMaximasDiarias: 10,
  horasMaximasSemanales: 40,
  horasMaximasMensuales: 160,
  horasMaximasAnuales: 1920,
  diasFestivos: [],
};

// Obtener todos los usuarios
export const getUsuarios = async (): Promise<Usuario[]> => {
  try {
    const usuariosRef = ref(realtimeDb, 'usuarios');
    const snapshot = await get(usuariosRef);

    if (!snapshot.exists()) {
      return [];
    }

    const usuarios: Usuario[] = [];
    snapshot.forEach((childSnapshot) => {
      const usuarioData = childSnapshot.val();
      usuarios.push({
        uid: childSnapshot.key!,
        ...usuarioData,
        restricciones: usuarioData.restricciones || defaultRestricciones,
        createdAt: usuarioData.createdAt ? new Date(usuarioData.createdAt) : undefined,
        updatedAt: usuarioData.updatedAt ? new Date(usuarioData.updatedAt) : undefined,
      });
    });

    return usuarios;
  } catch (error) {
    console.error('Error getting usuarios:', error);
    throw error;
  }
};

// Obtener usuarios por farmacia
export const getUsuariosByFarmacia = async (farmaciaId: string): Promise<Usuario[]> => {
  try {
    const allUsuarios = await getUsuarios();
    return allUsuarios.filter(usuario => usuario.farmaciaId === farmaciaId);
  } catch (error) {
    console.error('Error getting usuarios by farmacia:', error);
    throw error;
  }
};

// Obtener usuarios por empresa (excluyendo superusers)
export const getUsuariosByEmpresa = async (empresaId: string, excludeSuperusers = false): Promise<Usuario[]> => {
  try {
    const allUsuarios = await getUsuarios();
    let usuarios = allUsuarios.filter(usuario => usuario.empresaId === empresaId);

    // Filtrar superusers si se solicita
    if (excludeSuperusers) {
      usuarios = usuarios.filter(u => u.rol !== 'superuser');
    }

    return usuarios;
  } catch (error) {
    console.error('Error getting usuarios by empresa:', error);
    throw error;
  }
};

// Obtener usuarios por rol
export const getUsuariosByRol = async (rol: string, farmaciaId?: string): Promise<Usuario[]> => {
  try {
    const allUsuarios = await getUsuarios();
    let usuarios = allUsuarios.filter(usuario => usuario.rol === rol);

    if (farmaciaId) {
      usuarios = usuarios.filter(usuario => usuario.farmaciaId === farmaciaId);
    }

    return usuarios;
  } catch (error) {
    console.error('Error getting usuarios by rol:', error);
    throw error;
  }
};

// Obtener un usuario por ID
export const getUsuarioById = async (uid: string): Promise<Usuario | null> => {
  try {
    const usuarioRef = ref(realtimeDb, `usuarios/${uid}`);
    const snapshot = await get(usuarioRef);

    if (snapshot.exists()) {
      const usuarioData = snapshot.val();
      return {
        uid,
        ...usuarioData,
        restricciones: usuarioData.restricciones || defaultRestricciones,
        createdAt: usuarioData.createdAt ? new Date(usuarioData.createdAt) : undefined,
        updatedAt: usuarioData.updatedAt ? new Date(usuarioData.updatedAt) : undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting usuario:', error);
    throw error;
  }
};

// Crear un nuevo usuario (solo datos en RTDB, no crea cuenta de Auth)
export const createUsuario = async (
  uid: string,
  usuario: Omit<Usuario, 'uid' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  try {
    const usuarioRef = ref(realtimeDb, `usuarios/${uid}`);
    await set(usuarioRef, {
      ...usuario,
      restricciones: usuario.restricciones || defaultRestricciones,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error creating usuario:', error);
    throw error;
  }
};

// Actualizar un usuario
export const updateUsuario = async (
  uid: string,
  usuario: Partial<Omit<Usuario, 'uid' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  try {
    const usuarioRef = ref(realtimeDb, `usuarios/${uid}`);
    await update(usuarioRef, {
      ...usuario,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error updating usuario:', error);
    throw error;
  }
};

// Eliminar un usuario (solo de RTDB, no elimina la cuenta de Auth)
export const deleteUsuario = async (uid: string): Promise<void> => {
  try {
    const usuarioRef = ref(realtimeDb, `usuarios/${uid}`);
    await remove(usuarioRef);
  } catch (error) {
    console.error('Error deleting usuario:', error);
    throw error;
  }
};

// Crear usuario completo (Auth + RTDB)
export const createUsuarioComplete = async (
  email: string,
  password: string,
  userData: Omit<Usuario, 'uid' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Crear datos en Realtime Database
    const usuarioRef = ref(realtimeDb, `usuarios/${uid}`);
    await set(usuarioRef, {
      ...userData,
      restricciones: userData.restricciones || defaultRestricciones,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return uid;
  } catch (error) {
    console.error('Error creating usuario complete:', error);
    throw error;
  }
};

// Eliminar usuario incluyendo credenciales de Firebase Auth
export const deleteUsuarioComplete = async (uid: string): Promise<void> => {
  try {
    const deleteUserAuth = httpsCallable(functions, 'deleteUserAuth');
    await deleteUserAuth({ uid });
  } catch (error) {
    console.error('Error deleting usuario completely:', error);
    throw error;
  }
};

// Buscar usuario por NIF
export const getUsuarioByNif = async (nif: string): Promise<Usuario | null> => {
  try {
    const allUsuarios = await getUsuarios();
    const usuario = allUsuarios.find(u => u.datosPersonales?.nif === nif);
    return usuario || null;
  } catch (error) {
    console.error('Error getting usuario by NIF:', error);
    throw error;
  }
};

// Buscar usuario por email
export const getUsuarioByEmail = async (email: string): Promise<Usuario | null> => {
  try {
    const allUsuarios = await getUsuarios();
    const usuario = allUsuarios.find(u => u.datosPersonales?.email === email);
    return usuario || null;
  } catch (error) {
    console.error('Error getting usuario by email:', error);
    throw error;
  }
};

// Obtener usuarios disponibles para ser asignados como admin (usuarios con rol admin sin empresa asignada)
export const getAdminsDisponibles = async (): Promise<Usuario[]> => {
  try {
    const allUsuarios = await getUsuarios();
    return allUsuarios.filter(
      usuario => usuario.rol === 'admin' && (!usuario.empresaId || usuario.empresaId === '')
    );
  } catch (error) {
    console.error('Error getting admins disponibles:', error);
    throw error;
  }
};

// Suscribirse a cambios en un usuario específico
export const subscribeToUsuario = (
  uid: string,
  callback: (usuario: Usuario | null) => void
): (() => void) => {
  const usuarioRef = ref(realtimeDb, `usuarios/${uid}`);

  const listener = onValue(usuarioRef, (snapshot) => {
    if (snapshot.exists()) {
      const usuarioData = snapshot.val();
      callback({
        uid,
        ...usuarioData,
        restricciones: usuarioData.restricciones || defaultRestricciones,
        createdAt: usuarioData.createdAt ? new Date(usuarioData.createdAt) : undefined,
        updatedAt: usuarioData.updatedAt ? new Date(usuarioData.updatedAt) : undefined,
      });
    } else {
      callback(null);
    }
  });

  // Retornar función para desuscribirse
  return () => off(usuarioRef, 'value', listener);
};
