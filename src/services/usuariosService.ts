import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Usuario } from '@/types';

const COLLECTION_NAME = 'usuarios';

// Convertir timestamp de Firestore a Date
const convertTimestamps = (data: any): Usuario => {
  return {
    ...data,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
  };
};

// Obtener todos los usuarios
export const getUsuarios = async (): Promise<Usuario[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ uid: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting usuarios:', error);
    throw error;
  }
};

// Obtener usuarios por farmacia
export const getUsuariosByFarmacia = async (farmaciaId: string): Promise<Usuario[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('farmaciaId', '==', farmaciaId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ uid: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting usuarios by farmacia:', error);
    throw error;
  }
};

// Obtener usuarios por empresa
export const getUsuariosByEmpresa = async (empresaId: string): Promise<Usuario[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('empresaId', '==', empresaId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ uid: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting usuarios by empresa:', error);
    throw error;
  }
};

// Obtener usuarios por rol
export const getUsuariosByRol = async (rol: string, farmaciaId?: string): Promise<Usuario[]> => {
  try {
    let q;
    if (farmaciaId) {
      q = query(
        collection(db, COLLECTION_NAME),
        where('rol', '==', rol),
        where('farmaciaId', '==', farmaciaId)
      );
    } else {
      q = query(collection(db, COLLECTION_NAME), where('rol', '==', rol));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ uid: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting usuarios by rol:', error);
    throw error;
  }
};

// Obtener un usuario por ID
export const getUsuarioById = async (uid: string): Promise<Usuario | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return convertTimestamps({ uid: docSnap.id, ...docSnap.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting usuario:', error);
    throw error;
  }
};

// Crear un nuevo usuario (solo datos en Firestore, no crea cuenta de Auth)
export const createUsuario = async (
  uid: string,
  usuario: Omit<Usuario, 'uid' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, uid), {
      ...usuario,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
    const docRef = doc(db, COLLECTION_NAME, uid);
    await updateDoc(docRef, {
      ...usuario,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating usuario:', error);
    throw error;
  }
};

// Eliminar un usuario (solo de Firestore, no elimina la cuenta de Auth)
export const deleteUsuario = async (uid: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting usuario:', error);
    throw error;
  }
};

// Buscar usuario por NIF
export const getUsuarioByNif = async (nif: string): Promise<Usuario | null> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('datosPersonales.nif', '==', nif));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return convertTimestamps({ uid: doc.id, ...doc.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting usuario by NIF:', error);
    throw error;
  }
};

// Buscar usuario por email
export const getUsuarioByEmail = async (email: string): Promise<Usuario | null> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('datosPersonales.email', '==', email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return convertTimestamps({ uid: doc.id, ...doc.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting usuario by email:', error);
    throw error;
  }
};
