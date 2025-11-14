"""
Cliente de Firebase Realtime Database para interactuar con los datos
"""
import os
import logging
from typing import Dict, Any, Optional, List
import firebase_admin
from firebase_admin import credentials, db
from models import Empleado

logger = logging.getLogger(__name__)


class FirebaseClient:
    """Cliente para interactuar con Firebase Realtime Database"""

    def __init__(self):
        """Inicializar el cliente de Firebase"""
        if not firebase_admin._apps:
            # Verificar si existe el archivo de credenciales
            cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'serviceAccountKey.json')
            database_url = os.getenv('FIREBASE_DATABASE_URL')

            if not database_url:
                raise ValueError("FIREBASE_DATABASE_URL no está configurada")

            try:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred, {
                    'databaseURL': database_url
                })
                logger.info(f"Firebase inicializado correctamente con URL: {database_url}")
            except Exception as e:
                logger.error(f"Error al inicializar Firebase: {e}")
                raise

    def leer_empleados(self, empresa_id: str, empleados_ids: Optional[List[str]] = None) -> List[Empleado]:
        """
        Leer empleados de una empresa desde Firebase

        Args:
            empresa_id: ID de la empresa
            empleados_ids: Lista opcional de IDs de empleados específicos

        Returns:
            Lista de empleados
        """
        try:
            # Leer todos los usuarios desde /usuarios/
            ref = db.reference('usuarios')
            usuarios_data = ref.get()

            if not usuarios_data:
                logger.warning("No se encontraron usuarios en la base de datos")
                return []

            empleados = []
            for emp_id, emp_data in usuarios_data.items():
                # Filtrar por empresa
                if emp_data.get('empresaId') != empresa_id:
                    continue

                # Filtrar solo empleados que se deben incluir en el calendario
                if not emp_data.get('incluirEnCalendario', True):
                    continue

                # Filtrar por IDs específicos si se proporcionan
                if empleados_ids and emp_id not in empleados_ids:
                    continue

                # Obtener datos personales
                datos_personales = emp_data.get('datosPersonales', {})
                restricciones = emp_data.get('restricciones', {})
                preferencias = emp_data.get('preferencias', {})

                # Combinar nombre completo
                nombre = datos_personales.get('nombre', '')
                apellidos = datos_personales.get('apellidos', '')
                nombre_completo = f"{nombre} {apellidos}".strip()

                empleado = Empleado(
                    uid=emp_id,
                    nombre=nombre_completo,
                    email=datos_personales.get('email', ''),
                    horas_maximas_diarias=restricciones.get('horasMaximasDiarias', 10),
                    horas_maximas_semanales=restricciones.get('horasMaximasSemanales', 40),
                    horas_maximas_mensuales=restricciones.get('horasMaximasMensuales', 160),
                    festivos_personales=emp_data.get('festivosPersonales', []),
                    turnos_favoritos=preferencias.get('turnosFavoritos', []),
                    dias_libres_preferidos=preferencias.get('diasLibresPreferidos', [])
                )
                empleados.append(empleado)

            logger.info(f"Leídos {len(empleados)} empleados para empresa {empresa_id}")
            return empleados

        except Exception as e:
            logger.error(f"Error al leer empleados: {e}")
            raise

    def leer_configuracion(self, empresa_id: str, farmacia_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Leer configuración de turnos de una empresa/farmacia

        Args:
            empresa_id: ID de la empresa
            farmacia_id: ID de la farmacia (opcional, se infiere si no se proporciona)

        Returns:
            Configuración de turnos y algoritmo combinada
        """
        try:
            # Si no se proporciona farmacia_id, buscar la primera farmacia de la empresa
            if not farmacia_id:
                farmacias_ref = db.reference('farmacias')
                farmacias_data = farmacias_ref.get()

                if farmacias_data:
                    for fid, fdata in farmacias_data.items():
                        if fdata.get('empresaId') == empresa_id:
                            farmacia_id = fid
                            break

                if not farmacia_id:
                    logger.warning(f"No se encontró farmacia para empresa {empresa_id}")
                    return {}

            # Leer configuración de la farmacia
            farmacia_ref = db.reference(f'farmacias/{farmacia_id}')
            farmacia_data = farmacia_ref.get()

            if not farmacia_data:
                logger.warning(f"No se encontró farmacia {farmacia_id}")
                return {}

            # Leer configuración del algoritmo
            config_algoritmo_ref = db.reference(f'configuracionesAlgoritmo/{farmacia_id}')
            config_algoritmo_data = config_algoritmo_ref.get()

            if not config_algoritmo_data:
                logger.warning(f"No se encontró configuración de algoritmo para farmacia {farmacia_id}")
                config_algoritmo_data = {}

            # Combinar configuraciones
            config_farmacia = farmacia_data.get('configuracion', {})

            # Construir configuración completa
            config_data = {
                'turnos': self._generar_turnos_desde_horarios(config_farmacia.get('horariosHabituales', [])),
                'coberturaMinima': {
                    'trabajadoresMinimos': config_farmacia.get('trabajadoresMinimos', 1)
                },
                'restricciones': config_algoritmo_data.get('restricciones', {}),
                'prioridades': config_algoritmo_data.get('prioridades', {}),
                'festivosRegionales': config_farmacia.get('festivosRegionales', []),
                'jornadasGuardia': config_farmacia.get('jornadasGuardia', [])
            }

            logger.info(f"Configuración leída para farmacia {farmacia_id}")
            return config_data

        except Exception as e:
            logger.error(f"Error al leer configuración: {e}")
            raise

    def _generar_turnos_desde_horarios(self, horarios_habituales: list) -> Dict[str, Any]:
        """
        Genera definiciones de turnos desde los horarios habituales

        Args:
            horarios_habituales: Lista de horarios habituales por día

        Returns:
            Diccionario de turnos
        """
        turnos = {}

        for idx, horario in enumerate(horarios_habituales):
            hora_inicio = horario.get('inicio', '09:00')
            hora_fin = horario.get('fin', '17:00')

            # Calcular duración en horas
            try:
                h_inicio = int(hora_inicio.split(':')[0])
                m_inicio = int(hora_inicio.split(':')[1])
                h_fin = int(hora_fin.split(':')[0])
                m_fin = int(hora_fin.split(':')[1])

                duracion = (h_fin * 60 + m_fin - h_inicio * 60 - m_inicio) / 60
            except:
                duracion = 8

            turno_id = f"turno_{idx + 1}"
            turnos[turno_id] = {
                'id': turno_id,
                'nombre': f"Turno {hora_inicio}-{hora_fin}",
                'horaInicio': hora_inicio,
                'horaFin': hora_fin,
                'duracionHoras': duracion,
                'tipo': 'laboral',
                'dia': horario.get('dia')
            }

        return turnos

    def guardar_horarios(
        self,
        empresa_id: str,
        mes: str,
        horarios: Dict[str, Dict[str, str]],
        metricas: Dict[str, Any],
        farmacia_id: Optional[str] = None
    ) -> str:
        """
        Guardar horarios generados en Firebase

        Args:
            empresa_id: ID de la empresa
            mes: Mes en formato YYYY-MM
            horarios: Horarios asignados {empleadoId -> {dia -> turnoId}}
            metricas: Métricas de la generación
            farmacia_id: ID de la farmacia (opcional, se infiere si no se proporciona)

        Returns:
            ID del horario guardado
        """
        try:
            import time
            from datetime import datetime

            # Obtener farmacia_id si no se proporciona
            if not farmacia_id:
                farmacias_ref = db.reference('farmacias')
                farmacias_data = farmacias_ref.get()

                if farmacias_data:
                    for fid, fdata in farmacias_data.items():
                        if fdata.get('empresaId') == empresa_id:
                            farmacia_id = fid
                            break

            if not farmacia_id:
                raise ValueError(f"No se encontró farmacia para empresa {empresa_id}")

            # Leer configuración de turnos para expandir la información
            config_data = self.leer_configuracion(empresa_id, farmacia_id)
            turnos_config = config_data.get('turnos', {})

            # Convertir horarios al formato de la base de datos
            # De {empleadoId: {dia: turnoId}} a lista de turnos individuales
            logger.info(f"Procesando horarios para guardar: {len(horarios)} empleados")
            logger.debug(f"Horarios recibidos: {horarios}")

            turnos = {}
            for empleado_id, dias_turnos in horarios.items():
                for dia, turno_id in dias_turnos.items():
                    # Obtener información del turno desde la configuración
                    turno_info = turnos_config.get(turno_id, {})

                    # Convertir horas de formato HH:MM a números
                    hora_inicio_str = turno_info.get('horaInicio', '09:00')
                    hora_fin_str = turno_info.get('horaFin', '17:00')

                    try:
                        hora_inicio = int(hora_inicio_str.split(':')[0])
                        minutos_inicio = int(hora_inicio_str.split(':')[1])
                        hora_fin = int(hora_fin_str.split(':')[0])
                        minutos_fin = int(hora_fin_str.split(':')[1])

                        # Calcular duración en minutos
                        duracion_minutos = (hora_fin * 60 + minutos_fin) - (hora_inicio * 60 + minutos_inicio)
                    except:
                        hora_inicio = 9
                        hora_fin = 17
                        duracion_minutos = 480

                    # Generar un ID único para el turno
                    turno_key = db.reference(f'calendarios/{farmacia_id}/{mes}/turnos').push().key

                    turnos[turno_key] = {
                        'empleadoId': empleado_id,
                        'fecha': dia,
                        'turnoId': turno_id,
                        'horaInicio': hora_inicio,
                        'horaFin': hora_fin,
                        'duracionMinutos': duracion_minutos,
                        'tipo': turno_info.get('tipo', 'laboral'),
                        'estado': 'confirmado',
                        'createdAt': int(time.time() * 1000),
                        'updatedAt': int(time.time() * 1000)
                    }

            logger.info(f"Total de turnos generados: {len(turnos)}")

            # Parsear año y mes
            año_mes = datetime.strptime(mes, '%Y-%m')
            año = año_mes.year
            mes_num = año_mes.month

            # Preparar metadata
            metadata = {
                'empresaId': empresa_id,
                'farmaciaId': farmacia_id,
                'año': año,
                'mes': mes_num,
                'createdAt': int(time.time() * 1000),
                'updatedAt': int(time.time() * 1000)
            }

            # Referencia al calendario
            calendario_ref = db.reference(f'calendarios/{farmacia_id}/{mes}')

            # Guardar datos
            calendario_data = {
                'metadata': metadata,
                'turnos': turnos,
                'metricas': metricas
            }

            calendario_ref.set(calendario_data)

            logger.info(f"Horarios guardados en calendarios/{farmacia_id}/{mes}")
            return mes

        except Exception as e:
            logger.error(f"Error al guardar horarios: {e}")
            raise

    def leer_horarios_existentes(
        self,
        empresa_id: str,
        mes: str,
        farmacia_id: Optional[str] = None
    ) -> Optional[Dict[str, Dict[str, str]]]:
        """
        Leer horarios existentes de un mes

        Args:
            empresa_id: ID de la empresa
            mes: Mes en formato YYYY-MM
            farmacia_id: ID de la farmacia (opcional, se infiere si no se proporciona)

        Returns:
            Horarios existentes o None si no existen
        """
        try:
            # Obtener farmacia_id si no se proporciona
            if not farmacia_id:
                farmacias_ref = db.reference('farmacias')
                farmacias_data = farmacias_ref.get()

                if farmacias_data:
                    for fid, fdata in farmacias_data.items():
                        if fdata.get('empresaId') == empresa_id:
                            farmacia_id = fid
                            break

            if not farmacia_id:
                logger.warning(f"No se encontró farmacia para empresa {empresa_id}")
                return None

            ref = db.reference(f'calendarios/{farmacia_id}/{mes}/turnos')
            turnos = ref.get()

            if turnos:
                logger.info(f"Horarios existentes encontrados para farmacia {farmacia_id}/{mes}")
                # Convertir de formato Firebase a formato del algoritmo
                # De {turnoKey: {empleadoId, fecha, turnoId}} a {empleadoId: {dia: turnoId}}
                horarios = {}
                for turno_data in turnos.values():
                    empleado_id = turno_data.get('empleadoId')
                    fecha = turno_data.get('fecha')
                    turno_id = turno_data.get('turnoId')

                    if empleado_id not in horarios:
                        horarios[empleado_id] = {}
                    horarios[empleado_id][fecha] = turno_id

                return horarios
            else:
                logger.info(f"No se encontraron horarios existentes para farmacia {farmacia_id}/{mes}")
                return None

        except Exception as e:
            logger.error(f"Error al leer horarios existentes: {e}")
            raise

    def actualizar_estado_horario(
        self,
        empresa_id: str,
        mes: str,
        estado: str,
        farmacia_id: Optional[str] = None
    ) -> None:
        """
        Actualizar el estado de un horario

        Args:
            empresa_id: ID de la empresa
            mes: Mes en formato YYYY-MM
            estado: Nuevo estado
            farmacia_id: ID de la farmacia (opcional, se infiere si no se proporciona)
        """
        try:
            # Obtener farmacia_id si no se proporciona
            if not farmacia_id:
                farmacias_ref = db.reference('farmacias')
                farmacias_data = farmacias_ref.get()

                if farmacias_data:
                    for fid, fdata in farmacias_data.items():
                        if fdata.get('empresaId') == empresa_id:
                            farmacia_id = fid
                            break

            if not farmacia_id:
                logger.warning(f"No se encontró farmacia para empresa {empresa_id}")
                return

            ref = db.reference(f'calendarios/{farmacia_id}/{mes}/metadata')
            ref.update({
                'estado': estado,
                'updatedAt': int(__import__('time').time() * 1000)
            })

            logger.info(f"Estado actualizado a '{estado}' para farmacia {farmacia_id}/{mes}")

        except Exception as e:
            logger.error(f"Error al actualizar estado: {e}")
            raise
