import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Alert,
  Paper,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EventIcon from '@mui/icons-material/Event';
import { formatDateDisplay, isValidDate } from '@/utils/dateTimeUtils';

interface FestivosRegionalesProps {
  festivos: string[];
  onChange: (festivos: string[]) => void;
}

const FestivosRegionales: React.FC<FestivosRegionalesProps> = ({
  festivos,
  onChange,
}) => {
  const [newFestivo, setNewFestivo] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!newFestivo) {
      setError('Debe seleccionar una fecha');
      return;
    }

    if (!isValidDate(newFestivo)) {
      setError('Fecha inválida');
      return;
    }

    // Verificar que no esté duplicada
    if (festivos.includes(newFestivo)) {
      setError('Esta fecha ya está añadida');
      return;
    }

    onChange([...festivos, newFestivo]);
    setNewFestivo('');
    setError('');
  };

  const handleDelete = (fecha: string) => {
    onChange(festivos.filter((f) => f !== fecha));
  };

  // Agrupar festivos por año
  const festivosPorAnio = festivos.reduce((acc, festivo) => {
    const year = new Date(festivo).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(festivo);
    return acc;
  }, {} as { [key: number]: string[] });

  // Ordenar festivos por fecha
  Object.keys(festivosPorAnio).forEach((year) => {
    festivosPorAnio[parseInt(year)].sort();
  });

  // Festivos comunes de España (sugerencias)
  const festivosSugeridos = [
    { nombre: 'Año Nuevo', fecha: `${new Date().getFullYear()}-01-01` },
    { nombre: 'Reyes', fecha: `${new Date().getFullYear()}-01-06` },
    { nombre: 'Día del Trabajador', fecha: `${new Date().getFullYear()}-05-01` },
    { nombre: 'Asunción', fecha: `${new Date().getFullYear()}-08-15` },
    { nombre: 'Día de la Hispanidad', fecha: `${new Date().getFullYear()}-10-12` },
    { nombre: 'Todos los Santos', fecha: `${new Date().getFullYear()}-11-01` },
    { nombre: 'Constitución', fecha: `${new Date().getFullYear()}-12-06` },
    { nombre: 'Inmaculada', fecha: `${new Date().getFullYear()}-12-08` },
    { nombre: 'Navidad', fecha: `${new Date().getFullYear()}-12-25` },
  ].filter((f) => !festivos.includes(f.fecha));

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Festivos Regionales
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Configure los festivos regionales y locales. Estos días serán
          considerados en la generación de horarios y pueden tener requisitos
          especiales de personal.
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Añadir Festivo
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <TextField
            type="date"
            fullWidth
            value={newFestivo}
            onChange={(e) => {
              setNewFestivo(e.target.value);
              setError('');
            }}
            error={!!error}
            helperText={error}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            sx={{ minWidth: 120 }}
          >
            Añadir
          </Button>
        </Box>
      </Paper>

      {festivosSugeridos.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            Festivos Sugeridos (España)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {festivosSugeridos.map((festivo) => (
              <Chip
                key={festivo.fecha}
                label={festivo.nombre}
                onClick={() => {
                  setNewFestivo(festivo.fecha);
                  setError('');
                }}
                clickable
                icon={<EventIcon />}
              />
            ))}
          </Box>
        </Paper>
      )}

      {festivos.length === 0 ? (
        <Alert severity="info">
          No hay festivos configurados. Añada los festivos regionales y locales
          que apliquen a su farmacia.
        </Alert>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <Alert severity="success">
              <Typography variant="subtitle2">
                Total de festivos configurados: {festivos.length}
              </Typography>
            </Alert>
          </Box>

          {Object.entries(festivosPorAnio)
            .sort(([a], [b]) => parseInt(b) - parseInt(a))
            .map(([year, festivosDelAnio]) => (
              <Box key={year} sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {year}
                  <Chip
                    label={`${festivosDelAnio.length} festivos`}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Typography>
                <List>
                  {festivosDelAnio.map((festivo) => (
                    <ListItem
                      key={festivo}
                      sx={{
                        bgcolor: 'background.paper',
                        mb: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <ListItemText
                        primary={formatDateDisplay(festivo)}
                        secondary={new Date(festivo).toLocaleDateString('es-ES', {
                          weekday: 'long',
                        })}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          color="error"
                          onClick={() => handleDelete(festivo)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            ))}
        </>
      )}

      <Alert severity="warning" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Nota:</strong> Los festivos regionales afectan la disponibilidad
          de empleados y los requisitos de personal. Asegúrese de incluir todos los
          festivos oficiales de su comunidad autónoma y localidad.
        </Typography>
      </Alert>
    </Box>
  );
};

export default FestivosRegionales;
