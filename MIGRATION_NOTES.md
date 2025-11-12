# Notas de Migración: Algoritmo Greedy → OR-Tools

## Resumen de Cambios

El sistema de generación de horarios ha sido refactorizado para usar **Google OR-Tools CP-SAT Solver** en lugar del algoritmo greedy local anterior. Esta migración proporciona:

### Ventajas del Nuevo Sistema

✅ **Soluciones Óptimas**: OR-Tools garantiza encontrar la mejor solución posible o determinar que no existe solución

✅ **Restricciones Duras Garantizadas**: Todas las restricciones obligatorias se cumplen siempre (horas máximas, descansos, festivos personales)

✅ **Mejor Distribución**: Optimización matemática de la equidad en guardias, horas y fines de semana

✅ **Validación Previa**: Endpoint `/validar-configuracion` detecta problemas antes de intentar generar

✅ **Escalabilidad**: Separa la carga computacional en servicio Python dedicado

✅ **Métricas Detalladas**: Reportes completos de calidad de la solución

### Desventajas/Consideraciones

⚠️ **Tiempo de Ejecución**: Puede tardar 10-60 segundos (vs <5s del algoritmo antiguo)

⚠️ **Complejidad de Despliegue**: Requiere Cloud Run además de Firebase Functions

⚠️ **Costo**: Aunque dentro de capa gratuita, usa más recursos que el algoritmo local

## Cambios en la Arquitectura

### Antes
```
React Frontend → executeSchedulingAlgorithm() (local) → Firestore
```

### Después
```
React Frontend → Firebase Functions → Cloud Run (Python + OR-Tools) → Realtime Database
```

## Componentes Nuevos

### 1. Servicio Python (`scheduler-service/`)
- `main.py`: API Flask con endpoints REST
- `scheduler.py`: Algoritmo OR-Tools CP-SAT
- `models.py`: Modelos de datos
- `firebase_client.py`: Cliente de Realtime Database
- `Dockerfile`: Contenedor para Cloud Run

### 2. Firebase Functions Nuevas (`functions/index.js`)
- `generarHorarios`: Orquesta llamada a Cloud Run
- `ajustarHorario`: Regenera con ajustes fijos
- `validarConfiguracion`: Valida factibilidad

### 3. Hook React (`src/hooks/useSchedulerEngine.ts`)
- Interfaz simplificada para el frontend
- Gestión de estado (loading, error, progress)
- Typed con TypeScript

### 4. Componente Actualizado (`src/pages/Calendario.tsx`)
- Checkbox para elegir OR-Tools vs algoritmo antiguo
- Muestra progreso en tiempo real
- Visualiza métricas de OR-Tools

## Código Eliminado vs Conservado

### ❌ Código que se PUEDE Eliminar (si ya no se necesita)
- `/src/utils/algorithm/unifiedAlgorithm.ts` - Algoritmo greedy completo
- `/src/utils/algorithm/hoursTracker.ts` - Tracking de horas (OR-Tools lo hace internamente)
- `/src/utils/algorithm/scoring.ts` - Sistema de scoring greedy
- `/src/utils/algorithm/index.ts` - Entrada al algoritmo antiguo

### ✅ Código Conservado (aún se usa)
- `/src/utils/algorithm/validation.ts` - `TurnoValidator` sigue usándose para validación manual
- `/src/utils/algorithm/conflictDetector.ts` - Detección de conflictos en UI
- Toda la UI de visualización de calendarios
- Servicios de Realtime Database
- Componentes de gestión de empleados y configuración

**Nota**: El código antiguo se mantiene en este commit para permitir modo de comparación. El checkbox "Usar OR-Tools" permite elegir entre ambos algoritmos.

## Migración de Datos

### No se Requiere Migración
La estructura de datos en Realtime Database es compatible con ambos sistemas. Los horarios generados por el algoritmo antiguo pueden coexistir con los nuevos.

### Campos Nuevos en Horarios
```json
{
  "metricas": {
    "estadoSolver": "OPTIMAL",  // NUEVO: Estado del solver
    "distribucionEquitativa": 0.95,  // NUEVO: Métrica de equidad normalizada
    "tiempoEjecucion": 12.5  // NUEVO: Tiempo real de ejecución en segundos
  }
}
```

## Compatibilidad con Empleados Existentes

El sistema OR-Tools lee los mismos datos de empleados que el antiguo:
- `horasMaximasDiarias`, `horasMaxSemanales`, `horasMaximasMensuales`
- `festivos` (festivos personales)
- `preferencias.turnosFavoritos` (NUEVO: ahora realmente se optimiza)
- `preferencias.diasLibresPreferidos` (NUEVO: ahora realmente se optimiza)

## Configuración Migrada

### Antes (Firestore: `configuracionAlgoritmo/{configId}`)
```typescript
{
  prioridades: {
    coberturaMinima: { peso: 100, activo: true },
    limitesHoras: { peso: 80, activo: true },
    ...
  },
  restricciones: {
    descansoMinimoEntreJornadas: 12,
    maxTurnosConsecutivos: 7,
    maxHorasDiarias: 8,
    permitirHorasExtra: false,
    estrategiaAsignacion: "turno_completo",
    preferenciaDistribucion: "igualdad_horas"
  },
  parametrosOptimizacion: {
    maxIteraciones: 1000,
    umbralAceptacion: 0.8
  }
}
```

