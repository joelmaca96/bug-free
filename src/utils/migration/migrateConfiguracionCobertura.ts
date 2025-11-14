/**
 * Script de migración para convertir configuración de trabajadoresMinimos global
 * a configuraciones de cobertura por franjas horarias
 */

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Farmacia, ConfiguracionCobertura, HorarioHabitual } from '@/types';

// Generar ID único
const generateId = () => {
  return `cob-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Agrupa horarios habituales por patrón de días y horas
 * para crear configuraciones de cobertura eficientes
 */
const agruparHorariosPorPatron = (
  horarios: HorarioHabitual[]
): Array<{
  dias: number[];
  horaInicio: number;
  horaFin: number;
  nombre: string;
}> => {
  // Mapear horarios por patrón de horas
  const patronesMap = new Map<
    string,
    { dias: Set<number>; horaInicio: number; horaFin: number }
  >();

  horarios.forEach((horario) => {
    const horaInicio = parseInt(horario.inicio.split(':')[0]);
    const horaFin = parseInt(horario.fin.split(':')[0]);
    const horaFinMinutos = parseInt(horario.fin.split(':')[1]);

    // Ajustar horaFin si tiene minutos (ej: 13:30 -> 14)
    const horaFinAjustada = horaFinMinutos > 0 ? horaFin + 1 : horaFin;

    const patron = `${horaInicio}-${horaFinAjustada}`;

    if (!patronesMap.has(patron)) {
      patronesMap.set(patron, {
        dias: new Set([horario.dia]),
        horaInicio,
        horaFin: horaFinAjustada,
      });
    } else {
      patronesMap.get(patron)!.dias.add(horario.dia);
    }
  });

  // Convertir a array y generar nombres
  const nombresDias = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];

  const getNombreDias = (dias: number[]): string => {
    if (dias.length === 7) return 'Todos los días';

    const laborables = [1, 2, 3, 4, 5];
    const finDeSemana = [0, 6];

    if (
      laborables.every((d) => dias.includes(d)) &&
      dias.length === 5
    ) {
      return 'Lunes a Viernes';
    }

    if (
      finDeSemana.every((d) => dias.includes(d)) &&
      dias.length === 2
    ) {
      return 'Fin de semana';
    }

    if (dias.length === 1) {
      return nombresDias[dias[0]];
    }

    // Para otros casos, mostrar los días
    return dias.map((d) => nombresDias[d]).join(', ');
  };

  return Array.from(patronesMap.values()).map((patron) => {
    const diasArray = Array.from(patron.dias).sort((a, b) => a - b);
    const nombreDias = getNombreDias(diasArray);
    const nombreHora = `${String(patron.horaInicio).padStart(2, '0')}:00-${String(patron.horaFin).padStart(2, '0')}:00`;

    return {
      dias: diasArray,
      horaInicio: patron.horaInicio,
      horaFin: patron.horaFin,
      nombre: `${nombreDias} ${nombreHora}`,
    };
  });
};

/**
 * Migra una farmacia específica de trabajadoresMinimos global a configuraciones por franja
 */
export const migrarFarmacia = async (
  farmaciaId: string,
  forzar: boolean = false
): Promise<boolean> => {
  try {
    const farmaciaRef = doc(db, 'farmacias', farmaciaId);
    const farmaciaSnap = await getDoc(farmaciaRef);

    if (!farmaciaSnap.exists()) {
      console.warn(`Farmacia ${farmaciaId} no encontrada`);
      return false;
    }

    const farmacia = farmaciaSnap.data() as Farmacia;
    const configuracion = farmacia.configuracion;

    // Verificar si ya tiene configuraciones de cobertura
    if (
      configuracion.configuracionesCobertura &&
      configuracion.configuracionesCobertura.length > 0 &&
      !forzar
    ) {
      console.log(`Farmacia ${farmaciaId} ya tiene configuraciones de cobertura`);
      return false;
    }

    // Si no hay horarios habituales, no hay nada que migrar
    if (
      !configuracion.horariosHabituales ||
      configuracion.horariosHabituales.length === 0
    ) {
      console.log(`Farmacia ${farmaciaId} no tiene horarios habituales definidos`);
      return false;
    }

    // Obtener el valor de trabajadores mínimos
    const trabajadoresMinimos = configuracion.trabajadoresMinimos || 1;

    // Agrupar horarios por patrón
    const patrones = agruparHorariosPorPatron(configuracion.horariosHabituales);

    // Crear configuraciones de cobertura
    const configuracionesCobertura: ConfiguracionCobertura[] = patrones.map(
      (patron) => ({
        id: generateId(),
        diasSemana: patron.dias,
        horaInicio: patron.horaInicio,
        horaFin: patron.horaFin,
        trabajadoresMinimos: trabajadoresMinimos,
        nombre: patron.nombre,
      })
    );

    // Actualizar farmacia
    await updateDoc(farmaciaRef, {
      'configuracion.configuracionesCobertura': configuracionesCobertura,
    });

    console.log(
      `Farmacia ${farmaciaId} migrada exitosamente. ${configuracionesCobertura.length} configuraciones creadas.`
    );
    return true;
  } catch (error) {
    console.error(`Error migrando farmacia ${farmaciaId}:`, error);
    return false;
  }
};

/**
 * Migra todas las farmacias de una empresa
 */
export const migrarEmpresa = async (
  empresaId: string,
  forzar: boolean = false
): Promise<{
  total: number;
  migradas: number;
  errores: number;
}> => {
  try {
    const farmaciasRef = collection(db, 'farmacias');
    const farmaciasSnap = await getDocs(farmaciasRef);

    const farmaciasEmpresa = farmaciasSnap.docs.filter(
      (doc) => doc.data().empresaId === empresaId
    );

    let migradas = 0;
    let errores = 0;

    for (const farmaciaDoc of farmaciasEmpresa) {
      try {
        const resultado = await migrarFarmacia(farmaciaDoc.id, forzar);
        if (resultado) {
          migradas++;
        }
      } catch (error) {
        console.error(`Error migrando farmacia ${farmaciaDoc.id}:`, error);
        errores++;
      }
    }

    console.log(
      `Migración de empresa ${empresaId} completada: ${migradas} farmacias migradas, ${errores} errores`
    );

    return {
      total: farmaciasEmpresa.length,
      migradas,
      errores,
    };
  } catch (error) {
    console.error(`Error migrando empresa ${empresaId}:`, error);
    throw error;
  }
};

/**
 * Migra todas las farmacias del sistema
 */
export const migrarTodasLasFarmacias = async (
  forzar: boolean = false
): Promise<{
  total: number;
  migradas: number;
  errores: number;
}> => {
  try {
    const farmaciasRef = collection(db, 'farmacias');
    const farmaciasSnap = await getDocs(farmaciasRef);

    let migradas = 0;
    let errores = 0;

    for (const farmaciaDoc of farmaciasSnap.docs) {
      try {
        const resultado = await migrarFarmacia(farmaciaDoc.id, forzar);
        if (resultado) {
          migradas++;
        }
      } catch (error) {
        console.error(`Error migrando farmacia ${farmaciaDoc.id}:`, error);
        errores++;
      }
    }

    console.log(
      `Migración global completada: ${migradas} farmacias migradas de ${farmaciasSnap.docs.length} totales, ${errores} errores`
    );

    return {
      total: farmaciasSnap.docs.length,
      migradas,
      errores,
    };
  } catch (error) {
    console.error('Error en migración global:', error);
    throw error;
  }
};

/**
 * Revierte la migración de una farmacia (elimina configuraciones de cobertura)
 */
export const revertirMigracion = async (
  farmaciaId: string
): Promise<boolean> => {
  try {
    const farmaciaRef = doc(db, 'farmacias', farmaciaId);

    await updateDoc(farmaciaRef, {
      'configuracion.configuracionesCobertura': [],
    });

    console.log(`Migración revertida para farmacia ${farmaciaId}`);
    return true;
  } catch (error) {
    console.error(`Error revirtiendo migración de farmacia ${farmaciaId}:`, error);
    return false;
  }
};
