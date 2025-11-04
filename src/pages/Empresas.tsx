import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  getEmpresas,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
} from '@/services/empresasService';
import { Empresa } from '@/types';

const Empresas: React.FC = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const [formData, setFormData] = useState({
    cif: '',
    nombre: '',
    direccion: '',
    contacto: '',
  });

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    try {
      setLoading(true);
      const data = await getEmpresas();
      setEmpresas(data);
    } catch (error) {
      showSnackbar('Error al cargar empresas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (empresa?: Empresa) => {
    if (empresa) {
      setEditingEmpresa(empresa);
      setFormData({
        cif: empresa.cif,
        nombre: empresa.nombre,
        direccion: empresa.direccion,
        contacto: empresa.contacto,
      });
    } else {
      setEditingEmpresa(null);
      setFormData({
        cif: '',
        nombre: '',
        direccion: '',
        contacto: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingEmpresa(null);
    setFormData({
      cif: '',
      nombre: '',
      direccion: '',
      contacto: '',
    });
  };

  const handleSave = async () => {
    try {
      if (editingEmpresa) {
        await updateEmpresa(editingEmpresa.id, formData);
        showSnackbar('Empresa actualizada correctamente', 'success');
      } else {
        await createEmpresa(formData);
        showSnackbar('Empresa creada correctamente', 'success');
      }
      handleCloseDialog();
      loadEmpresas();
    } catch (error) {
      showSnackbar('Error al guardar empresa', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar esta empresa?')) {
      try {
        await deleteEmpresa(id);
        showSnackbar('Empresa eliminada correctamente', 'success');
        loadEmpresas();
      } catch (error) {
        showSnackbar('Error al eliminar empresa', 'error');
      }
    }
  };

  const columns: GridColDef[] = [
    { field: 'cif', headerName: 'CIF', width: 130 },
    { field: 'nombre', headerName: 'Nombre', width: 250, flex: 1 },
    { field: 'direccion', headerName: 'Dirección', width: 300, flex: 1 },
    { field: 'contacto', headerName: 'Contacto', width: 200 },
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
        <h1>Gestión de Empresas</h1>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nueva Empresa
        </Button>
      </Box>

      <DataGrid
        rows={empresas}
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
        <DialogTitle>{editingEmpresa ? 'Editar Empresa' : 'Nueva Empresa'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
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
            margin="dense"
            label="Contacto"
            fullWidth
            value={formData.contacto}
            onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
            required
          />
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

export default Empresas;
