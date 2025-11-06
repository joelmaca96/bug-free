import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getEmpresaById, updateEmpresa } from '@/services/empresasRealtimeService';
import { Empresa } from '@/types';

const MiEmpresa: React.FC = () => {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    cif: '',
    direccion: '',
    contacto: '',
  });

  useEffect(() => {
    loadEmpresa();
  }, [user]);

  const loadEmpresa = async () => {
    if (!user?.empresaId) {
      setError('No tienes una empresa asignada');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const empresaData = await getEmpresaById(user.empresaId);

      if (empresaData) {
        setEmpresa(empresaData);
        setFormData({
          nombre: empresaData.nombre,
          cif: empresaData.cif,
          direccion: empresaData.direccion,
          contacto: empresaData.contacto,
        });
      } else {
        setError('No se encontró la empresa');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar la empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresa) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await updateEmpresa(empresa.id, formData);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la empresa');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !empresa) {
    return (
      <Box>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Mi Empresa
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Empresa actualizada correctamente
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nombre de la Empresa"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="CIF"
                  name="cif"
                  value={formData.cif}
                  onChange={handleChange}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Dirección"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                  required
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contacto"
                  name="contacto"
                  value={formData.contacto}
                  onChange={handleChange}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end">
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={20} /> : null}
                  >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {empresa && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" color="text.secondary">
            Creado: {empresa.createdAt ? new Date(empresa.createdAt).toLocaleString('es-ES') : 'N/A'}
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary">
            Última actualización: {empresa.updatedAt ? new Date(empresa.updatedAt).toLocaleString('es-ES') : 'N/A'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MiEmpresa;
