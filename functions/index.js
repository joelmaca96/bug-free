/**
 * Cloud Functions para AgapitoDiSousa
 *
 * Funciones principales:
 * - Envío de emails de notificación
 * - Generación de reportes PDF
 * - Cálculo y distribución de turnos
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configurar transporter de nodemailer
// IMPORTANTE: Configurar las credenciales de email en Firebase Config
const transporter = nodemailer.createTransport({
  service: 'gmail', // o el servicio de email que uses
  auth: {
    user: functions.config().email?.user || 'your-email@gmail.com',
    pass: functions.config().email?.password || 'your-password',
  },
});

/**
 * Enviar email de notificación cuando se crea un nuevo admin
 */
exports.sendAdminCreatedEmail = functions.firestore
  .document('usuarios/{userId}')
  .onCreate(async (snap, context) => {
    const userData = snap.data();

    // Solo enviar email si es un admin
    if (userData.rol !== 'admin') {
      return null;
    }

    const mailOptions = {
      from: 'AgapitoDiSousa <noreply@agapitodisousa.com>',
      to: userData.datosPersonales.email,
      subject: 'Bienvenido a AgapitoDiSousa - Cuenta de Administrador Creada',
      html: `
        <h2>¡Bienvenido a AgapitoDiSousa!</h2>
        <p>Hola ${userData.datosPersonales.nombre} ${userData.datosPersonales.apellidos},</p>
        <p>Se ha creado una cuenta de administrador para ti en el sistema AgapitoDiSousa.</p>

        <h3>Detalles de tu cuenta:</h3>
        <ul>
          <li><strong>Email:</strong> ${userData.datosPersonales.email}</li>
          <li><strong>Rol:</strong> Administrador</li>
        </ul>

        <p>Puedes acceder al sistema usando tu email y la contraseña que te fue proporcionada.</p>
        <p><a href="https://agapitodisousa.com/login">Ir al sistema</a></p>

        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>

        <p>Saludos,<br>El equipo de AgapitoDiSousa</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent to admin:', userData.datosPersonales.email);
      return null;
    } catch (error) {
      console.error('Error sending email:', error);
      return null;
    }
  });

/**
 * Enviar email de notificación cuando se crea un nuevo gestor
 */
exports.sendGestorCreatedEmail = functions.firestore
  .document('usuarios/{userId}')
  .onCreate(async (snap, context) => {
    const userData = snap.data();

    // Solo enviar email si es un gestor
    if (userData.rol !== 'gestor') {
      return null;
    }

    const mailOptions = {
      from: 'AgapitoDiSousa <noreply@agapitodisousa.com>',
      to: userData.datosPersonales.email,
      subject: 'Bienvenido a AgapitoDiSousa - Cuenta de Gestor Creada',
      html: `
        <h2>¡Bienvenido a AgapitoDiSousa!</h2>
        <p>Hola ${userData.datosPersonales.nombre} ${userData.datosPersonales.apellidos},</p>
        <p>Se ha creado una cuenta de gestor para ti en el sistema AgapitoDiSousa.</p>

        <h3>Detalles de tu cuenta:</h3>
        <ul>
          <li><strong>Email:</strong> ${userData.datosPersonales.email}</li>
          <li><strong>Rol:</strong> Gestor</li>
        </ul>

        <p>Como gestor, podrás:</p>
        <ul>
          <li>Gestionar empleados de tu farmacia</li>
          <li>Configurar horarios y turnos</li>
          <li>Generar calendarios automáticos</li>
          <li>Exportar y enviar horarios</li>
        </ul>

        <p>Puedes acceder al sistema usando tu email y la contraseña que te fue proporcionada.</p>
        <p><a href="https://agapitodisousa.com/login">Ir al sistema</a></p>

        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>

        <p>Saludos,<br>El equipo de AgapitoDiSousa</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent to gestor:', userData.datosPersonales.email);
      return null;
    } catch (error) {
      console.error('Error sending email:', error);
      return null;
    }
  });

/**
 * Enviar email de notificación cuando se crea un nuevo empleado
 */
