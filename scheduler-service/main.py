"""
API Flask para el servicio de generación de horarios
"""
import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

from models import (
    Empleado,
    ConfiguracionTurnos,
    ConfiguracionAlgoritmo,
    Restricciones,
    Turno,
    TipoTurno,
    SolicitudGeneracion,
    SolicitudValidacion
)
from scheduler import SchedulerORTools, validar_configuracion
from firebase_client import FirebaseClient

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Crear aplicación Flask
app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

# Inicializar cliente de Firebase
try:
    firebase_client = FirebaseClient()
    logger.info("Cliente de Firebase inicializado correctamente")
except Exception as e:
    logger.error(f"Error al inicializar Firebase: {e}")
    firebase_client = None


@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint para verificar que el servicio está funcionando

    Returns:
        JSON con estado del servicio
    """
    return jsonify({
        'status': 'healthy',
        'service': 'scheduler-service',
        'version': '1.0.0',
        'firebase': 'connected' if firebase_client else 'disconnected'
    }), 200


@app.route('/generar-horarios', methods=['POST'])
def generar_horarios():
    """
    Generar horarios completos para un mes

    Body:
        {
            "empresaId": str,
            "mes": str (YYYY-MM),
            "empleadosIds": List[str] (opcional),
            "opciones": {
                "timeout": int (opcional, segundos),
                "ajustesFijos": Dict (opcional)
            }
        }

    Returns:
        JSON con horarios generados y métricas
    """
    try:
        data = request.get_json()

        # Validar datos requeridos
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400

        empresa_id = data.get('empresaId')
        mes = data.get('mes')
        empleados_ids = data.get('empleadosIds')
        opciones = data.get('opciones', {})

        if not empresa_id or not mes:
            return jsonify({'error': 'empresaId y mes son requeridos'}), 400

        logger.info(f"Generando horarios para empresa {empresa_id}, mes {mes}")

        # Leer datos desde Firebase
        if not firebase_client:
            return jsonify({'error': 'Firebase no está conectado'}), 503

        empleados_data = firebase_client.leer_empleados(empresa_id, empleados_ids)
        if not empleados_data:
            return jsonify({'error': 'No se encontraron empleados'}), 404

        config_data = firebase_client.leer_configuracion(empresa_id)
        if not config_data:
            return jsonify({'error': 'No se encontró configuración'}), 404

        # Parsear configuración
        configuracion_turnos = _parsear_configuracion_turnos(config_data)
        configuracion_algoritmo = _parsear_configuracion_algoritmo(config_data)

        # Crear generador
        scheduler = SchedulerORTools(
            empleados=empleados_data,
            configuracion_turnos=configuracion_turnos,
            configuracion_algoritmo=configuracion_algoritmo,
            mes=mes
        )

        # Generar horarios
        timeout = opciones.get('timeout', 60)
        ajustes_fijos = opciones.get('ajustesFijos')

        resultado = scheduler.generar_horarios(
            ajustes_fijos=ajustes_fijos,
            timeout_segundos=timeout
        )

        # Guardar en Firebase si fue exitoso
        if resultado.estado == 'success':
            firebase_client.guardar_horarios(
                empresa_id=empresa_id,
                mes=mes,
                horarios=resultado.horarios,
                metricas={
                    'horasPorEmpleado': resultado.metricas.horas_por_empleado,
                    'guardiasPorEmpleado': resultado.metricas.guardias_por_empleado,
                    'festivosPorEmpleado': resultado.metricas.festivos_por_empleado,
                    'distribucionEquitativa': resultado.metricas.distribucion_equitativa,
                    'restriccionesVioladas': resultado.metricas.restricciones_violadas,
                    'tiempoEjecucion': resultado.metricas.tiempo_ejecucion_segundos,
                    'estadoSolver': resultado.metricas.estado_solver
                }
            )

        # Construir respuesta
        respuesta = {
            'estado': resultado.estado,
            'mensaje': resultado.mensaje,
            'horarios': resultado.horarios,
            'metricas': {
                'horasPorEmpleado': resultado.metricas.horas_por_empleado,
                'guardiasPorEmpleado': resultado.metricas.guardias_por_empleado,
                'festivosPorEmpleado': resultado.metricas.festivos_por_empleado,
                'distribucionEquitativa': resultado.metricas.distribucion_equitativa,
                'restriccionesVioladas': resultado.metricas.restricciones_violadas,
                'tiempoEjecucion': resultado.metricas.tiempo_ejecucion_segundos,
                'estadoSolver': resultado.metricas.estado_solver
            }
        }

        if resultado.sugerencias:
            respuesta['sugerencias'] = resultado.sugerencias

        status_code = 200 if resultado.estado == 'success' else 422

        return jsonify(respuesta), status_code

    except Exception as e:
        logger.error(f"Error generando horarios: {e}", exc_info=True)
        return jsonify({
            'error': 'Error interno del servidor',
            'detalle': str(e)
        }), 500


@app.route('/ajustar-horarios', methods=['POST'])
def ajustar_horarios():
    """
    Ajustar horarios con restricciones fijas del usuario

    Body:
        {
            "empresaId": str,
            "mes": str (YYYY-MM),
            "ajustes": [
                {
                    "empleadoId": str,
                    "dia": str (YYYY-MM-DD),
                    "turnoId": str
                }
            ]
        }

    Returns:
        JSON con horarios ajustados
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400

        empresa_id = data.get('empresaId')
        mes = data.get('mes')
        ajustes = data.get('ajustes', [])

        if not empresa_id or not mes:
            return jsonify({'error': 'empresaId y mes son requeridos'}), 400

        logger.info(f"Ajustando horarios para empresa {empresa_id}, mes {mes}")

        # Leer horarios existentes
        if not firebase_client:
            return jsonify({'error': 'Firebase no está conectado'}), 503

        horarios_existentes = firebase_client.leer_horarios_existentes(empresa_id, mes)

        # Convertir ajustes a formato de ajustes fijos
        ajustes_fijos = {}
        for ajuste in ajustes:
            empleado_id = ajuste.get('empleadoId')
            dia = ajuste.get('dia')
            turno_id = ajuste.get('turnoId')

            if empleado_id and dia and turno_id:
                if empleado_id not in ajustes_fijos:
                    ajustes_fijos[empleado_id] = {}
                ajustes_fijos[empleado_id][dia] = turno_id

        # Leer configuración y empleados
        empleados_data = firebase_client.leer_empleados(empresa_id)
        config_data = firebase_client.leer_configuracion(empresa_id)

        configuracion_turnos = _parsear_configuracion_turnos(config_data)
        configuracion_algoritmo = _parsear_configuracion_algoritmo(config_data)

        # Crear generador con ajustes fijos
        scheduler = SchedulerORTools(
            empleados=empleados_data,
            configuracion_turnos=configuracion_turnos,
            configuracion_algoritmo=configuracion_algoritmo,
            mes=mes
        )

        resultado = scheduler.generar_horarios(
            ajustes_fijos=ajustes_fijos,
            timeout_segundos=60
        )

        # Guardar en Firebase
        if resultado.estado == 'success':
            firebase_client.guardar_horarios(
                empresa_id=empresa_id,
                mes=mes,
                horarios=resultado.horarios,
                metricas={
                    'horasPorEmpleado': resultado.metricas.horas_por_empleado,
                    'guardiasPorEmpleado': resultado.metricas.guardias_por_empleado,
                    'festivosPorEmpleado': resultado.metricas.festivos_por_empleado,
                    'distribucionEquitativa': resultado.metricas.distribucion_equitativa,
                    'restriccionesVioladas': resultado.metricas.restricciones_violadas,
                    'tiempoEjecucion': resultado.metricas.tiempo_ejecucion_segundos,
                    'estadoSolver': resultado.metricas.estado_solver
                }
            )

            # Marcar como modificado
            firebase_client.actualizar_estado_horario(empresa_id, mes, 'modificado')

        respuesta = {
            'estado': resultado.estado,
            'mensaje': resultado.mensaje,
            'horarios': resultado.horarios,
            'metricas': {
                'horasPorEmpleado': resultado.metricas.horas_por_empleado,
                'guardiasPorEmpleado': resultado.metricas.guardias_por_empleado,
                'festivosPorEmpleado': resultado.metricas.festivos_por_empleado,
                'distribucionEquitativa': resultado.metricas.distribucion_equitativa,
                'restriccionesVioladas': resultado.metricas.restricciones_violadas,
                'tiempoEjecucion': resultado.metricas.tiempo_ejecucion_segundos
            }
        }

        status_code = 200 if resultado.estado == 'success' else 422

        return jsonify(respuesta), status_code

    except Exception as e:
        logger.error(f"Error ajustando horarios: {e}", exc_info=True)
        return jsonify({
            'error': 'Error interno del servidor',
            'detalle': str(e)
        }), 500


