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
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  DialogContentText,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import EditIcon from '@mui/icons-material/Edit';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { Usuario, Empresa, Farmacia } from '@/types';
import { getUsuarios, deleteUsuarioComplete } from '@/services/usuariosService';
import { getEmpresas, deleteEmpresaCascade, getEmpresaById } from '@/services/empresasService';
import { getFarmacias, deleteFarmacia } from '@/services/farmaciasService';
import { useNavigate } from 'react-router-dom';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const SuperuserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);

  // Data states
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [farmacias, setFarmacias] = useState<Farmacia[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'empresa' | 'farmacia' | 'usuario'>('empresa');
  const [deleteId, setDeleteId] = useState('');
  const [deleteFarmacias, setDeleteFarmacias] = useState(false);
  const [deleteUsers, setDeleteUsers] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usuariosData, empresasData, farmaciasData] = await Promise.all([
        getUsuarios(),
        getEmpresas(),
        getFarmacias(),
      ]);
      setUsuarios(usuariosData);
      setEmpresas(empresasData);
      setFarmacias(farmaciasData);
    } catch (err) {
      setError('Error al cargar los datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (type: 'empresa' | 'farmacia' | 'usuario', id: string) => {
    setDeleteType(type);
    setDeleteId(id);
    setDeleteFarmacias(false);
    setDeleteUsers(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setError(null);

      if (deleteType === 'empresa') {
        await deleteEmpresaCascade(deleteId, deleteFarmacias, deleteUsers);
        setSuccess('Empresa eliminada correctamente');
      } else if (deleteType === 'farmacia') {
        // TODO: Implement cascade delete for farmacia
        await deleteFarmacia(deleteId);
        setSuccess('Farmacia eliminada correctamente');
      } else if (deleteType === 'usuario') {
        await deleteUsuarioComplete(deleteId);
        setSuccess('Usuario eliminado correctamente');
      }

      setDeleteDialogOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar');
      console.error(err);
    }
  };

  const getAdminName = (adminId: string) => {
    const admin = usuarios.find((u) => u.uid === adminId);
    return admin ? `${admin.datosPersonales.nombre} ${admin.datosPersonales.apellidos}` : 'N/A';
  };

  const getGestorName = (gestorId?: string) => {
    if (!gestorId) return 'Sin asignar';
    const gestor = usuarios.find((u) => u.uid === gestorId);
    return gestor ? `${gestor.datosPersonales.nombre} ${gestor.datosPersonales.apellidos}` : 'N/A';
  };

  const getEmpresaName = (empresaId: string) => {
    const empresa = empresas.find((e) => e.id === empresaId);
    return empresa ? empresa.nombre : 'N/A';
  };

  // Columns for Empresas table
  const empresasColumns: GridColDef[] = [
    { field: 'nombre', headerName: 'Nombre', flex: 1 },
    { field: 'cif', headerName: 'CIF', width: 120 },
    { field: 'direccion', headerName: 'Dirección', flex: 1 },
    {
      field: 'adminId',
      headerName: 'Administrador',
      flex: 1,
      renderCell: (params) => getAdminName(params.row.adminId),
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton size="small" onClick={() => navigate(`/empresas`)}>
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteClick('empresa', params.row.id)}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  // Columns for Farmacias table
  const farmaciasColumns: GridColDef[] = [
    { field: 'nombre', headerName: 'Nombre', flex: 1 },
    { field: 'cif', headerName: 'CIF', width: 120 },
    {
      field: 'empresaId',
      headerName: 'Empresa',
      flex: 1,
      renderCell: (params) => getEmpresaName(params.row.empresaId),
    },
    {
      field: 'gestorId',
      headerName: 'Gestor',
      flex: 1,
      renderCell: (params) => getGestorName(params.row.gestorId),
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton size="small" onClick={() => navigate(`/farmacias`)}>
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteClick('farmacia', params.row.id)}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  // Columns for Usuarios table
  const usuariosColumns: GridColDef[] = [
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
      field: 'rol',
      headerName: 'Rol',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.rol}
          color={
            params.row.rol === 'superuser'
              ? 'error'
              : params.row.rol === 'admin'
              ? 'primary'
              : params.row.rol === 'gestor'
              ? 'secondary'
              : 'default'
          }
          size="small"
        />
      ),
    },
    {
      field: 'empresaId',
      headerName: 'Empresa',
      flex: 1,
      renderCell: (params) =>
        params.row.empresaId ? getEmpresaName(params.row.empresaId) : 'N/A',
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton size="small" onClick={() => navigate(`/empleados`)}>
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteClick('usuario', params.row.uid)}
            disabled={params.row.rol === 'superuser'}
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
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Panel de Gestión Superuser
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

      {/* Estadísticas */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom sx={{ fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                Total Empresas
              </Typography>
              <Typography variant="h3">{empresas.length}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom sx={{ fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                Total Farmacias
              </Typography>
              <Typography variant="h3">{farmacias.length}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom sx={{ fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                Total Usuarios
              </Typography>
              <Typography variant="h3">{usuarios.length}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom sx={{ fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                Admins Disponibles
              </Typography>
              <Typography variant="h3">
                {usuarios.filter((u) => u.rol === 'admin' && !u.empresaId).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Empresas" />
          <Tab label="Farmacias" />
          <Tab label="Usuarios" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Gestión de Empresas</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/empresas')}
          >
            Crear Empresa
          </Button>
        </Box>
        <Paper>
          <DataGrid
            rows={empresas}
            columns={empresasColumns}
            getRowId={(row) => row.id}
            autoHeight
            disableRowSelectionOnClick
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Gestión de Farmacias</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/farmacias')}
          >
            Crear Farmacia
          </Button>
        </Box>
        <Paper>
          <DataGrid
            rows={farmacias}
            columns={farmaciasColumns}
            getRowId={(row) => row.id}
            autoHeight
            disableRowSelectionOnClick
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Gestión de Usuarios</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/empleados')}
          >
            Crear Usuario
          </Button>
        </Box>
        <Paper>
          <DataGrid
            rows={usuarios}
            columns={usuariosColumns}
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
        </Paper>
      </TabPanel>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Está seguro de que desea eliminar este{' '}
            {deleteType === 'empresa' ? 'empresa' : deleteType === 'farmacia' ? 'farmacia' : 'usuario'}?
          </DialogContentText>

          {deleteType === 'empresa' && (
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={deleteFarmacias}
                    onChange={(e) => setDeleteFarmacias(e.target.checked)}
                  />
                }
                label="Eliminar también todas las farmacias asociadas"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={deleteUsers}
                    onChange={(e) => setDeleteUsers(e.target.checked)}
                  />
                }
                label="Eliminar también todos los usuarios asociados"
              />
            </Box>
          )}

          {deleteType === 'farmacia' && (
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={deleteUsers}
                    onChange={(e) => setDeleteUsers(e.target.checked)}
                  />
                }
                label="Eliminar también todos los usuarios de la farmacia"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperuserDashboard;
