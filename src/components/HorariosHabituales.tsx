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
import { HorarioHabitual } from '@/types';
import { DIAS_SEMANA, generateTimeOptions, validarHorario } from '@/utils/dateTimeUtils';

interface HorariosHabitualesProps {
  horarios: HorarioHabitual[];
  onChange: (horarios: HorarioHabitual[]) => void;
}

const HorariosHabituales: React.FC<HorariosHabitualesProps> = ({
  horarios,
  onChange,
}) => {
  const [errors, setErrors] = useState<{ [key: number]: string }>({});
  const timeOptions = generateTimeOptions();

  const handleAdd = () => {
    const newHorario: HorarioHabitual = {
      dia: 1, // Lunes por defecto
      inicio: '09:00',
      fin: '14:00',
    };
    onChange([...(horarios || []), newHorario]);
  };

  const handleDelete = (index: number) => {
    if (!horarios) return;
    const newHorarios = horarios.filter((_, i) => i !== index);
    onChange(newHorarios);

    // Limpiar errores del índice eliminado
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  const handleChange = (
    index: number,
    field: keyof HorarioHabitual,
    value: string | number
  ) => {
    if (!horarios) return;
    const newHorarios = [...horarios];
    newHorarios[index] = { ...newHorarios[index], [field]: value };
    onChange(newHorarios);

    // Validar si se cambió inicio o fin
    if (field === 'inicio' || field === 'fin') {
      const horario = newHorarios[index];
      const validacion = validarHorario(horario.inicio, horario.fin);

      if (!validacion.valido) {
        setErrors({ ...errors, [index]: validacion.errores.join(', ') });
      } else {
        const newErrors = { ...errors };
        delete newErrors[index];
        setErrors(newErrors);
      }
    }
  };

  const getHorariosPorDia = () => {
    const porDia: { [key: number]: HorarioHabitual[] } = {};
    if (!horarios || !Array.isArray(horarios)) {
      return porDia;
    }
    horarios.forEach((horario) => {
      if (!porDia[horario.dia]) {
        porDia[horario.dia] = [];
      }
      porDia[horario.dia].push(horario);
    });
    return porDia;
  };

  const horariosPorDia = getHorariosPorDia();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Horarios Habituales de Apertura
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Configure los horarios de apertura habituales de la farmacia para cada día
          de la semana. Puede añadir múltiples franjas horarias por día.
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          Añadir Horario
        </Button>
      </Box>

      {!horarios || horarios.length === 0 ? (
        <Alert severity="info">
          No hay horarios configurados. Añada al menos un horario para cada día
          que la farmacia esté abierta.
        </Alert>
      ) : (
        <>
          {/* Resumen por día */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Resumen Semanal:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {DIAS_SEMANA.map((dia) => {
                const horariosDelDia = horariosPorDia[dia.value] || [];
                return (
                  <Chip
                    key={dia.value}
                    label={`${dia.label}: ${
                      horariosDelDia.length > 0
                        ? `${horariosDelDia.length} franja${horariosDelDia.length > 1 ? 's' : ''}`
                        : 'Cerrado'
                    }`}
                    color={horariosDelDia.length > 0 ? 'primary' : 'default'}
                    variant={horariosDelDia.length > 0 ? 'filled' : 'outlined'}
                  />
                );
              })}
            </Box>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Día</TableCell>
                  <TableCell>Hora Inicio</TableCell>
                  <TableCell>Hora Fin</TableCell>
                  <TableCell>Duración</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {horarios.map((horario, index) => {
                  const duracion =
                    horario.inicio && horario.fin
                      ? (() => {
                          const [hi, mi] = horario.inicio.split(':').map(Number);
                          const [hf, mf] = horario.fin.split(':').map(Number);
                          const totalHoras = hf - hi + (mf - mi) / 60;
                          return totalHoras.toFixed(1);
                        })()
                      : '0';

                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={horario.dia}
                          onChange={(e) =>
                            handleChange(index, 'dia', parseInt(e.target.value))
                          }
                          sx={{ minWidth: 130 }}
                        >
                          {DIAS_SEMANA.map((dia) => (
                            <MenuItem key={dia.value} value={dia.value}>
                              {dia.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={horario.inicio}
                          onChange={(e) =>
                            handleChange(index, 'inicio', e.target.value)
                          }
                          error={!!errors[index]}
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
                          value={horario.fin}
                          onChange={(e) =>
                            handleChange(index, 'fin', e.target.value)
                          }
                          error={!!errors[index]}
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
                          color={parseFloat(duracion) > 0 ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(index)}
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
                    Horario {parseInt(index) + 1}: {error}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </>
      )}
    </Box>
  );
};

export default HorariosHabituales;
