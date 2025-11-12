# Desarrollo Local - Scheduler Service

Guía para ejecutar y probar el servicio de scheduler localmente antes de desplegar a Cloud Run.

## Prerrequisitos

- Python 3.11+
- pip
- Credenciales de Firebase (`serviceAccountKey.json`)

## Configuración Inicial

### 1. Crear entorno virtual

```bash
cd scheduler-service/

# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
# En Linux/Mac:
source venv/bin/activate
# En Windows:
venv\Scripts\activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar credenciales

```bash
# Copiar credenciales de Firebase
cp /ruta/a/tu/serviceAccountKey.json .

# Crear archivo .env
cp .env.example .env
```

Editar `.env`:
```env
FIREBASE_DATABASE_URL=https://tu-proyecto.firebaseio.com
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json
PORT=8080
```

## Ejecutar el Servidor Local

```bash
python main.py
```

El servidor estará disponible en `http://localhost:8080`

## Probar Endpoints

### Health Check

```bash
curl http://localhost:8080/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "service": "scheduler-service",
  "version": "1.0.0",
  "firebase": "connected"
}
```

### Generar Horarios (ejemplo)

```bash
curl -X POST http://localhost:8080/generar-horarios \
  -H "Content-Type: application/json" \
  -d '{
    "empresaId": "empresa123",
    "mes": "2024-01",
    "empleadosIds": ["emp1", "emp2", "emp3"],
    "opciones": {
      "timeout": 60
    }
  }'
```

### Validar Configuración (ejemplo)

```bash
curl -X POST http://localhost:8080/validar-configuracion \
  -H "Content-Type: application/json" \
  -d '{
    "empresaId": "empresa123",
    "mes": "2024-01"
  }'
```

## Debugging

### Modo Debug

Editar `main.py`:
```python
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)  # Cambiar a debug=True
```

### Ver Logs Detallados

Editar `main.py`:
```python
logging.basicConfig(
    level=logging.DEBUG,  # Cambiar de INFO a DEBUG
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### Probar Algoritmo Directamente

Crear archivo `test_scheduler.py`:
```python
from models import Empleado, ConfiguracionTurnos, Turno, TipoTurno, ConfiguracionAlgoritmo, Restricciones
from scheduler import SchedulerORTools

# Crear datos de prueba
empleados = [
    Empleado(
        uid="emp1",
        nombre="Juan Pérez",
        email="juan@test.com",
        horas_maximas_diarias=8,
        horas_maximas_semanales=40,
        horas_maximas_mensuales=160,
        festivos_personales=[],
        turnos_favoritos=[],
        dias_libres_preferidos=[]
    ),
    Empleado(
        uid="emp2",
        nombre="María García",
        email="maria@test.com",
        horas_maximas_diarias=8,
        horas_maximas_semanales=40,
        horas_maximas_mensuales=160,
        festivos_personales=[],
        turnos_favoritos=[],
        dias_libres_preferidos=[]
    ),
]

turnos = {
    "mañana": Turno(
        id="mañana",
        nombre="Mañana",
        hora_inicio="08:00",
        hora_fin="16:00",
        duracion_horas=8,
        tipo=TipoTurno.LABORAL
    ),
    "tarde": Turno(
        id="tarde",
        nombre="Tarde",
        hora_inicio="16:00",
        hora_fin="00:00",
        duracion_horas=8,
        tipo=TipoTurno.LABORAL
    ),
}

config_turnos = ConfiguracionTurnos(
    turnos=turnos,
    cobertura_minima={"mañana": 1, "tarde": 1}
)

config_algo = ConfiguracionAlgoritmo(
    restricciones=Restricciones(),
    pesos_optimizacion={}
)

# Ejecutar algoritmo
scheduler = SchedulerORTools(
    empleados=empleados,
    configuracion_turnos=config_turnos,
    configuracion_algoritmo=config_algo,
    mes="2024-01"
)

