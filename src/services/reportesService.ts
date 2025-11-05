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
  doc.setFont(undefined, 'bold');
  doc.text('Fecha', PDF_CONFIG.marginLeft, yPosition);
  doc.text('Día', PDF_CONFIG.marginLeft + 40, yPosition);
  doc.text('Hora Inicio', PDF_CONFIG.marginLeft + 70, yPosition);
  doc.text('Hora Fin', PDF_CONFIG.marginLeft + 110, yPosition);
  doc.text('Tipo', PDF_CONFIG.marginLeft + 140, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont(undefined, 'normal');

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

    doc.text(format(fecha, 'dd/MM/yyyy'), PDF_CONFIG.marginLeft, yPosition);
    doc.text(diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1), PDF_CONFIG.marginLeft + 40, yPosition);
    doc.text(`${turno.horaInicio}:00`, PDF_CONFIG.marginLeft + 70, yPosition);
    doc.text(`${turno.horaFin}:00`, PDF_CONFIG.marginLeft + 110, yPosition);
    doc.text(turno.tipo.charAt(0).toUpperCase() + turno.tipo.slice(1), PDF_CONFIG.marginLeft + 140, yPosition);
    yPosition += PDF_CONFIG.lineHeight;
  });

  // Resumen
  yPosition += PDF_CONFIG.lineHeight;
  doc.line(PDF_CONFIG.marginLeft, yPosition, 190, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont(undefined, 'bold');
  doc.text('Resumen', PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;

  doc.setFont(undefined, 'normal');
  const totalHoras = turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
  const totalGuardias = turnos.filter(t => t.tipo === 'guardia').length;
  const totalFestivos = turnos.filter(t => t.tipo === 'festivo').length;

  doc.text(`Total de turnos: ${turnos.length}`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Total de horas: ${totalHoras}h`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Guardias: ${totalGuardias}`, PDF_CONFIG.marginLeft, yPosition);
  yPosition += PDF_CONFIG.lineHeight;
  doc.text(`Festivos: ${totalFestivos}`, PDF_CONFIG.marginLeft, yPosition);

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
  doc.text('Calendario Completo de Turnos', PDF_CONFIG.marginLeft, yPosition);
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

  // Resumen por empleado
  empleados.forEach((empleado, index) => {
    if (yPosition > 260) {
      doc.addPage();
      yPosition = PDF_CONFIG.marginTop;
    }

    const turnos = turnosPorEmpleado.get(empleado.uid) || [];
    const totalHoras = turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);

    doc.setFont(undefined, 'bold');
    doc.text(
      `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}`,
      PDF_CONFIG.marginLeft,
      yPosition
    );
    yPosition += PDF_CONFIG.lineHeight;

    doc.setFont(undefined, 'normal');
    doc.text(`Turnos: ${turnos.length} | Horas: ${totalHoras}h`, PDF_CONFIG.marginLeft + 5, yPosition);
    yPosition += PDF_CONFIG.lineHeight * 1.5;
  });

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

  // Hoja de resumen
  const resumenData = [
    ['Calendario de Turnos'],
    ['Farmacia:', farmacia.nombre],
    ['Período:', `${fechaInicio} - ${fechaFin}`],
    ['Generado:', format(new Date(), 'dd/MM/yyyy HH:mm')],
    [],
    ['Empleado', 'Total Turnos', 'Total Horas', 'Guardias', 'Festivos'],
  ];

  empleados.forEach((empleado) => {
    const turnos = turnosPorEmpleado.get(empleado.uid) || [];
    const totalHoras = turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    const guardias = turnos.filter(t => t.tipo === 'guardia').length;
    const festivos = turnos.filter(t => t.tipo === 'festivo').length;

    resumenData.push([
      `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}`,
      turnos.length,
      totalHoras,
      guardias,
      festivos,
    ]);
  });

  const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen');

  // Hoja por cada empleado
  empleados.forEach((empleado) => {
    const turnos = turnosPorEmpleado.get(empleado.uid) || [];
    const turnosOrdenados = [...turnos].sort((a, b) => a.fecha.localeCompare(b.fecha));

    const empleadoData = [
      [`${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}`],
      ['NIF:', empleado.datosPersonales.nif],
      ['Email:', empleado.datosPersonales.email],
      [],
      ['Fecha', 'Día', 'Hora Inicio', 'Hora Fin', 'Horas', 'Tipo'],
    ];

    turnosOrdenados.forEach((turno) => {
      const fecha = new Date(turno.fecha);
      const diaSemana = format(fecha, 'EEEE', { locale: es });
      const horas = turno.horaFin - turno.horaInicio;

      empleadoData.push([
        format(fecha, 'dd/MM/yyyy'),
        diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1),
        `${turno.horaInicio}:00`,
        `${turno.horaFin}:00`,
        horas,
        turno.tipo.charAt(0).toUpperCase() + turno.tipo.slice(1),
      ]);
    });

    // Resumen
    const totalHoras = turnos.reduce((sum, t) => sum + (t.horaFin - t.horaInicio), 0);
    empleadoData.push([]);
    empleadoData.push(['Total Turnos:', turnos.length]);
    empleadoData.push(['Total Horas:', totalHoras]);

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
