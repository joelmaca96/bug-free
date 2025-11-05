import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Alert,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { JornadaGuardia } from '@/types';
import {
  generateTimeOptions,
  formatDateDisplay,
} from '@/utils/dateTimeUtils';

interface JornadasGuardiaProps {
  guardias: JornadaGuardia[];
  onChange: (guardias: JornadaGuardia[]) => void;
}

const JornadasGuardia: React.FC<JornadasGuardiaProps> = ({
  guardias,
  onChange,
}) => {
  const [errors, setErrors] = useState<{ [key: number]: string }>({});
  const timeOptions = generateTimeOptions();

  const handleAdd = () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const newGuardia: JornadaGuardia = {
      fechaInicio: today,
      horaInicio: '20:00',
      fechaFin: tomorrow,
      horaFin: '09:00',
    };
    onChange([...guardias, newGuardia]);
  };

  const handleDelete = (index: number) => {
    const newGuardias = guardias.filter((_, i) => i !== index);
    onChange(newGuardias);

    // Limpiar errores del índice eliminado
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  const handleChange = (
    index: number,
    field: keyof JornadaGuardia,
    value: string
  ) => {
    const newGuardias = [...guardias];
    newGuardias[index] = { ...newGuardias[index], [field]: value };
    onChange(newGuardias);

    // Validar fechas y horas
    const guardia = newGuardias[index];
    const fechaInicioMs = new Date(`${guardia.fechaInicio}T${guardia.horaInicio}`).getTime();
    const fechaFinMs = new Date(`${guardia.fechaFin}T${guardia.horaFin}`).getTime();

    if (fechaFinMs <= fechaInicioMs) {
      setErrors({
        ...errors,
        [index]: 'La fecha/hora de fin debe ser posterior a la de inicio'
      });
    } else {
      const newErrors = { ...errors };
      delete newErrors[index];
      setErrors(newErrors);
    }
  };

  const calculateDuration = (guardia: JornadaGuardia): string => {
    if (!guardia.fechaInicio || !guardia.horaInicio || !guardia.fechaFin || !guardia.horaFin) {
      return '0';
    }

    const fechaInicioMs = new Date(`${guardia.fechaInicio}T${guardia.horaInicio}`).getTime();
    const fechaFinMs = new Date(`${guardia.fechaFin}T${guardia.horaFin}`).getTime();

    const duracionMs = fechaFinMs - fechaInicioMs;
    const duracionHoras = duracionMs / (1000 * 60 * 60);

    return duracionHoras.toFixed(1);
  };

  // Ordenar guardias por fecha de inicio
  const guardiasOrdenadas = [...guardias].sort((a, b) =>
    a.fechaInicio.localeCompare(b.fechaInicio)
  );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Jornadas de Guardia
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Configure las fechas y horarios de guardia de la farmacia. Las guardias
          suelen tener horarios especiales fuera del horario habitual.
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd}>
          Añadir Guardia
        </Button>
      </Box>

      {guardias.length === 0 ? (
        <Alert severity="info">
          No hay guardias configuradas. Añada las fechas en las que la farmacia
          estará de guardia.
        </Alert>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <Alert severity="info">
              <Typography variant="subtitle2">
                Total de guardias programadas: {guardias.length}
              </Typography>
            </Alert>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha Inicio</TableCell>
                  <TableCell>Hora Inicio</TableCell>
                  <TableCell>Fecha Fin</TableCell>
                  <TableCell>Hora Fin</TableCell>
                  <TableCell>Duración</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {guardiasOrdenadas.map((guardia) => {
                  const originalIndex = guardias.findIndex(
                    (g) =>
                      g.fechaInicio === guardia.fechaInicio &&
                      g.horaInicio === guardia.horaInicio &&
                      g.fechaFin === guardia.fechaFin &&
                      g.horaFin === guardia.horaFin
                  );
                  const duracion = calculateDuration(guardia);
                  const esDuracionLarga = parseFloat(duracion) > 12;

                  return (
                    <TableRow key={originalIndex}>
                      <TableCell>
                        <TextField
                          type="date"
                          size="small"
                          value={guardia.fechaInicio}
                          onChange={(e) =>
                            handleChange(originalIndex, 'fechaInicio', e.target.value)
                          }
                          InputLabelProps={{ shrink: true }}
                          helperText={formatDateDisplay(guardia.fechaInicio)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={guardia.horaInicio}
                          onChange={(e) =>
                            handleChange(originalIndex, 'horaInicio', e.target.value)
                          }
                          error={!!errors[originalIndex]}
                          sx={{ minWidth: 100 }}
                        >
                          {timeOptions.map((time) => (
                            <MenuItem key={time} value={time}>
                              {time}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="date"
                          size="small"
                          value={guardia.fechaFin}
                          onChange={(e) =>
                            handleChange(originalIndex, 'fechaFin', e.target.value)
                          }
                          InputLabelProps={{ shrink: true }}
                          helperText={formatDateDisplay(guardia.fechaFin)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={guardia.horaFin}
                          onChange={(e) =>
                            handleChange(originalIndex, 'horaFin', e.target.value)
                          }
                          error={!!errors[originalIndex]}
                          sx={{ minWidth: 100 }}
                        >
                          {timeOptions.map((time) => (
                            <MenuItem key={time} value={time}>
                              {time}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${duracion}h`}
                          size="small"
                          color={parseFloat(duracion) > 0 ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={esDuracionLarga ? '24h' : 'Nocturna'}
                          size="small"
                          color={esDuracionLarga ? 'error' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(originalIndex)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {Object.keys(errors).length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Errores de validación:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {Object.entries(errors).map(([index, error]) => (
                  <li key={index}>
                    Guardia {parseInt(index) + 1}: {error}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Nota:</strong> Las guardias pueden abarcar múltiples días. Por
              ejemplo, una guardia nocturna puede iniciar el día 15 a las 20:00 y
              finalizar el día 16 a las 09:00 (13 horas de duración).
            </Typography>
          </Alert>
        </>
      )}
    </Box>
  );
};

export default JornadasGuardia;