exports.sendEmpleadoCreatedEmail = functions.firestore
  .document('usuarios/{userId}')
  .onCreate(async (snap, context) => {
    const userData = snap.data();

    // Solo enviar email si es un empleado
    if (userData.rol !== 'empleado') {
      return null;
    }

    const mailOptions = {
      from: 'AgapitoDiSousa <noreply@agapitodisousa.com>',
      to: userData.datosPersonales.email,
      subject: 'Bienvenido a AgapitoDiSousa',
      html: `
        <h2>¡Bienvenido a AgapitoDiSousa!</h2>
        <p>Hola ${userData.datosPersonales.nombre} ${userData.datosPersonales.apellidos},</p>
        <p>Se ha creado una cuenta para ti en el sistema AgapitoDiSousa.</p>

        <h3>Detalles de tu cuenta:</h3>
        <ul>
          <li><strong>Email:</strong> ${userData.datosPersonales.email}</li>
          <li><strong>Rol:</strong> Empleado</li>
        </ul>

        <p>Podrás acceder al sistema para consultar:</p>
        <ul>
          <li>Tu calendario de turnos</li>
          <li>Tus estadísticas de horas trabajadas</li>
          <li>Tus turnos programados</li>
        </ul>

        <p>Puedes acceder al sistema usando tu email y la contraseña que te fue proporcionada.</p>
        <p><a href="https://agapitodisousa.com/login">Ir al sistema</a></p>

        <p>Si tienes alguna pregunta, contacta con tu gestor.</p>

        <p>Saludos,<br>El equipo de AgapitoDiSousa</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent to empleado:', userData.datosPersonales.email);
      return null;
    } catch (error) {
      console.error('Error sending email:', error);
      return null;
    }
  });

/**
 * Callable function para enviar horario por email
 */
exports.sendScheduleEmail = functions.https.onCall(async (data, context) => {
  // Verificar que el usuario está autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Usuario debe estar autenticado'
    );
  }

  const { empleadoId, fechaInicio, fechaFin, farmaciaId } = data;

  try {
    // Obtener datos del empleado
    const empleadoDoc = await admin.firestore().doc(`usuarios/${empleadoId}`).get();
    if (!empleadoDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Empleado no encontrado');
    }

    const empleado = empleadoDoc.data();

    // Obtener turnos del empleado en el rango de fechas
    const turnosSnapshot = await admin
      .firestore()
      .collection(`calendarios/${farmaciaId}/turnos`)
      .where('empleadoId', '==', empleadoId)
      .where('fecha', '>=', fechaInicio)
      .where('fecha', '<=', fechaFin)
      .get();

    const turnos = turnosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Generar HTML con los turnos
    let turnosHtml = '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
    turnosHtml += '<tr><th>Fecha</th><th>Hora Inicio</th><th>Hora Fin</th><th>Tipo</th></tr>';

    turnos.forEach(turno => {
      turnosHtml += `
        <tr>
          <td>${turno.fecha}</td>
          <td>${turno.horaInicio}:00</td>
          <td>${turno.horaFin}:00</td>
          <td>${turno.tipo}</td>
        </tr>
      `;
    });

    turnosHtml += '</table>';

    const mailOptions = {
      from: 'AgapitoDiSousa <noreply@agapitodisousa.com>',
      to: empleado.datosPersonales.email,
      subject: `Tu horario del ${fechaInicio} al ${fechaFin}`,
      html: `
        <h2>Tu horario de trabajo</h2>
        <p>Hola ${empleado.datosPersonales.nombre},</p>
        <p>Aquí está tu horario de trabajo del <strong>${fechaInicio}</strong> al <strong>${fechaFin}</strong>:</p>

        ${turnosHtml}

        <p>Total de turnos: ${turnos.length}</p>

        <p>Si tienes alguna pregunta sobre tu horario, contacta con tu gestor.</p>

        <p>Saludos,<br>El equipo de AgapitoDiSousa</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return { success: true, message: 'Email enviado correctamente' };
  } catch (error) {
    console.error('Error sending schedule email:', error);
    throw new functions.https.HttpsError('internal', 'Error al enviar el email');
  }
});
