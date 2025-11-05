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
} from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [turnoForm, setTurnoForm] = useState({
    empleadoId: '',
    horaInicio: 9,
    horaFin: 17,
  });

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
      setEmpleados(empleadosData.filter(emp => emp.rol === 'empleado'));

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
      setTurnos(turnosData);
    } catch (err) {
      console.error('Error loading turnos:', err);
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

      // Cargar configuración
      const config = await getOrCreateConfiguracion(user.farmaciaId);

      // Eliminar turnos existentes en el período ANTES de generar nuevos
      await deleteTurnosByDateRange(
        user.farmaciaId,
        generatePeriod.inicio,
        generatePeriod.fin
      );

      // Ejecutar algoritmo con período limpio
      const fechaInicio = new Date(generatePeriod.inicio);
      const fechaFin = new Date(generatePeriod.fin);

      console.log('Ejecutando algoritmo de asignación...');
      const resultado = await executeSchedulingAlgorithm(
        config,
        farmacia,
        empleados,
        fechaInicio,
        fechaFin
      );

      // Guardar nuevos turnos
      console.log('Guardando nuevos turnos en la base de datos...');
      await createTurnosBatch(user.farmaciaId, resultado.turnos);
      console.log('Turnos guardados exitosamente');

      // Recargar turnos desde la base de datos para obtener los IDs correctos
      console.log('Recargando turnos desde la base de datos...');
      const turnosGuardados = await getTurnosByDateRange(
        user.farmaciaId,
        generatePeriod.inicio,
        generatePeriod.fin
      );
      console.log(`Turnos recargados: ${turnosGuardados.length}`);

      // Actualizar estado con los turnos recargados desde la base de datos
      setTurnos(turnosGuardados);
      setConflictos(resultado.conflictos);

      setSuccess(
        `Calendario generado y guardado en la base de datos: ${resultado.turnos.length} turnos creados. ` +
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
    const config = await getOrCreateConfiguracion(user.farmaciaId);

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
      if (selectedTurno.id) {
        // Actualizar turno existente
        await updateTurno(user.farmaciaId, selectedTurno.id, {
          empleadoId: turnoForm.empleadoId,
          horaInicio: turnoForm.horaInicio,
          horaFin: turnoForm.horaFin,
        });

        setTurnos(turnos.map(t =>
          t.id === selectedTurno.id
            ? { ...t, empleadoId: turnoForm.empleadoId, horaInicio: turnoForm.horaInicio, horaFin: turnoForm.horaFin }
            : t
        ));
      } else {
        // Crear nuevo turno
        const nuevoTurno: Omit<Turno, 'id' | 'createdAt' | 'updatedAt'> = {
          empleadoId: turnoForm.empleadoId,
          fecha: selectedTurno.fecha,
          horaInicio: turnoForm.horaInicio,
          horaFin: turnoForm.horaFin,
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
      await deleteTurno(user.farmaciaId, selectedTurno.id);
      setTurnos(turnos.filter(t => t.id !== selectedTurno.id));
      setSuccess('Turno eliminado correctamente');
      setOpenEditDialog(false);
    } catch (err) {
      setError('Error al eliminar el turno');
    }
  };

  // Convertir turnos a eventos de FullCalendar
  const events = turnos.map(turno => {
    const empleado = empleados.find(e => e.uid === turno.empleadoId);
    const hasConflict = conflictos.some(c => c.turnoId === turno.id);

    return {
      id: turno.id,
      title: empleado ? `${empleado.datosPersonales.nombre} ${empleado.datosPersonales.apellidos}` : 'Sin asignar',
      start: `${turno.fecha}T${String(turno.horaInicio).padStart(2, '0')}:00:00`,
      end: `${turno.fecha}T${String(turno.horaFin).padStart(2, '0')}:00:00`,
      backgroundColor: hasConflict ? '#ef5350' : turno.tipo === 'guardia' ? '#42a5f5' : turno.tipo === 'festivo' ? '#66bb6a' : '#9575cd',
      borderColor: hasConflict ? '#c62828' : turno.tipo === 'guardia' ? '#1976d2' : turno.tipo === 'festivo' ? '#388e3c' : '#5e35b1',
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
        <Button
          variant="contained"
          color="primary"
          startIcon={<AutoFixHighIcon />}
          onClick={() => setOpenGenerateDialog(true)}
        >
          Generar Calendario
        </Button>
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
          datesSet={(dateInfo) => {
            loadTurnosForMonth(dateInfo.start);
          }}
          height="auto"
        />
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

            <Alert severity="warning" sx={{ mt: 2 }}>
              Esto eliminará todos los turnos existentes en el período seleccionado.
            </Alert>
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
