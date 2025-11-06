import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Divider,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Box,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { createEmpresaConAdmin } from '@/services/empresasService';
import {
  validateEmail,
  validateNIF,
  validatePhone,
  validateName,
  validationMessages,
} from '@/utils/validations';

interface CreateEmpresaConAdminDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateEmpresaConAdminDialog: React.FC<CreateEmpresaConAdminDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [empresaData, setEmpresaData] = useState({
    cif: '',
    nombre: '',
    direccion: '',
    contacto: '',
  });

  const [adminData, setAdminData] = useState({
    email: '',
    password: '',
    datosPersonales: {
      nombre: '',
      apellidos: '',
      nif: '',
      email: '',
      telefono: '',
    },
  });

  const [errors, setErrors] = useState({
    empresaCif: '',
    empresaNombre: '',
    empresaDireccion: '',
    empresaContacto: '',
    adminNombre: '',
    adminApellidos: '',
    adminNif: '',
    adminEmail: '',
    adminTelefono: '',
    adminPassword: '',
  });

  const steps = ['Datos de la Empresa', 'Datos del Administrador', 'Confirmar'];

  const validateEmpresaStep = (): boolean => {
    const newErrors = { ...errors };
    let isValid = true;

    if (!empresaData.cif || empresaData.cif.length < 9) {
      newErrors.empresaCif = 'CIF inválido';
      isValid = false;
    } else {
      newErrors.empresaCif = '';
    }

    if (!empresaData.nombre || empresaData.nombre.length < 3) {
      newErrors.empresaNombre = 'Nombre debe tener al menos 3 caracteres';
      isValid = false;
    } else {
      newErrors.empresaNombre = '';
    }

    if (!empresaData.direccion) {
      newErrors.empresaDireccion = 'La dirección es requerida';
      isValid = false;
    } else {
      newErrors.empresaDireccion = '';
    }

    if (!empresaData.contacto) {
      newErrors.empresaContacto = 'El contacto es requerido';
      isValid = false;
    } else {
      newErrors.empresaContacto = '';
    }

    setErrors(newErrors);
    return isValid;
  };

  const validateAdminStep = (): boolean => {
    const newErrors = { ...errors };
    let isValid = true;

    if (!validateName(adminData.datosPersonales.nombre)) {
      newErrors.adminNombre = validationMessages.name;
      isValid = false;
    } else {
      newErrors.adminNombre = '';
    }

    if (!validateName(adminData.datosPersonales.apellidos)) {
      newErrors.adminApellidos = validationMessages.name;
      isValid = false;
    } else {
      newErrors.adminApellidos = '';
    }

    if (!validateNIF(adminData.datosPersonales.nif)) {
      newErrors.adminNif = validationMessages.nif;
      isValid = false;
    } else {
      newErrors.adminNif = '';
    }

    if (!validateEmail(adminData.email)) {
      newErrors.adminEmail = validationMessages.email;
      isValid = false;
    } else {
      newErrors.adminEmail = '';
    }

    if (!validatePhone(adminData.datosPersonales.telefono)) {
      newErrors.adminTelefono = validationMessages.phone;
      isValid = false;
    } else {
      newErrors.adminTelefono = '';
    }

    if (!adminData.password || adminData.password.length < 6) {
      newErrors.adminPassword = 'La contraseña debe tener al menos 6 caracteres';
      isValid = false;
    } else {
      newErrors.adminPassword = '';
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    setError('');

    if (activeStep === 0) {
      if (!validateEmpresaStep()) {
        setError('Por favor, corrige los errores antes de continuar');
        return;
      }
    } else if (activeStep === 1) {
      if (!validateAdminStep()) {
        setError('Por favor, corrige los errores antes de continuar');
        return;
      }
      // Sincronizar email del admin
      setAdminData({
        ...adminData,
        datosPersonales: {
          ...adminData.datosPersonales,
          email: adminData.email,
        },
      });
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Sincronizar email
      const finalAdminData = {
        ...adminData,
        datosPersonales: {
          ...adminData.datosPersonales,
          email: adminData.email,
        },
      };

      await createEmpresaConAdmin(empresaData, finalAdminData);
      onSuccess();
      handleClose();
    } catch (err: any) {
      const errorMessage =
        err.code === 'auth/email-already-in-use'
          ? 'El email ya está en uso'
          : err.message || 'Error al crear empresa y administrador';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setEmpresaData({
      cif: '',
      nombre: '',
      direccion: '',
      contacto: '',
    });
    setAdminData({
      email: '',
      password: '',
      datosPersonales: {
        nombre: '',
        apellidos: '',
        nif: '',
        email: '',
        telefono: '',
      },
    });
    setErrors({
      empresaCif: '',
      empresaNombre: '',
      empresaDireccion: '',
      empresaContacto: '',
      adminNombre: '',
      adminApellidos: '',
      adminNif: '',
      adminEmail: '',
      adminTelefono: '',
      adminPassword: '',
    });
    setError('');
    onClose();
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Ingresa los datos de la nueva empresa
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="CIF"
                value={empresaData.cif}
                onChange={(e) => setEmpresaData({ ...empresaData, cif: e.target.value })}
                error={!!errors.empresaCif}
                helperText={errors.empresaCif}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombre de la Empresa"
                value={empresaData.nombre}
                onChange={(e) => setEmpresaData({ ...empresaData, nombre: e.target.value })}
                error={!!errors.empresaNombre}
                helperText={errors.empresaNombre}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Dirección"
                value={empresaData.direccion}
                onChange={(e) => setEmpresaData({ ...empresaData, direccion: e.target.value })}
                error={!!errors.empresaDireccion}
                helperText={errors.empresaDireccion}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Contacto"
                value={empresaData.contacto}
                onChange={(e) => setEmpresaData({ ...empresaData, contacto: e.target.value })}
                error={!!errors.empresaContacto}
                helperText={errors.empresaContacto}
                required
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Ingresa los datos del administrador de la empresa
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombre"
                value={adminData.datosPersonales.nombre}
                onChange={(e) =>
                  setAdminData({
                    ...adminData,
                    datosPersonales: { ...adminData.datosPersonales, nombre: e.target.value },
                  })
                }
                error={!!errors.adminNombre}
                helperText={errors.adminNombre}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Apellidos"
                value={adminData.datosPersonales.apellidos}
                onChange={(e) =>
                  setAdminData({
                    ...adminData,
                    datosPersonales: { ...adminData.datosPersonales, apellidos: e.target.value },
                  })
                }
                error={!!errors.adminApellidos}
                helperText={errors.adminApellidos}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="NIF/NIE"
                value={adminData.datosPersonales.nif}
                onChange={(e) =>
                  setAdminData({
                    ...adminData,
                    datosPersonales: { ...adminData.datosPersonales, nif: e.target.value },
                  })
                }
                error={!!errors.adminNif}
                helperText={errors.adminNif}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Teléfono"
                value={adminData.datosPersonales.telefono}
                onChange={(e) =>
                  setAdminData({
                    ...adminData,
                    datosPersonales: { ...adminData.datosPersonales, telefono: e.target.value },
                  })
                }
                error={!!errors.adminTelefono}
                helperText={errors.adminTelefono}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="email"
                label="Email"
                value={adminData.email}
                onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                error={!!errors.adminEmail}
                helperText={errors.adminEmail}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Contraseña"
                value={adminData.password}
                onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                error={!!errors.adminPassword}
                helperText={errors.adminPassword || 'Mínimo 6 caracteres'}
                required
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Revisa los datos antes de crear la empresa y el administrador
            </Alert>

            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon /> Datos de la Empresa
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={1} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  CIF:
                </Typography>
                <Typography variant="body1">{empresaData.cif}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Nombre:
                </Typography>
                <Typography variant="body1">{empresaData.nombre}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Dirección:
                </Typography>
                <Typography variant="body1">{empresaData.direccion}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Contacto:
                </Typography>
                <Typography variant="body1">{empresaData.contacto}</Typography>
              </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonAddIcon /> Datos del Administrador
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Nombre Completo:
                </Typography>
                <Typography variant="body1">
                  {adminData.datosPersonales.nombre} {adminData.datosPersonales.apellidos}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  NIF:
                </Typography>
                <Typography variant="body1">{adminData.datosPersonales.nif}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Email:
                </Typography>
                <Typography variant="body1">{adminData.email}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Teléfono:
                </Typography>
                <Typography variant="body1">{adminData.datosPersonales.telefono}</Typography>
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Crear Empresa con Administrador</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ pt: 2, pb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {renderStepContent(activeStep)}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Atrás
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button variant="contained" onClick={handleNext} disabled={loading}>
            Siguiente
          </Button>
        ) : (
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creando...' : 'Crear Empresa y Admin'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CreateEmpresaConAdminDialog;
