/**
 * Script de migración para convertir guardias del formato antiguo al nuevo
 *
 * Formato antiguo:
 * {
 *   fecha: "2024-01-15",
 *   inicio: "20:00",
 *   fin: "09:00"
 * }
 *
 * Formato nuevo:
 * {
 *   fechaInicio: "2024-01-15",
 *   horaInicio: "20:00",
 *   fechaFin: "2024-01-16",
 *   horaFin: "09:00"
 * }
 */

interface JornadaGuardiaAntigua {
  fecha: string;
  inicio: string;
  fin: string;
}

interface JornadaGuardiaNueva {
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string;
  horaFin: string;
}

/**
 * Convierte una guardia del formato antiguo al nuevo
 * Si la hora de fin es menor que la de inicio, asume que cruza medianoche
 */
export function migrarGuardia(guardiaAntigua: JornadaGuardiaAntigua): JornadaGuardiaNueva {
  const { fecha, inicio, fin } = guardiaAntigua;

  // Parsear horas
  const [horaInicio] = inicio.split(':').map(Number);
  const [horaFin] = fin.split(':').map(Number);

  // Si la hora de fin es menor o igual que la de inicio, asumimos que cruza medianoche
  const cruzaMedianoche = horaFin <= horaInicio;

  let fechaFin = fecha;
  if (cruzaMedianoche) {
    // Agregar un día a la fecha de fin
    const date = new Date(fecha);
    date.setDate(date.getDate() + 1);
    fechaFin = date.toISOString().split('T')[0];
  }

  return {
    fechaInicio: fecha,
    horaInicio: inicio,
    fechaFin: fechaFin,
    horaFin: fin,
  };
}

/**
 * Convierte un array de guardias del formato antiguo al nuevo
 */
export function migrarGuardias(guardiasAntiguas: JornadaGuardiaAntigua[]): JornadaGuardiaNueva[] {
  return guardiasAntiguas.map(migrarGuardia);
}

/**
 * Detecta si una guardia está en formato antiguo
 */
export function esFormatoAntiguo(guardia: any): guardia is JornadaGuardiaAntigua {
  return (
    typeof guardia === 'object' &&
    'fecha' in guardia &&
    'inicio' in guardia &&
    'fin' in guardia &&
    !('fechaInicio' in guardia)
  );
}

/**
 * Detecta si una guardia está en formato nuevo
 */
export function esFormatoNuevo(guardia: any): guardia is JornadaGuardiaNueva {
  return (
    typeof guardia === 'object' &&
    'fechaInicio' in guardia &&
    'horaInicio' in guardia &&
    'fechaFin' in guardia &&
    'horaFin' in guardia
  );
}

/**
 * Migra automáticamente guardias si detecta formato antiguo
 */
export function migrarSiEsNecesario(guardias: any[]): JornadaGuardiaNueva[] {
  if (guardias.length === 0) {
    return [];
  }

  // Verificar el primer elemento para determinar el formato
  if (esFormatoAntiguo(guardias[0])) {
    console.log('Detectado formato antiguo de guardias, migrando...');
    return migrarGuardias(guardias as JornadaGuardiaAntigua[]);
  }

  if (esFormatoNuevo(guardias[0])) {
    return guardias as JornadaGuardiaNueva[];
  }

  console.warn('Formato de guardias no reconocido');
  return [];
}
