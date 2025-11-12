# Scheduler Service - Servicio de Generación de Horarios con OR-Tools

Servicio Python que utiliza Google OR-Tools CP-SAT Solver para generar horarios optimizados de empleados cumpliendo restricciones duras y optimizando objetivos blandos.

## Características

- **Restricciones Duras** (obligatorias):
  - Cobertura mínima por turno
  - Horas máximas diarias, semanales y mensuales por empleado
  - Descanso mínimo entre turnos
  - Días de descanso semanales
  - Festivos personales respetados
  - Un solo turno por empleado por día

- **Objetivos de Optimización** (restricciones blandas):
  - Distribución equitativa de guardias
  - Distribución equitativa de horas entre empleados
  - Minimización de cambios bruscos de horario
  - Maximización de preferencias de empleados

## Requisitos

- Python 3.11+
- Google OR-Tools
- Firebase Admin SDK
- Flask

## Instalación

### Local

```bash
# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Copiar credenciales de Firebase
# Descargar serviceAccountKey.json desde Firebase Console
cp /ruta/a/serviceAccountKey.json .

# Ejecutar servidor
python main.py
```

El servidor estará disponible en `http://localhost:8080`

### Docker

```bash
# Construir imagen
docker build -t scheduler-service .

# Ejecutar contenedor
docker run -p 8080:8080 \
  -e FIREBASE_DATABASE_URL=https://tu-proyecto.firebaseio.com \
  -v $(pwd)/serviceAccountKey.json:/app/serviceAccountKey.json \
  scheduler-service
```

### Cloud Run (Google Cloud)

```bash
# Asegúrate de tener gcloud CLI instalado y configurado

# Desplegar a Cloud Run
gcloud run deploy scheduler-service \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars FIREBASE_DATABASE_URL=https://tu-proyecto.firebaseio.com
```

**Nota**: Las credenciales de Firebase se configuran automáticamente en Cloud Run si el proyecto está en la misma cuenta de GCP.

## API Endpoints

### `GET /health`

Health check del servicio.

**Respuesta:**
```json
{
  "status": "healthy",
  "service": "scheduler-service",
  "version": "1.0.0",
  "firebase": "connected"
}
```

### `POST /generar-horarios`

Genera horarios completos para un mes.

**Request Body:**
```json
{
  "empresaId": "empresa123",
  "mes": "2024-01",
  "empleadosIds": ["emp1", "emp2"],  // Opcional
  "opciones": {
    "timeout": 60,  // Segundos, opcional (default: 60)
    "ajustesFijos": {  // Opcional
      "emp1": {
        "2024-01-15": "turno_mañana"
      }
    }
  }
}
```

**Respuesta Exitosa (200):**
```json
{
  "estado": "success",
  "mensaje": "Horarios generados exitosamente (OPTIMAL)",
  "horarios": {
    "emp1": {
      "2024-01-01": "turno_mañana",
      "2024-01-02": "turno_tarde",
      ...
    },
    "emp2": {
      ...
    }
  },
  "metricas": {
    "horasPorEmpleado": {
      "emp1": 160.0,
      "emp2": 155.5
    },
    "guardiasPorEmpleado": {
      "emp1": 4,
      "emp2": 5
    },
    "festivosPorEmpleado": {
      "emp1": 2,
      "emp2": 1
    },
    "distribucionEquitativa": 0.95,
    "restriccionesVioladas": 0,
    "tiempoEjecucion": 12.5,
    "estadoSolver": "OPTIMAL"
  }
}
```

**Respuesta Infactible (422):**
```json
{
  "estado": "infeasible",
  "mensaje": "No se pudo generar un horario que cumpla todas las restricciones",
  "horarios": {},
  "metricas": {...},
  "sugerencias": [
    "Aumentar el número de empleados disponibles",
    "Reducir la cobertura mínima requerida por turno",
    ...
  ]
}
```

### `POST /ajustar-horarios`

Ajusta horarios existentes manteniendo turnos fijos del usuario.

**Request Body:**
```json
{
  "empresaId": "empresa123",
  "mes": "2024-01",
  "ajustes": [
    {
      "empleadoId": "emp1",
      "dia": "2024-01-15",
      "turnoId": "turno_mañana"
    }
  ]
}
```

**Respuesta:** Igual que `/generar-horarios`

### `POST /validar-configuracion`

Valida que la configuración sea factible antes de generar.

