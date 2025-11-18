import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Turno, Usuario, Farmacia } from '@/types';

/**
 * Servicio para generación de reportes en PDF y Excel
 */

// Configuración de estilos para PDF
const PDF_CONFIG = {
  marginLeft: 20,
  marginTop: 20,
  marginRight: 20,
  lineHeight: 7,
  fontSize: {
    title: 18,
    subtitle: 14,
    normal: 10,
    small: 8,
  },
};

/**
 * Generar reporte PDF de horario de un empleado
 */
export const generarPDFEmpleado = (
  empleado: Usuario,
  turnos: Turno[],
  farmacia: Farmacia,
  fechaInicio: string,
  fechaFin: string
): Blob => {
  const doc = new jsPDF();

  let yPosition = PDF_CONFIG.marginTop;

  // Título
  doc.setFontSize(PDF_CONFIG.fontSize.title);
  doc.text('Horario de Trabajo', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 2;

  // Información del empleado
  doc.setFontSize(PDF_CONFIG.fontSize.subtitle);
  doc.text(
    `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}`,
    PDF_CONFIG.marginLeft,
    yPosition
  );
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFontSize(PDF_CONFIG.fontSize.normal);
  doc.text(`NIF: ${empleado.datosPersonales.nif}`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.text(`Farmacia: ${farmacia.nombre}`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.text(
    `Período: ${format(new Date(fechaInicio), 'dd/MM/yyyy', { locale: es })} - ${format(new Date(fechaFin), 'dd/MM/yyyy', { locale: es })}`,
    PDF_CONFIG.marginLeft,
    yPosition
  );
  yPosition += PDF_CONFIG.lineHeight * 2;

  // Línea divisoria
  doc.line(PDF_CONFIG.marginLeft, yPosition, 190, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  // Tabla de turnos
  doc.setFontSize(PDF_CONFIG.fontSize.subtitle);
  doc.text('Turnos Asignados', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 1.5;

  // Headers de tabla
  doc.setFontSize(PDF_CONFIG.fontSize.normal);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha', PDF_CONFIG.marginLeft, yPosition);
  doc.text('Día', PDF_CONFIG.marginLeft + 35, yPosition);
  doc.text('Entrada', PDF_CONFIG.marginLeft + 65, yPosition);
  doc.text('Salida', PDF_CONFIG.marginLeft + 95, yPosition);
  doc.text('Horas', PDF_CONFIG.marginLeft + 120, yPosition);
  doc.text('Tipo', PDF_CONFIG.marginLeft + 145, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont('helvetica', 'normal');

  // Ordenar turnos por fecha
  const turnosOrdenados = [...turnos].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Datos de turnos
  turnosOrdenados.forEach((turno) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = PDF_CONFIG.marginTop;
    }

    const fecha = new Date(turno.fecha);
    const diaSemana = format(fecha, 'EEEE', { locale: es });
    const horas = turno.horaFin - turno.horaInicio;

    doc.text(format(fecha, 'dd/MM/yyyy'), PDF_CONFIG.marginLeft, yPosition);
    doc.text(diaSemana.substring(0, 3).toUpperCase(), PDF_CONFIG.marginLeft + 35, yPosition);
    doc.text(`${String(turno.horaInicio).padStart(2, '0')}:00`, PDF_CONFIG.marginLeft + 65, yPosition);
    doc.text(`${String(turno.horaFin).padStart(2, '0')}:00`, PDF_CONFIG.marginLeft + 95, yPosition);
    doc.text(`${horas}h`, PDF_CONFIG.marginLeft + 120, yPosition);
    doc.text(turno.tipo.charAt(0).toUpperCase() + turno.tipo.slice(1), PDF_CONFIG.marginLeft + 145, yPosition);
    yPosition += PDF_CONFIG.lineHeight;
  });

  // Resumen y Estadísticas
  yPosition += PDF_CONFIG.lineHeight;
  doc.line(PDF_CONFIG.marginLeft, yPosition, 190, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_CONFIG.fontSize.subtitle);
  doc.text('Resumen y Estadísticas', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 1.5;

  // Calcular estadísticas
  const totalHoras = turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
  const totalGuardias = turnos.filter(t => t.tipo === 'guardia').length;
  const totalFestivos = turnos.filter(t => t.tipo === 'festivo').length;
  const totalLaborales = turnos.filter(t => t.tipo === 'laboral').length;

  // Estadísticas por semana
  const diasUnicos = new Set(turnos.map(t => t.fecha)).size;
  const semanasAprox = Math.ceil(diasUnicos / 7);
  const promedioHorasPorSemana = semanasAprox > 0 ? (totalHoras / semanasAprox).toFixed(1) : 0;
  const promedioTurnosPorSemana = semanasAprox > 0 ? (turnos.length / semanasAprox).toFixed(1) : 0;

  // Estadísticas de horarios
  const horasGuardias = turnos.filter(t => t.tipo === 'guardia').reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
  const horasFestivos = turnos.filter(t => t.tipo === 'festivo').reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
  const horasLaborales = turnos.filter(t => t.tipo === 'laboral').reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);

  doc.setFontSize(PDF_CONFIG.fontSize.normal);
  doc.setFont('helvetica', 'bold');
  doc.text('Totales:', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont('helvetica', 'normal');
  doc.text(`• Total de turnos: ${turnos.length}`, PDF_CONFIG.marginLeft + 5, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`• Total de horas trabajadas: ${totalHoras}h`, PDF_CONFIG.marginLeft + 5, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`• Días trabajados: ${diasUnicos}`, PDF_CONFIG.marginLeft + 5, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 1.5;

  doc.setFont('helvetica', 'bold');
  doc.text('Distribución por tipo:', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont('helvetica', 'normal');
  doc.text(`• Turnos laborales: ${totalLaborales} (${horasLaborales}h)`, PDF_CONFIG.marginLeft + 5, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`• Guardias: ${totalGuardias} (${horasGuardias}h)`, PDF_CONFIG.marginLeft + 5, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`• Festivos: ${totalFestivos} (${horasFestivos}h)`, PDF_CONFIG.marginLeft + 5, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 1.5;

  doc.setFont('helvetica', 'bold');
  doc.text('Promedios:', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont('helvetica', 'normal');
  doc.text(`• Horas por semana: ${promedioHorasPorSemana}h`, PDF_CONFIG.marginLeft + 5, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`• Turnos por semana: ${promedioTurnosPorSemana}`, PDF_CONFIG.marginLeft + 5, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`• Horas por turno: ${(totalHoras / turnos.length).toFixed(1)}h`, PDF_CONFIG.marginLeft + 5, yPosition);

  // Footer
  yPosition = 280;
  doc.setFontSize(PDF_CONFIG.fontSize.small);
  doc.text(
    `Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`,
    PDF_CONFIG.marginLeft,
    yPosition
  );

  return doc.output('blob');
};

/**
 * Generar reporte PDF de todos los empleados
 */
export const generarPDFCompleto = (
  empleados: Usuario[],
  turnosPorEmpleado: Map<string, Turno[]>,
  farmacia: Farmacia,
  fechaInicio: string,
  fechaFin: string
): Blob => {
  const doc = new jsPDF();

  let yPosition = PDF_CONFIG.marginTop;

  // Título
  doc.setFontSize(PDF_CONFIG.fontSize.title);
  doc.text('Informe Completo de Turnos', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 2;

  // Información de la farmacia
  doc.setFontSize(PDF_CONFIG.fontSize.subtitle);
  doc.text(`Farmacia: ${farmacia.nombre}`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFontSize(PDF_CONFIG.fontSize.normal);
  doc.text(
    `Período: ${format(new Date(fechaInicio), 'dd/MM/yyyy')} - ${format(new Date(fechaFin), 'dd/MM/yyyy')}`,
    PDF_CONFIG.marginLeft,
    yPosition
  );
  yPosition += PDF_CONFIG.lineHeight * 2;

  // Calcular estadísticas globales
  let totalTurnosGlobal = 0;
  let totalHorasGlobal = 0;
  let totalGuardiasGlobal = 0;
  let totalFestivosGlobal = 0;

  empleados.forEach((empleado) => {
    const turnos = turnosPorEmpleado.get(empleado.uid) || [];
    totalTurnosGlobal += turnos.length;
    totalHorasGlobal += turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    totalGuardiasGlobal += turnos.filter(t => t.tipo === 'guardia').length;
    totalFestivosGlobal += turnos.filter(t => t.tipo === 'festivo').length;
  });

  // Resumen Global
  doc.line(PDF_CONFIG.marginLeft, yPosition, 190, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_CONFIG.fontSize.subtitle);
  doc.text('Resumen Global', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 1.5;

  doc.setFontSize(PDF_CONFIG.fontSize.normal);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de empleados: ${empleados.length}`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Total de turnos asignados: ${totalTurnosGlobal}`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Total de horas trabajadas: ${totalHorasGlobal}h`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Guardias totales: ${totalGuardiasGlobal}`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Festivos totales: ${totalFestivosGlobal}`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Promedio horas por empleado: ${(totalHorasGlobal / empleados.length).toFixed(1)}h`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 2;

  // Tabla de empleados
  doc.line(PDF_CONFIG.marginLeft, yPosition, 190, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_CONFIG.fontSize.subtitle);
  doc.text('Detalle por Empleado', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 1.5;

  // Headers de tabla
  doc.setFontSize(PDF_CONFIG.fontSize.normal);
  doc.text('Empleado', PDF_CONFIG.marginLeft, yPosition);
  doc.text('Turnos', PDF_CONFIG.marginLeft + 80, yPosition);
  doc.text('Horas', PDF_CONFIG.marginLeft + 105, yPosition);
  doc.text('Guard.', PDF_CONFIG.marginLeft + 130, yPosition);
  doc.text('Fest.', PDF_CONFIG.marginLeft + 155, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont('helvetica', 'normal');

  // Datos por empleado
  empleados.forEach((empleado) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = PDF_CONFIG.marginTop;
    }

    const turnos = turnosPorEmpleado.get(empleado.uid) || [];
    const totalHoras = turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    const guardias = turnos.filter(t => t.tipo === 'guardia').length;
    const festivos = turnos.filter(t => t.tipo === 'festivo').length;

    const nombreCompleto = `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}`;
    const nombreCorto = nombreCompleto.length > 35 ? nombreCompleto.substring(0, 32) + '...' : nombreCompleto;

    doc.text(nombreCorto, PDF_CONFIG.marginLeft, yPosition);
    doc.text(turnos.length.toString(), PDF_CONFIG.marginLeft + 85, yPosition);
    doc.text(`${totalHoras}h`, PDF_CONFIG.marginLeft + 105, yPosition);
    doc.text(guardias.toString(), PDF_CONFIG.marginLeft + 135, yPosition);
    doc.text(festivos.toString(), PDF_CONFIG.marginLeft + 160, yPosition);
    yPosition += PDF_CONFIG.lineHeight;
  });

  // Análisis de distribución
  if (yPosition > 220) {
    doc.addPage();
    yPosition = PDF_CONFIG.marginTop;
  } else {
    yPosition += PDF_CONFIG.lineHeight;
  }

  doc.line(PDF_CONFIG.marginLeft, yPosition, 190, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_CONFIG.fontSize.subtitle);
  doc.text('Análisis de Distribución', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight * 1.5;

  // Calcular máximos y mínimos
  let maxHoras = 0;
  let minHoras = Infinity;
  let empleadoMaxHoras = '';
  let empleadoMinHoras = '';

  empleados.forEach((empleado) => {
    const turnos = turnosPorEmpleado.get(empleado.uid) || [];
    const totalHoras = turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);

    if (totalHoras > maxHoras) {
      maxHoras = totalHoras;
      empleadoMaxHoras = `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}`;
    }
    if (totalHoras < minHoras && turnos.length > 0) {
      minHoras = totalHoras;
      empleadoMinHoras = `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}`;
    }
  });

  doc.setFontSize(PDF_CONFIG.fontSize.normal);
  doc.setFont('helvetica', 'normal');
  doc.text(`Empleado con más horas: ${empleadoMaxHoras} (${maxHoras}h)`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Empleado con menos horas: ${empleadoMinHoras} (${minHoras}h)`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Diferencia: ${maxHoras - minHoras}h`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Desviación promedio: ${((maxHoras - minHoras) / 2).toFixed(1)}h`, PDF_CONFIG.marginLeft, yPosition);

  // Footer
  yPosition = 280;
  doc.setFontSize(PDF_CONFIG.fontSize.small);
  doc.text(
    `Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`,
    PDF_CONFIG.marginLeft,
    yPosition
  );

  return doc.output('blob');
};

/**
 * Generar archivo Excel con horarios
 */
export const generarExcel = (
  empleados: Usuario[],
  turnosPorEmpleado: Map<string, Turno[]>,
  farmacia: Farmacia,
  fechaInicio: string,
  fechaFin: string
): Blob => {
  const workbook = XLSX.utils.book_new();

  // Calcular estadísticas globales
  let totalTurnosGlobal = 0;
  let totalHorasGlobal = 0;
  let totalGuardiasGlobal = 0;
  let totalFestivosGlobal = 0;
  let totalLaboralesGlobal = 0;

  empleados.forEach((empleado) => {
    const turnos = turnosPorEmpleado.get(empleado.uid) || [];
    totalTurnosGlobal += turnos.length;
    totalHorasGlobal += turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    totalGuardiasGlobal += turnos.filter(t => t.tipo === 'guardia').length;
    totalFestivosGlobal += turnos.filter(t => t.tipo === 'festivo').length;
    totalLaboralesGlobal += turnos.filter(t => t.tipo === 'laboral').length;
  });

  // Hoja de resumen general
  const resumenData = [
    ['INFORME DE TURNOS - RESUMEN GENERAL'],
    [],
    ['Farmacia:', farmacia.nombre],
    ['Período:', `${fechaInicio} - ${fechaFin}`],
    ['Generado:', format(new Date(), 'dd/MM/yyyy HH:mm')],
    [],
    ['ESTADÍSTICAS GLOBALES'],
    ['Total de empleados:', empleados.length.toString()],
    ['Total de turnos asignados:', totalTurnosGlobal.toString()],
    ['Total de horas trabajadas:', `${totalHorasGlobal}h`],
    ['Turnos laborales:', totalLaboralesGlobal.toString()],
    ['Guardias:', totalGuardiasGlobal.toString()],
    ['Festivos:', totalFestivosGlobal.toString()],
    ['Promedio horas por empleado:', `${(totalHorasGlobal / empleados.length).toFixed(1)}h`],
    ['Promedio turnos por empleado:', `${(totalTurnosGlobal / empleados.length).toFixed(1)}`],
    [],
    ['DETALLE POR EMPLEADO'],
    ['Empleado', 'NIF', 'Total Turnos', 'Total Horas', 'Laborales', 'Guardias', 'Festivos', 'Promedio Horas/Turno'],
  ];

  empleados.forEach((empleado) => {
    const turnos = turnosPorEmpleado.get(empleado.uid) || [];
    const totalHoras = turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    const laborales = turnos.filter(t => t.tipo === 'laboral').length;
    const guardias = turnos.filter(t => t.tipo === 'guardia').length;
    const festivos = turnos.filter(t => t.tipo === 'festivo').length;
    const promedioHoras = turnos.length > 0 ? (totalHoras / turnos.length).toFixed(1) : '0';

    resumenData.push([
      `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}`,
      empleado.datosPersonales.nif,
      turnos.length.toString(),
      totalHoras.toString(),
      laborales.toString(),
      guardias.toString(),
      festivos.toString(),
      promedioHoras,
    ]);
  });

  const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen General');

  // Hoja por cada empleado
  empleados.forEach((empleado) => {
    const turnos = turnosPorEmpleado.get(empleado.uid) || [];
    const turnosOrdenados = [...turnos].sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Calcular estadísticas del empleado
    const totalHoras = turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    const laborales = turnos.filter(t => t.tipo === 'laboral').length;
    const guardias = turnos.filter(t => t.tipo === 'guardia').length;
    const festivos = turnos.filter(t => t.tipo === 'festivo').length;
    const horasLaborales = turnos.filter(t => t.tipo === 'laboral').reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    const horasGuardias = turnos.filter(t => t.tipo === 'guardia').reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    const horasFestivos = turnos.filter(t => t.tipo === 'festivo').reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    const diasUnicos = new Set(turnos.map(t => t.fecha)).size;

    const empleadoData = [
      [`HORARIO DE TRABAJO - ${empleado.datosPersonales.nombre.toUpperCase()} ${empleado.datosPersonales.apellidos.toUpperCase()}`],
      [],
      ['Datos del Empleado'],
      ['NIF:', empleado.datosPersonales.nif],
      ['Email:', empleado.datosPersonales.email],
      ['Teléfono:', empleado.datosPersonales.telefono || 'N/A'],
      [],
      ['Estadísticas del Período'],
      ['Total de turnos:', turnos.length.toString()],
      ['Total de horas:', `${totalHoras}h`],
      ['Días trabajados:', diasUnicos.toString()],
      ['Promedio horas/turno:', turnos.length > 0 ? `${(totalHoras / turnos.length).toFixed(1)}h` : '0h'],
      [],
      ['Distribución por Tipo'],
      ['Turnos laborales:', `${laborales} (${horasLaborales}h)`],
      ['Guardias:', `${guardias} (${horasGuardias}h)`],
      ['Festivos:', `${festivos} (${horasFestivos}h)`],
      [],
      ['DETALLE DE TURNOS'],
      ['Fecha', 'Día de la Semana', 'Hora Entrada', 'Hora Salida', 'Duración (horas)', 'Tipo de Turno'],
    ];

    turnosOrdenados.forEach((turno) => {
      const fecha = new Date(turno.fecha);
      const diaSemana = format(fecha, 'EEEE', { locale: es });
      const horas = turno.horaFin - turno.horaInicio;

      empleadoData.push([
        format(fecha, 'dd/MM/yyyy'),
        diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1),
        `${String(turno.horaInicio).padStart(2, '0')}:00`,
        `${String(turno.horaFin).padStart(2, '0')}:00`,
        horas.toString(),
        turno.tipo.charAt(0).toUpperCase() + turno.tipo.slice(1),
      ]);
    });

    const empleadoSheet = XLSX.utils.aoa_to_sheet(empleadoData);

    // Nombre de la hoja (máximo 31 caracteres)
    const sheetName = `${empleado.datosPersonales.nombre.substring(0, 15)} ${empleado.datosPersonales.apellidos.substring(0, 10)}`;
    XLSX.utils.book_append_sheet(workbook, empleadoSheet, sheetName);
  });

  // Convertir a blob
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

/**
 * Descargar archivo
 */
export const descargarArchivo = (blob: Blob, nombreArchivo: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
