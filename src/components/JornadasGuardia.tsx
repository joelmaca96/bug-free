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
  validarHorario,
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
    const newGuardia: JornadaGuardia = {
      fecha: today,
      inicio: '20:00',
      fin: '09:00',
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

    // Validar si se cambió inicio o fin
    if (field === 'inicio' || field === 'fin') {
      const guardia = newGuardias[index];
      const validacion = validarHorario(guardia.inicio, guardia.fin, 'Guardia');

      if (!validacion.valido) {
        setErrors({ ...errors, [index]: validacion.errores.join(', ') });
      } else {
        const newErrors = { ...errors };
        delete newErrors[index];
        setErrors(newErrors);
      }
    }
  };

  const calculateDuration = (inicio: string, fin: string): string => {
    if (!inicio || !fin) return '0';

    const [hi, mi] = inicio.split(':').map(Number);
    const [hf, mf] = fin.split(':').map(Number);

    let totalHoras = hf - hi + (mf - mi) / 60;

    // Si el fin es menor que el inicio, asumimos que cruza medianoche
    if (totalHoras < 0) {
      totalHoras += 24;
    }

    return totalHoras.toFixed(1);
  };

  // Ordenar guardias por fecha
  const guardiasOrdenadas = [...guardias].sort((a, b) =>
    a.fecha.localeCompare(b.fecha)
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
                  <TableCell>Fecha</TableCell>
                  <TableCell>Hora Inicio</TableCell>
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
                      g.fecha === guardia.fecha &&
                      g.inicio === guardia.inicio &&
                      g.fin === guardia.fin
                  );
                  const duracion = calculateDuration(guardia.inicio, guardia.fin);
                  const esDuracionLarga = parseFloat(duracion) > 12;

                  return (
                    <TableRow key={originalIndex}>
                      <TableCell>
                        <TextField
                          type="date"
                          size="small"
                          value={guardia.fecha}
                          onChange={(e) =>
                            handleChange(originalIndex, 'fecha', e.target.value)
                          }
                          InputLabelProps={{ shrink: true }}
                          helperText={formatDateDisplay(guardia.fecha)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={guardia.inicio}
                          onChange={(e) =>
                            handleChange(originalIndex, 'inicio', e.target.value)
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
                          select
                          size="small"
                          value={guardia.fin}
                          onChange={(e) =>
                            handleChange(originalIndex, 'fin', e.target.value)
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
              <strong>Nota:</strong> Las guardias pueden cruzar medianoche. Por
              ejemplo, 20:00 - 09:00 representa una guardia nocturna de 13 horas.
            </Typography>
          </Alert>
        </>
      )}
    </Box>
  );
};

export default JornadasGuardia;
