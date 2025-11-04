import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Grid,
  Typography,
  Chip,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import {
  getUsuarios,
  getUsuariosByFarmacia,
  updateUsuario,
  deleteUsuario,
} from '@/services/usuariosService';
import { getFarmacias } from '@/services/farmaciasService';
import { getEmpresas } from '@/services/empresasService';
import { Usuario, Farmacia, Empresa, UserRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  validateNIF,
  validateEmail,
  validatePhone,
  validateName,
  validateRestricciones,
  validationMessages,
} from '@/utils/validations';

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

const Empleados: React.FC = () => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [farmacias, setFarmacias] = useState<Farmacia[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const [formData, setFormData] = useState({
    datosPersonales: {
      nombre: '',
      apellidos: '',
      nif: '',
      email: '',
      telefono: '',
    },
    rol: 'empleado' as UserRole,
    farmaciaId: '',
    empresaId: '',
    restricciones: {
      horasMaximasDiarias: 10,
      horasMaximasSemanales: 40,
      horasMaximasMensuales: 160,
      horasMaximasAnuales: 1920,
      diasFestivos: [] as string[],
    },
  });

  const [errors, setErrors] = useState({
    nombre: '',
    apellidos: '',
    nif: '',
    email: '',
    telefono: '',
    restricciones: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [empresasData, farmaciasData] = await Promise.all([
        getEmpresas(),
        getFarmacias(),
      ]);

      setEmpresas(empresasData);
      setFarmacias(farmaciasData);

      // Cargar usuarios según el rol
      let usuariosData: Usuario[];
      if (user?.rol === 'admin') {
        usuariosData = await getUsuarios();
      } else if (user?.rol === 'gestor' && user.farmaciaId) {
        usuariosData = await getUsuariosByFarmacia(user.farmaciaId);
      } else {
        usuariosData = [];
      }

      setUsuarios(usuariosData);
    } catch (error) {
      showSnackbar('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const validateForm = (): boolean => {
    const newErrors = {
      nombre: '',
      apellidos: '',
      nif: '',
      email: '',
      telefono: '',
      restricciones: '',
    };

    // Validar nombre
    if (!validateName(formData.datosPersonales.nombre)) {
      newErrors.nombre = validationMessages.name;
    }

    // Validar apellidos
    if (!validateName(formData.datosPersonales.apellidos)) {
      newErrors.apellidos = validationMessages.name;
    }

    // Validar NIF
    if (!validateNIF(formData.datosPersonales.nif)) {
      newErrors.nif = validationMessages.nif;
    }

    // Validar email
    if (!validateEmail(formData.datosPersonales.email)) {
      newErrors.email = validationMessages.email;
    }

    // Validar teléfono
    if (!validatePhone(formData.datosPersonales.telefono)) {
      newErrors.telefono = validationMessages.phone;
    }

    // Validar restricciones
    const restriccionesValidation = validateRestricciones(formData.restricciones);
    if (!restriccionesValidation.valid) {
      newErrors.restricciones = restriccionesValidation.errors.join(', ');
    }

    setErrors(newErrors);

    return !Object.values(newErrors).some((error) => error !== '');
  };

  const handleOpenDialog = (usuario?: Usuario) => {
    if (usuario) {
      setEditingUsuario(usuario);
      setFormData({
        datosPersonales: usuario.datosPersonales,
        rol: usuario.rol,
        farmaciaId: usuario.farmaciaId,
        empresaId: usuario.empresaId,
        restricciones: usuario.restricciones,
      });
    } else {
      setEditingUsuario(null);
      setFormData({
        datosPersonales: {
          nombre: '',
          apellidos: '',
          nif: '',
          email: '',
          telefono: '',
        },
        rol: 'empleado',
        farmaciaId: user?.rol === 'gestor' ? user.farmaciaId : '',
        empresaId: user?.rol === 'gestor' ? user.empresaId : '',
        restricciones: {
          horasMaximasDiarias: 10,
          horasMaximasSemanales: 40,
          horasMaximasMensuales: 160,
          horasMaximasAnuales: 1920,
          diasFestivos: [],
        },
      });
    }
    setErrors({
      nombre: '',
      apellidos: '',
      nif: '',
      email: '',
      telefono: '',
      restricciones: '',
    });
    setTabValue(0);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUsuario(null);
    setTabValue(0);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showSnackbar('Por favor, corrige los errores en el formulario', 'error');
      return;
    }

    try {
      if (editingUsuario) {
        await updateUsuario(editingUsuario.uid, formData);
        showSnackbar('Empleado actualizado correctamente', 'success');
      } else {
        // Para crear nuevos empleados, se requeriría integración con Auth
        // Por ahora solo permitimos editar existentes
        showSnackbar('La creación de nuevos empleados requiere registro previo', 'error');
        return;
      }
      handleCloseDialog();
      loadData();
    } catch (error) {
      showSnackbar('Error al guardar empleado', 'error');
    }
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('¿Está seguro de eliminar este empleado?')) {
      try {
        await deleteUsuario(uid);
        showSnackbar('Empleado eliminado correctamente', 'success');
        loadData();
      } catch (error) {
        showSnackbar('Error al eliminar empleado', 'error');
      }
    }
  };

  const getFarmaciaName = (farmaciaId: string) => {
    const farmacia = farmacias.find((f) => f.id === farmaciaId);
    return farmacia ? farmacia.nombre : '-';
  };

  const getRolColor = (rol: UserRole) => {
    switch (rol) {
      case 'admin':
        return 'error';
      case 'gestor':
        return 'warning';
      case 'empleado':
        return 'success';
      default:
        return 'default';
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'nombre',
      headerName: 'Nombre',
      width: 150,
      renderCell: (params) => params.row.datosPersonales.nombre,
    },
    {
      field: 'apellidos',
      headerName: 'Apellidos',
      width: 180,
      flex: 1,
      renderCell: (params) => params.row.datosPersonales.apellidos,
    },
    {
      field: 'nif',
      headerName: 'NIF',
      width: 120,
      renderCell: (params) => params.row.datosPersonales.nif,
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 220,
      renderCell: (params) => params.row.datosPersonales.email,
    },
    {
      field: 'telefono',
      headerName: 'Teléfono',
      width: 130,
      renderCell: (params) => params.row.datosPersonales.telefono,
    },
    {
      field: 'rol',
      headerName: 'Rol',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={getRolColor(params.value)} size="small" />
      ),
    },
    {
      field: 'farmaciaId',
      headerName: 'Farmacia',
      width: 180,
      renderCell: (params) => getFarmaciaName(params.value),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Acciones',
      width: 100,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<EditIcon />}
          label="Editar"
          onClick={() => handleOpenDialog(params.row)}
        />,
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label="Eliminar"
          onClick={() => handleDelete(params.row.uid)}
          showInMenu
        />,
      ],
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Gestión de Empleados</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Empleado
        </Button>
      </Box>

      <DataGrid
        rows={usuarios}
        columns={columns}
        loading={loading}
        autoHeight
        getRowId={(row) => row.uid}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
        }}
        disableRowSelectionOnClick
      />

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingUsuario ? 'Editar Empleado' : 'Nuevo Empleado'}
        </DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab icon={<PersonIcon />} label="Datos Personales" />
            <Tab icon={<AccessTimeIcon />} label="Restricciones Horarias" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nombre"
                  value={formData.datosPersonales.nombre}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      datosPersonales: { ...formData.datosPersonales, nombre: e.target.value },
                    })
                  }
                  error={!!errors.nombre}
                  helperText={errors.nombre}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Apellidos"
                  value={formData.datosPersonales.apellidos}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      datosPersonales: { ...formData.datosPersonales, apellidos: e.target.value },
                    })
                  }
                  error={!!errors.apellidos}
                  helperText={errors.apellidos}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="NIF/NIE"
                  value={formData.datosPersonales.nif}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      datosPersonales: { ...formData.datosPersonales, nif: e.target.value },
                    })
                  }
                  error={!!errors.nif}
                  helperText={errors.nif}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.datosPersonales.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      datosPersonales: { ...formData.datosPersonales, email: e.target.value },
                    })
                  }
                  error={!!errors.email}
                  helperText={errors.email}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Teléfono"
                  value={formData.datosPersonales.telefono}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      datosPersonales: { ...formData.datosPersonales, telefono: e.target.value },
                    })
                  }
                  error={!!errors.telefono}
                  helperText={errors.telefono}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Rol"
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as UserRole })}
                  required
                  disabled={user?.rol !== 'admin'}
                >
                  <MenuItem value="empleado">Empleado</MenuItem>
                  <MenuItem value="gestor">Gestor</MenuItem>
                  {user?.rol === 'admin' && <MenuItem value="admin">Admin</MenuItem>}
                </TextField>
              </Grid>
              {user?.rol === 'admin' && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Empresa"
                      value={formData.empresaId}
                      onChange={(e) => setFormData({ ...formData, empresaId: e.target.value })}
                      required
                    >
                      {empresas.map((empresa) => (
                        <MenuItem key={empresa.id} value={empresa.id}>
                          {empresa.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Farmacia"
                      value={formData.farmaciaId}
                      onChange={(e) => setFormData({ ...formData, farmaciaId: e.target.value })}
                      required
                    >
                      {farmacias
                        .filter((f) => !formData.empresaId || f.empresaId === formData.empresaId)
                        .map((farmacia) => (
                          <MenuItem key={farmacia.id} value={farmacia.id}>
                            {farmacia.nombre}
                          </MenuItem>
                        ))}
                    </TextField>
                  </Grid>
                </>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Configure los límites de horas de trabajo para este empleado
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Tooltip title="Máximo de horas que puede trabajar en un día">
                  <TextField
                    fullWidth
                    label="Horas Máximas Diarias"
                    type="number"
                    value={formData.restricciones.horasMaximasDiarias}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        restricciones: {
                          ...formData.restricciones,
                          horasMaximasDiarias: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    InputProps={{ inputProps: { min: 1, max: 24 } }}
                    required
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Tooltip title="Máximo de horas que puede trabajar en una semana">
                  <TextField
                    fullWidth
                    label="Horas Máximas Semanales"
                    type="number"
                    value={formData.restricciones.horasMaximasSemanales}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        restricciones: {
                          ...formData.restricciones,
                          horasMaximasSemanales: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    InputProps={{ inputProps: { min: 1, max: 168 } }}
                    required
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Tooltip title="Máximo de horas que puede trabajar en un mes">
                  <TextField
                    fullWidth
                    label="Horas Máximas Mensuales"
                    type="number"
                    value={formData.restricciones.horasMaximasMensuales}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        restricciones: {
                          ...formData.restricciones,
                          horasMaximasMensuales: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    InputProps={{ inputProps: { min: 1 } }}
                    required
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Tooltip title="Máximo de horas que puede trabajar en un año">
                  <TextField
                    fullWidth
                    label="Horas Máximas Anuales"
                    type="number"
                    value={formData.restricciones.horasMaximasAnuales}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        restricciones: {
                          ...formData.restricciones,
                          horasMaximasAnuales: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    InputProps={{ inputProps: { min: 1 } }}
                    required
                  />
                </Tooltip>
              </Grid>
              {errors.restricciones && (
                <Grid item xs={12}>
                  <Alert severity="error">{errors.restricciones}</Alert>
                </Grid>
              )}
            </Grid>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

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

export default Empleados;