**Request Body:**
```json
{
  "empresaId": "empresa123",
  "mes": "2024-01"
}
```

**Respuesta:**
```json
{
  "factible": true,
  "errors": [],
  "warnings": [
    "Las horas disponibles pueden ser insuficientes..."
  ]
}
```

## Estructura de Datos en Firebase Realtime Database

### Empleados

```
empresas/{empresaId}/empleados/{empleadoId}
  ├── nombre: string
  ├── email: string
  ├── horasMaximasDiarias: number
  ├── horasMaxSemanales: number
  ├── horasMaximasMensuales: number
  ├── festivos: string[]  // Fechas ISO
  └── preferencias
      ├── turnosFavoritos: string[]
      └── diasLibresPreferidos: number[]  // 0-6
```

### Configuración

```
empresas/{empresaId}/configuracion
  ├── turnos
  │   ├── {turnoId}
  │   │   ├── nombre: string
  │   │   ├── horaInicio: string  // "HH:MM"
  │   │   ├── horaFin: string
  │   │   ├── duracionHoras: number
  │   │   └── tipo: "laboral"|"guardia"|"festivo"
  ├── coberturaMinima
  │   ├── {turnoId}: number  // Empleados requeridos
  └── restricciones
      ├── descansoMinimoHoras: number
      ├── diasDescansoSemana: number
      ├── horasMaxSemanales: number
      ├── permitirHorasExtra: boolean
      └── maxTurnosConsecutivos: number
```

### Horarios Generados

```
empresas/{empresaId}/horarios/{año-mes}
  ├── generado: timestamp
  ├── estado: "generado"|"modificado"
  ├── horarios
  │   └── {empleadoId}
  │       └── {dia}: turnoId
  └── metricas
      ├── horasPorEmpleado: object
      ├── guardiasPorEmpleado: object
      ├── festivosPorEmpleado: object
      ├── distribucionEquitativa: number
      ├── restriccionesVioladas: number
      ├── tiempoEjecucion: number
      └── estadoSolver: string
```

## Logging

El servicio utiliza logging estándar de Python. Los logs incluyen:

- Inicialización del servicio
- Solicitudes recibidas
- Progreso de la generación
- Errores y excepciones
- Resultados de la optimización

Nivel de logging: `INFO` (configurable en `main.py`)

## Troubleshooting

### El solver no encuentra solución (INFEASIBLE)

**Causas comunes:**
1. No hay suficientes empleados para cubrir la cobertura mínima
2. Las horas disponibles son insuficientes
3. Demasiados festivos personales que bloquean días críticos
4. Restricciones de descanso muy estrictas

**Soluciones:**
- Aumentar número de empleados
- Reducir cobertura mínima
- Habilitar horas extra
- Revisar festivos personales
- Ajustar días de descanso requeridos

### El solver es muy lento (timeout)

**Soluciones:**
- Aumentar el timeout (default: 60s)
- Reducir el número de empleados o días
- Simplificar restricciones
- Aumentar recursos de CPU/memoria en Cloud Run

### Firebase no conecta

**Verificar:**
1. `FIREBASE_DATABASE_URL` está correctamente configurada
2. `serviceAccountKey.json` existe y es válido
3. El proyecto de Firebase tiene Realtime Database habilitado
4. Las reglas de seguridad permiten lectura/escritura

## Desarrollo

### Estructura del Proyecto

```
scheduler-service/
├── main.py                # API Flask
├── scheduler.py           # Algoritmo OR-Tools
├── models.py              # Modelos de datos
├── firebase_client.py     # Cliente Firebase
├── requirements.txt       # Dependencias Python
├── Dockerfile            # Imagen Docker
├── .env.example          # Ejemplo de variables de entorno
└── README.md             # Esta documentación
```

### Testing

```bash
# Instalar pytest
pip install pytest pytest-cov

# Ejecutar tests
pytest tests/ -v

# Con cobertura
pytest tests/ --cov=. --cov-report=html
```

### Agregar Nuevas Restricciones

1. Editar `scheduler.py`
2. Agregar método `_aplicar_restriccion_nueva()` en la clase `SchedulerORTools`
3. Llamar el método en `generar_horarios()`
4. Actualizar modelos en `models.py` si es necesario
5. Actualizar documentación

## Licencia

Este proyecto es parte de AgapitoDiSousa.

## Soporte

Para preguntas o problemas, contactar al equipo de desarrollo.
