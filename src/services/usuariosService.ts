import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, functions, auth } from './firebase';
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

// Obtener usuarios por empresa (excluyendo superusers)
export const getUsuariosByEmpresa = async (empresaId: string, excludeSuperusers = false): Promise<Usuario[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('empresaId', '==', empresaId));
    const querySnapshot = await getDocs(q);
    let usuarios = querySnapshot.docs.map((doc) =>
      convertTimestamps({ uid: doc.id, ...doc.data() })
    );

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

// Obtener usuarios disponibles para ser asignados como admin (usuarios con rol admin sin empresa asignada)
export const getAdminsDisponibles = async (): Promise<Usuario[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('rol', '==', 'admin'));
    const querySnapshot = await getDocs(q);
    const admins = querySnapshot.docs.map((doc) =>
      convertTimestamps({ uid: doc.id, ...doc.data() })
    );

    // Filtrar solo los que no tienen empresaId o tienen un empresaId vacío
    return admins.filter(admin => !admin.empresaId || admin.empresaId === '');
  } catch (error) {
    console.error('Error getting admins disponibles:', error);
    throw error;
  }
};

// Crear un nuevo usuario completo (Auth + Firestore)
// IMPORTANTE: Solo debe ser usado por SuperUser o Admin con permisos especiales
export const createUsuarioComplete = async (
  email: string,
  password: string,
  userData: Omit<Usuario, 'uid' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Crear documento en Firestore
    const newUser: Usuario = {
      uid,
      ...userData,
    };

    await setDoc(doc(db, COLLECTION_NAME, uid), {
      ...newUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return uid;
  } catch (error) {
    console.error('Error creating usuario complete:', error);
    throw error;
  }
};
