import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { Usuario } from '@/types';
import { getUsuariosByRol, deleteUsuario } from '@/services/usuariosService';
import { getEmpresas } from '@/services/empresasService';

interface Empresa {
  id: string;
  nombre: string;
  cif: string;
}

const SuperuserDashboard: React.FC = () => {
  const [admins, setAdmins] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombre: '',
    apellidos: '',
    nif: '',
    telefono: '',
    empresaId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [adminsData, empresasData] = await Promise.all([
        getUsuariosByRol('admin'),
        getEmpresas(),
      ]);
      setAdmins(adminsData);
      setEmpresas(empresasData as any);
    } catch (err) {
      setError('Error al cargar los datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      setError(null);

      // Validaciones
      if (!formData.email || !formData.password || !formData.nombre || !formData.apellidos) {
        setError('Por favor complete todos los campos obligatorios');
        return;
      }

      if (formData.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        return;
      }

      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Crear documento en Firestore
      const newAdmin: Omit<Usuario, 'uid'> = {
        datosPersonales: {
          nombre: formData.nombre,
          apellidos: formData.apellidos,
          nif: formData.nif,
          email: formData.email,
          telefono: formData.telefono,
        },
        rol: 'admin',
        empresaId: formData.empresaId,
        farmaciaId: '',
        restricciones: {
          horasMaximasDiarias: 10,
          horasMaximasSemanales: 40,
          horasMaximasMensuales: 160,
          horasMaximasAnuales: 1920,
          diasFestivos: [],
        },
      };

      await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
        ...newAdmin,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // TODO: Enviar email de notificación (requiere Cloud Function)

      setSuccess(`Admin ${formData.nombre} ${formData.apellidos} creado correctamente`);
      setOpenDialog(false);
      resetForm();
      loadData();
    } catch (err: any) {
      console.error('Error creating admin:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email ya está en uso');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil');
      } else {
        setError('Error al crear el administrador');
      }
    }
  };

  const handleDeleteAdmin = async (uid: string) => {
    if (!window.confirm('¿Está seguro de eliminar este administrador?')) {
      return;
    }

    try {
      await deleteUsuario(uid);
      setSuccess('Administrador eliminado correctamente');
      loadData();
    } catch (err) {
      setError('Error al eliminar el administrador');
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      nombre: '',
      apellidos: '',
      nif: '',
      telefono: '',
      empresaId: '',
    });
  };

  const columns: GridColDef[] = [
    {
      field: 'nombre',
      headerName: 'Nombre',
      flex: 1,
      valueGetter: (params) => params.row.datosPersonales.nombre,
    },
    {
      field: 'apellidos',
      headerName: 'Apellidos',
      flex: 1,
      valueGetter: (params) => params.row.datosPersonales.apellidos,
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      valueGetter: (params) => params.row.datosPersonales.email,
    },
    {
      field: 'empresaId',
      headerName: 'Empresa',
      flex: 1,
      renderCell: (params) => {
        const empresa = empresas.find((e) => e.id === params.row.empresaId);
        return empresa ? empresa.nombre : 'Sin asignar';
      },
    },
    {
      field: 'rol',
      headerName: 'Rol',
      width: 120,
      renderCell: () => <Chip label="Admin" color="primary" size="small" />,
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteAdmin(params.row.uid)}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Panel de Superusuario</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Crear Administrador
        </Button>
      </Box>

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

      {/* Estadísticas */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Total Administradores
              </Typography>
              <Typography variant="h3">{admins.length}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Total Empresas
              </Typography>
              <Typography variant="h3">{empresas.length}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Admins Sin Empresa
              </Typography>
              <Typography variant="h3">
                {admins.filter((a) => !a.empresaId).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabla de administradores */}
      <Paper>
        <Box p={2}>
          <Typography variant="h6" gutterBottom>
            Administradores del Sistema
          </Typography>
          <DataGrid
            rows={admins}
            columns={columns}
            getRowId={(row) => row.uid}
            autoHeight
            disableRowSelectionOnClick
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </Box>
      </Paper>

      {/* Dialog para crear admin */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Crear Nuevo Administrador</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nombre *"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Apellidos *"
                value={formData.apellidos}
                onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="NIF"
                value={formData.nif}
                onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Teléfono"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="email"
                label="Email *"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Contraseña *"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                helperText="Mínimo 6 caracteres"
              />
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info" icon={<EmailIcon />}>
                Se enviará un email al administrador notificándole de su nuevo rol y las
                credenciales de acceso.
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={handleCreateAdmin}>
            Crear Administrador
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperuserDashboard;
