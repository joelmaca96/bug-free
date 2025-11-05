import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  Button,
  Slider,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import { useAuth } from '@/contexts/AuthContext';
import { ConfiguracionAlgoritmo, EstrategiaOptimizacion } from '@/types';
import {
  getOrCreateConfiguracion,
  updateConfiguracion,
  getDefaultConfig,
} from '@/services/configuracionAlgoritmoService';

const ConfiguracionAlgoritmoPage: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<ConfiguracionAlgoritmo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, [user]);

  const loadConfiguration = async () => {
    if (!user?.farmaciaId) return;

    try {
      setLoading(true);
      const configuracion = await getOrCreateConfiguracion(user.farmaciaId);
      setConfig(configuracion);
    } catch (err) {
      setError('Error al cargar la configuración');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config || !user?.farmaciaId) return;

    try {
      setSaving(true);
      setError(null);

      console.log('Guardando configuración:', {
        id: config.id,
        farmaciaId: user.farmaciaId,
        config
      });

      await updateConfiguracion(config.id, {
        prioridades: config.prioridades,
        restricciones: config.restricciones,
        parametrosOptimizacion: config.parametrosOptimizacion,
      });

      console.log('Configuración guardada exitosamente');
      setSuccess('Configuración guardada correctamente en la base de datos');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMsg = `Error al guardar la configuración: ${err.message || err}`;
      setError(errorMsg);
      console.error('Error al guardar configuración:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!user?.farmaciaId) return;

    const defaultConfig = getDefaultConfig(user.farmaciaId);
    setConfig({
      ...config!,
      prioridades: defaultConfig.prioridades,
      restricciones: defaultConfig.restricciones,
      parametrosOptimizacion: defaultConfig.parametrosOptimizacion,
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!config) {
    return (
      <Box p={3}>
        <Alert severity="error">No se pudo cargar la configuración</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Configuración del Algoritmo
      </Typography>

      <Typography variant="body1" color="textSecondary" paragraph>
        Ajusta los parámetros del algoritmo de asignación de turnos para optimizar la generación
        de horarios según las necesidades de tu farmacia.
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

      {/* Prioridades */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Prioridades del Algoritmo
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Ajusta los pesos de cada factor. Mayor peso = mayor importancia.
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.prioridades.coberturaMinima.activo}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          prioridades: {
                            ...config.prioridades,
                            coberturaMinima: {
                              ...config.prioridades.coberturaMinima,
                              activo: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                  }
                  label="Cobertura Mínima"
                />
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Prioriza cubrir el número mínimo de trabajadores requeridos
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Typography variant="caption">Peso: {config.prioridades.coberturaMinima.peso}</Typography>
                  <Slider
                    value={config.prioridades.coberturaMinima.peso}
                    onChange={(_, value) =>
                      setConfig({
                        ...config,
                        prioridades: {
                          ...config.prioridades,
                          coberturaMinima: {
                            ...config.prioridades.coberturaMinima,
                            peso: value as number,
                          },
                        },
                      })
                    }
                    min={0}
                    max={100}
                    disabled={!config.prioridades.coberturaMinima.activo}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.prioridades.limitesHoras.activo}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          prioridades: {
                            ...config.prioridades,
                            limitesHoras: {
                              ...config.prioridades.limitesHoras,
                              activo: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                  }
                  label="Límites de Horas"
                />
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Respeta los límites de horas de cada empleado
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Typography variant="caption">Peso: {config.prioridades.limitesHoras.peso}</Typography>
                  <Slider
                    value={config.prioridades.limitesHoras.peso}
                    onChange={(_, value) =>
                      setConfig({
                        ...config,
                        prioridades: {
                          ...config.prioridades,
                          limitesHoras: {
                            ...config.prioridades.limitesHoras,
                            peso: value as number,
                          },
                        },
                      })
                    }
                    min={0}
                    max={100}
                    disabled={!config.prioridades.limitesHoras.activo}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.prioridades.distribucionGuardias.activo}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          prioridades: {
                            ...config.prioridades,
                            distribucionGuardias: {
                              ...config.prioridades.distribucionGuardias,
                              activo: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                  }
                  label="Distribución de Guardias"
                />
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Distribuye las guardias equitativamente entre empleados
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Typography variant="caption">
                    Peso: {config.prioridades.distribucionGuardias.peso}
                  </Typography>
                  <Slider
                    value={config.prioridades.distribucionGuardias.peso}
                    onChange={(_, value) =>
                      setConfig({
                        ...config,
                        prioridades: {
                          ...config.prioridades,
                          distribucionGuardias: {
                            ...config.prioridades.distribucionGuardias,
                            peso: value as number,
                          },
                        },
                      })
                    }
                    min={0}
                    max={100}
                    disabled={!config.prioridades.distribucionGuardias.activo}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.prioridades.distribucionFestivos.activo}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          prioridades: {
                            ...config.prioridades,
                            distribucionFestivos: {
                              ...config.prioridades.distribucionFestivos,
                              activo: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                  }
                  label="Distribución de Festivos"
                />
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Distribuye los turnos festivos equitativamente
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Typography variant="caption">
                    Peso: {config.prioridades.distribucionFestivos.peso}
                  </Typography>
                  <Slider
                    value={config.prioridades.distribucionFestivos.peso}
                    onChange={(_, value) =>
                      setConfig({
                        ...config,
                        prioridades: {
                          ...config.prioridades,
                          distribucionFestivos: {
                            ...config.prioridades.distribucionFestivos,
                            peso: value as number,
                          },
                        },
                      })
                    }
                    min={0}
                    max={100}
                    disabled={!config.prioridades.distribucionFestivos.activo}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.prioridades.minimizarCambiosTurno.activo}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          prioridades: {
                            ...config.prioridades,
                            minimizarCambiosTurno: {
                              ...config.prioridades.minimizarCambiosTurno,
                              activo: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                  }
                  label="Minimizar Cambios de Turno"
                />
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Mantiene patrones consistentes de turnos
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Typography variant="caption">
                    Peso: {config.prioridades.minimizarCambiosTurno.peso}
                  </Typography>
                  <Slider
                    value={config.prioridades.minimizarCambiosTurno.peso}
                    onChange={(_, value) =>
                      setConfig({
                        ...config,
                        prioridades: {
                          ...config.prioridades,
                          minimizarCambiosTurno: {
                            ...config.prioridades.minimizarCambiosTurno,
                            peso: value as number,
                          },
                        },
                      })
                    }
                    min={0}
                    max={100}
                    disabled={!config.prioridades.minimizarCambiosTurno.activo}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Restricciones */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Restricciones Obligatorias
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Estas restricciones no se pueden violar al generar horarios.
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Descanso Mínimo Entre Jornadas (horas)"
              value={config.restricciones.descansoMinimoEntreJornadas}
              onChange={(e) =>
                setConfig({
                  ...config,
                  restricciones: {
                    ...config.restricciones,
                    descansoMinimoEntreJornadas: Number(e.target.value),
                  },
                })
              }
              inputProps={{ min: 8, max: 24 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Máximo Turnos Consecutivos (días)"
              value={config.restricciones.maxTurnosConsecutivos}
              onChange={(e) =>
                setConfig({
                  ...config,
                  restricciones: {
                    ...config.restricciones,
                    maxTurnosConsecutivos: Number(e.target.value),
                  },
                })
              }
              inputProps={{ min: 1, max: 14 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Máximo Horas Diarias"
              value={config.restricciones.maxHorasDiarias}
              onChange={(e) =>
                setConfig({
                  ...config,
                  restricciones: {
                    ...config.restricciones,
                    maxHorasDiarias: Number(e.target.value),
                  },
                })
              }
              inputProps={{ min: 6, max: 16 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Margen de Sobrecarga (%)"
              value={config.restricciones.margenSobrecarga}
              onChange={(e) =>
                setConfig({
                  ...config,
                  restricciones: {
                    ...config.restricciones,
                    margenSobrecarga: Number(e.target.value),
                  },
                })
              }
              inputProps={{ min: 0, max: 50 }}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.restricciones.permitirHorasExtra}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      restricciones: {
                        ...config.restricciones,
                        permitirHorasExtra: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="Permitir Horas Extra"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Parámetros de Optimización */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Parámetros de Optimización
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" gutterBottom>
              Estrategia de Optimización
            </Typography>
            <Select
              fullWidth
              value={config.parametrosOptimizacion.estrategia}
              onChange={(e) =>
                setConfig({
                  ...config,
                  parametrosOptimizacion: {
                    ...config.parametrosOptimizacion,
                    estrategia: e.target.value as EstrategiaOptimizacion,
                  },
                })
              }
            >
              <MenuItem value="greedy">Greedy (Rápido)</MenuItem>
              <MenuItem value="backtracking">Backtracking (Preciso)</MenuItem>
              <MenuItem value="genetico">Genético (Óptimo)</MenuItem>
            </Select>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Máximo de Iteraciones"
              value={config.parametrosOptimizacion.maxIteraciones}
              onChange={(e) =>
                setConfig({
                  ...config,
                  parametrosOptimizacion: {
                    ...config.parametrosOptimizacion,
                    maxIteraciones: Number(e.target.value),
                  },
                })
              }
              inputProps={{ min: 100, max: 10000 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Umbral de Aceptación (0-1)"
              value={config.parametrosOptimizacion.umbralAceptacion}
              onChange={(e) =>
                setConfig({
                  ...config,
                  parametrosOptimizacion: {
                    ...config.parametrosOptimizacion,
                    umbralAceptacion: Number(e.target.value),
                  },
                })
              }
              inputProps={{ min: 0, max: 1, step: 0.1 }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Acciones */}
      <Box display="flex" gap={2}>
        <Button
          variant="contained"
          color="primary"
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          Guardar Configuración
        </Button>

        <Button
          variant="outlined"
          startIcon={<RestoreIcon />}
          onClick={handleReset}
          disabled={saving}
        >
          Restaurar Valores Por Defecto
        </Button>
      </Box>
    </Box>
  );
};

export default ConfiguracionAlgoritmoPage;