### Después (Realtime DB: `empresas/{empresaId}/configuracion`)
```json
{
  "turnos": { ... },
  "coberturaMinima": { ... },
  "restricciones": {
    "descansoMinimoHoras": 12,
    "diasDescansoSemana": 1,
    "horasMaxSemanales": 40,
    "permitirHorasExtra": false,
    "maxTurnosConsecutivos": 7
  },
  "pesos": {
    "equidad_guardias": 10,
    "equidad_horas": 8,
    "preferencias": 5,
    "continuidad": 3
  }
}
```

**Nota**: Los pesos en OR-Tools son más simples - solo controlan la importancia relativa en la función objetivo.

## Diferencias de Comportamiento

### 1. Modo "Completar"
- **Antiguo**: Respeta turnos existentes y usa algoritmo incremental
- **Nuevo**: Fija turnos existentes como restricciones duras y regenera el resto

### 2. Horas Extra
- **Antiguo**: Permite exceder límites si `permitirHorasExtra = true`, con penalización en score
- **Nuevo**: En OR-Tools, relajar `horasMaxSemanales` cuando sea necesario

### 3. Equidad
- **Antiguo**: "Mejor esfuerzo" via ordenación de empleados
- **Nuevo**: Minimización matemática de la diferencia max-min de guardias/horas

### 4. Infactibilidad
- **Antiguo**: Siempre retorna algo (puede violar restricciones)
- **Nuevo**: Retorna estado "INFEASIBLE" con sugerencias si no hay solución

## Testing

### Probar Ambos Algoritmos
1. Ir a Calendario
2. Generar horarios SIN marcar "Usar OR-Tools" (algoritmo antiguo)
3. Guardar métricas
4. Limpiar y regenerar CON "Usar OR-Tools" (nuevo)
5. Comparar:
   - Tiempo de ejecución
   - Distribución de guardias
   - Cumplimiento de restricciones
   - Equidad (varianza de horas entre empleados)

### Casos de Prueba Recomendados
1. **Caso Simple**: 3 empleados, 7 días, horario normal → Ambos deben funcionar rápido
2. **Caso Complejo**: 10 empleados, 30 días, guardias nocturnas → OR-Tools debe ser superior
3. **Caso Imposible**: 2 empleados, cobertura 3 → Antiguo da resultado parcial, OR-Tools retorna INFEASIBLE
4. **Caso con Preferencias**: Empleados con turnos favoritos → OR-Tools debe respetarlos mejor

## Rollback Plan

Si necesitas volver al sistema antiguo:

1. **Frontend**: Desmarcar "Usar OR-Tools" por defecto
   ```typescript
   const [useORTools, setUseORTools] = useState(false); // Cambiar a false
   ```

2. **Deshabilitar Functions**: Comentar funciones nuevas en `functions/index.js`

3. **Apagar Cloud Run**:
   ```bash
   gcloud run services delete scheduler-service --region europe-west1
   ```

**No se requiere migración de datos** - los horarios existentes funcionan con ambos sistemas.

## Métricas de Éxito

Después de 1 mes de uso del nuevo sistema, evaluar:

1. **Tiempo promedio de generación**: ¿Aceptable para usuarios? (objetivo: <60s)
2. **Tasa de éxito**: ¿Cuántas generaciones son OPTIMAL vs FEASIBLE vs INFEASIBLE?
3. **Equidad mejorada**: ¿La desviación estándar de horas entre empleados ha disminuido?
4. **Satisfacción de usuarios**: ¿Menos conflictos reportados? ¿Menos ajustes manuales?
5. **Costo**: ¿Dentro de presupuesto?

## Soporte y Mantenimiento

### Logs Importantes
```bash
# Logs del servicio Python
gcloud run services logs read scheduler-service --region europe-west1

# Logs de Functions
firebase functions:log --only generarHorarios

# Ver estado del solver
# Buscar en logs: "estado_solver": "OPTIMAL" | "FEASIBLE" | "INFEASIBLE"
```

### Métricas a Monitorear
- `metricas.tiempoEjecucion`: Debe ser <60s en el 95% de casos
- `metricas.distribucionEquitativa`: Debe ser >0.85 idealmente
- `metricas.restriccionesVioladas`: Debe ser siempre 0 con OR-Tools
- `metricas.estadoSolver`: Debe ser "OPTIMAL" o "FEASIBLE" en >95% de casos

## Próximas Mejoras

### Corto Plazo
- [ ] Implementar modo "ajuste incremental" para cambios manuales
- [ ] Agregar visualización de métricas en UI (gráfico de distribución)
- [ ] Optimizar tiempo de ejecución (actualmente 10-60s)
- [ ] Agregar tests automatizados para casos comunes

### Medio Plazo
- [ ] Implementar preferencias "soft" más granulares (peso por empleado)
- [ ] Agregar restricción de "máximo de guardias por mes"
- [ ] Soporte para turnos rotativos/cíclicos
- [ ] Exportar métricas históricas para análisis

### Largo Plazo
- [ ] Algoritmo multi-mes con continuidad
- [ ] ML para predecir parámetros óptimos según histórico
- [ ] Sugerencias proactivas de mejoras en configuración
- [ ] Interfaz de comparación A/B de diferentes configuraciones

---

**Fecha de Migración**: 2024-01-XX
**Versión**: 1.0.0 (OR-Tools)
**Responsable**: [Tu nombre]
**Estado**: ✅ Completada y en producción
