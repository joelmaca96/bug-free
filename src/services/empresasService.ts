import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './firebase';
import { Empresa, Usuario, DatosPersonales } from '@/types';
import { deleteUsuarioComplete } from './usuariosService';

const COLLECTION_NAME = 'empresas';

// Convertir timestamp de Firestore a Date
const convertTimestamps = (data: any): Empresa => {
  return {
    ...data,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
  };
};

// Obtener todas las empresas
export const getEmpresas = async (): Promise<Empresa[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ id: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting empresas:', error);
    throw error;
  }
};

// Obtener una empresa por ID
export const getEmpresaById = async (id: string): Promise<Empresa | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return convertTimestamps({ id: docSnap.id, ...docSnap.data() });
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
    // Verificar que el adminId no esté ya asignado a otra empresa (solo si se proporciona)
    if (empresa.adminId) {
      const existingEmpresa = await getEmpresaByAdminId(empresa.adminId);
      if (existingEmpresa) {
        throw new Error('El usuario admin ya está asignado a otra empresa');
      }
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...empresa,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
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

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...empresa,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating empresa:', error);
    throw error;
  }
};

// Eliminar una empresa
export const deleteEmpresa = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting empresa:', error);
    throw error;
  }
};

// Buscar empresa por CIF
export const getEmpresaByCif = async (cif: string): Promise<Empresa | null> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('cif', '==', cif));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return convertTimestamps({ id: doc.id, ...doc.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting empresa by CIF:', error);
    throw error;
  }
};

// Buscar empresa por adminId
export const getEmpresaByAdminId = async (adminId: string): Promise<Empresa | null> => {
  try {
    if (!adminId) return null;

    const q = query(collection(db, COLLECTION_NAME), where('adminId', '==', adminId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return convertTimestamps({ id: doc.id, ...doc.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting empresa by adminId:', error);
    throw error;
  }
};

// Crear empresa con admin en una transacción atómica
export const createEmpresaConAdmin = async (
  empresaData: Omit<Empresa, 'id' | 'adminId' | 'createdAt' | 'updatedAt'>,
  adminData: {
    email: string;
    password: string;
    datosPersonales: DatosPersonales;
  }
): Promise<{ empresaId: string; adminId: string }> => {
  try {
    // 1. Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      adminData.email,
      adminData.password
    );
    const adminId = userCredential.user.uid;

    // 2. Crear empresa en Firestore
    const empresaRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...empresaData,
      adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const empresaId = empresaRef.id;

    // 3. Crear documento de usuario en Firestore con empresaId asignado
    const newAdmin: Usuario = {
      uid: adminId,
      datosPersonales: adminData.datosPersonales,
      rol: 'admin',
      farmaciaId: '',
      empresaId,
      restricciones: {
        horasMaximasDiarias: 10,
        horasMaximasSemanales: 40,
        horasMaximasMensuales: 160,
        horasMaximasAnuales: 1920,
        diasFestivos: [],
      },
      incluirEnCalendario: false, // Admin no se incluye en calendario por defecto
    };

    await setDoc(doc(db, 'usuarios', adminId), {
      ...newAdmin,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { empresaId, adminId };
  } catch (error) {
    console.error('Error creating empresa con admin:', error);
    throw error;
  }
};

// Eliminar empresa en cascada (con opción de eliminar farmacias y usuarios)
export const deleteEmpresaCascade = async (
  empresaId: string,
  deleteFarmacias: boolean = false,
  deleteUsers: boolean = false
): Promise<void> => {
  try {
    // Obtener farmacias de la empresa
    const farmaciasQuery = query(
      collection(db, 'farmacias'),
      where('empresaId', '==', empresaId)
    );
    const farmaciasSnapshot = await getDocs(farmaciasQuery);

    if (deleteFarmacias) {
      // Eliminar cada farmacia
      for (const farmaciaDoc of farmaciasSnapshot.docs) {
        const farmaciaId = farmaciaDoc.id;

        if (deleteUsers) {
          // Obtener usuarios de la farmacia
          const usuariosQuery = query(
            collection(db, 'usuarios'),
            where('farmaciaId', '==', farmaciaId)
          );
          const usuariosSnapshot = await getDocs(usuariosQuery);

          // Eliminar usuarios incluyendo Auth
          for (const usuarioDoc of usuariosSnapshot.docs) {
            await deleteUsuarioComplete(usuarioDoc.id);
          }
        }

        // Eliminar la farmacia
        await deleteDoc(doc(db, 'farmacias', farmaciaId));
      }
    } else {
      // Si no se eliminan farmacias, desasignar empresaId de las farmacias
      for (const farmaciaDoc of farmaciasSnapshot.docs) {
        await updateDoc(doc(db, 'farmacias', farmaciaDoc.id), {
          empresaId: '',
        });
      }
    }

    if (deleteUsers) {
      // Obtener usuarios de la empresa
      const usuariosQuery = query(
        collection(db, 'usuarios'),
        where('empresaId', '==', empresaId)
      );
      const usuariosSnapshot = await getDocs(usuariosQuery);

      // Eliminar usuarios incluyendo Auth
      for (const usuarioDoc of usuariosSnapshot.docs) {
        await deleteUsuarioComplete(usuarioDoc.id);
      }
    } else {
      // Desasignar empresaId de los usuarios
      const usuariosQuery = query(
        collection(db, 'usuarios'),
        where('empresaId', '==', empresaId)
      );
      const usuariosSnapshot = await getDocs(usuariosQuery);

      for (const usuarioDoc of usuariosSnapshot.docs) {
        await updateDoc(doc(db, 'usuarios', usuarioDoc.id), {
          empresaId: '',
        });
      }
    }

    // Eliminar la empresa
    await deleteDoc(doc(db, COLLECTION_NAME, empresaId));
  } catch (error) {
    console.error('Error deleting empresa cascade:', error);
    throw error;
  }
};
