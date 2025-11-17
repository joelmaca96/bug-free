/**
 * Cloud Functions para Sistema de Generación de Horarios
 */

const {onCall, HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

/**
 * Callable function para generar horarios usando OR-Tools (Cloud Run)
 */
exports.generarHorarios = onCall({
  region: 'europe-west1',
  cors: true,
  memory: '2GiB',
  timeoutSeconds: 540
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario debe estar autenticado');
  }

  const data = request.data;
  const { empresaId, mes, empleadosIds, opciones } = data;

  if (!empresaId || !mes) {
    throw new HttpsError('invalid-argument', 'empresaId y mes son requeridos');
  }

  try {
    console.log(`[generarHorarios] Iniciando para empresa ${empresaId}, mes ${mes}`);
    console.log(`[generarHorarios] Usuario autenticado: ${request.auth.uid}`);

    // Verificar permisos - Usar Realtime Database
    const callerRef = admin.database().ref(`usuarios/${request.auth.uid}`);
    const callerSnapshot = await callerRef.once('value');
    const caller = callerSnapshot.val();

    console.log(`[generarHorarios] Usuario existe en Realtime DB: ${caller !== null}`);

    if (!caller) {
      throw new HttpsError('not-found', `Usuario no encontrado en Realtime DB: ${request.auth.uid}`);
    }

    if (!['superuser', 'admin', 'gestor'].includes(caller.rol)) {
      throw new HttpsError('permission-denied', 'No tienes permisos para generar horarios');
    }

    if (caller.rol !== 'superuser' && caller.empresaId !== empresaId) {
      throw new HttpsError('permission-denied', 'No tienes acceso a esta empresa');
    }

    // URL del servicio Cloud Run
    const serviceUrl = process.env.SCHEDULER_SERVICE_URL || 'http://localhost:8080';

    // Llamar al servicio de generación
    const response = await axios.post(
      `${serviceUrl}/generar-horarios`,
      {
        empresaId,
        mes,
        empleadosIds,
        opciones: opciones || {}
      },
      {
        timeout: 500000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log(`[generarHorarios] Respuesta recibida: ${response.data.estado}`);

    return {
      success: response.data.estado === 'success',
      horarioId: mes,
      metricas: response.data.metricas,
      estado: response.data.estado,
      mensaje: response.data.mensaje,
      sugerencias: response.data.sugerencias || []
    };

  } catch (error) {
    console.error('[generarHorarios] Error:', error);

    if (error.response) {
      throw new HttpsError(
        'internal',
        error.response.data.error || 'Error al generar horarios',
        { detalle: error.response.data.detalle }
      );
    } else if (error.code) {
      throw error;
    } else {
      throw new HttpsError('internal', 'Error al conectar con el servicio de generación');
    }
  }
});

/**
 * Callable function para ajustar horarios manualmente
 */
exports.ajustarHorario = onCall({
  region: 'europe-west1',
  cors: true,
  memory: '2GiB',
  timeoutSeconds: 540
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario debe estar autenticado');
  }

  const data = request.data;
  const { empresaId, mes, ajustes } = data;

  if (!empresaId || !mes || !ajustes) {
    throw new HttpsError('invalid-argument', 'empresaId, mes y ajustes son requeridos');
  }

  try {
    console.log(`[ajustarHorario] Iniciando para empresa ${empresaId}, mes ${mes}`);

    // Verificar permisos - Usar Realtime Database
    const callerRef = admin.database().ref(`usuarios/${request.auth.uid}`);
    const callerSnapshot = await callerRef.once('value');
    const caller = callerSnapshot.val();

    if (!caller) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }

    if (!['superuser', 'admin', 'gestor'].includes(caller.rol)) {
      throw new HttpsError('permission-denied', 'No tienes permisos para ajustar horarios');
    }

    if (caller.rol !== 'superuser' && caller.empresaId !== empresaId) {
      throw new HttpsError('permission-denied', 'No tienes acceso a esta empresa');
    }

    const serviceUrl = process.env.SCHEDULER_SERVICE_URL || 'http://localhost:8080';

    const response = await axios.post(
      `${serviceUrl}/ajustar-horarios`,
      { empresaId, mes, ajustes },
      {
        timeout: 500000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log(`[ajustarHorario] Respuesta recibida: ${response.data.estado}`);

    return {
      success: response.data.estado === 'success',
      horarioId: mes,
      metricas: response.data.metricas,
      estado: response.data.estado,
      mensaje: response.data.mensaje
    };

  } catch (error) {
    console.error('[ajustarHorario] Error:', error);

    if (error.response) {
      throw new HttpsError(
        'internal',
        error.response.data.error || 'Error al ajustar horarios',
        { detalle: error.response.data.detalle }
      );
    } else if (error.code) {
      throw error;
    } else {
      throw new HttpsError('internal', 'Error al conectar con el servicio de ajuste');
    }
  }
});

/**
 * Callable function para validar configuración
 */
exports.validarConfiguracion = onCall({
  region: 'europe-west1',
  cors: true
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario debe estar autenticado');
  }

  const data = request.data;
  const { empresaId, mes } = data;

  if (!empresaId || !mes) {
    throw new HttpsError('invalid-argument', 'empresaId y mes son requeridos');
  }

  try {
    console.log(`[validarConfiguracion] Validando empresa ${empresaId}, mes ${mes}`);

    // Verificar permisos - Usar Realtime Database
    const callerRef = admin.database().ref(`usuarios/${request.auth.uid}`);
    const callerSnapshot = await callerRef.once('value');
    const caller = callerSnapshot.val();

    if (!caller) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }

    if (!['superuser', 'admin', 'gestor'].includes(caller.rol)) {
      throw new HttpsError('permission-denied', 'No tienes permisos para validar configuración');
    }

    const serviceUrl = process.env.SCHEDULER_SERVICE_URL || 'http://localhost:8080';

    const response = await axios.post(
      `${serviceUrl}/validar-configuracion`,
      { empresaId, mes },
      {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log(`[validarConfiguracion] Resultado: ${response.data.factible ? 'factible' : 'no factible'}`);

    return {
      factible: response.data.factible,
      errors: response.data.errors || [],
      warnings: response.data.warnings || []
    };

  } catch (error) {
    console.error('[validarConfiguracion] Error:', error);

    if (error.response) {
      throw new HttpsError(
        'internal',
        error.response.data.error || 'Error al validar configuración',
        { detalle: error.response.data.detalle }
      );
    } else if (error.code) {
      throw error;
    } else {
      throw new HttpsError('internal', 'Error al conectar con el servicio de validación');
    }
  }
});

/**
 * Callable function para eliminar usuario de Firebase Auth
 */
exports.deleteUserAuth = onCall({
  region: 'europe-west1',
  cors: true
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuario debe estar autenticado');
  }

  // Verificar permisos - Usar Realtime Database
  const callerRef = admin.database().ref(`usuarios/${request.auth.uid}`);
  const callerSnapshot = await callerRef.once('value');
  const caller = callerSnapshot.val();

  if (!caller) {
    throw new HttpsError('not-found', 'Usuario no encontrado');
  }

  if (caller.rol !== 'superuser' && caller.rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo SuperUser o Admin pueden eliminar usuarios');
  }

  const { uid } = request.data;

  if (!uid) {
    throw new HttpsError('invalid-argument', 'UID es requerido');
  }

  try {
    await admin.auth().deleteUser(uid);
    await admin.database().ref(`usuarios/${uid}`).remove();

    return { success: true, message: 'Usuario eliminado correctamente' };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new HttpsError('internal', 'Error al eliminar el usuario');
  }
});
