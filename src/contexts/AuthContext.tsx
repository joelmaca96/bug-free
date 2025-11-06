import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/services/firebase';
import { getUsuarioById, createUsuario } from '@/services/usuariosRealtimeService';
import { Usuario, AuthContextType } from '@/types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar datos del usuario desde Realtime Database
  const loadUserData = async (firebaseUser: FirebaseUser): Promise<Usuario | null> => {
    try {
      const userData = await getUsuarioById(firebaseUser.uid);
      return userData;
    } catch (error) {
      console.error('Error loading user data:', error);
      return null;
    }
  };

  // Escuchar cambios en la autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await loadUserData(firebaseUser);
        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign in con email/password
  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await loadUserData(userCredential.user);

      if (!userData) {
        throw new Error('Usuario no encontrado en la base de datos');
      }

      setUser(userData);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  // Sign up con email/password
  const signUp = async (
    email: string,
    password: string,
    userData: Partial<Usuario>
  ) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Crear documento de usuario en Realtime Database
      const newUser: Omit<Usuario, 'uid' | 'createdAt' | 'updatedAt'> = {
        datosPersonales: userData.datosPersonales || {
          nombre: '',
          apellidos: '',
          nif: '',
          email: email,
          telefono: '',
        },
        rol: userData.rol || 'empleado',
        farmaciaId: userData.farmaciaId || '',
        empresaId: userData.empresaId || '',
        restricciones: userData.restricciones || {
          horasMaximasDiarias: 10,
          horasMaximasSemanales: 40,
          horasMaximasMensuales: 160,
          horasMaximasAnuales: 1920,
          diasFestivos: [],
        },
      };

      await createUsuario(userCredential.user.uid, newUser);

      setUser({
        uid: userCredential.user.uid,
        ...newUser,
      });
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  // Sign in con Google
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);

      // Verificar si el usuario ya existe
      let userData = await loadUserData(userCredential.user);

      // Si no existe, crear un nuevo usuario con datos básicos
      if (!userData) {
        const newUser: Omit<Usuario, 'uid' | 'createdAt' | 'updatedAt'> = {
          datosPersonales: {
            nombre: userCredential.user.displayName?.split(' ')[0] || '',
            apellidos: userCredential.user.displayName?.split(' ').slice(1).join(' ') || '',
            nif: '',
            email: userCredential.user.email || '',
            telefono: '',
          },
          rol: 'empleado',
          farmaciaId: '',
          empresaId: '',
          restricciones: {
            horasMaximasDiarias: 10,
            horasMaximasSemanales: 40,
            horasMaximasMensuales: 160,
            horasMaximasAnuales: 1920,
            diasFestivos: [],
          },
        };

        await createUsuario(userCredential.user.uid, newUser);

        userData = {
          uid: userCredential.user.uid,
          ...newUser,
        };
      }

      setUser(userData);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  // Sign in con Apple
  const signInWithApple = async () => {
    try {
      const provider = new OAuthProvider('apple.com');
      const userCredential = await signInWithPopup(auth, provider);

      // Verificar si el usuario ya existe
      let userData = await loadUserData(userCredential.user);

      // Si no existe, crear un nuevo usuario con datos básicos
      if (!userData) {
        const newUser: Omit<Usuario, 'uid' | 'createdAt' | 'updatedAt'> = {
          datosPersonales: {
            nombre: userCredential.user.displayName?.split(' ')[0] || '',
            apellidos: userCredential.user.displayName?.split(' ').slice(1).join(' ') || '',
            nif: '',
            email: userCredential.user.email || '',
            telefono: '',
          },
          rol: 'empleado',
          farmaciaId: '',
          empresaId: '',
          restricciones: {
            horasMaximasDiarias: 10,
            horasMaximasSemanales: 40,
            horasMaximasMensuales: 160,
            horasMaximasAnuales: 1920,
            diasFestivos: [],
          },
        };

        await createUsuario(userCredential.user.uid, newUser);

        userData = {
          uid: userCredential.user.uid,
          ...newUser,
        };
      }

      setUser(userData);
    } catch (error) {
      console.error('Error signing in with Apple:', error);
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithApple,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
