import { Box, useTheme } from '@mui/material';

interface LogoProps {
  /**
   * Variant del logo:
   * - 'full': Logo completo con texto (LogotipoClaro.png)
   * - 'icon': Solo el icono de la cruz (apoteke_cross_dark.svg)
   */
  variant?: 'full' | 'icon';
  /**
   * Altura del logo en píxeles
   */
  height?: number;
  /**
   * Ancho del logo en píxeles (opcional, mantiene aspect ratio si no se especifica)
   */
  width?: number | string;
  /**
   * Clase CSS adicional
   */
  className?: string;
}

/**
 * Componente Logo de Apoteke con soporte para modo claro/oscuro
 *
 * En modo claro usa LogotipoClaro.png (logo completo con gradiente turquesa-azul)
 * En modo oscuro usa apoteke_cross_dark.svg (logo oscuro con gradiente)
 */
export default function Logo({
  variant = 'full',
  height = 40,
  width,
  className
}: LogoProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Determinar qué logo usar según el variant y el modo
  const logoSrc = variant === 'icon'
    ? '/logos/apoteke_cross_dark.svg'  // Icono para ambos modos
    : isDark
      ? '/logos/apoteke_cross_dark.svg'  // Logo oscuro en dark mode
      : '/logos/LogotipoClaro.png';      // Logo claro en light mode

  return (
    <Box
      component="img"
      src={logoSrc}
      alt="Apoteke Logo"
      className={className}
      sx={{
        height,
        width: width || 'auto',
        objectFit: 'contain',
        transition: theme.transitions.create(['transform', 'filter'], {
          duration: theme.transitions.duration.standard,
        }),
        '&:hover': {
          transform: 'scale(1.02)',
          filter: 'brightness(1.1)',
        },
      }}
    />
  );
}
