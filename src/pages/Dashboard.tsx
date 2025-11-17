import React from 'react';
import { Box, Card, CardContent, Grid, Typography, CardActionArea } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BusinessIcon from '@mui/icons-material/Business';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Box>
      <Typography
        variant="h4"
        gutterBottom
        sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
      >
        Hola, {user?.datosPersonales.nombre}
      </Typography>
      <Typography
        variant="subtitle1"
        color="text.secondary"
        gutterBottom
        sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
      >
        Rol: {user?.rol}
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {user?.rol === 'superuser' && (
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardActionArea onClick={() => navigate('/empresas')}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BusinessIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'primary.main', mr: 2 }} />
                    <Typography
                      variant="h5"
                      sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
                    >
                      Empresas
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Gestiona las empresas del sistema
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        )}

        {(user?.rol === 'admin' || user?.rol === 'superuser') && (
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardActionArea onClick={() => navigate('/farmacias')}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <LocalPharmacyIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'primary.main', mr: 2 }} />
                    <Typography
                      variant="h5"
                      sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
                    >
                      Farmacias
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Administra las farmacias
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        )}

        {(user?.rol === 'gestor' || user?.rol === 'admin' || user?.rol === 'superuser') && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardActionArea onClick={() => navigate('/empleados')}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <PeopleIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'primary.main', mr: 2 }} />
                      <Typography
                        variant="h5"
                        sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
                      >
                        Empleados
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                    >
                      Gestiona los empleados de tu farmacia
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardActionArea onClick={() => navigate('/calendario')}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <CalendarMonthIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'primary.main', mr: 2 }} />
                      <Typography
                        variant="h5"
                        sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
                      >
                        Calendario
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                    >
                      Genera y edita horarios
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );
};

export default Dashboard;
