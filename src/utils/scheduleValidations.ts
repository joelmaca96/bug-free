/**
 * Validaciones específicas para horarios de farmacia
 */

import { HorarioHabitual, JornadaGuardia } from '@/types';
import {
  horariosSeOverlapan,
  isValidDate,
  validarHorario,
  ValidacionHorario,
} from './dateTimeUtils';

// Validar horarios habituales de un día
export const validarHorariosHabitualesDia = (
  horarios: HorarioHabitual[],
  dia: number
): ValidacionHorario => {
  const errores: string[] = [];
  const horariosDelDia = horarios.filter((h) => h.dia === dia);

  if (horariosDelDia.length === 0) {
    // No es obligatorio tener horarios todos los días (puede estar cerrado)
    return { valido: true, errores: [] };
  }

  // Validar cada horario individualmente
  horariosDelDia.forEach((horario, index) => {
    const validacion = validarHorario(
      horario.inicio,
      horario.fin,
      `Horario ${index + 1}`
    );
    errores.push(...validacion.errores);
  });

  // Validar que no haya solapamientos entre horarios del mismo día
  for (let i = 0; i < horariosDelDia.length; i++) {
    for (let j = i + 1; j < horariosDelDia.length; j++) {
      const h1 = horariosDelDia[i];
      const h2 = horariosDelDia[j];

      if (horariosSeOverlapan(h1.inicio, h1.fin, h2.inicio, h2.fin)) {
        errores.push(
          `Los horarios ${h1.inicio}-${h1.fin} y ${h2.inicio}-${h2.fin} se solapan`
        );
      }
    }
  }

  return {
    valido: errores.length === 0,
    errores,
  };
};

// Validar todos los horarios habituales
export const validarTodosHorariosHabituales = (
  horarios: HorarioHabitual[]
): ValidacionHorario => {
  const errores: string[] = [];

  // Validar cada día
  for (let dia = 0; dia <= 6; dia++) {
    const validacion = validarHorariosHabitualesDia(horarios, dia);
    if (!validacion.valido) {
      const diaNombre = [
        'Domingo',
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
      ][dia];
      validacion.errores.forEach((error) => {
        errores.push(`${diaNombre}: ${error}`);
      });
    }
  }

  // Verificar que haya al menos un día con horarios
  if (horarios.length === 0) {
    errores.push('Debe configurar al menos un horario habitual');
  }

  return {
    valido: errores.length === 0,
    errores,
  };
};

// Validar jornadas de guardia
export const validarJornadasGuardia = (
  jornadas: JornadaGuardia[]
): ValidacionHorario => {
  const errores: string[] = [];

  if (jornadas.length === 0) {
    // No es obligatorio tener guardias
    return { valido: true, errores: [] };
  }

  // Validar cada jornada
  jornadas.forEach((jornada, index) => {
    // Validar fecha de inicio
    if (!isValidDate(jornada.fechaInicio)) {
      errores.push(`Guardia ${index + 1}: Fecha de inicio inválida`);
    }

    // Validar fecha de fin
    if (!isValidDate(jornada.fechaFin)) {
      errores.push(`Guardia ${index + 1}: Fecha de fin inválida`);
    }

    // Validar que la fecha/hora de fin sea posterior a la de inicio
    const fechaInicioMs = new Date(`${jornada.fechaInicio}T${jornada.horaInicio}`).getTime();
    const fechaFinMs = new Date(`${jornada.fechaFin}T${jornada.horaFin}`).getTime();

    if (fechaFinMs <= fechaInicioMs) {
      errores.push(
        `Guardia ${index + 1}: La fecha/hora de fin debe ser posterior a la de inicio`
      );
    }

    // Validar que la duración no sea excesiva (máximo 48 horas)
    const duracionHoras = (fechaFinMs - fechaInicioMs) / (1000 * 60 * 60);
    if (duracionHoras > 48) {
      errores.push(
        `Guardia ${index + 1}: La duración no puede exceder 48 horas (${duracionHoras.toFixed(1)}h)`
      );
    }
  });

  // Validar que no haya solapamientos entre guardias
  for (let i = 0; i < jornadas.length; i++) {
    for (let j = i + 1; j < jornadas.length; j++) {
      const g1 = jornadas[i];
      const g2 = jornadas[j];

      const g1InicioMs = new Date(`${g1.fechaInicio}T${g1.horaInicio}`).getTime();
      const g1FinMs = new Date(`${g1.fechaFin}T${g1.horaFin}`).getTime();
      const g2InicioMs = new Date(`${g2.fechaInicio}T${g2.horaInicio}`).getTime();
      const g2FinMs = new Date(`${g2.fechaFin}T${g2.horaFin}`).getTime();

      // Verificar solapamiento
      if (
        (g1InicioMs < g2FinMs && g1FinMs > g2InicioMs) ||
        (g2InicioMs < g1FinMs && g2FinMs > g1InicioMs)
      ) {
        errores.push(
          `Las guardias ${i + 1} y ${j + 1} se solapan en el tiempo`
        );
      }
    }
  }

  return {
    valido: errores.length === 0,
    errores,
  };
};

