"""
Cliente de Firebase Realtime Database para interactuar con los datos
"""
import os
import logging
from typing import Dict, Any, Optional, List
import firebase_admin
from firebase_admin import credentials, db
from models import Empleado, ConfiguracionTurnos, Turno, TipoTurno, TurnoAsignado, EstadoTurno

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
            # En Firestore la estructura es usuarios/, pero podemos adaptarla
            # Para Realtime Database, asumimos: /empresas/{empresaId}/empleados/
            ref = db.reference(f'empresas/{empresa_id}/empleados')
            empleados_data = ref.get()

            if not empleados_data:
                logger.warning(f"No se encontraron empleados para empresa {empresa_id}")
                return []

            empleados = []
            for emp_id, emp_data in empleados_data.items():
                # Filtrar por IDs específicos si se proporcionan
                if empleados_ids and emp_id not in empleados_ids:
                    continue

                empleado = Empleado(
                    uid=emp_id,
                    nombre=emp_data.get('nombre', ''),
                    email=emp_data.get('email', ''),
                    horas_maximas_diarias=emp_data.get('horasMaximasDiarias', 8),
                    horas_maximas_semanales=emp_data.get('horasMaxSemanales', 40),
                    horas_maximas_mensuales=emp_data.get('horasMaximasMensuales', 160),
                    festivos_personales=emp_data.get('festivos', []),
                    turnos_favoritos=emp_data.get('preferencias', {}).get('turnosFavoritos', []),
                    dias_libres_preferidos=emp_data.get('preferencias', {}).get('diasLibresPreferidos', [])
                )
                empleados.append(empleado)

            logger.info(f"Leídos {len(empleados)} empleados para empresa {empresa_id}")
            return empleados

        except Exception as e:
            logger.error(f"Error al leer empleados: {e}")
            raise

    def leer_configuracion(self, empresa_id: str) -> Dict[str, Any]:
        """
        Leer configuración de turnos de una empresa

        Args:
            empresa_id: ID de la empresa

        Returns:
            Configuración de turnos
        """
        try:
            ref = db.reference(f'empresas/{empresa_id}/configuracion')
            config_data = ref.get()

            if not config_data:
                logger.warning(f"No se encontró configuración para empresa {empresa_id}")
                return {}

            logger.info(f"Configuración leída para empresa {empresa_id}")
            return config_data

        except Exception as e:
            logger.error(f"Error al leer configuración: {e}")
            raise

    def guardar_horarios(
        self,
        empresa_id: str,
        mes: str,
        horarios: Dict[str, Dict[str, str]],
        metricas: Dict[str, Any]
    ) -> str:
        """
        Guardar horarios generados en Firebase

        Args:
            empresa_id: ID de la empresa
            mes: Mes en formato YYYY-MM
            horarios: Horarios asignados {empleadoId -> {dia -> turnoId}}
            metricas: Métricas de la generación

        Returns:
            ID del horario guardado
        """
        try:
            import time

            # Referencia al horario del mes
            ref = db.reference(f'empresas/{empresa_id}/horarios/{mes}')

            # Preparar datos
            horario_data = {
                'generado': int(time.time() * 1000),  # Timestamp en milisegundos
                'estado': 'generado',
                'horarios': horarios,
                'metricas': metricas
            }

            # Guardar
            ref.set(horario_data)

            logger.info(f"Horarios guardados para empresa {empresa_id}, mes {mes}")
            return mes

        except Exception as e:
            logger.error(f"Error al guardar horarios: {e}")
            raise

    def leer_horarios_existentes(
        self,
        empresa_id: str,
        mes: str
    ) -> Optional[Dict[str, Dict[str, str]]]:
        """
        Leer horarios existentes de un mes

        Args:
            empresa_id: ID de la empresa
            mes: Mes en formato YYYY-MM

        Returns:
            Horarios existentes o None si no existen
        """
        try:
            ref = db.reference(f'empresas/{empresa_id}/horarios/{mes}/horarios')
            horarios = ref.get()

            if horarios:
                logger.info(f"Horarios existentes encontrados para {empresa_id}/{mes}")
            else:
                logger.info(f"No se encontraron horarios existentes para {empresa_id}/{mes}")

            return horarios

        except Exception as e:
            logger.error(f"Error al leer horarios existentes: {e}")
            raise

    def actualizar_estado_horario(
        self,
        empresa_id: str,
        mes: str,
        estado: str
    ) -> None:
        """
        Actualizar el estado de un horario

        Args:
            empresa_id: ID de la empresa
            mes: Mes en formato YYYY-MM
            estado: Nuevo estado
        """
        try:
            ref = db.reference(f'empresas/{empresa_id}/horarios/{mes}')
            ref.update({'estado': estado})

            logger.info(f"Estado actualizado a '{estado}' para {empresa_id}/{mes}")

        except Exception as e:
            logger.error(f"Error al actualizar estado: {e}")
            raise
