import React from 'react';
import { IconButton, Tooltip, Box, useTheme } from '@mui/material';
import { Brightness7, Brightness4 } from '@mui/icons-material';
import { useThemeMode } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();

  return (
    <Tooltip title={mode === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}>
      <Box
        sx={{
          position: 'relative',
          display: 'inline-flex',
        }}
      >
        <IconButton
          onClick={toggleTheme}
          sx={{
            color: theme.palette.text.primary,
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'rotate(180deg)',
              backgroundColor:
                mode === 'light'
                  ? 'rgba(73, 92, 252, 0.08)'
                  : 'rgba(255, 0, 112, 0.08)',
            },
            '& .MuiSvgIcon-root': {
              transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            },
          }}
        >
          {mode === 'light' ? (
            <Brightness4
              sx={{
                color: theme.palette.primary.main,
              }}
            />
          ) : (
            <Brightness7
              sx={{
                color: theme.palette.secondary.main,
              }}
            />
          )}
        </IconButton>
      </Box>
    </Tooltip>
  );
};

export default ThemeToggle;
