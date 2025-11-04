import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import theme from './theme';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Empresas from './pages/Empresas';
import Farmacias from './pages/Farmacias';
import Empleados from './pages/Empleados';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Ruta pública */}
            <Route path="/login" element={<Login />} />

            {/* Rutas protegidas con Layout */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Rutas solo para admin */}
            <Route
              path="/empresas"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <Empresas />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/farmacias"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <Farmacias />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Rutas para gestor y admin */}
            <Route
              path="/empleados"
              element={
                <ProtectedRoute allowedRoles={['gestor', 'admin']}>
                  <Layout>
                    <Empleados />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Ruta por defecto */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Ruta 404 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
