# AgapitoDiSousa - Sistema de Gestión de Horarios para Farmacias

Aplicación web para gestionar y generar automáticamente horarios de empleados en farmacias, considerando restricciones laborales, guardias, festivos y cobertura mínima de personal.

## 🚀 Estado del Proyecto

**Fases 1, 2 y 3 Completadas** - Sistema funcional con configuración de horarios

### ✅ Funcionalidades Implementadas

**Fase 1 - Setup y Funcionalidades Básicas:**
- ✅ Setup completo del proyecto (React + Vite + TypeScript + Material-UI)
- ✅ Configuración de Firebase (Auth, Firestore, Functions, Hosting)
- ✅ Sistema de autenticación multi-método:
  - Email/Password
  - Google Sign-In
  - Apple Sign-In
- ✅ Sistema de roles (admin, gestor, empleado)
- ✅ Rutas protegidas según roles
- ✅ CRUD completo de Empresas
- ✅ CRUD completo de Farmacias
- ✅ Layout responsive con drawer lateral
- ✅ Reglas de seguridad de Firestore

**Fase 2 - Gestión de Empleados:**
- ✅ CRUD completo de Empleados/Usuarios
- ✅ Formulario con tabs (Datos Personales + Restricciones Horarias)
- ✅ Validaciones avanzadas:
  - NIF/NIE español con verificación de letra de control
  - Email con formato correcto
  - Teléfono español (móvil y fijo)
  - Nombres y apellidos (solo letras)
- ✅ Sistema de restricciones horarias por empleado:
  - Horas máximas diarias (hasta 24h)
  - Horas máximas semanales (hasta 168h)
  - Horas máximas mensuales
  - Horas máximas anuales
  - Validación de coherencia entre límites
- ✅ Componente EmpleadoStats con progress bars visuales
- ✅ Filtrado de empleados por farmacia y empresa
- ✅ Control de acceso según rol (admin ve todos, gestor solo su farmacia)

**Fase 3 - Configuración de Horarios y Calendario:**
- ✅ Página de Configuración de Farmacia con tabs
- ✅ Horarios Habituales:
  - Configuración por día de la semana (Lun-Dom)
  - Múltiples franjas horarias por día
  - Validación de no solapamiento
  - Resumen visual semanal con chips
  - Cálculo automático de duración
- ✅ Jornadas de Guardia:
  - Configuración de fechas específicas
  - Horarios especiales (puede cruzar medianoche)
  - Ordenamiento cronológico automático
  - Indicador de guardias 24h vs nocturnas
- ✅ Festivos Regionales:
  - Añadir fechas de festivos
  - Sugerencias de festivos nacionales de España
  - Agrupación por año
  - Validación de fechas no duplicadas
- ✅ Configuración General:
  - Trabajadores mínimos por turno (1-50)
  - Tooltips informativos
- ✅ Utilidades de fecha/hora:
  - Validación de formato HH:mm
  - Conversión decimal de horas
  - Cálculo de duraciones
  - Detección de solapamientos
  - Formato de fechas en español
- ✅ Validaciones completas:
  - Coherencia entre horarios
  - Duración mínima de 30 minutos
  - Límites lógicos (24h max)
  - Fechas válidas en ISO format

## 🛠️ Tecnologías

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Material-UI (MUI) v5
- **Backend**: Firebase (Auth, Firestore, Functions, Hosting)
- **Routing**: React Router v6
- **Date Management**: date-fns
- **Build Tool**: Vite

## 📁 Estructura del Proyecto

```
bug-free/
├── src/
│   ├── components/        # Componentes reutilizables
│   │   ├── Layout.tsx    # Layout principal con drawer
│   │   ├── ProtectedRoute.tsx  # HOC para rutas protegidas
│   │   ├── EmpleadoStats.tsx   # Estadísticas de empleado (Fase 2)
│   │   ├── HorariosHabituales.tsx  # Config horarios (Fase 3)
│   │   ├── JornadasGuardia.tsx     # Config guardias (Fase 3)
│   │   └── FestivosRegionales.tsx  # Config festivos (Fase 3)
│   ├── contexts/         # Context API
│   │   └── AuthContext.tsx  # Contexto de autenticación
│   ├── pages/            # Páginas de la aplicación
│   │   ├── Login.tsx     # Página de login
│   │   ├── Dashboard.tsx # Dashboard principal
│   │   ├── Empresas.tsx  # Gestión de empresas
│   │   ├── Farmacias.tsx # Gestión de farmacias
│   │   ├── Empleados.tsx # Gestión de empleados (Fase 2)
│   │   └── ConfiguracionFarmacia.tsx  # Configuración (Fase 3)
│   ├── services/         # Servicios y lógica de negocio
│   │   ├── firebase.ts   # Configuración de Firebase
│   │   ├── empresasService.ts  # CRUD de empresas
│   │   ├── farmaciasService.ts # CRUD de farmacias
│   │   └── usuariosService.ts  # CRUD de usuarios (Fase 2)
│   ├── utils/            # Utilidades
│   │   ├── validations.ts # Validaciones de formularios (Fase 2)
│   │   ├── dateTimeUtils.ts    # Utilidades de fecha/hora (Fase 3)
│   │   └── scheduleValidations.ts  # Validaciones horarios (Fase 3)
│   ├── types/            # Definiciones TypeScript
│   │   └── index.ts      # Tipos globales
│   ├── App.tsx           # Componente raíz con rutas
│   ├── main.tsx          # Punto de entrada
│   └── theme.ts          # Tema personalizado de MUI
├── firestore.rules       # Reglas de seguridad de Firestore
├── firestore.indexes.json # Índices de Firestore
├── firebase.json         # Configuración de Firebase
└── package.json          # Dependencias del proyecto
```

