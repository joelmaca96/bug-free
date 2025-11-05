import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Empresas from './pages/Empresas';
import MiEmpresa from './pages/MiEmpresa';
import Farmacias from './pages/Farmacias';
import Empleados from './pages/Empleados';
import ConfiguracionFarmacia from './pages/ConfiguracionFarmacia';
import ConfiguracionAlgoritmo from './pages/ConfiguracionAlgoritmo';
import SuperuserDashboard from './pages/SuperuserDashboard';
import Calendario from './pages/Calendario';
import Reportes from './pages/Reportes';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

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

            {/* Rutas solo para superuser */}
            <Route
              path="/empresas"
              element={
                <ProtectedRoute allowedRoles={['superuser']}>
                  <Layout>
                    <Empresas />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Ruta solo para admin */}
            <Route
              path="/mi-empresa"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <MiEmpresa />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Rutas para admin y superuser */}
            <Route
              path="/farmacias"
              element={
                <ProtectedRoute allowedRoles={['admin', 'superuser']}>
                  <Layout>
                    <Farmacias />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Rutas para gestor, admin y superuser */}
            <Route
              path="/empleados"
              element={
                <ProtectedRoute allowedRoles={['gestor', 'admin', 'superuser']}>
                  <Layout>
                    <Empleados />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/configuracion"
              element={
                <ProtectedRoute allowedRoles={['gestor', 'admin', 'superuser']}>
                  <Layout>
                    <ConfiguracionFarmacia />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/algoritmo"
              element={
                <ProtectedRoute allowedRoles={['gestor', 'admin', 'superuser']}>
                  <Layout>
                    <ConfiguracionAlgoritmo />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/calendario"
              element={
                <ProtectedRoute allowedRoles={['gestor', 'admin', 'superuser']}>
                  <Layout>
                    <Calendario />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/reportes"
              element={
                <ProtectedRoute allowedRoles={['gestor', 'admin', 'superuser']}>
                  <Layout>
                    <Reportes />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Ruta solo para superuser */}
            <Route
              path="/superuser"
              element={
                <ProtectedRoute allowedRoles={['superuser']}>
                  <Layout>
                    <SuperuserDashboard />
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
