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
        main: isLight ? '#00B8C7' : '#008E9B',
        light: isLight ? '#9FE3E8' : '#66D9FF',
        dark: isLight ? '#007D85' : '#005E66',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: isLight ? '#66A6FF' : '#74F1C1',
        light: isLight ? '#B8F5CB' : '#66D9FF',
        dark: isLight ? '#004C4F' : '#003344',
        contrastText: '#FFFFFF',
      },
      success: {
        main: isLight ? '#B8F5CB' : '#74F1C1',
      },
      warning: {
        main: '#ff9800',
      },
      error: {
        main: '#FF6BA6',
      },
      background: {
        default: isLight ? '#F8FAFB' : '#11161C',
        paper: isLight ? '#FFFFFF' : '#1C232C',
      },
      text: {
        primary: isLight ? '#1A1D23' : '#E9EEF1',
        secondary: isLight ? '#5E6472' : '#9CA8B3',
        disabled: isLight ? 'rgba(26, 29, 35, 0.4)' : 'rgba(233, 238, 241, 0.4)',
      },
      gradient: {
        primary: isLight
          ? 'linear-gradient(135deg, #00B8C7 0%, #66A6FF 100%)'
          : 'linear-gradient(135deg, #005E66 0%, #003344 100%)',
        secondary: isLight
          ? 'linear-gradient(135deg, #66A6FF 0%, #B8F5CB 100%)'
          : 'linear-gradient(135deg, #74F1C1 0%, #66D9FF 100%)',
      },
    },
    typography: {
      fontFamily: [
        'Inter',
        'Manrope',
        'Space Grotesk',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'sans-serif',
      ].join(','),
      h1: {
        fontWeight: 700,
        fontSize: '3rem',
        letterSpacing: '-0.02em',
      },
      h2: {
        fontWeight: 700,
        fontSize: '2rem',
        letterSpacing: '-0.01em',
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.5rem',
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.25rem',
      },
      h5: {
        fontWeight: 600,
        fontSize: '1rem',
      },
      h6: {
        fontWeight: 600,
        fontSize: '0.875rem',
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.6,
      },
      button: {
        fontWeight: 600,
        textTransform: 'none',
        letterSpacing: '0.02em',
      },
    },
    shape: {
      borderRadius: 12, // 0.75rem - apoteke style
    },
    shadows: [
      'none',
      isLight ? '0 2px 16px rgba(0, 0, 0, 0.05)' : '0 2px 16px rgba(0, 0, 0, 0.3)',
      isLight ? '0 4px 24px rgba(0, 0, 0, 0.1)' : '0 4px 24px rgba(0, 0, 0, 0.4)',
      isLight ? '0 8px 32px rgba(0, 0, 0, 0.12)' : '0 8px 32px rgba(0, 0, 0, 0.5)',
      isLight ? '0 12px 40px rgba(0, 0, 0, 0.15)' : '0 12px 40px rgba(0, 0, 0, 0.6)',
      isLight ? '0 16px 48px rgba(0, 0, 0, 0.18)' : '0 16px 48px rgba(0, 0, 0, 0.7)',
      isLight ? '0 20px 56px rgba(0, 0, 0, 0.2)' : '0 20px 56px rgba(0, 0, 0, 0.8)',
      isLight ? '0 24px 64px rgba(0, 0, 0, 0.22)' : '0 24px 64px rgba(0, 0, 0, 0.85)',
      isLight ? '0 28px 72px rgba(0, 0, 0, 0.24)' : '0 28px 72px rgba(0, 0, 0, 0.9)',
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
            scrollbarColor: isLight ? '#00B8C7 #F8FAFB' : '#008E9B #11161C',
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 8,
              backgroundColor: isLight ? '#00B8C7' : '#008E9B',
              minHeight: 24,
            },
            '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
              backgroundColor: isLight ? '#F8FAFB' : '#11161C',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 12, // 0.75rem
            padding: '12px 20px',
            transition: 'all 200ms ease',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: isLight ? '0 4px 24px rgba(0, 0, 0, 0.1)' : '0 4px 24px rgba(0, 0, 0, 0.4)',
            },
          },
          containedPrimary: {
            background: isLight
              ? 'linear-gradient(135deg, #00B8C7 0%, #66A6FF 100%)'
              : 'linear-gradient(135deg, #005E66 0%, #003344 100%)',
            color: '#FFFFFF',
            '&:hover': {
              background: isLight
                ? 'linear-gradient(135deg, #00B8C7 0%, #66A6FF 100%)'
                : 'linear-gradient(135deg, #005E66 0%, #003344 100%)',
              filter: 'brightness(1.1)',
            },
          },
          outlined: {
            borderWidth: 1,
            '&:hover': {
              borderWidth: 1,
              backgroundColor: isLight ? 'rgba(0, 184, 199, 0.08)' : 'rgba(0, 142, 155, 0.08)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16, // 1rem
            boxShadow: isLight ? '0 2px 16px rgba(0, 0, 0, 0.05)' : '0 2px 16px rgba(0, 0, 0, 0.3)',
            transition: 'box-shadow 0.3s ease, transform 0.3s ease',
            '&:hover': {
              boxShadow: isLight ? '0 4px 24px rgba(0, 0, 0, 0.1)' : '0 4px 24px rgba(0, 0, 0, 0.4)',
              transform: 'translateY(-2px)',
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
            boxShadow: isLight ? '0 2px 16px rgba(0, 0, 0, 0.05)' : '0 2px 16px rgba(0, 0, 0, 0.3)',
          },
          elevation2: {
            boxShadow: isLight ? '0 4px 24px rgba(0, 0, 0, 0.1)' : '0 4px 24px rgba(0, 0, 0, 0.4)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: isLight ? '0 2px 16px rgba(0, 0, 0, 0.05)' : '0 2px 16px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(28, 35, 44, 0.95)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            boxShadow: isLight ? '0 2px 16px rgba(0, 0, 0, 0.05)' : '0 2px 16px rgba(0, 0, 0, 0.3)',
            backgroundColor: isLight ? '#FFFFFF' : '#1C232C',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8, // 0.5rem
              transition: 'all 0.3s ease',
              '&:hover': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: isLight ? '#00B8C7' : '#008E9B',
                },
              },
              '&.Mui-focused': {
                boxShadow: isLight
                  ? '0 0 0 3px rgba(0, 184, 199, 0.2)'
                  : '0 0 0 3px rgba(0, 142, 155, 0.2)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: isLight ? '#00B8C7' : '#008E9B',
                },
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
            boxShadow: isLight ? '0 8px 32px rgba(0, 0, 0, 0.12)' : '0 8px 32px rgba(0, 0, 0, 0.5)',
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
