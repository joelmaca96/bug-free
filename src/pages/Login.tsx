import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Link as MuiLink,
  useTheme,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import AppleIcon from '@mui/icons-material/Apple';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signInWithGoogle, signInWithApple } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await signInWithApple();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Apple');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        background: theme.palette.gradient.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={8}
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            width: '100%',
            borderRadius: 4,
            animation: 'slideUp 0.5s ease-out',
            backdropFilter: 'blur(10px)',
            background: theme.palette.mode === 'light'
              ? 'rgba(255, 255, 255, 0.95)'
              : 'rgba(43, 36, 77, 0.95)',
          }}
        >
          <Box
            sx={{
              animation: 'fadeIn 0.8s ease-out',
              textAlign: 'center',
              mb: 3,
            }}
          >
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 700,
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                background: theme.palette.gradient.secondary,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Apoteke
            </Typography>
            <Typography
              variant="subtitle1"
              color="text.secondary"
              sx={{
                fontWeight: 500,
                fontSize: { xs: '0.875rem', sm: '1rem' },
              }}
            >
              Sistema de Gestión de Horarios
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleEmailLogin} sx={{ mt: 3 }}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              disabled={loading}
            />
            <TextField
              fullWidth
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              disabled={loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{
                mt: 3,
                mb: 2,
                py: 1.5,
                background: theme.palette.gradient.secondary,
                '&:hover': {
                  background: theme.palette.gradient.secondary,
                  opacity: 0.9,
                },
              }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Iniciar Sesión'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }}>o</Divider>

          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            sx={{
              mb: 2,
              py: 1.5,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
              },
            }}
            disabled={loading}
          >
            Continuar con Google
          </Button>

          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<AppleIcon />}
            onClick={handleAppleLogin}
            disabled={loading}
            sx={{
              mb: 2,
              py: 1.5,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
              },
            }}
          >
            Continuar con Apple
          </Button>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2">
              ¿No tienes cuenta?{' '}
              <MuiLink component={Link} to="/register" underline="hover">
                Regístrate
              </MuiLink>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;
