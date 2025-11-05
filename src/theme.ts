import { createTheme, Theme } from '@mui/material/styles';

type PaletteMode = 'light' | 'dark';

// Definir colores personalizados para TypeScript
declare module '@mui/material/styles' {
  interface Palette {
    gradient: {
      primary: string;
      secondary: string;
    };
  }
  interface PaletteOptions {
    gradient?: {
      primary: string;
      secondary: string;
    };
  }
}

// Función para crear tema basado en modo (light/dark)
const getTheme = (mode: PaletteMode): Theme => {
  const isLight = mode === 'light';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? '#495cfc' : '#66a6ff',
        light: '#66a6ff',
        dark: '#372865',
        contrastText: '#ffffff',
      },
      secondary: {
        main: isLight ? '#5ee7df' : '#ff0070',
        light: '#5ee7df',
        dark: '#ff0070',
        contrastText: isLight ? '#2b244d' : '#ffffff',
      },
      success: {
        main: '#4caf50',
      },
      warning: {
        main: '#ff9800',
      },
      error: {
        main: '#f44336',
      },
      background: {
        default: isLight ? '#f5f5f5' : '#1a1a1a',
        paper: isLight ? '#ffffff' : '#2b244d',
      },
      text: {
        primary: isLight ? '#2b244d' : '#ffffff',
        secondary: isLight ? 'rgba(43, 36, 77, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        disabled: isLight ? 'rgba(43, 36, 77, 0.4)' : 'rgba(255, 255, 255, 0.4)',
      },
      gradient: {
        primary: isLight
          ? 'linear-gradient(to top, #5ee7df 0%, #66a6ff 100%)'
          : 'linear-gradient(to bottom, #372865, #000000)',
        secondary: isLight
          ? 'linear-gradient(135deg, #5ee7df 0%, #66a6ff 100%)'
          : 'linear-gradient(135deg, #ff0070 0%, #495cfc 100%)',
      },
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Oxygen"',
        '"Ubuntu"',
        '"Cantarell"',
        '"Fira Sans"',
        '"Droid Sans"',
        '"Helvetica Neue"',
        'sans-serif',
      ].join(','),
      h1: {
        fontWeight: 600,
      },
      h2: {
        fontWeight: 600,
      },
      h3: {
        fontWeight: 600,
      },
      h4: {
        fontWeight: 500,
      },
      h5: {
        fontWeight: 500,
      },
      h6: {
        fontWeight: 500,
      },
      button: {
        fontWeight: 500,
        textTransform: 'none',
      },
    },
    shape: {
      borderRadius: 16, // 1rem - Minimus style
    },
    shadows: [
      'none',
      isLight ? '0 0 1rem rgba(0, 0, 255, 0.1)' : '0 0 1rem rgba(0, 0, 0, 0.3)',
      isLight ? '0 0 2rem rgba(0, 0, 255, 0.1)' : '0 0 2rem rgba(0, 0, 0, 0.4)',
      isLight ? '0 0 2rem rgba(0, 0, 255, 0.15)' : '0 0 2rem rgba(0, 0, 0, 0.5)',
      isLight ? '0 0 2rem rgba(0, 0, 255, 0.2)' : '0 0 2rem rgba(0, 0, 0, 0.6)',
      isLight ? '0 0 3rem rgba(0, 0, 255, 0.2)' : '0 0 3rem rgba(0, 0, 0, 0.6)',
      isLight ? '0 0 3rem rgba(0, 0, 255, 0.25)' : '0 0 3rem rgba(0, 0, 0, 0.7)',
      isLight ? '0 0 3rem rgba(0, 0, 255, 0.3)' : '0 0 3rem rgba(0, 0, 0, 0.8)',
      isLight ? '0 0 4rem rgba(0, 0, 255, 0.3)' : '0 0 4rem rgba(0, 0, 0, 0.8)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
      '0 0 4rem rgba(0, 0, 0, 0.15)',
    ],
    transitions: {
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195,
      },
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isLight ? '#495cfc #f5f5f5' : '#ff0070 #1a1a1a',
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 8,
              backgroundColor: isLight ? '#495cfc' : '#ff0070',
              minHeight: 24,
            },
            '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
              backgroundColor: isLight ? '#f5f5f5' : '#1a1a1a',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            borderRadius: 16,
            padding: '12px 24px',
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
            },
          },
          contained: {
            boxShadow: isLight ? '0 0 1rem rgba(0, 0, 255, 0.2)' : '0 0 1rem rgba(255, 0, 112, 0.3)',
            '&:hover': {
              boxShadow: isLight ? '0 0 2rem rgba(0, 0, 255, 0.3)' : '0 0 2rem rgba(255, 0, 112, 0.4)',
            },
          },
          outlined: {
            borderWidth: 2,
            '&:hover': {
              borderWidth: 2,
              backgroundColor: isLight ? 'rgba(73, 92, 252, 0.08)' : 'rgba(255, 0, 112, 0.08)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: isLight ? '0 0 2rem rgba(0, 0, 255, 0.1)' : '0 0 2rem rgba(0, 0, 0, 0.5)',
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: isLight ? '0 0 3rem rgba(0, 0, 255, 0.2)' : '0 0 3rem rgba(0, 0, 0, 0.7)',
              transform: 'translateY(-4px)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
          elevation1: {
            boxShadow: isLight ? '0 0 1rem rgba(0, 0, 255, 0.1)' : '0 0 1rem rgba(0, 0, 0, 0.3)',
          },
          elevation2: {
            boxShadow: isLight ? '0 0 2rem rgba(0, 0, 255, 0.15)' : '0 0 2rem rgba(0, 0, 0, 0.5)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: isLight ? '0 0 2rem rgba(0, 0, 255, 0.1)' : '0 0 2rem rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(10px)',
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(43, 36, 77, 0.95)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            boxShadow: isLight ? '0 0 2rem rgba(0, 0, 255, 0.1)' : '0 0 2rem rgba(0, 0, 0, 0.5)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 16,
              transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: isLight ? '#495cfc' : '#ff0070',
                },
              },
              '&.Mui-focused': {
                boxShadow: isLight
                  ? '0 0 1rem rgba(73, 92, 252, 0.2)'
                  : '0 0 1rem rgba(255, 0, 112, 0.3)',
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            fontWeight: 500,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 24,
            boxShadow: isLight ? '0 0 3rem rgba(0, 0, 255, 0.3)' : '0 0 3rem rgba(0, 0, 0, 0.8)',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: '0.875rem',
          },
        },
      },
    },
  });
};

// Exportar tema por defecto en modo light
const theme = getTheme('light');

export default theme;
export { getTheme };
