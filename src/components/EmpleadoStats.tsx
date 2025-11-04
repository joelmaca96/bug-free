import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Grid,
  Chip,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TodayIcon from '@mui/icons-material/Today';
import { Usuario } from '@/types';

interface EmpleadoStatsProps {
  empleado: Usuario;
  horasTrabajadas?: {
    diarias: number;
    semanales: number;
    mensuales: number;
    anuales: number;
  };
}

const EmpleadoStats: React.FC<EmpleadoStatsProps> = ({
  empleado,
  horasTrabajadas = {
    diarias: 0,
    semanales: 0,
    mensuales: 0,
    anuales: 0,
  },
}) => {
  const calculatePercentage = (current: number, max: number): number => {
    if (max === 0) return 0;
    return Math.min((current / max) * 100, 100);
  };

  const getProgressColor = (
    percentage: number
  ): 'success' | 'warning' | 'error' => {
    if (percentage < 70) return 'success';
    if (percentage < 90) return 'warning';
    return 'error';
  };

  const stats = [
    {
      label: 'Horas Diarias',
      icon: <TodayIcon />,
      current: horasTrabajadas.diarias,
      max: empleado.restricciones.horasMaximasDiarias,
    },
    {
      label: 'Horas Semanales',
      icon: <CalendarMonthIcon />,
      current: horasTrabajadas.semanales,
      max: empleado.restricciones.horasMaximasSemanales,
    },
    {
      label: 'Horas Mensuales',
      icon: <AccessTimeIcon />,
      current: horasTrabajadas.mensuales,
      max: empleado.restricciones.horasMaximasMensuales,
    },
    {
      label: 'Horas Anuales',
      icon: <AccessTimeIcon />,
      current: horasTrabajadas.anuales,
      max: empleado.restricciones.horasMaximasAnuales,
    },
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {empleado.datosPersonales.nombre} {empleado.datosPersonales.apellidos}
          </Typography>
          <Chip label={empleado.rol} color="primary" size="small" />
        </Box>

        <Grid container spacing={2}>
          {stats.map((stat, index) => {
            const percentage = calculatePercentage(stat.current, stat.max);
            const color = getProgressColor(percentage);

            return (
              <Grid item xs={12} sm={6} key={index}>
                <Box sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{ mr: 1, color: 'text.secondary', display: 'flex' }}>
                      {stat.icon}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 0.5 }}>
                    <Typography variant="h6" component="span">
                      {stat.current}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      component="span"
                      sx={{ ml: 0.5 }}
                    >
                      / {stat.max}h
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={percentage}
                    color={color}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              </Grid>
            );
          })}
        </Grid>

        {empleado.restricciones.diasFestivos.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Días festivos personales: {empleado.restricciones.diasFestivos.length}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default EmpleadoStats;
