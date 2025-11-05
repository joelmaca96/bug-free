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
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  getFarmacias,
  createFarmacia,
  updateFarmacia,
  deleteFarmacia,
} from '@/services/farmaciasService';
import { getEmpresas } from '@/services/empresasService';
import { getUsuariosByRol, getUsuariosByEmpresa, updateUsuario } from '@/services/usuariosService';
import { Farmacia, Empresa, Usuario } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const Farmacias: React.FC = () => {
  const { user } = useAuth();
  const [farmacias, setFarmacias] = useState<Farmacia[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [gestores, setGestores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingFarmacia, setEditingFarmacia] = useState<Farmacia | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const [formData, setFormData] = useState({
    empresaId: '',
    cif: '',
    nombre: '',
    direccion: '',
    gestorId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [farmaciasData, empresasData, gestoresData] = await Promise.all([
        getFarmacias(),
        getEmpresas(),
        getUsuariosByRol('gestor'),
      ]);
      setFarmacias(farmaciasData);
      setEmpresas(empresasData);
      setGestores(gestoresData);
    } catch (error) {
      showSnackbar('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (farmacia?: Farmacia) => {
    if (farmacia) {
      setEditingFarmacia(farmacia);
      setFormData({
        empresaId: farmacia.empresaId,
        cif: farmacia.cif,
        nombre: farmacia.nombre,
        direccion: farmacia.direccion,
        gestorId: farmacia.gestorId || '',
      });
    } else {
      setEditingFarmacia(null);
      setFormData({
        empresaId: user?.empresaId || '',
        cif: '',
        nombre: '',
        direccion: '',
        gestorId: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingFarmacia(null);
    setFormData({
      empresaId: '',
      cif: '',
      nombre: '',
      direccion: '',
      gestorId: '',
    });
  };

  const handleSave = async () => {
    try {
      const previousGestorId = editingFarmacia?.gestorId;

      if (editingFarmacia) {
        await updateFarmacia(editingFarmacia.id, formData);

        // Si cambió el gestor, actualizar ambos usuarios
        if (previousGestorId !== formData.gestorId) {
          // Desasignar el gestor anterior
          if (previousGestorId) {
            await updateUsuario(previousGestorId, { farmaciaId: '' });
          }
          // Asignar el nuevo gestor
          if (formData.gestorId) {
            await updateUsuario(formData.gestorId, {
              farmaciaId: editingFarmacia.id,
              empresaId: formData.empresaId
            });
          }
        }

        showSnackbar('Farmacia actualizada correctamente', 'success');
      } else {
        const farmaciaId = await createFarmacia({
          ...formData,
          configuracion: {
            horariosHabituales: [],
            jornadasGuardia: [],
            festivosRegionales: [],
            trabajadoresMinimos: 1,
          },
        });

        // Asignar el gestor a la farmacia si se seleccionó uno
        if (formData.gestorId) {
          await updateUsuario(formData.gestorId, {
            farmaciaId: farmaciaId,
            empresaId: formData.empresaId
          });
        }

        showSnackbar('Farmacia creada correctamente', 'success');
      }
      handleCloseDialog();
      loadData();
    } catch (error) {
      showSnackbar('Error al guardar farmacia', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar esta farmacia?')) {
      try {
        const farmacia = farmacias.find(f => f.id === id);
        // Desasignar el gestor antes de eliminar
        if (farmacia?.gestorId) {
          await updateUsuario(farmacia.gestorId, { farmaciaId: '' });
        }
        await deleteFarmacia(id);
        showSnackbar('Farmacia eliminada correctamente', 'success');
        loadData();
      } catch (error) {
        showSnackbar('Error al eliminar farmacia', 'error');
      }
    }
  };

  const getEmpresaNombre = (empresaId: string) => {
    const empresa = empresas.find((e) => e.id === empresaId);
    return empresa ? empresa.nombre : '-';
  };

  const getGestorNombre = (gestorId?: string) => {
    if (!gestorId) return 'Sin asignar';
    const gestor = gestores.find((g) => g.uid === gestorId);
    return gestor ? `${gestor.datosPersonales.nombre} ${gestor.datosPersonales.apellidos}` : 'Sin asignar';
  };

  const columns: GridColDef[] = [
    { field: 'cif', headerName: 'CIF', width: 130 },
    { field: 'nombre', headerName: 'Nombre', width: 250, flex: 1 },
    {
      field: 'empresaId',
      headerName: 'Empresa',
      width: 200,
      renderCell: (params) => getEmpresaNombre(params.value),
    },
    {
      field: 'gestorId',
      headerName: 'Gestor',
      width: 200,
      renderCell: (params) => getGestorNombre(params.row.gestorId),
    },
    { field: 'direccion', headerName: 'Dirección', width: 300, flex: 1 },
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
          onClick={() => handleDelete(params.row.id)}
        />,
      ],
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Gestión de Farmacias</h1>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nueva Farmacia
        </Button>
      </Box>

      <DataGrid
        rows={farmacias}
        columns={columns}
        loading={loading}
        autoHeight
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
        }}
        disableRowSelectionOnClick
      />

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFarmacia ? 'Editar Farmacia' : 'Nueva Farmacia'}</DialogTitle>
        <DialogContent>
          <TextField
            select
            margin="dense"
            label="Empresa"
            fullWidth
            value={formData.empresaId}
            onChange={(e) => setFormData({ ...formData, empresaId: e.target.value })}
            required
            disabled={user?.rol === 'admin'}
          >
            {empresas.map((empresa) => (
              <MenuItem key={empresa.id} value={empresa.id}>
                {empresa.nombre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            margin="dense"
            label="CIF"
            fullWidth
            value={formData.cif}
            onChange={(e) => setFormData({ ...formData, cif: e.target.value })}
            required
          />
          <TextField
            margin="dense"
            label="Nombre"
            fullWidth
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            required
          />
          <TextField
            margin="dense"
            label="Dirección"
            fullWidth
            value={formData.direccion}
            onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            required
          />
          <TextField
            select
            margin="dense"
            label="Gestor (Opcional)"
            fullWidth
            value={formData.gestorId}
            onChange={(e) => setFormData({ ...formData, gestorId: e.target.value })}
          >
            <MenuItem value="">Sin asignar</MenuItem>
            {gestores
              .filter(gestor =>
                (!gestor.farmaciaId || gestor.uid === editingFarmacia?.gestorId) &&
                (!formData.empresaId || gestor.empresaId === formData.empresaId || !gestor.empresaId)
              )
              .map((gestor) => (
                <MenuItem key={gestor.uid} value={gestor.uid}>
                  {gestor.datosPersonales.nombre} {gestor.datosPersonales.apellidos} - {gestor.datosPersonales.email}
                </MenuItem>
              ))}
          </TextField>
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

export default Farmacias;
