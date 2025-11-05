import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Turno, Usuario, Farmacia, Conflicto } from '@/types';
import {
  getTurnosByDateRange,
  createTurno,
  updateTurno,
  deleteTurno,
  deleteTurnosByDateRange,
  createTurnosBatch,
} from '@/services/turnosService';
import { getFarmaciaById } from '@/services/farmaciasService';
import { getUsuariosByFarmacia } from '@/services/usuariosService';
import { getOrCreateConfiguracion } from '@/services/configuracionAlgoritmoService';
import { executeSchedulingAlgorithm } from '@/utils/algorithm';
import { TurnoValidator } from '@/utils/algorithm/validation';

const CalendarioPage: React.FC = () => {
  const { user } = useAuth();
  const calendarRef = useRef<FullCalendar>(null);

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [empleados, setEmpleados] = useState<Usuario[]>([]);
  const [farmacia, setFarmacia] = useState<Farmacia | null>(null);
  const [conflictos, setConflictos] = useState<Conflicto[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [openGenerateDialog, setOpenGenerateDialog] = useState(false);
  const [generatePeriod, setGeneratePeriod] = useState({
    inicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    fin: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [modoCompletar, setModoCompletar] = useState(false); // false = limpiar y generar, true = completar existentes

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [turnoForm, setTurnoForm] = useState({
    empleadoId: '',
    horaInicio: 9,
    horaFin: 17,
  });

  // Función para calcular duración del turno en minutos
  const calculateDuracionMinutos = (horaInicio: number, horaFin: number): number => {
    if (horaFin >= horaInicio) {
      // Turno normal (ej: 9:00 a 17:00)
      return (horaFin - horaInicio) * 60;
    } else {
      // Turno que cruza medianoche (ej: 22:00 a 6:00)
      return (24 - horaInicio + horaFin) * 60;
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.farmaciaId || user.farmaciaId.trim() === '') {
      setError('No se ha asignado una farmacia a este usuario. Por favor, contacte con el administrador.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Cargar datos de farmacia y empleados
      const [farmaciaData, empleadosData] = await Promise.all([
        getFarmaciaById(user.farmaciaId),
        getUsuariosByFarmacia(user.farmaciaId),
      ]);

      setFarmacia(farmaciaData);
      // Incluir empleados y admin/gestores que estén marcados como trabajadores
      setEmpleados(empleadosData.filter(emp =>
        emp.rol === 'empleado' ||
        ((emp.rol === 'admin' || emp.rol === 'gestor') && emp.incluirEnCalendario === true)
      ));

      // Cargar turnos del mes actual
      await loadTurnosForMonth(new Date());
    } catch (err) {
      setError('Error al cargar los datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTurnosForMonth = async (date: Date) => {
    if (!user?.farmaciaId || user.farmaciaId.trim() === '') return;

    try {
      const inicio = format(startOfMonth(date), 'yyyy-MM-dd');
      const fin = format(endOfMonth(date), 'yyyy-MM-dd');

      const turnosData = await getTurnosByDateRange(user.farmaciaId, inicio, fin);

      // Calcular duracionMinutos si no existe (para compatibilidad con turnos antiguos)
      const turnosConDuracion = turnosData.map(turno => {
        if (turno.duracionMinutos === undefined) {
          const duracionMinutos = calculateDuracionMinutos(turno.horaInicio, turno.horaFin);
          return { ...turno, duracionMinutos };
        }
        return turno;
      });

      setTurnos(turnosConDuracion);
    } catch (err) {
      console.error('Error loading turnos:', err);
      setError('Error al cargar los turnos del calendario');
    }
  };

  const handleGenerateSchedule = async () => {
    if (!user?.farmaciaId || user.farmaciaId.trim() === '' || !farmacia) {
      setError('Error: No se ha asignado una farmacia a este usuario. Por favor, contacte con el administrador.');
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      console.log('Iniciando generación de calendario para el período:', generatePeriod);
      console.log('Modo:', modoCompletar ? 'Completar existentes' : 'Limpiar y generar');

      // Cargar configuración
      const config = await getOrCreateConfiguracion(user.uid, user.farmaciaId);

      const fechaInicio = new Date(generatePeriod.inicio);
      const fechaFin = new Date(generatePeriod.fin);

      let turnosExistentes: Turno[] = [];

      if (modoCompletar) {
        // Modo completar: cargar turnos existentes
        console.log('Cargando turnos existentes...');
        turnosExistentes = await getTurnosByDateRange(
          user.farmaciaId,
          generatePeriod.inicio,
          generatePeriod.fin
        );
        console.log(`Turnos existentes encontrados: ${turnosExistentes.length}`);
      } else {
        // Modo limpiar: eliminar turnos existentes en el período ANTES de generar nuevos
        console.log('Eliminando turnos existentes...');
        await deleteTurnosByDateRange(
          user.farmaciaId,
          generatePeriod.inicio,
          generatePeriod.fin
        );
      }

      // Ejecutar algoritmo
      console.log('Ejecutando algoritmo de asignación...');
      const resultado = await executeSchedulingAlgorithm(
        config,
        farmacia,
        empleados,
        fechaInicio,
        fechaFin,
        turnosExistentes // Pasar turnos existentes al algoritmo
      );

      // Guardar nuevos turnos
      console.log('Guardando nuevos turnos en la base de datos...');
      await createTurnosBatch(user.farmaciaId, resultado.turnos);
      console.log('Turnos guardados exitosamente');

      // Recargar turnos del mes visible actualmente en el calendario
      console.log('Recargando turnos desde la base de datos...');
      const calendarApi = calendarRef.current?.getApi();
      const currentDate = calendarApi?.getDate() || new Date();
      await loadTurnosForMonth(currentDate);
      console.log('Turnos recargados');

      setConflictos(resultado.conflictos);

      const modoTexto = modoCompletar ? 'completado' : 'generado';
      setSuccess(
        `Calendario ${modoTexto} y guardado en la base de datos: ${resultado.turnos.length} turnos ${modoCompletar ? 'agregados' : 'creados'}. ` +
        `${resultado.conflictos.length} conflictos detectados. ` +
        `Score: ${resultado.scoreGlobal.toFixed(0)}`
      );
      setOpenGenerateDialog(false);
    } catch (err: any) {
      const errorMsg = `Error al generar el calendario: ${err.message || err}`;
      setError(errorMsg);
      console.error('Error en la generación del calendario:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setTurnoForm({
      empleadoId: '',
      horaInicio: 9,
      horaFin: 17,
    });
    setSelectedTurno({
      id: '',
      empleadoId: '',
      fecha: format(selectInfo.start, 'yyyy-MM-dd'),
      horaInicio: 9,
      horaFin: 17,
      duracionMinutos: (17 - 9) * 60, // 8 horas = 480 minutos
      tipo: 'laboral',
      estado: 'pendiente',
    });
    setOpenEditDialog(true);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const turno = turnos.find(t => t.id === clickInfo.event.id);
    if (turno) {
      setSelectedTurno(turno);
      setTurnoForm({
        empleadoId: turno.empleadoId,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
      });
      setOpenEditDialog(true);
    }
  };

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    if (!user?.farmaciaId || user.farmaciaId.trim() === '') return;

    const turno = turnos.find(t => t.id === dropInfo.event.id);
    if (!turno) return;

    // Crear turno actualizado
    const updatedTurno: Turno = {
      ...turno,
      fecha: format(dropInfo.event.start!, 'yyyy-MM-dd'),
    };

    // Validar el movimiento
    const empleado = empleados.find(e => e.uid === turno.empleadoId);
    if (!empleado) return;

    const turnosEmpleado = turnos.filter(t => t.empleadoId === turno.empleadoId && t.id !== turno.id);
    const config = await getOrCreateConfiguracion(user.uid, user.farmaciaId);

    if (!TurnoValidator.isValidAssignment(updatedTurno, empleado, turnosEmpleado, config)) {
      setError('El movimiento viola las restricciones de horario');
      dropInfo.revert();
      return;
    }

    try {
      await updateTurno(user.farmaciaId, turno.id, {
        fecha: updatedTurno.fecha,
      });

      setTurnos(turnos.map(t => t.id === turno.id ? updatedTurno : t));
      setSuccess('Turno actualizado correctamente');
    } catch (err) {
      setError('Error al actualizar el turno');
      dropInfo.revert();
    }
  };

  const handleSaveTurno = async () => {
    if (!user?.farmaciaId || user.farmaciaId.trim() === '' || !selectedTurno) return;

    try {
      // Calcular duración del turno
      const duracionMinutos = calculateDuracionMinutos(turnoForm.horaInicio, turnoForm.horaFin);

      if (selectedTurno.id) {
        // Actualizar turno existente
        await updateTurno(user.farmaciaId, selectedTurno.id, {
          empleadoId: turnoForm.empleadoId,
          horaInicio: turnoForm.horaInicio,
          horaFin: turnoForm.horaFin,
          duracionMinutos,
        });

        setTurnos(turnos.map(t =>
          t.id === selectedTurno.id
            ? { ...t, empleadoId: turnoForm.empleadoId, horaInicio: turnoForm.horaInicio, horaFin: turnoForm.horaFin, duracionMinutos }
            : t
        ));
      } else {
        // Crear nuevo turno
        const nuevoTurno: Omit<Turno, 'id' | 'createdAt' | 'updatedAt'> = {
          empleadoId: turnoForm.empleadoId,
          fecha: selectedTurno.fecha,
          horaInicio: turnoForm.horaInicio,
          horaFin: turnoForm.horaFin,
          duracionMinutos,
          tipo: selectedTurno.tipo,
          estado: 'confirmado',
        };

        const id = await createTurno(user.farmaciaId, nuevoTurno);
        setTurnos([...turnos, { ...nuevoTurno, id }]);
      }

      setSuccess('Turno guardado correctamente');
      setOpenEditDialog(false);
    } catch (err) {
      setError('Error al guardar el turno');
    }
  };

  const handleDeleteTurno = async () => {
    if (!user?.farmaciaId || user.farmaciaId.trim() === '' || !selectedTurno?.id) return;

    try {
      console.log('Iniciando borrado de turno desde diálogo:', selectedTurno.id);
      await deleteTurno(user.farmaciaId, selectedTurno.id);

      // Recargar turnos desde la base de datos para asegurar sincronización
      const calendarApi = calendarRef.current?.getApi();
      const currentDate = calendarApi?.getDate() || new Date();
      await loadTurnosForMonth(currentDate);

      setSuccess('Turno eliminado correctamente');
      setOpenEditDialog(false);
    } catch (err: any) {
      console.error('Error al eliminar turno:', err);
      setError(`Error al eliminar el turno: ${err.message || err}`);
    }
  };

  // Manejar eliminación de evento (tecla Delete o botón eliminar)
  const handleEventRemove = async (removeInfo: any) => {
    if (!user?.farmaciaId || user.farmaciaId.trim() === '') return;

    const turnoId = removeInfo.event.id;
    console.log('Evento eliminado desde calendario (tecla Delete):', turnoId);

    try {
      await deleteTurno(user.farmaciaId, turnoId);

      // Recargar turnos desde la base de datos para asegurar sincronización
      const calendarApi = calendarRef.current?.getApi();
      const currentDate = calendarApi?.getDate() || new Date();
      await loadTurnosForMonth(currentDate);

      setSuccess('Turno eliminado correctamente');
    } catch (err: any) {
      console.error('Error al eliminar turno:', err);
      setError(`Error al eliminar el turno: ${err.message || err}`);
      // Revertir la eliminación visual
      removeInfo.revert();
    }
  };

  // Limpiar todos los turnos del mes visible
  const handleClearMonth = async () => {
    if (!user?.farmaciaId || user.farmaciaId.trim() === '') return;

    const confirmacion = window.confirm(
      '¿Estás seguro de que deseas eliminar todos los turnos del mes visible? Esta acción no se puede deshacer.'
    );

    if (!confirmacion) return;

    try {
      setLoading(true);
      const calendarApi = calendarRef.current?.getApi();
      const currentDate = calendarApi?.getDate() || new Date();
      const inicio = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const fin = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      console.log('Limpiando todos los turnos del mes:', { inicio, fin });
      await deleteTurnosByDateRange(user.farmaciaId, inicio, fin);

      // Recargar turnos desde la base de datos
      await loadTurnosForMonth(currentDate);
      setConflictos([]);

      setSuccess('Todos los turnos del mes han sido eliminados');
    } catch (err: any) {
      console.error('Error al eliminar los turnos:', err);
      setError(`Error al eliminar los turnos: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper: obtener color de chip según severidad
  const getSeveridadColor = (severidad: string): "error" | "warning" | "info" | "default" => {
    switch (severidad) {
      case 'critico': return 'error';
      case 'alto': return 'warning';
      case 'medio': return 'warning';
      case 'bajo': return 'info';
      default: return 'default';
    }
  };

  // Convertir turnos a eventos de FullCalendar
  const events = turnos.map(turno => {
    const empleado = empleados.find(e => e.uid === turno.empleadoId);
    const turnoConflictos = conflictos.filter(c => c.turnoId === turno.id);
    const hasConflict = turnoConflictos.length > 0;

    // Detectar si la guardia cruza la medianoche (horaFin < horaInicio)
    const cruzaMedianoche = turno.horaFin < turno.horaInicio;
    const fechaInicio = turno.fecha;
    const fechaFin = cruzaMedianoche
      ? format(new Date(new Date(turno.fecha).getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      : turno.fecha;

    // Construir título con información de conflicto
    let title = empleado ? `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}` : 'Sin asignar';
    if (hasConflict) {
      title += ` ⚠️ (${turnoConflictos.length} conflicto${turnoConflictos.length > 1 ? 's' : ''})`;
    }

    return {
      id: turno.id,
      title,
      start: `${fechaInicio}T${String(turno.horaInicio).padStart(2, '0')}:00:00`,
      end: `${fechaFin}T${String(turno.horaFin).padStart(2, '0')}:00:00`,
      backgroundColor: hasConflict ? '#ef5350' : turno.tipo === 'guardia' ? '#42a5f5' : turno.tipo === 'festivo' ? '#66bb6a' : '#9575cd',
      borderColor: hasConflict ? '#c62828' : turno.tipo === 'guardia' ? '#1976d2' : turno.tipo === 'festivo' ? '#388e3c' : '#5e35b1',
      extendedProps: {
        conflictos: turnoConflictos,
        empleado: empleado,
        turno: turno
      }
    };
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Calendario de Turnos</Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteSweepIcon />}
            onClick={handleClearMonth}
            disabled={loading || turnos.length === 0}
          >
            Limpiar Mes
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AutoFixHighIcon />}
            onClick={() => setOpenGenerateDialog(true)}
          >
            Generar Calendario
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Estadísticas */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Total Turnos
              </Typography>
              <Typography variant="h3">{turnos.length}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <WarningIcon color="error" />
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Conflictos
                </Typography>
              </Box>
              <Typography variant="h3" color={conflictos.length > 0 ? 'error' : 'inherit'}>
                {conflictos.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <CheckCircleIcon color="success" />
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Empleados Asignados
                </Typography>
              </Box>
              <Typography variant="h3">
                {new Set(turnos.map(t => t.empleadoId)).size}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Panel de Conflictos Detallado */}
      {conflictos.length > 0 && (
        <Accordion sx={{ mb: 3 }} defaultExpanded={conflictos.length > 0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <ErrorIcon color="error" />
              <Typography variant="h6">
                Conflictos Detectados ({conflictos.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {conflictos.map((conflicto, index) => {
                const turno = turnos.find(t => t.id === conflicto.turnoId);
                const empleado = turno ? empleados.find(e => e.uid === turno.empleadoId) : null;

                return (
                  <React.Fragment key={conflicto.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      sx={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        py: 2,
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1} mb={1} width="100%">
                        <Chip
                          label={conflicto.severidad.toUpperCase()}
                          color={getSeveridadColor(conflicto.severidad)}
                          size="small"
                        />
                        <Chip
                          label={conflicto.tipo.replace(/_/g, ' ').toUpperCase()}
                          variant="outlined"
                          size="small"
                        />
                        {turno && (
                          <Typography variant="body2" color="textSecondary">
                            Fecha: {turno.fecha}
                          </Typography>
                        )}
                      </Box>

                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" fontWeight="bold">
                            {empleado ? `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}` : 'Empleado no encontrado'}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.primary" gutterBottom>
                              {conflicto.descripcion}
                            </Typography>
                            {conflicto.sugerencias.length > 0 && (
                              <Box mt={1}>
                                <Typography variant="caption" color="textSecondary" fontWeight="bold">
                                  Sugerencias:
                                </Typography>
                                <List dense sx={{ pl: 2 }}>
                                  {conflicto.sugerencias.map((sugerencia, idx) => (
                                    <ListItem key={idx} sx={{ py: 0 }}>
                                      <Typography variant="caption" color="textSecondary">
                                        • {sugerencia}
                                      </Typography>
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Calendario */}
      <Paper sx={{ p: 2 }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          locale="es"
          firstDay={0}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          events={events}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventRemove={handleEventRemove}
          datesSet={(dateInfo) => {
            loadTurnosForMonth(dateInfo.start);
          }}
          height="auto"
        />

        {/* Leyenda de colores */}
        <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#9575cd', borderRadius: 1, border: '2px solid #5e35b1' }} />
            <Typography variant="body2">Turno Laboral</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#42a5f5', borderRadius: 1, border: '2px solid #1976d2' }} />
            <Typography variant="body2">Guardia</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#66bb6a', borderRadius: 1, border: '2px solid #388e3c' }} />
            <Typography variant="body2">Festivo</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#ef5350', borderRadius: 1, border: '2px solid #c62828' }} />
            <Typography variant="body2">Conflicto</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Dialog: Generar Calendario */}
      <Dialog open={openGenerateDialog} onClose={() => setOpenGenerateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generar Calendario Automático</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary" paragraph>
              El algoritmo generará automáticamente los turnos para el período seleccionado,
              respetando todas las restricciones configuradas.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Fecha Inicio"
                  type="date"
                  value={generatePeriod.inicio}
                  onChange={(e) => setGeneratePeriod({ ...generatePeriod, inicio: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Fecha Fin"
                  type="date"
                  value={generatePeriod.fin}
                  onChange={(e) => setGeneratePeriod({ ...generatePeriod, fin: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            <FormControlLabel
              control={
                <Checkbox
                  checked={modoCompletar}
                  onChange={(e) => setModoCompletar(e.target.checked)}
                />
              }
              label="Modo completar: mantener turnos existentes y solo llenar espacios vacíos"
              sx={{ mt: 2 }}
            />

            {!modoCompletar && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Esto eliminará todos los turnos existentes en el período seleccionado antes de generar nuevos.
              </Alert>
            )}

            {modoCompletar && (
              <Alert severity="info" sx={{ mt: 2 }}>
                El algoritmo respetará los turnos ya asignados y solo completará los espacios vacíos.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGenerateDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleGenerateSchedule}
            disabled={generating}
            startIcon={generating ? <CircularProgress size={20} /> : <AutoFixHighIcon />}
          >
            {generating ? 'Generando...' : 'Generar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Editar Turno */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedTurno?.id ? 'Editar Turno' : 'Nuevo Turno'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Empleado</InputLabel>
                  <Select
                    value={turnoForm.empleadoId}
                    onChange={(e) => setTurnoForm({ ...turnoForm, empleadoId: e.target.value })}
                    label="Empleado"
                  >
                    {empleados.map((emp) => (
                      <MenuItem key={emp.uid} value={emp.uid}>
                        {emp.datosPersonales.nombre} {emp.datosPersonales.apellidos}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Hora Inicio"
                  value={turnoForm.horaInicio}
                  onChange={(e) => setTurnoForm({ ...turnoForm, horaInicio: Number(e.target.value) })}
                  inputProps={{ min: 0, max: 23 }}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Hora Fin"
                  value={turnoForm.horaFin}
                  onChange={(e) => setTurnoForm({ ...turnoForm, horaFin: Number(e.target.value) })}
                  inputProps={{ min: 0, max: 23 }}
                />
              </Grid>

              {selectedTurno && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">
                    Fecha: {selectedTurno.fecha}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          {selectedTurno?.id && (
            <Button color="error" onClick={handleDeleteTurno}>
              Eliminar
            </Button>
          )}
          <Button onClick={() => setOpenEditDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveTurno}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarioPage;