resultado = scheduler.generar_horarios(timeout_segundos=30)

print(f"Estado: {resultado.estado}")
print(f"Mensaje: {resultado.mensaje}")
print(f"Horarios generados: {len(resultado.horarios)} empleados")
print(f"Métricas: {resultado.metricas}")
```

Ejecutar:
```bash
python test_scheduler.py
```

## Tests Unitarios

Crear archivo `test_models.py`:
```python
import pytest
from models import Empleado, Turno, TipoTurno

def test_empleado_creation():
    emp = Empleado(
        uid="test",
        nombre="Test",
        email="test@test.com",
        horas_maximas_diarias=8,
        horas_maximas_semanales=40,
        horas_maximas_mensuales=160
    )
    assert emp.uid == "test"
    assert emp.horas_maximas_diarias == 8

def test_turno_creation():
    turno = Turno(
        id="test",
        nombre="Test",
        hora_inicio="08:00",
        hora_fin="16:00",
        duracion_horas=8,
        tipo=TipoTurno.LABORAL
    )
    assert turno.duracion_horas == 8
    assert turno.tipo == TipoTurno.LABORAL
```

Ejecutar tests:
```bash
pip install pytest
pytest test_models.py -v
```

## Probar con Docker Localmente

```bash
# Construir imagen
docker build -t scheduler-service:local .

# Ejecutar contenedor
docker run -p 8080:8080 \
  -e FIREBASE_DATABASE_URL=https://tu-proyecto.firebaseio.com \
  -v $(pwd)/serviceAccountKey.json:/app/serviceAccountKey.json \
  scheduler-service:local
```

Probar:
```bash
curl http://localhost:8080/health
```

## Simular Firebase Realtime Database Localmente

Si quieres trabajar completamente offline, puedes usar Firebase Emulators:

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# En el directorio raíz del proyecto
firebase init emulators

# Seleccionar: Realtime Database

# Iniciar emuladores
firebase emulators:start
```

Actualizar `.env`:
```env
FIREBASE_DATABASE_URL=http://localhost:9000/?ns=tu-proyecto
```

## Herramientas Útiles

### VSCode Extensions
- Python
- Pylance
- Python Debugger

### Python Debugger en VSCode

Crear `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Flask",
      "type": "python",
      "request": "launch",
      "module": "flask",
      "env": {
        "FLASK_APP": "main.py",
        "FLASK_ENV": "development"
      },
      "args": [
        "run",
        "--no-debugger",
        "--no-reload"
      ],
      "jinja": true
    }
  ]
}
```

### Postman Collection

Importar esta colección en Postman para probar los endpoints:

```json
{
  "info": {
    "name": "Scheduler Service",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "http://localhost:8080/health"
      }
    },
    {
      "name": "Generar Horarios",
      "request": {
        "method": "POST",
        "url": "http://localhost:8080/generar-horarios",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"empresaId\": \"empresa123\",\n  \"mes\": \"2024-01\",\n  \"empleadosIds\": [\"emp1\", \"emp2\"],\n  \"opciones\": {\n    \"timeout\": 60\n  }\n}"
        }
      }
    }
  ]
}
```

## Troubleshooting Común

### Error: "No module named 'ortools'"

```bash
pip install --upgrade pip
pip install ortools==9.8.3296
```

### Error: "Firebase no está conectado"

1. Verificar que `serviceAccountKey.json` existe
2. Verificar que `FIREBASE_DATABASE_URL` es correcta
3. Verificar conexión a Internet

### El solver es muy lento

1. Reducir el número de días (probar con 7 días primero)
2. Reducir el número de empleados
3. Aumentar el timeout

### Warnings de OR-Tools

Algunos warnings son normales:
```
W0000 ... This model contains a linear constraint of size...
```

Puedes ignorarlos si el algoritmo funciona correctamente.

## Siguiente Paso

Una vez que el servicio funciona localmente, seguir la guía en `DESPLIEGUE.md` para desplegar a Cloud Run.
