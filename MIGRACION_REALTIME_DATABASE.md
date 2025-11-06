# Migración a Firebase Realtime Database para Calendarios

## Resumen de Cambios

Se ha refactorizado el sistema de almacenamiento de calendarios para usar Firebase Realtime Database en lugar de Firestore. Este cambio proporciona:

1. **Un calendario por farmacia y mes**: La estructura garantiza que solo puede existir un calendario por farmacia y mes específico
2. **Mejores permisos**: Control granular de acceso basado en roles
3. **Actualizaciones en tiempo real**: Los cambios se sincronizan automáticamente entre usuarios
4. **Mejor rendimiento**: Consultas más eficientes para calendarios mensuales

## Nueva Estructura de Datos

```
calendarios/
  {farmaciaId}/
    {año-mes}/  (ej: "2025-11")
      metadata:
        farmaciaId: string
        empresaId: string
        año: number
        mes: number
        createdAt: timestamp
        updatedAt: timestamp
      turnos/
        {turnoId}/
          empleadoId: string
          fecha: string (ISO date)
          horaInicio: number
          horaFin: number
          duracionMinutos: number
          tipo: 'laboral' | 'guardia' | 'festivo'
          estado: 'confirmado' | 'pendiente' | 'conflicto'
          createdAt: timestamp
          updatedAt: timestamp
```

## Reglas de Permisos

### Superuser
- Acceso completo a todos los calendarios

### Admin
- Puede ver y editar calendarios de todas las farmacias de su empresa
- Filtrado automático por `empresaId`

### Gestor
- Puede ver y editar el calendario de su farmacia
- Filtrado automático por `farmaciaId`

### Empleado
- Puede ver el calendario de su farmacia
- Solo puede ver sus propios turnos (filtrado en la aplicación)

## Pasos de Configuración

### 1. Habilitar Realtime Database en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. En el menú lateral, ve a "Realtime Database"
4. Haz clic en "Crear base de datos"
5. Selecciona la ubicación (región) - **IMPORTANTE**: Elige la misma región que tu proyecto
6. Selecciona "Modo bloqueado" (las reglas se aplicarán después)
7. Haz clic en "Habilitar"

### 2. Copiar la URL de Realtime Database

Una vez creada la base de datos, copia la URL que aparece en la parte superior. Debería verse así:

- Para us-central1: `https://tu-proyecto-default-rtdb.firebaseio.com`
- Para europe-west1: `https://tu-proyecto-default-rtdb.europe-west1.firebasedatabase.app`

### 3. Configurar Variables de Entorno

1. Copia `.env.example` a `.env`:
```bash
cp .env.example .env
```

2. Edita `.env` y agrega la URL de Realtime Database:
```env
VITE_FIREBASE_DATABASE_URL=https://tu-proyecto-default-rtdb.firebaseio.com
```

3. Asegúrate de que todas las demás variables de Firebase estén configuradas correctamente

### 4. Desplegar Reglas de Seguridad

Las reglas de seguridad se encuentran en `database.rules.json`. Para desplegarlas:

#### Opción A: Usando Firebase CLI (Recomendado)

```bash
# Instalar Firebase CLI si no lo tienes
npm install -g firebase-tools

# Iniciar sesión
firebase login

# Desplegar solo las reglas de Realtime Database
firebase deploy --only database
```

#### Opción B: Usando Firebase Console (Manual)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a "Realtime Database" → "Reglas"
4. Copia el contenido de `database.rules.json`
5. Pégalo en el editor de reglas
6. Haz clic en "Publicar"

### 5. Migrar Datos Existentes (Opcional)

Si tienes datos existentes en Firestore que quieres migrar a Realtime Database, puedes crear un script de migración. Un ejemplo básico:

```typescript
import { db } from './firebase'; // Firestore
import { realtimeDb } from './firebase'; // Realtime Database
import { ref, set } from 'firebase/database';
import { collection, getDocs } from 'firebase/firestore';

async function migrarCalendarios() {
  // Por cada farmacia
  const farmacias = await getDocs(collection(db, 'farmacias'));

  for (const farmaciaDoc of farmacias.docs) {
    const farmaciaId = farmaciaDoc.id;
    const farmacia = farmaciaDoc.data();

    // Obtener turnos de Firestore
    const turnosSnapshot = await getDocs(
      collection(db, `calendarios/${farmaciaId}/turnos`)
    );

    // Agrupar por mes y migrar
    const turnosPorMes = new Map();

    for (const turnoDoc of turnosSnapshot.docs) {
      const turno = turnoDoc.data();
      const fecha = new Date(turno.fecha);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

      if (!turnosPorMes.has(mesKey)) {
        turnosPorMes.set(mesKey, []);
      }

      turnosPorMes.get(mesKey).push({
        id: turnoDoc.id,
        ...turno
      });
    }

    // Guardar en Realtime Database
    for (const [mesKey, turnos] of turnosPorMes.entries()) {
      const [año, mes] = mesKey.split('-');

      const calendarioRef = ref(realtimeDb, `calendarios/${farmaciaId}/${mesKey}`);

      const calendarioData = {
        metadata: {
          farmaciaId,
          empresaId: farmacia.empresaId,
          año: parseInt(año),
          mes: parseInt(mes),
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        turnos: {}
      };

      turnos.forEach(turno => {
        calendarioData.turnos[turno.id] = {
          empleadoId: turno.empleadoId,
          fecha: turno.fecha,
          horaInicio: turno.horaInicio,
          horaFin: turno.horaFin,
          duracionMinutos: turno.duracionMinutos || ((turno.horaFin - turno.horaInicio) * 60),
          tipo: turno.tipo,
          estado: turno.estado,
          createdAt: turno.createdAt?.getTime() || Date.now(),
          updatedAt: turno.updatedAt?.getTime() || Date.now()
        };
      });

      await set(calendarioRef, calendarioData);
      console.log(`Migrado ${turnos.length} turnos para ${farmaciaId}/${mesKey}`);
    }
  }
}
```