// Validar festivos regionales
export const validarFestivosRegionales = (
  festivos: string[]
): ValidacionHorario => {
  const errores: string[] = [];

  if (festivos.length === 0) {
    // No es obligatorio tener festivos
    return { valido: true, errores: [] };
  }

  // Validar cada festivo
  festivos.forEach((festivo, index) => {
    if (!isValidDate(festivo)) {
      errores.push(`Festivo ${index + 1}: Fecha inválida`);
    }
  });

  // Validar que no haya fechas duplicadas
  const festivosDuplicados = festivos.filter(
    (festivo, index) => festivos.indexOf(festivo) !== index
  );

  if (festivosDuplicados.length > 0) {
    errores.push(
      `Fechas duplicadas en festivos: ${festivosDuplicados.join(', ')}`
    );
  }

  return {
    valido: errores.length === 0,
    errores,
  };
};

// Validar trabajadores mínimos
export const validarTrabajadoresMinimos = (
  trabajadoresMinimos: number
): ValidacionHorario => {
  const errores: string[] = [];

  if (trabajadoresMinimos < 1) {
    errores.push('Debe haber al menos 1 trabajador mínimo');
  }

  if (trabajadoresMinimos > 50) {
    errores.push('El número de trabajadores mínimos no puede exceder 50');
  }

  if (!Number.isInteger(trabajadoresMinimos)) {
    errores.push('El número de trabajadores mínimos debe ser un número entero');
  }

  return {
    valido: errores.length === 0,
    errores,
  };
};

// Validar configuración completa de farmacia
export interface ValidacionConfiguracion {
  valido: boolean;
  errores: {
    horariosHabituales: string[];
    jornadasGuardia: string[];
    festivosRegionales: string[];
    trabajadoresMinimos: string[];
  };
}

export const validarConfiguracionFarmacia = (config: {
  horariosHabituales: HorarioHabitual[];
  jornadasGuardia: JornadaGuardia[];
  festivosRegionales: string[];
  trabajadoresMinimos: number;
}): ValidacionConfiguracion => {
  const validacionHorarios = validarTodosHorariosHabituales(
    config.horariosHabituales
  );
  const validacionGuardias = validarJornadasGuardia(config.jornadasGuardia);
  const validacionFestivos = validarFestivosRegionales(
    config.festivosRegionales
  );
  const validacionTrabajadores = validarTrabajadoresMinimos(
    config.trabajadoresMinimos
  );

  return {
    valido:
      validacionHorarios.valido &&
      validacionGuardias.valido &&
      validacionFestivos.valido &&
      validacionTrabajadores.valido,
    errores: {
      horariosHabituales: validacionHorarios.errores,
      jornadasGuardia: validacionGuardias.errores,
      festivosRegionales: validacionFestivos.errores,
      trabajadoresMinimos: validacionTrabajadores.errores,
    },
  };
};
