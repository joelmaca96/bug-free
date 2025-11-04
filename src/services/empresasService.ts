import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Empresa } from '@/types';

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