## 🔧 Configuración Inicial

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilita los siguientes servicios:
   - Authentication (Email/Password, Google, Apple)
   - Firestore Database
   - Cloud Functions
   - Hosting
3. Copia las credenciales de tu proyecto

### 3. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto basado en `.env.example`:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
VITE_FIREBASE_MEASUREMENT_ID=tu_measurement_id
```

### 4. Desplegar Reglas de Firestore

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 🚀 Desarrollo

### Iniciar el servidor de desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Build para producción

```bash
npm run build
```

### Vista previa del build

```bash
npm run preview
```

## 🔐 Sistema de Autenticación

### Roles de Usuario

1. **Admin**
   - Gestiona empresas y farmacias
   - Crea y administra usuarios
   - Acceso total al sistema

2. **Gestor**
   - Gestiona empleados de su farmacia
   - Configura y genera horarios
   - Accede a reportes y estadísticas

3. **Empleado**
   - Visualiza su calendario personal
   - Consulta sus estadísticas de horas

### Métodos de Autenticación

- Email/Password
- Google OAuth
- Apple OAuth

## 📊 Estructura de Datos (Firestore)

### Colecciones Principales

#### `/empresas/{empresaId}`
```typescript
{
  cif: string
  nombre: string
  direccion: string
  contacto: string
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `/farmacias/{farmaciaId}`
```typescript
{
  empresaId: string
  cif: string
  nombre: string
  direccion: string
  configuracion: {
    horariosHabituales: Array<{dia: number, inicio: string, fin: string}>
    jornadasGuardia: Array<{fecha: string, inicio: string, fin: string}>
    festivosRegionales: Array<string>
    trabajadoresMinimos: number
  }
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `/usuarios/{uid}`
```typescript
{
  datosPersonales: {
    nombre: string
    apellidos: string
    nif: string
    email: string
    telefono: string
  }
  rol: 'admin' | 'gestor' | 'empleado'
  farmaciaId: string
  empresaId: string
  restricciones: {
    horasMaximasDiarias: number
    horasMaximasSemanales: number
    horasMaximasMensuales: number
    horasMaximasAnuales: number
    diasFestivos: Array<string>
  }
  createdAt: timestamp
  updatedAt: timestamp
}
```

## 🔒 Seguridad

- Autenticación obligatoria para todo acceso
- Reglas de Firestore implementadas con control granular
- Validación basada en roles
- Los usuarios solo acceden a datos de su empresa/farmacia
- HTTPS obligatorio en producción

## 📝 Próximas Fases

### ✅ Fase 2 (1.5 semanas) - COMPLETADA
- ✅ CRUD de Empleados
- ✅ Sistema de restricciones horarias
- ✅ Panel de gestión de empleados

### ✅ Fase 3 (2 semanas) - COMPLETADA
- ✅ Configuración de horarios habituales
- ✅ Configuración de guardias y festivos
- ✅ Validaciones de configuración

### Fase 4 (3 semanas)
- Algoritmo de asignación automática de turnos
- Sistema de scoring configurable
- Detección de conflictos
- Optimizadores (greedy, backtracking, genético)

### Fase 5 (2 semanas)
- Integración FullCalendar
- Drag & drop con validaciones
- Indicadores visuales de estado

### Fase 6 (1.5 semanas)
- Generación de PDF y Excel
- Sistema de envío de emails
- Interfaz de reportes

### Fase 7 (1 semana)
- Testing integral
- Optimización de rendimiento
- Deploy a producción

## 👥 Autores

Proyecto desarrollado para la gestión eficiente de horarios en farmacias.

## 📄 Licencia

Este proyecto es privado y confidencial.