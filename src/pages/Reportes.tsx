import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import EmailIcon from '@mui/icons-material/Email';
import DownloadIcon from '@mui/icons-material/Download';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Usuario, Turno, Farmacia } from '@/types';
import { getTurnosByDateRange } from '@/services/turnosService';
import { getFarmaciaById } from '@/services/farmaciasRealtimeService';
import { getUsuariosByFarmacia } from '@/services/usuariosRealtimeService';
import {
  generarPDFEmpleado,
  generarPDFCompleto,
  generarExcel,
  descargarArchivo,
} from '@/services/reportesService';
import { getFunctions, httpsCallable } from 'firebase/functions';

const ReportesPage: React.FC = () => {
  const { user } = useAuth();

  const [empleados, setEmpleados] = useState<Usuario[]>([]);
  const [farmacia, setFarmacia] = useState<Farmacia | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtros
  const [periodo, setPeriodo] = useState({
    inicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    fin: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<string>('todos');
  const [tipoReporte, setTipoReporte] = useState<'pdf' | 'excel'>('pdf');

  // Envío de emails
  const [empleadosParaEnviar, setEmpleadosParaEnviar] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.farmaciaId) return;

    try {
      setLoading(true);

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
    } catch (err) {
      setError('Error al cargar los datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarReporte = async () => {
    if (!user?.farmaciaId || !farmacia) return;

    try {
      setGenerating(true);
      setError(null);

      // Cargar turnos del período
      const turnos = await getTurnosByDateRange(
        user.farmaciaId,
        periodo.inicio,
        periodo.fin
      );

      if (empleadoSeleccionado === 'todos') {
        // Reporte completo
        const turnosPorEmpleado = new Map<string, Turno[]>();
        empleados.forEach(emp => {
          turnosPorEmpleado.set(
            emp.uid,
            turnos.filter(t => t.empleadoId === emp.uid)
          );
        });

        if (tipoReporte === 'pdf') {
          const blob = generarPDFCompleto(
            empleados,
            turnosPorEmpleado,
            farmacia,
            periodo.inicio,
            periodo.fin
          );
          descargarArchivo(blob, `calendario_completo_${periodo.inicio}_${periodo.fin}.pdf`);
        } else {
          const blob = generarExcel(
            empleados,
            turnosPorEmpleado,
            farmacia,
            periodo.inicio,
            periodo.fin
          );
          descargarArchivo(blob, `calendario_completo_${periodo.inicio}_${periodo.fin}.xlsx`);
        }
      } else {
        // Reporte individual
        const empleado = empleados.find(e => e.uid === empleadoSeleccionado);
        if (!empleado) return;

        const turnosEmpleado = turnos.filter(t => t.empleadoId === empleadoSeleccionado);

        if (tipoReporte === 'pdf') {
          const blob = generarPDFEmpleado(
            empleado,
            turnosEmpleado,
            farmacia,
            periodo.inicio,
            periodo.fin
          );
          const nombreArchivo = `horario_${empleado.datosPersonales.nombre}_${empleado.datosPersonales.apellidos}_${periodo.inicio}_${periodo.fin}.pdf`.replace(/\s+/g, '_');
          descargarArchivo(blob, nombreArchivo);
        } else {
          // Para Excel individual, crear un reporte con un solo empleado
          const turnosPorEmpleado = new Map([[empleado.uid, turnosEmpleado]]);
          const blob = generarExcel(
            [empleado],
            turnosPorEmpleado,
            farmacia,
            periodo.inicio,
            periodo.fin
          );
          const nombreArchivo = `horario_${empleado.datosPersonales.nombre}_${empleado.datosPersonales.apellidos}_${periodo.inicio}_${periodo.fin}.xlsx`.replace(/\s+/g, '_');
          descargarArchivo(blob, nombreArchivo);
        }
      }

      setSuccess('Reporte generado correctamente');
    } catch (err) {
      setError('Error al generar el reporte');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleEmpleado = (empleadoId: string) => {
    const newSet = new Set(empleadosParaEnviar);
    if (newSet.has(empleadoId)) {
      newSet.delete(empleadoId);
    } else {
      newSet.add(empleadoId);
    }
    setEmpleadosParaEnviar(newSet);
  };

  const handleToggleTodos = () => {
    if (empleadosParaEnviar.size === empleados.length) {
      setEmpleadosParaEnviar(new Set());
    } else {
      setEmpleadosParaEnviar(new Set(empleados.map(e => e.uid)));
    }
  };

  const handleEnviarPorEmail = async () => {
    if (!user?.farmaciaId || empleadosParaEnviar.size === 0) return;

    try {
      setSending(true);
      setError(null);

      const functions = getFunctions();
      const sendScheduleEmail = httpsCallable(functions, 'sendScheduleEmail');

      let enviados = 0;
      let errores = 0;

      for (const empleadoId of empleadosParaEnviar) {
        try {
          await sendScheduleEmail({
            empleadoId,
            fechaInicio: periodo.inicio,
            fechaFin: periodo.fin,
            farmaciaId: user.farmaciaId,
          });
          enviados++;
        } catch (err) {
          console.error(`Error enviando email a empleado ${empleadoId}:`, err);
          errores++;
        }
      }

      if (errores === 0) {
        setSuccess(`Emails enviados correctamente a ${enviados} empleado(s)`);
      } else {
        setError(`${enviados} emails enviados, ${errores} fallaron`);
      }

      setEmpleadosParaEnviar(new Set());
    } catch (err) {
      setError('Error al enviar los emails');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Reportes y Exportación
      </Typography>

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

      <Grid container spacing={3}>
        {/* Generación de Reportes */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Generar y Descargar Reportes
              </Typography>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Empleado</InputLabel>
                    <Select
                      value={empleadoSeleccionado}
                      onChange={(e) => setEmpleadoSeleccionado(e.target.value)}
                      label="Empleado"
                    >
                      <MenuItem value="todos">Todos los empleados</MenuItem>
                      <Divider />
                      {empleados.map(emp => (
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
                    label="Fecha Inicio"
                    type="date"
                    value={periodo.inicio}
                    onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Fecha Fin"
                    type="date"
                    value={periodo.fin}
                    onChange={(e) => setPeriodo({ ...periodo, fin: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Formato</InputLabel>
                    <Select
                      value={tipoReporte}
                      onChange={(e) => setTipoReporte(e.target.value as 'pdf' | 'excel')}
                      label="Formato"
                    >
                      <MenuItem value="pdf">
                        <Box display="flex" alignItems="center" gap={1}>
                          <PictureAsPdfIcon /> PDF
                        </Box>
                      </MenuItem>
                      <MenuItem value="excel">
                        <Box display="flex" alignItems="center" gap={1}>
                          <TableChartIcon /> Excel
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>

            <CardActions>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={generating ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={handleGenerarReporte}
                disabled={generating}
              >
                {generating ? 'Generando...' : 'Generar y Descargar'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Envío por Email */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Enviar Horarios por Email
              </Typography>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Fecha Inicio"
                    type="date"
                    value={periodo.inicio}
                    onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Fecha Fin"
                    type="date"
                    value={periodo.fin}
                    onChange={(e) => setPeriodo({ ...periodo, fin: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">
                      Seleccionar Empleados ({empleadosParaEnviar.size} seleccionados)
                    </Typography>
                    <Button size="small" onClick={handleToggleTodos}>
                      {empleadosParaEnviar.size === empleados.length ? 'Deseleccionar' : 'Seleccionar'} Todos
                    </Button>
                  </Box>

                  <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', mt: 1 }}>
                    <List dense>
                      {empleados.map(emp => (
                        <ListItem
                          key={emp.uid}
                          button
                          onClick={() => handleToggleEmpleado(emp.uid)}
                        >
                          <ListItemIcon>
                            <Checkbox
                              edge="start"
                              checked={empleadosParaEnviar.has(emp.uid)}
                              tabIndex={-1}
                              disableRipple
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${emp.datosPersonales.nombre} ${emp.datosPersonales.apellidos}`}
                            secondary={emp.datosPersonales.email}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>

            <CardActions>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                startIcon={sending ? <CircularProgress size={20} /> : <EmailIcon />}
                onClick={handleEnviarPorEmail}
                disabled={sending || empleadosParaEnviar.size === 0}
              >
                {sending ? 'Enviando...' : `Enviar a ${empleadosParaEnviar.size} Empleado(s)`}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Información adicional */}
        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              Información sobre Reportes
            </Typography>
            <Typography variant="body2">
              • Los reportes PDF incluyen información detallada de cada turno con fecha, hora y tipo.
              <br />
              • Los archivos Excel incluyen una hoja resumen y hojas individuales por empleado.
              <br />
              • El envío por email utiliza las direcciones de correo registradas en el sistema.
              <br />• Los emails incluyen el horario completo del período seleccionado.
            </Typography>
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportesPage;
