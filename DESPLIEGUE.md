# Guía de Despliegue - Sistema de Generación de Horarios con OR-Tools

Este documento describe cómo desplegar el sistema completo de generación de horarios que utiliza Google OR-Tools.

## Arquitectura del Sistema

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   React     │────────▶│ Firebase         │────────▶│ Cloud Run       │
│   Frontend  │         │ Functions        │         │ (Python         │
│             │         │ (Orquestador)    │         │  + OR-Tools)    │
└─────────────┘         └──────────────────┘         └─────────────────┘
                                │                              │
                                │                              │
                                ▼                              ▼
                        ┌────────────────────────────────────────┐
                        │   Firebase Realtime Database           │
                        │   - Empleados                          │
                        │   - Configuración                      │
                        │   - Horarios generados                 │
                        └────────────────────────────────────────┘
```

## Prerrequisitos

### 1. Herramientas Necesarias

- **Node.js** 20+
- **Python** 3.11+
- **gcloud CLI** (Google Cloud SDK)
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Git**

### 2. Cuenta de Google Cloud

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. Habilitar APIs necesarias:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```
3. Configurar facturación (Cloud Run tiene capa gratuita generosa)

### 3. Proyecto de Firebase

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilitar **Realtime Database**
3. Habilitar **Authentication**
4. Descargar `serviceAccountKey.json` desde:
   - Firebase Console → Project Settings → Service Accounts → Generate new private key

## Paso 1: Desplegar el Servicio Python (Cloud Run)

### 1.1. Preparar el Servicio

```bash
cd scheduler-service/

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

### 1.2. Probar Localmente (Opcional)

```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor local
python main.py
```

Probar health check:
```bash
curl http://localhost:8080/health
```

### 1.3. Desplegar a Cloud Run

**Opción A: Usando el script automatizado**
```bash
./deploy.sh
```

Cuando se solicite, configurar:
- Proyecto ID de Google Cloud
- Región (recomendado: `europe-west1`)
- Firebase Database URL

**Opción B: Manual**
```bash
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

**Nota sobre `--allow-unauthenticated`:**
- Esto permite que las Firebase Functions llamen al servicio
- Si prefieres autenticación, configura Service Accounts para las Functions
- Para producción, considera usar Cloud Run con autenticación

### 1.4. Obtener la URL del Servicio

Después del despliegue, obtendrás una URL como:
```
https://scheduler-service-xxxxxxxxxx-ew.a.run.app
```

**Guardar esta URL**, la necesitarás para configurar las Functions.

## Paso 2: Configurar y Desplegar Firebase Functions

### 2.1. Instalar Dependencias

```bash
cd ../functions/
npm install
```

### 2.2. Configurar Variables de Entorno

Crear archivo `.env` en `functions/`:
```bash
cp .env.example .env
```

Editar `functions/.env`:
```env
# Email Configuration
EMAIL_USER=tu-email@gmail.com
EMAIL_PASSWORD=tu-app-password

# Scheduler Service URL (Cloud Run)
SCHEDULER_SERVICE_URL=https://scheduler-service-xxxxxxxxxx-ew.a.run.app
```

**Importante:** Usar "App Password" de Gmail, no la contraseña normal.
- Ir a cuenta de Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones

### 2.3. Configurar Variables en Firebase

Las variables de entorno también deben configurarse en Firebase:

```bash
firebase functions:config:set \
  email.user="tu-email@gmail.com" \
  email.password="tu-app-password" \
  scheduler.service_url="https://scheduler-service-xxx.run.app"
```

Verificar configuración:
```bash
firebase functions:config:get
```

### 2.4. Desplegar Functions

```bash
# Desplegar todas las functions
firebase deploy --only functions

# O desplegar solo las nuevas functions
firebase deploy --only functions:generarHorarios,functions:ajustarHorario,functions:validarConfiguracion
```

## Paso 3: Configurar Frontend (React)

### 3.1. Actualizar Variables de Entorno

En el directorio raíz del proyecto, crear/editar `.env`:

```env
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_FIREBASE_DATABASE_URL=https://tu-proyecto.firebaseio.com
```

Obtener estas credenciales desde:
- Firebase Console → Project Settings → General → Your apps → Web app

### 3.2. Construir para Producción

```bash
npm install
npm run build
```

### 3.3. Desplegar a Firebase Hosting

```bash
firebase deploy --only hosting
```

## Paso 4: Configurar Base de Datos

### 4.1. Estructura de Datos

Asegurarse de que la estructura de Realtime Database coincida con el formato esperado:

```
empresas/
  {empresaId}/
    empleados/
      {empleadoId}/
        nombre: string
        email: string
        horasMaximasDiarias: number
        horasMaxSemanales: number
        horasMaximasMensuales: number
        festivos: string[]
        preferencias/
          turnosFavoritos: string[]
          diasLibresPreferidos: number[]
    configuracion/
      turnos/
        {turnoId}/
          nombre: string
          horaInicio: string
          horaFin: string
          duracionHoras: number
          tipo: "laboral"|"guardia"|"festivo"
      coberturaMinima/
        {turnoId}: number
      restricciones/
        descansoMinimoHoras: number
        diasDescansoSemana: number
        horasMaxSemanales: number
        permitirHorasExtra: boolean
        maxTurnosConsecutivos: number
    horarios/
      {año-mes}/
        generado: timestamp
        estado: "generado"|"modificado"
        horarios/
          {empleadoId}/
            {dia}: turnoId
        metricas/
          ...
```

### 4.2. Reglas de Seguridad

Configurar reglas de seguridad en Firebase Realtime Database:

