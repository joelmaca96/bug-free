/**
 * Validaciones específicas para horarios de farmacia
 */

import { HorarioHabitual, JornadaGuardia, ConfiguracionCobertura } from '@/types';
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

// Validar configuraciones de cobertura por franjas horarias
export const validarConfiguracionesCobertura = (
  configuraciones: ConfiguracionCobertura[]
): ValidacionHorario => {
  const errores: string[] = [];

  if (configuraciones.length === 0) {
    // No es obligatorio tener configuraciones (usar trabajadoresMinimos global)
    return { valido: true, errores: [] };
  }

  // Nombres de días para mensajes
  const nombresDias = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];

  // Validar cada configuración individualmente
  configuraciones.forEach((config, index) => {
    // Validar que tenga al menos un día seleccionado
    if (!config.diasSemana || config.diasSemana.length === 0) {
      errores.push(
        `Configuración ${index + 1} (${config.nombre || 'sin nombre'}): Debe seleccionar al menos un día`
      );
    }

    // Validar que los días estén en el rango válido
    config.diasSemana?.forEach((dia) => {
      if (dia < 0 || dia > 6) {
        errores.push(
          `Configuración ${index + 1} (${config.nombre || 'sin nombre'}): Día inválido (${dia}). Debe estar entre 0-6`
        );
      }
    });

    // Validar que horaInicio < horaFin
    if (config.horaInicio >= config.horaFin) {
      errores.push(
        `Configuración ${index + 1} (${config.nombre || 'sin nombre'}): La hora de inicio (${config.horaInicio}:00) debe ser menor que la hora de fin (${config.horaFin}:00)`
      );
    }

    // Validar que las horas estén en el rango válido
    if (config.horaInicio < 0 || config.horaInicio > 23) {
      errores.push(
        `Configuración ${index + 1} (${config.nombre || 'sin nombre'}): Hora de inicio inválida (${config.horaInicio}). Debe estar entre 0-23`
      );
    }

    if (config.horaFin < 1 || config.horaFin > 24) {
      errores.push(
        `Configuración ${index + 1} (${config.nombre || 'sin nombre'}): Hora de fin inválida (${config.horaFin}). Debe estar entre 1-24`
      );
    }

    // Validar trabajadores mínimos
    if (config.trabajadoresMinimos < 1) {
      errores.push(
        `Configuración ${index + 1} (${config.nombre || 'sin nombre'}): Debe haber al menos 1 trabajador mínimo`
      );
    }

    if (config.trabajadoresMinimos > 50) {
      errores.push(
        `Configuración ${index + 1} (${config.nombre || 'sin nombre'}): El número de trabajadores mínimos no puede exceder 50`
      );
    }

    if (!Number.isInteger(config.trabajadoresMinimos)) {
      errores.push(
        `Configuración ${index + 1} (${config.nombre || 'sin nombre'}): El número de trabajadores mínimos debe ser un número entero`
      );
    }
  });

  // Validar que no haya solapamientos entre configuraciones
  for (let i = 0; i < configuraciones.length; i++) {
    for (let j = i + 1; j < configuraciones.length; j++) {
      const c1 = configuraciones[i];
      const c2 = configuraciones[j];

      // Verificar si hay días en común
      const diasComunes = c1.diasSemana.filter((dia) =>
        c2.diasSemana.includes(dia)
      );

      if (diasComunes.length > 0) {
        // Verificar si hay solapamiento de horarios
        const horasSolapan =
          (c1.horaInicio < c2.horaFin && c1.horaFin > c2.horaInicio) ||
          (c2.horaInicio < c1.horaFin && c2.horaFin > c1.horaInicio);

        if (horasSolapan) {
          const diasStr = diasComunes
            .map((dia) => nombresDias[dia])
            .join(', ');
          errores.push(
            `Solapamiento detectado entre "${c1.nombre || 'Configuración ' + (i + 1)}" y "${c2.nombre || 'Configuración ' + (j + 1)}" en ${diasStr} (${c1.horaInicio}:00-${c1.horaFin}:00 y ${c2.horaInicio}:00-${c2.horaFin}:00)`
          );
        }
      }
    }
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
    jornadasGuardia: string[];
    festivosRegionales: string[];
    trabajadoresMinimos: string[];
    configuracionesCobertura: string[];
  };
}

export const validarConfiguracionFarmacia = (config: {
  jornadasGuardia: JornadaGuardia[];
  festivosRegionales: string[];
  trabajadoresMinimos: number;
  configuracionesCobertura: ConfiguracionCobertura[];
}): ValidacionConfiguracion => {
  const validacionGuardias = validarJornadasGuardia(config.jornadasGuardia);
  const validacionFestivos = validarFestivosRegionales(
    config.festivosRegionales
  );
  const validacionTrabajadores = validarTrabajadoresMinimos(
    config.trabajadoresMinimos
  );
  const validacionConfiguraciones = validarConfiguracionesCobertura(
    config.configuracionesCobertura
  );

  return {
    valido:
      validacionGuardias.valido &&
      validacionFestivos.valido &&
      validacionTrabajadores.valido &&
      validacionConfiguraciones.valido,
    errores: {
      jornadasGuardia: validacionGuardias.errores,
      festivosRegionales: validacionFestivos.errores,
      trabajadoresMinimos: validacionTrabajadores.errores,
      configuracionesCobertura: validacionConfiguraciones.errores,
    },
  };
};
