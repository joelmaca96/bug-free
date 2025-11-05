# Fase 4: Algoritmo de Asignación de Turnos - Documentación

## Resumen de la Fase 4

La Fase 4 implementa el núcleo algorítmico de AgapitoDiSousa, incluyendo:

1. **Algoritmos de Asignación** con 3 estrategias:
   - Greedy (rápido, buenas soluciones)
   - Backtracking (preciso, búsqueda exhaustiva)
   - Genético (óptimo, evolución de soluciones)

2. **Sistema de Scoring Configurable**
   - Pesos ajustables por prioridad
   - Evaluación multi-criterio
   - Optimización de asignaciones

3. **Detección y Clasificación de Conflictos**
   - Identificación automática de problemas
   - Severidad: crítico, alto, medio, bajo
   - Sugerencias de resolución

4. **Dashboard de Superuser**
   - Gestión de administradores
   - Creación de cuentas admin
   - Estadísticas del sistema

5. **Sistema de Notificaciones**
   - Cloud Functions para emails
   - Notificaciones de roles creados
   - Envío de horarios

## Estructura de Archivos Creados

### Servicios
```
src/services/
├── configuracionAlgoritmoService.ts  # CRUD de configuración del algoritmo
└── turnosService.ts                  # CRUD de turnos
```

### Algoritmo
```
src/utils/algorithm/
├── index.ts                  # Orquestador principal
├── greedyAlgorithm.ts       # Estrategia Greedy
├── backtrackingAlgorithm.ts # Estrategia Backtracking
├── geneticAlgorithm.ts      # Estrategia Genética
├── scoring.ts               # Sistema de puntuación
├── validation.ts            # Validaciones de restricciones
├── conflictDetector.ts      # Detector de conflictos
└── hoursTracker.ts          # Seguimiento de horas
```

### Páginas
```
src/pages/
├── ConfiguracionAlgoritmo.tsx  # UI de configuración del algoritmo
└── SuperuserDashboard.tsx      # Panel de superusuario
```

### Cloud Functions
```
functions/
├── index.js      # Funciones para emails y notificaciones
└── package.json  # Dependencias de Functions
```

## Tipos Agregados

### Nuevos en `src/types/index.ts`

```typescript
// Rol de superusuario
export type UserRole = 'superuser' | 'admin' | 'gestor' | 'empleado';

// Conflictos
export type SeveridadConflicto = 'critico' | 'alto' | 'medio' | 'bajo';
export interface Conflicto {
  id: string;
  tipo: 'cobertura_insuficiente' | 'exceso_horas' | 'descanso_insuficiente' | 'turnos_consecutivos';
  severidad: SeveridadConflicto;
  descripcion: string;
  fecha: string;
  empleadoId?: string;
  turnoId?: string;
  sugerencias: string[];
}

// Resultado del algoritmo
export interface ResultadoAlgoritmo {
  turnos: Turno[];
  conflictos: Conflicto[];
  estadisticas: EstadisticaEmpleado[];
  scoreGlobal: number;
  tiempoEjecucion: number;
}
```

## Uso del Algoritmo

### Ejemplo Básico

```typescript
import { executeSchedulingAlgorithm } from '@/utils/algorithm';
import { getOrCreateConfiguracion } from '@/services/configuracionAlgoritmoService';
import { getFarmaciaById } from '@/services/farmaciasService';
import { getUsuariosByFarmacia } from '@/services/usuariosService';

// Cargar datos necesarios
const config = await getOrCreateConfiguracion(farmaciaId);
const farmacia = await getFarmaciaById(farmaciaId);
const empleados = await getUsuariosByFarmacia(farmaciaId);

// Definir período
const fechaInicio = new Date('2025-01-01');
const fechaFin = new Date('2025-01-31');

// Ejecutar algoritmo
const resultado = await executeSchedulingAlgorithm(
  config,
  farmacia,
  empleados,
  fechaInicio,
  fechaFin
);

// Procesar resultado
console.log(`Turnos generados: ${resultado.turnos.length}`);
console.log(`Conflictos: ${resultado.conflictos.length}`);
console.log(`Score global: ${resultado.scoreGlobal}`);
console.log(`Tiempo de ejecución: ${resultado.tiempoEjecucion}ms`);

// Guardar turnos en Firestore
for (const turno of resultado.turnos) {
  await createTurno(farmaciaId, turno);
}
```

### Configuración del Algoritmo

#### Prioridades

Ajustables desde la UI en `/algoritmo`:

- **Cobertura Mínima** (peso: 0-100): Prioriza cubrir el mínimo de trabajadores
- **Límites de Horas** (peso: 0-100): Respeta restricciones horarias
- **Distribución de Guardias** (peso: 0-100): Distribuye guardias equitativamente
- **Distribución de Festivos** (peso: 0-100): Distribuye festivos equitativamente
- **Minimizar Cambios** (peso: 0-100): Mantiene patrones consistentes

