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
import { Farmacia } from '@/types';

const COLLECTION_NAME = 'farmacias';

// Convertir timestamp de Firestore a Date
const convertTimestamps = (data: any): Farmacia => {
  return {
    ...data,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
  };
};

// Obtener todas las farmacias
export const getFarmacias = async (): Promise<Farmacia[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ id: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting farmacias:', error);
    throw error;
  }
};

// Obtener farmacias por empresa
export const getFarmaciasByEmpresa = async (empresaId: string): Promise<Farmacia[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('empresaId', '==', empresaId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) =>
      convertTimestamps({ id: doc.id, ...doc.data() })
    );
  } catch (error) {
    console.error('Error getting farmacias by empresa:', error);
    throw error;
  }
};

// Obtener una farmacia por ID
export const getFarmaciaById = async (id: string): Promise<Farmacia | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return convertTimestamps({ id: docSnap.id, ...docSnap.data() });
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), farmaciaData);
    return docRef.id;
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
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...farmacia,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating farmacia:', error);
    throw error;
  }
};

// Eliminar una farmacia
export const deleteFarmacia = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting farmacia:', error);
    throw error;
  }
};

// Buscar farmacia por CIF
export const getFarmaciaByCif = async (cif: string): Promise<Farmacia | null> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('cif', '==', cif));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return convertTimestamps({ id: doc.id, ...doc.data() });
    }

    return null;
  } catch (error) {
    console.error('Error getting farmacia by CIF:', error);
    throw error;
  }
};