## Archivos Modificados

### Nuevos Archivos
- `src/services/calendariosRealtimeService.ts` - Servicio para operaciones CRUD con Realtime Database
- `database.rules.json` - Reglas de seguridad para Realtime Database
- `.env.example` - Ejemplo de variables de entorno incluyendo DATABASE_URL
- `MIGRACION_REALTIME_DATABASE.md` - Esta guía

### Archivos Modificados
- `src/services/firebase.ts` - Agregado soporte para Realtime Database
- `src/pages/Calendario.tsx` - Actualizado para usar el nuevo servicio

### Archivos Antiguos (Ya no se usan para calendarios)
- `src/services/turnosService.ts` - Mantener por si acaso, pero ya no se usa en Calendario.tsx

## Funcionalidades Implementadas

### ✅ Gestión de Calendarios
- Creación automática de calendario al crear el primer turno de un mes
- Un calendario por farmacia y mes (garantizado por la estructura)
- Metadata del calendario incluye empresaId para filtrado eficiente

### ✅ Operaciones CRUD de Turnos
- Crear turno individual
- Crear múltiples turnos (batch)
- Actualizar turno
- Eliminar turno
- Eliminar turnos por rango de fechas
- Obtener turnos por mes
- Obtener turnos por empleado y mes
- Obtener turnos por rango de fechas (múltiples meses)

### ✅ Permisos y Seguridad
- Reglas de seguridad implementadas
- Filtrado por rol (superuser, admin, gestor, empleado)
- Validación de estructura de datos
- Validación de valores (horas, tipos, estados)

### ✅ Funcionalidad del Calendario
- Mostrar turnos existentes al entrar
- Edición individual de turnos
- Modo "Completar" - Mantiene turnos existentes y solo llena espacios vacíos
- Modo "Limpiar" - Elimina todos los turnos y genera calendario nuevo
- Visualización de conflictos
- Arrastrar y soltar turnos
- Agregar/editar/eliminar turnos manualmente

### ✅ Tiempo Real (Opcional)
- Función `subscribeTurnosByMonth()` disponible para actualizaciones en tiempo real
- Actualmente no habilitado en la UI, pero fácil de activar si se desea

## Ventajas de la Nueva Estructura

### 1. Mejor Organización
- Los turnos están agrupados por mes, facilitando consultas
- Un documento por calendario-mes reduce fragmentación

### 2. Rendimiento
- Consultas más rápidas al cargar un mes específico
- No es necesario consultar múltiples documentos/colecciones
- Estructura plana optimizada para lectura

### 3. Escalabilidad
- Estructura que crece horizontalmente (por mes)
- Cada mes es independiente
- Fácil de archivar meses antiguos

### 4. Permisos Granulares
- Control preciso basado en empresaId y farmaciaId
- Reglas de validación en el servidor
- Seguridad garantizada por Firebase

### 5. Mantenimiento
- Código más limpio y organizado
- Operaciones batch más eficientes
- Fácil de extender

## Pruebas

Para probar que todo funciona correctamente:

1. **Crear turnos manualmente**
   - Haz clic en una fecha del calendario
   - Asigna un empleado y horario
   - Verifica que se guarde correctamente

2. **Generar calendario automático**
   - Selecciona un rango de fechas
   - Prueba el modo "Limpiar"
   - Prueba el modo "Completar"

3. **Editar turnos**
   - Haz clic en un turno existente
   - Modifica horarios o empleado
   - Verifica que se actualice

4. **Eliminar turnos**
   - Haz clic en un turno y elimínalo
   - Usa el botón "Limpiar Mes"

5. **Probar permisos**
   - Inicia sesión como admin, gestor y empleado
   - Verifica que cada rol vea solo lo que debe

## Solución de Problemas

### Error: "Permission denied"
- Verifica que las reglas de seguridad estén desplegadas
- Asegúrate de que el usuario tenga el rol correcto en Firestore
- Verifica que empresaId esté configurado correctamente

### Error: "Cannot read property 'empresaId' of undefined"
- Asegúrate de que todos los usuarios tengan el campo `empresaId`
- Verifica que el campo esté en el documento de usuario en Firestore

### Error: "DATABASE_URL is not defined"
- Verifica que `.env` tenga la variable `VITE_FIREBASE_DATABASE_URL`
- Reinicia el servidor de desarrollo después de agregar la variable

### Los turnos no se muestran
- Abre la consola del navegador y busca errores
- Verifica que la URL de Realtime Database sea correcta
- Comprueba las reglas de seguridad en Firebase Console

## Soporte

Si encuentras problemas durante la migración:

1. Revisa los logs en la consola del navegador
2. Verifica las reglas de seguridad en Firebase Console → Realtime Database → Reglas
3. Comprueba que la URL de Realtime Database sea correcta
4. Asegúrate de que el usuario tenga todos los campos necesarios (empresaId, farmaciaId, rol)

## Próximos Pasos (Opcional)

- [ ] Activar actualizaciones en tiempo real con `subscribeTurnosByMonth()`
- [ ] Implementar caché local para mejor rendimiento offline
- [ ] Agregar índices para consultas complejas si es necesario
- [ ] Implementar sistema de auditoría para cambios en turnos
- [ ] Agregar notificaciones push cuando se actualice el calendario
