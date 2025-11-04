/**
 * Validaciones para formularios de empleados
 */

// Validar NIF/NIE español
export const validateNIF = (nif: string): boolean => {
  if (!nif) return false;

  const nifRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;
  const nieRegex = /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;

  const nifUpper = nif.toUpperCase().replace(/\s/g, '');

  if (!nifRegex.test(nifUpper) && !nieRegex.test(nifUpper)) {
    return false;
  }

  // Calcular letra de control
  const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
  let numero: number;

  if (nieRegex.test(nifUpper)) {
    // NIE: reemplazar X, Y, Z por 0, 1, 2
    const nieMap: { [key: string]: string } = { X: '0', Y: '1', Z: '2' };
    numero = parseInt(nieMap[nifUpper[0]] + nifUpper.substring(1, 8));
  } else {
    // NIF
    numero = parseInt(nifUpper.substring(0, 8));
  }

  const letraCalculada = letras[numero % 23];
  const letraProporcionada = nifUpper[nifUpper.length - 1];

  return letraCalculada === letraProporcionada;
};

// Validar email
export const validateEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validar teléfono español (móvil y fijo)
export const validatePhone = (phone: string): boolean => {
  if (!phone) return false;

  // Limpiar espacios, guiones y paréntesis
  const cleanPhone = phone.replace(/[\s\-()]/g, '');

  // Formato español: 9 dígitos que comienzan con 6, 7, 8 o 9
  const mobileRegex = /^[6-9]\d{8}$/;

  // También aceptar formato con prefijo +34
  const mobileWithPrefixRegex = /^(\+34)?[6-9]\d{8}$/;

  return mobileRegex.test(cleanPhone) || mobileWithPrefixRegex.test(cleanPhone);
};

// Validar que un número esté dentro de un rango
export const validateRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

// Validar que un campo no esté vacío
export const validateRequired = (value: string | number): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

// Validar nombre (solo letras, espacios, guiones y acentos)
export const validateName = (name: string): boolean => {
  if (!name) return false;
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-']+$/;
  return nameRegex.test(name) && name.trim().length >= 2;
};

// Mensajes de error
export const validationMessages = {
  nif: 'NIF/NIE inválido',
  email: 'Email inválido',
  phone: 'Teléfono inválido (formato: 6XXXXXXXX o +34 6XXXXXXXX)',
  required: 'Este campo es obligatorio',
  name: 'Nombre inválido (mínimo 2 caracteres, solo letras)',
  minValue: (min: number) => `El valor mínimo es ${min}`,
  maxValue: (max: number) => `El valor máximo es ${max}`,
  range: (min: number, max: number) => `El valor debe estar entre ${min} y ${max}`,
};

// Validar restricciones horarias
export const validateRestricciones = (restricciones: {
  horasMaximasDiarias: number;
  horasMaximasSemanales: number;
  horasMaximasMensuales: number;
  horasMaximasAnuales: number;
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validar valores lógicos
  if (restricciones.horasMaximasDiarias > 24) {
    errors.push('Las horas máximas diarias no pueden superar 24');
  }

  if (restricciones.horasMaximasSemanales > 168) {
    errors.push('Las horas máximas semanales no pueden superar 168 (7 días x 24 horas)');
  }

  if (restricciones.horasMaximasMensuales < restricciones.horasMaximasSemanales * 4) {
    errors.push('Las horas máximas mensuales deben ser al menos 4 veces las semanales');
  }

  if (restricciones.horasMaximasAnuales < restricciones.horasMaximasMensuales * 12) {
    errors.push('Las horas máximas anuales deben ser al menos 12 veces las mensuales');
  }

  // Validar que sean números positivos
  Object.entries(restricciones).forEach(([key, value]) => {
    if (value < 0) {
      errors.push(`${key} no puede ser negativo`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};
