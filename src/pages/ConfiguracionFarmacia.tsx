import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Tabs,
  Tab,
  Typography,
  Paper,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import EventIcon from '@mui/icons-material/Event';
import { useAuth } from '@/contexts/AuthContext';
import { getFarmaciaById, updateFarmacia } from '@/services/farmaciasRealtimeService';
import { Farmacia, JornadaGuardia, ConfiguracionCobertura } from '@/types';
import { validarConfiguracionFarmacia } from '@/utils/scheduleValidations';
import { migrarSiEsNecesario } from '@/utils/migrateGuardias';
import JornadasGuardia from '@/components/JornadasGuardia';
import FestivosRegionales from '@/components/FestivosRegionales';
import ConfiguracionesCobertura from '@/components/ConfiguracionesCobertura';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const ConfiguracionFarmacia: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [farmacia, setFarmacia] = useState<Farmacia | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const [configuracion, setConfiguracion] = useState({
    jornadasGuardia: [] as JornadaGuardia[],
    festivosRegionales: [] as string[],
    trabajadoresMinimos: 1,
    configuracionesCobertura: [] as ConfiguracionCobertura[],
  });

  useEffect(() => {
    loadFarmacia();
  }, [user]);

  const loadFarmacia = async () => {
    try {
      setLoading(true);
      if (!user?.farmaciaId) {
        showSnackbar('No se encontró farmacia asociada', 'error');
        return;
      }

      const farmaciaData = await getFarmaciaById(user.farmaciaId);
      if (farmaciaData) {
        setFarmacia(farmaciaData);

        // Migrar guardias del formato antiguo al nuevo si es necesario
        const guardiasActualizadas = migrarSiEsNecesario(
          farmaciaData.configuracion.jornadasGuardia || []
        );

        setConfiguracion({
          ...farmaciaData.configuracion,
          jornadasGuardia: guardiasActualizadas,
          configuracionesCobertura: farmaciaData.configuracion.configuracionesCobertura || [],
        });
      }
    } catch (error) {
      showSnackbar('Error al cargar configuración', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validar configuración
      const validacion = validarConfiguracionFarmacia(configuracion);

      if (!validacion.valido) {
        const todosErrores = [
          ...validacion.errores.jornadasGuardia,
          ...validacion.errores.festivosRegionales,
          ...validacion.errores.trabajadoresMinimos,
          ...validacion.errores.configuracionesCobertura,
        ];

        showSnackbar(
          `Errores de validación: ${todosErrores.join(', ')}`,
          'error'
        );
        return;
      }

      if (!farmacia) {
        showSnackbar('No se encontró farmacia', 'error');
        return;
      }

      await updateFarmacia(farmacia.id, { configuracion });
      showSnackbar('Configuración guardada correctamente', 'success');
    } catch (error) {
      showSnackbar('Error al guardar configuración', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGuardiasChange = (guardias: JornadaGuardia[]) => {
    setConfiguracion((prev) => ({
      ...prev,
      jornadasGuardia: guardias,
    }));
  };

  const handleFestivosChange = (festivos: string[]) => {
    setConfiguracion((prev) => ({
      ...prev,
      festivosRegionales: festivos,
    }));
  };

  const handleConfiguracionesCoberturaChange = (
    configuraciones: ConfiguracionCobertura[]
  ) => {
    setConfiguracion((prev) => ({
      ...prev,
      configuracionesCobertura: configuraciones,
    }));
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Configuración de Farmacia
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {farmacia?.nombre}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<ScheduleIcon />}
            label="Horarios"
            iconPosition="start"
          />
          <Tab
            icon={<LocalHospitalIcon />}
            label="Jornadas de Guardia"
            iconPosition="start"
          />
          <Tab
            icon={<EventIcon />}
            label="Festivos Regionales"
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tabValue} index={0}>
            <ConfiguracionesCobertura
              configuraciones={configuracion.configuracionesCobertura || []}
              onChange={handleConfiguracionesCoberturaChange}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <JornadasGuardia
              guardias={configuracion.jornadasGuardia}
              onChange={handleGuardiasChange}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <FestivosRegionales
              festivos={configuracion.festivosRegionales}
              onChange={handleFestivosChange}
            />
          </TabPanel>
        </Box>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ConfiguracionFarmacia;
