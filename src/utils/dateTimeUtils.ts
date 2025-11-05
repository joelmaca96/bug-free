/**
 * Utilidades para manejo de fechas y horarios
 */

import { format, isValid, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

// Días de la semana
export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

// Formatear hora en formato HH:mm
export const formatTime = (time: string): string => {
  if (!time) return '';
  // Si ya está en formato correcto, devolverlo
  if (/^\d{2}:\d{2}$/.test(time)) return time;

  // Si es un número, convertirlo a HH:mm
  const num = parseInt(time);
  if (!isNaN(num)) {
    const hours = Math.floor(num);
    const minutes = Math.round((num - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  return time;
};

// Convertir hora HH:mm a número decimal
export const timeToDecimal = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
};

// Validar formato de hora HH:mm
export const isValidTimeFormat = (time: string): boolean => {
  if (!time) return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

// Validar que hora inicio sea antes que hora fin
export const isStartBeforeEnd = (inicio: string, fin: string): boolean => {
  if (!isValidTimeFormat(inicio) || !isValidTimeFormat(fin)) return false;
  return timeToDecimal(inicio) < timeToDecimal(fin);
};

// Calcular duración en horas entre dos horarios
export const calcularDuracion = (inicio: string, fin: string): number => {
  if (!isValidTimeFormat(inicio) || !isValidTimeFormat(fin)) return 0;
  const inicioDecimal = timeToDecimal(inicio);
  const finDecimal = timeToDecimal(fin);

  if (finDecimal < inicioDecimal) {
    // Si el fin es menor que inicio, asumimos que cruza medianoche
    return 24 - inicioDecimal + finDecimal;
  }

  return finDecimal - inicioDecimal;
};

// Verificar si dos horarios se solapan
export const horariosSeOverlapan = (
  inicio1: string,
  fin1: string,
  inicio2: string,
  fin2: string
): boolean => {
  if (
    !isValidTimeFormat(inicio1) ||
    !isValidTimeFormat(fin1) ||
    !isValidTimeFormat(inicio2) ||
    !isValidTimeFormat(fin2)
  ) {
    return false;
  }

  const start1 = timeToDecimal(inicio1);
  const end1 = timeToDecimal(fin1);
  const start2 = timeToDecimal(inicio2);
  const end2 = timeToDecimal(fin2);

  return start1 < end2 && start2 < end1;
};

// Formatear fecha para display (ej: "15 de enero de 2024")
export const formatDateDisplay = (date: string | Date): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return format(dateObj, "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return '';
  }
};

// Formatear fecha para input (ej: "2024-01-15")
export const formatDateInput = (date: string | Date): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return format(dateObj, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

// Validar que una fecha sea válida
export const isValidDate = (date: string): boolean => {
  if (!date) return false;
  try {
    const dateObj = parseISO(date);
    return isValid(dateObj);
  } catch {
    return false;
  }
};

// Obtener nombre del día de la semana
export const getDayName = (dayNumber: number): string => {
  const day = DIAS_SEMANA.find((d) => d.value === dayNumber);
  return day ? day.label : '';
};

// Validar que una fecha no sea pasada
export const isNotPastDate = (date: string): boolean => {
  try {
    const dateObj = parseISO(date);
    const today = startOfDay(new Date());
    return dateObj >= today;
  } catch {
    return false;
  }
};

// Generar array de horas para selector (00:00 a 23:30 cada 30 min)
export const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push(timeStr);
    }
  }
  options.push('23:59');
  return options;
};

// Validar horario completo (inicio, fin, coherencia)
export interface ValidacionHorario {
  valido: boolean;
  errores: string[];
}

export const validarHorario = (
  inicio: string,
  fin: string,
  label: string = 'Horario'
): ValidacionHorario => {
  const errores: string[] = [];

  if (!inicio || !fin) {
    errores.push(`${label}: Debe especificar hora de inicio y fin`);
    return { valido: false, errores };
  }

  if (!isValidTimeFormat(inicio)) {
    errores.push(`${label}: Formato de hora de inicio inválido (use HH:mm)`);
  }

  if (!isValidTimeFormat(fin)) {
    errores.push(`${label}: Formato de hora de fin inválido (use HH:mm)`);
  }

  if (errores.length === 0 && !isStartBeforeEnd(inicio, fin)) {
    errores.push(`${label}: La hora de inicio debe ser anterior a la hora de fin`);
  }

  const duracion = calcularDuracion(inicio, fin);
  if (duracion < 0.5) {
    errores.push(`${label}: La duración mínima debe ser de 30 minutos`);
  }

  if (duracion > 24) {
    errores.push(`${label}: La duración no puede exceder 24 horas`);
  }

  return {
    valido: errores.length === 0,
    errores,
  };
};