#### Restricciones

Configurables desde la UI:

- **Descanso mínimo**: 8-24 horas entre jornadas
- **Turnos consecutivos**: 1-14 días máximo
- **Horas diarias**: 6-16 horas máximo
- **Horas extra**: Activar/desactivar
- **Margen sobrecarga**: 0-50%

#### Estrategias

1. **Greedy** (recomendado para producción)
   - Rápido (< 5 segundos)
   - Soluciones buenas (80-90% óptimas)
   - Bajo consumo de memoria

2. **Backtracking** (para soluciones precisas)
   - Medio (5-30 segundos)
   - Soluciones muy buenas (90-95% óptimas)
   - Búsqueda exhaustiva limitada

3. **Genético** (para optimización máxima)
   - Lento (30-120 segundos)
   - Soluciones óptimas (95-100%)
   - Alto consumo de CPU

## Sistema de Conflictos

### Tipos de Conflictos

1. **Cobertura Insuficiente** (crítico)
   - Faltan trabajadores para cubrir un turno
   - Sugerencia: Asignar más empleados

2. **Exceso de Horas** (alto/crítico)
   - Empleado excede límites horarios
   - Sugerencia: Redistribuir turnos

3. **Descanso Insuficiente** (medio/alto)
   - No se respeta descanso mínimo
   - Sugerencia: Ajustar horarios

4. **Turnos Consecutivos** (medio)
   - Exceso de días consecutivos trabajando
   - Sugerencia: Agregar días de descanso

### Clasificación de Severidad

- **Crítico**: Viola legislación laboral
- **Alto**: Riesgo alto para empleado
- **Medio**: Problema de organización
- **Bajo**: Optimización recomendada

## Dashboard de Superuser

### Funcionalidades

1. **Crear Administradores**
   - Formulario de alta de admins
   - Asignación de empresa
   - Envío automático de email

2. **Gestión de Admins**
   - Lista completa de administradores
   - Eliminar administradores
   - Ver estadísticas

3. **Estadísticas**
   - Total de administradores
   - Total de empresas
   - Admins sin empresa asignada

### Acceso

Solo usuarios con rol `superuser` pueden acceder a `/superuser`.

## Cloud Functions

### Funciones Implementadas

#### 1. `sendAdminCreatedEmail`
Trigger: Creación de usuario con rol `admin`
```javascript
// Se ejecuta automáticamente al crear un admin en Firestore
```

#### 2. `sendGestorCreatedEmail`
Trigger: Creación de usuario con rol `gestor`

#### 3. `sendEmpleadoCreatedEmail`
Trigger: Creación de usuario con rol `empleado`

#### 4. `sendScheduleEmail`
Callable: Enviar horario por email a empleado
```typescript
// Llamar desde el cliente
const sendScheduleEmail = httpsCallable(functions, 'sendScheduleEmail');
await sendScheduleEmail({
  empleadoId: 'user123',
  fechaInicio: '2025-01-01',
  fechaFin: '2025-01-31',
  farmaciaId: 'farmacia123'
});
```

### Configuración de Email

Configurar credenciales en Firebase Config:

```bash
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.password="your-app-password"
```

## Deploy

### 1. Deploy de la Aplicación

```bash
npm run build
firebase deploy --only hosting
```

### 2. Deploy de Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 3. Deploy Completo

```bash
npm run build
firebase deploy
```

## Próximos Pasos (Fase 5-7)

### Fase 5: Integración FullCalendar
- Vista de calendario interactiva
- Drag & drop de turnos
- Validaciones en tiempo real

### Fase 6: Exportación y Reportes
- Generación de PDF
- Exportación a Excel
- Envío masivo de horarios

### Fase 7: Testing y Deploy
- Tests unitarios e integración
- Optimización de rendimiento
- Deploy a producción

## Notas Técnicas

### Performance

- El algoritmo Greedy puede manejar **20 empleados × 30 días** en < 5 segundos
- El algoritmo Genético puede tardar hasta **2 minutos** en casos complejos
- Se recomienda mostrar un indicador de progreso al usuario

### Limitaciones

- Máximo **100 empleados** por farmacia (limitación de escalabilidad)
- Máximo **3 meses** por ejecución (limitación de tiempo)
- Los conflictos se detectan pero no se resuelven automáticamente al 100%

### Mejoras Futuras

1. Implementar resolución automática de conflictos
2. Agregar preferencias de empleados (horarios preferidos)
3. Optimización con WebWorkers para UI no-bloqueante
4. Machine Learning para aprender patrones exitosos

## Contacto y Soporte

Para preguntas sobre esta implementación, referirse a la documentación del proyecto principal.
