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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  Chip,
  Paper,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { ConfiguracionCobertura } from '@/types';

// Generar ID único
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

interface ConfiguracionesCoberturaProps {
  configuraciones: ConfiguracionCobertura[];
  onChange: (configuraciones: ConfiguracionCobertura[]) => void;
}

const DIAS_SEMANA = [
  { valor: 0, nombre: 'Domingo', abrev: 'D' },
  { valor: 1, nombre: 'Lunes', abrev: 'L' },
  { valor: 2, nombre: 'Martes', abrev: 'M' },
  { valor: 3, nombre: 'Miércoles', abrev: 'X' },
  { valor: 4, nombre: 'Jueves', abrev: 'J' },
  { valor: 5, nombre: 'Viernes', abrev: 'V' },
  { valor: 6, nombre: 'Sábado', abrev: 'S' },
];

const ConfiguracionesCobertura: React.FC<ConfiguracionesCoberturaProps> = ({
  configuraciones,
  onChange,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentConfig, setCurrentConfig] = useState<ConfiguracionCobertura>({
    id: '',
    diasSemana: [1, 2, 3, 4, 5], // Lunes a Viernes por defecto
    horaInicio: 9,
    horaFin: 14,
    trabajadoresMinimos: 1,
    nombre: '',
  });
  const [errors, setErrors] = useState<string[]>([]);

  const handleOpenDialog = (index?: number) => {
    if (index !== undefined) {
      setEditingIndex(index);
      setCurrentConfig({ ...configuraciones[index] });
    } else {
      setEditingIndex(null);
      setCurrentConfig({
        id: generateId(),
        diasSemana: [1, 2, 3, 4, 5],
        horaInicio: 9,
        horaFin: 14,
        trabajadoresMinimos: 1,
        nombre: '',
      });
    }
    setErrors([]);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingIndex(null);
    setErrors([]);
  };

  const validateConfig = (): boolean => {
    const newErrors: string[] = [];

    if (!currentConfig.diasSemana || currentConfig.diasSemana.length === 0) {
      newErrors.push('Debe seleccionar al menos un día');
    }

    if (currentConfig.horaInicio >= currentConfig.horaFin) {
      newErrors.push('La hora de inicio debe ser menor que la hora de fin');
    }

    if (currentConfig.horaInicio < 0 || currentConfig.horaInicio > 23) {
      newErrors.push('La hora de inicio debe estar entre 0 y 23');
    }

    if (currentConfig.horaFin < 1 || currentConfig.horaFin > 24) {
      newErrors.push('La hora de fin debe estar entre 1 y 24');
    }

    if (
      currentConfig.trabajadoresMinimos < 1 ||
      currentConfig.trabajadoresMinimos > 50
    ) {
      newErrors.push('El número de trabajadores debe estar entre 1 y 50');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validateConfig()) {
      return;
    }

    const newConfiguraciones = [...(configuraciones || [])];
    if (editingIndex !== null) {
      newConfiguraciones[editingIndex] = currentConfig;
    } else {
      newConfiguraciones.push(currentConfig);
    }

    onChange(newConfiguraciones);
    handleCloseDialog();
  };

  const handleDelete = (index: number) => {
    const newConfiguraciones = configuraciones.filter((_, i) => i !== index);
    onChange(newConfiguraciones);
  };

  const handleDiaToggle = (dia: number) => {
    const newDiasSemana = currentConfig.diasSemana.includes(dia)
      ? currentConfig.diasSemana.filter((d) => d !== dia)
      : [...currentConfig.diasSemana, dia].sort((a, b) => a - b);

    setCurrentConfig({ ...currentConfig, diasSemana: newDiasSemana });
  };

  const getDiasNombre = (diasSemana: number[]): string => {
    if (diasSemana.length === 0) return 'Ningún día';
    if (diasSemana.length === 7) return 'Todos los días';

    // Verificar patrones comunes
    const laborables = [1, 2, 3, 4, 5];
    const finDeSemana = [0, 6];

    if (
      laborables.every((d) => diasSemana.includes(d)) &&
      diasSemana.length === 5
    ) {
      return 'Lunes a Viernes';
    }

    if (
      finDeSemana.every((d) => diasSemana.includes(d)) &&
      diasSemana.length === 2
    ) {
      return 'Sábado y Domingo';
    }

    // Mostrar abreviaturas
    return diasSemana
      .map((d) => DIAS_SEMANA.find((dia) => dia.valor === d)?.abrev)
      .join(', ');
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Horarios de la Farmacia
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Configure los días y horarios de apertura de la farmacia, junto con el
          número mínimo de empleados necesarios para cada franja horaria.
        </Typography>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ mb: 2 }}
        >
          Agregar Franja Horaria
        </Button>

        {(!configuraciones || configuraciones.length === 0) && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No hay configuraciones de cobertura definidas. Se usará el valor
            global de trabajadores mínimos para todos los horarios.
          </Alert>
        )}

        {configuraciones && configuraciones.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Días</TableCell>
                  <TableCell>Horario</TableCell>
                  <TableCell>Mín. Empleados</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {configuraciones.map((config, index) => (
                  <TableRow key={config.id || index}>
                    <TableCell>
                      {config.nombre || `Configuración ${index + 1}`}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getDiasNombre(config.diasSemana)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {String(config.horaInicio).padStart(2, '0')}:00 -{' '}
                      {String(config.horaFin).padStart(2, '0')}:00
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={config.trabajadoresMinimos}
                        size="small"
                        color="secondary"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(index)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(index)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Dialog de edición/creación */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingIndex !== null
            ? 'Editar Configuración'
            : 'Nueva Configuración'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {errors.length > 0 && (
              <Alert severity="error">
                {errors.map((error, i) => (
                  <div key={i}>{error}</div>
                ))}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Nombre (opcional)"
              value={currentConfig.nombre || ''}
              onChange={(e) =>
                setCurrentConfig({ ...currentConfig, nombre: e.target.value })
              }
              placeholder="ej. Horario mañana, Tardes tranquilas..."
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Días de la semana
              </Typography>
              <FormGroup row>
                {DIAS_SEMANA.map((dia) => (
                  <FormControlLabel
                    key={dia.valor}
                    control={
                      <Checkbox
                        checked={currentConfig.diasSemana.includes(dia.valor)}
                        onChange={() => handleDiaToggle(dia.valor)}
                      />
                    }
                    label={dia.nombre}
                  />
                ))}
              </FormGroup>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Franja horaria
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  type="number"
                  label="Hora inicio"
                  value={currentConfig.horaInicio}
                  onChange={(e) =>
                    setCurrentConfig({
                      ...currentConfig,
                      horaInicio: parseInt(e.target.value) || 0,
                    })
                  }
                  InputProps={{ inputProps: { min: 0, max: 23 } }}
                  helperText="0-23"
                />
                <Typography>a</Typography>
                <TextField
                  type="number"
                  label="Hora fin"
                  value={currentConfig.horaFin}
                  onChange={(e) =>
                    setCurrentConfig({
                      ...currentConfig,
                      horaFin: parseInt(e.target.value) || 24,
                    })
                  }
                  InputProps={{ inputProps: { min: 1, max: 24 } }}
                  helperText="1-24"
                />
              </Stack>
            </Box>

            <TextField
              type="number"
              label="Trabajadores mínimos"
              value={currentConfig.trabajadoresMinimos}
              onChange={(e) =>
                setCurrentConfig({
                  ...currentConfig,
                  trabajadoresMinimos: parseInt(e.target.value) || 1,
                })
              }
              InputProps={{ inputProps: { min: 1, max: 50 } }}
              helperText="Número mínimo de empleados necesarios en esta franja"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConfiguracionesCobertura;