@app.route('/validar-configuracion', methods=['POST'])
def validar_configuracion_endpoint():
    """
    Validar que la configuración sea factible

    Body:
        {
            "empresaId": str,
            "mes": str (YYYY-MM)
        }

    Returns:
        JSON con resultado de la validación
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400

        empresa_id = data.get('empresaId')
        mes = data.get('mes')

        if not empresa_id or not mes:
            return jsonify({'error': 'empresaId y mes son requeridos'}), 400

        logger.info(f"Validando configuración para empresa {empresa_id}, mes {mes}")

        # Leer datos desde Firebase
        if not firebase_client:
            return jsonify({'error': 'Firebase no está conectado'}), 503

        empleados_data = firebase_client.leer_empleados(empresa_id)
        config_data = firebase_client.leer_configuracion(empresa_id)

        if not empleados_data or not config_data:
            return jsonify({
                'error': 'No se encontraron datos suficientes para validar'
            }), 404

        configuracion_turnos = _parsear_configuracion_turnos(config_data)
        configuracion_algoritmo = _parsear_configuracion_algoritmo(config_data)

        # Validar
        resultado = validar_configuracion(
            empleados=empleados_data,
            configuracion_turnos=configuracion_turnos,
            configuracion_algoritmo=configuracion_algoritmo,
            mes=mes
        )

        return jsonify(resultado), 200

    except Exception as e:
        logger.error(f"Error validando configuración: {e}", exc_info=True)
        return jsonify({
            'error': 'Error interno del servidor',
            'detalle': str(e)
        }), 500


def _parsear_configuracion_turnos(config_data: dict) -> ConfiguracionTurnos:
    """
    Parsear configuración de turnos desde Firebase

    Args:
        config_data: Datos de configuración desde Firebase

    Returns:
        ConfiguracionTurnos
    """
    turnos_data = config_data.get('turnos', {})
    cobertura_data = config_data.get('coberturaMinima', {})

    turnos = {}
    for turno_id, turno_info in turnos_data.items():
        tipo_str = turno_info.get('tipo', 'laboral')
        tipo = TipoTurno(tipo_str) if tipo_str in ['laboral', 'guardia', 'festivo'] else TipoTurno.LABORAL

        turnos[turno_id] = Turno(
            id=turno_id,
            nombre=turno_info.get('nombre', ''),
            hora_inicio=turno_info.get('horaInicio', '09:00'),
            hora_fin=turno_info.get('horaFin', '17:00'),
            duracion_horas=turno_info.get('duracionHoras', 8),
            tipo=tipo
        )

    return ConfiguracionTurnos(
        turnos=turnos,
        cobertura_minima=cobertura_data
    )


def _parsear_configuracion_algoritmo(config_data: dict) -> ConfiguracionAlgoritmo:
    """
    Parsear configuración del algoritmo desde Firebase

    Args:
        config_data: Datos de configuración desde Firebase

    Returns:
        ConfiguracionAlgoritmo
    """
    restricciones_data = config_data.get('restricciones', {})

    restricciones = Restricciones(
        descanso_minimo_horas=restricciones_data.get('descansoMinimoHoras', 12),
        dias_descanso_semana=restricciones_data.get('diasDescansoSemana', 1),
        horas_maximas_semanales=restricciones_data.get('horasMaxSemanales', 40),
        permitir_horas_extra=restricciones_data.get('permitirHorasExtra', False),
        max_turnos_consecutivos=restricciones_data.get('maxTurnosConsecutivos', 7)
    )

    # Pesos de optimización (valores por defecto si no existen)
    pesos = config_data.get('pesos', {})

    return ConfiguracionAlgoritmo(
        restricciones=restricciones,
        pesos_optimizacion=pesos
    )


@app.errorhandler(404)
def not_found(error):
    """Manejador de errores 404"""
    return jsonify({'error': 'Ruta no encontrada'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Manejador de errores 500"""
    logger.error(f"Error 500: {error}")
    return jsonify({'error': 'Error interno del servidor'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
