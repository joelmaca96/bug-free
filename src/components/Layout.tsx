import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import BusinessIcon from '@mui/icons-material/Business';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from './ThemeToggle';

const drawerWidth = 260;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await signOut();
    navigate('/login');
  };

  // Menú según rol
  const getMenuItems = () => {
    if (!user) return [];

    const commonItems = [
      {
        text: 'Dashboard',
        icon: <DashboardIcon />,
        path: '/dashboard',
        roles: ['empleado', 'gestor', 'admin', 'superuser'],
      },
    ];

    const superuserItems = [
      {
        text: 'Panel Superuser',
        icon: <SupervisorAccountIcon />,
        path: '/superuser',
        roles: ['superuser']
      },
      { text: 'Empresas', icon: <BusinessIcon />, path: '/empresas', roles: ['superuser'] },
      { text: 'Farmacias', icon: <LocalPharmacyIcon />, path: '/farmacias', roles: ['superuser'] },
      { text: 'Empleados', icon: <PeopleIcon />, path: '/empleados', roles: ['superuser'] },
      { text: 'Configuración Farmacia', icon: <SettingsIcon />, path: '/configuracion', roles: ['superuser'] },
      { text: 'Configuración Algoritmo', icon: <SmartToyIcon />, path: '/algoritmo', roles: ['superuser'] },
      { text: 'Calendario', icon: <CalendarMonthIcon />, path: '/calendario', roles: ['superuser'] },
      { text: 'Reportes', icon: <AssessmentIcon />, path: '/reportes', roles: ['superuser'] },
    ];

    const gestorItems = [
      { text: 'Empleados', icon: <PeopleIcon />, path: '/empleados', roles: ['gestor', 'admin'] },
      { text: 'Configuración Farmacia', icon: <SettingsIcon />, path: '/configuracion', roles: ['gestor', 'admin'] },
      { text: 'Configuración Algoritmo', icon: <SmartToyIcon />, path: '/algoritmo', roles: ['gestor', 'admin'] },
      { text: 'Calendario', icon: <CalendarMonthIcon />, path: '/calendario', roles: ['gestor', 'admin'] },
      { text: 'Reportes', icon: <AssessmentIcon />, path: '/reportes', roles: ['gestor', 'admin'] },
    ];

    const adminItems = [
      { text: 'Mi Empresa', icon: <BusinessIcon />, path: '/mi-empresa', roles: ['admin'] },
      { text: 'Farmacias', icon: <LocalPharmacyIcon />, path: '/farmacias', roles: ['admin'] },
    ];

    let items = [...commonItems];

    if (user.rol === 'superuser') {
      items = [...items, ...superuserItems];
    }

    if (user.rol === 'gestor' || user.rol === 'admin') {
      items = [...items, ...gestorItems];
    }

    if (user.rol === 'admin') {
      items = [...items, ...adminItems];
    }

    return items.filter((item) => item.roles.includes(user.rol));
  };

  const menuItems = getMenuItems();

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
          Apoteke
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  sx: { fontSize: { xs: '0.875rem', sm: '1rem' } }
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              flexGrow: 1,
              fontSize: { xs: '1rem', sm: '1.25rem' }
            }}
          >
            {menuItems.find((item) => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>
          <ThemeToggle />
          <IconButton onClick={handleMenuOpen} sx={{ p: 0, ml: 1 }}>
            <Avatar sx={{ bgcolor: 'secondary.main' }}>
              {user?.datosPersonales.nombre.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem disabled>
              <Typography variant="body2">
                {user?.datosPersonales.nombre} {user?.datosPersonales.apellidos}
              </Typography>
            </MenuItem>
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                {user?.rol}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Cerrar Sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