```json
{
  "rules": {
    "empresas": {
      "$empresaId": {
        ".read": "auth != null && (
          root.child('usuarios').child(auth.uid).child('empresaId').val() === $empresaId ||
          root.child('usuarios').child(auth.uid).child('rol').val() === 'superuser'
        )",
        ".write": "auth != null && (
          root.child('usuarios').child(auth.uid).child('empresaId').val() === $empresaId &&
          root.child('usuarios').child(auth.uid).child('rol').val() !== 'empleado'
        )"
      }
    }
  }
}
```

Aplicar reglas:
```bash
firebase deploy --only database
```

## Paso 5: Verificar Despliegue

### 5.1. Probar Cloud Run

```bash
# Health check
curl https://scheduler-service-xxx.run.app/health

# Debe responder:
# {"status":"healthy","service":"scheduler-service","version":"1.0.0","firebase":"connected"}
```

### 5.2. Probar Firebase Functions

```bash
# Listar functions desplegadas
firebase functions:list

# Verificar logs
firebase functions:log --only generarHorarios
```

### 5.3. Probar desde la Aplicación

1. Acceder a la aplicación web
2. Ir a "Calendario"
3. Hacer clic en "Generar Calendario Automático"
4. Marcar "Usar OR-Tools"
5. Seleccionar período y generar

**Verificar:**
- El botón muestra progreso ("Conectando...", "Generando horarios...")
- La generación tarda entre 10-60 segundos
- Se muestra mensaje de éxito con métricas
- Los horarios aparecen en el calendario

## Troubleshooting

### Error: "Firebase no está conectado"

**Causa:** El servicio Python no puede conectar con Realtime Database.

**Solución:**
1. Verificar que `FIREBASE_DATABASE_URL` está correctamente configurada en Cloud Run
2. Verificar que `serviceAccountKey.json` es válido
3. Revisar logs de Cloud Run:
   ```bash
   gcloud run services logs read scheduler-service --region europe-west1
   ```

### Error: "Error al conectar con el servicio de generación"

**Causa:** Las Firebase Functions no pueden llegar a Cloud Run.

**Solución:**
1. Verificar que `SCHEDULER_SERVICE_URL` está configurada en Functions
2. Verificar que Cloud Run permite tráfico sin autenticación o configura autenticación
3. Revisar logs de Functions:
   ```bash
   firebase functions:log
   ```

### Error: "INFEASIBLE" al generar horarios

**Causa:** No hay solución que cumpla todas las restricciones.

**Solución:**
1. Aumentar número de empleados
2. Reducir cobertura mínima
3. Habilitar "Permitir horas extra" en configuración
4. Revisar festivos personales que bloqueen demasiados días
5. Llamar a endpoint `/validar-configuracion` para obtener sugerencias específicas

### Timeout al generar horarios

**Causa:** El problema es muy grande o complejo.

**Solución:**
1. Aumentar timeout en Firebase Functions (máximo 540s)
2. Reducir el período a generar (por ejemplo, 2 semanas en vez de 1 mes)
3. Aumentar recursos de Cloud Run (CPU y memoria)

## Monitoreo y Logs

### Cloud Run
```bash
# Ver logs en tiempo real
gcloud run services logs tail scheduler-service --region europe-west1

# Ver logs históricos
gcloud run services logs read scheduler-service --region europe-west1 --limit 50
```

### Firebase Functions
```bash
# Logs en tiempo real
firebase functions:log --follow

# Logs específicos de una función
firebase functions:log --only generarHorarios
```

### Métricas de Cloud Run

Acceder a Google Cloud Console → Cloud Run → scheduler-service → Métricas

Revisar:
- Latencia de solicitudes
- Tasa de errores
- Uso de CPU/memoria
- Número de instancias

## Costos Estimados

### Cloud Run (Capa Gratuita)
- **Invocaciones:** 2 millones/mes gratis
- **Tiempo de CPU:** 180,000 vCPU-segundos/mes gratis
- **Memoria:** 360,000 GiB-segundos/mes gratis
- **Tráfico de red:** 1 GB/mes gratis

**Estimación para 100 generaciones/mes:**
- Tiempo promedio: 30s por generación
- Total: 3,000 vCPU-segundos
- **Costo:** $0 (dentro de capa gratuita)

### Firebase Functions
- **Invocaciones:** 2 millones/mes gratis
- **Tiempo de ejecución:** 400,000 GB-segundos/mes gratis

**Estimación:**
- **Costo:** $0 (dentro de capa gratuita)

### Firebase Realtime Database
- **Almacenamiento:** 1 GB gratis
- **Datos descargados:** 10 GB/mes gratis

**Estimación para 100 empresas con 1,000 horarios:**
- Almacenamiento: ~50 MB
- **Costo:** $0 (dentro de capa gratuita)

**Total estimado:** $0/mes para uso moderado dentro de capas gratuitas.

Para uso enterprise, estimar ~$50-200/mes dependiendo del volumen.

## Mantenimiento

### Actualizar el Servicio Python

```bash
cd scheduler-service/
git pull
./deploy.sh
```

### Actualizar Firebase Functions

```bash
cd functions/
npm install
firebase deploy --only functions
```

### Actualizar Frontend

```bash
npm install
npm run build
firebase deploy --only hosting
```

## Soporte

Para problemas o preguntas:
1. Revisar logs en Cloud Run y Functions
2. Consultar documentación de cada servicio en sus respectivos README
3. Crear issue en el repositorio del proyecto

---

**¡Felicidades! El sistema de generación de horarios con OR-Tools está desplegado y funcionando.**
