import React from 'react';
import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Bienvenido, {user?.datosPersonales.nombre}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Rol: {user?.rol}
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {user?.rol === 'admin' && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BusinessIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                    <Typography variant="h5">Empresas</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Gestiona las empresas del sistema
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <LocalPharmacyIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                    <Typography variant="h5">Farmacias</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Administra las farmacias
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {(user?.rol === 'gestor' || user?.rol === 'admin') && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                    <Typography variant="h5">Empleados</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Gestiona los empleados de tu farmacia
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CalendarMonthIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                    <Typography variant="h5">Calendario</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Genera y edita horarios
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Estado del Sistema
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sistema operativo - Fase 1 completada
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
