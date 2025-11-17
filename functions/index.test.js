// Archivo de prueba mínimo para verificar despliegue
const {onCall} = require('firebase-functions/v2/https');

exports.testFunction = onCall({
  region: 'europe-west1'
}, async (request) => {
  return {
    success: true,
    message: 'Test exitoso'
  };
});
