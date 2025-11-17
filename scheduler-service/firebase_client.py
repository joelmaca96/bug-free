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
            database_url = os.getenv('FIREBASE_DATABASE_URL')

            if not database_url:
                raise ValueError("FIREBASE_DATABASE_URL no está configurada")

            try:
                # Intentar usar Application Default Credentials (Cloud Run)
                # Si no funciona, usar el archivo de credenciales local
                cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'serviceAccountKey.json')

                # En Cloud Run, usar ADC; en local, usar archivo
                if os.path.exists(cred_path):
                    logger.info(f"Usando credenciales desde archivo: {cred_path}")
                    cred = credentials.Certificate(cred_path)
                else:
                    logger.info("Usando Application Default Credentials (Cloud Run)")
                    cred = credentials.ApplicationDefault()

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

            # Obtener configuraciones de cobertura por franjas horarias
            configuraciones_cobertura = config_farmacia.get('configuracionesCobertura', [])

            # Generar turnos desde configuraciones de cobertura
            turnos = self._generar_turnos_desde_cobertura(configuraciones_cobertura)

            # Generar turnos de guardia desde jornadasGuardia
            jornadas_guardia = config_farmacia.get('jornadasGuardia', [])
            turnos_guardia = self._generar_turnos_guardia(jornadas_guardia)
            turnos.update(turnos_guardia)

            # Construir configuración completa
            config_data = {
                'turnos': turnos,
                'coberturaMinima': {
                    'trabajadoresMinimos': config_farmacia.get('trabajadoresMinimos', 1),
                    'configuracionesCobertura': configuraciones_cobertura
                },
                'restricciones': config_algoritmo_data.get('restricciones', {}),
                'prioridades': config_algoritmo_data.get('prioridades', {}),
                'festivosRegionales': config_farmacia.get('festivosRegionales', []),
                'jornadasGuardia': jornadas_guardia
            }

            logger.info(f"Configuración leída para farmacia {farmacia_id}: {len(turnos)} turnos totales")
            return config_data

        except Exception as e:
            logger.error(f"Error al leer configuración: {e}")
            raise

    def _generar_turnos_desde_cobertura(self, configuraciones_cobertura: list) -> Dict[str, Any]:
        """
        Genera definiciones de turnos desde configuraciones de cobertura.
        Divide turnos largos en múltiples turnos de duración razonable (4-6 horas).

        Args:
            configuraciones_cobertura: Lista de configuraciones de cobertura
                Ejemplo: [{'id': 'x', 'diasSemana': [1,2,3,4,5], 'horaInicio': 9, 'horaFin': 14, 'trabajadoresMinimos': 2}, ...]
                donde diasSemana: 0=Domingo, 1=Lunes, ..., 6=Sábado

        Returns:
            Diccionario de turnos con información completa
        """
        turnos = {}
        turno_counter = 0

        for config in configuraciones_cobertura:
            hora_inicio = config.get('horaInicio', 9)
            hora_fin = config.get('horaFin', 17)
            dias_semana = config.get('diasSemana', [1, 2, 3, 4, 5])

            # Calcular duración en horas
            duracion_horas = hora_fin - hora_inicio

            # Convertir días de semana de formato 0=Domingo a formato ISO (1=Lunes)
            # Python weekday: 0=Lunes, 6=Domingo
            # Nuestra config: 0=Domingo, 1=Lunes, ..., 6=Sábado
            # OR-Tools: 1=Lunes, 7=Domingo (ISO weekday)
            dias_iso = []
            for dia in dias_semana:
                if dia == 0:  # Domingo
                    dias_iso.append(7)
                else:  # Lunes (1) a Sábado (6)
                    dias_iso.append(dia)

            # Determinar nombre de días para el turno
            nombres_dias = self._obtener_nombres_dias(dias_iso)

            # Formatear horas
            hora_inicio_str = f"{hora_inicio:02d}:00"
            hora_fin_str = f"{hora_fin:02d}:00"

            # Si el turno es corto (<=6 horas), crear un solo turno
            if duracion_horas <= 6:
                turno_counter += 1
                turno_id = f"turno_{turno_counter}"
                turnos[turno_id] = {
                    'id': turno_id,
                    'nombre': f"{nombres_dias} {hora_inicio_str}-{hora_fin_str}",
                    'horaInicio': hora_inicio_str,
                    'horaFin': hora_fin_str,
                    'duracionHoras': duracion_horas,
                    'tipo': 'laboral',
                    'diasSemanaValidos': dias_iso
                }
            else:
                # Dividir en turnos más pequeños (mañana/tarde)
                mitad = hora_inicio + (duracion_horas // 2)

                # Turno de mañana
                turno_counter += 1
                turno_id_manana = f"turno_{turno_counter}"
                turnos[turno_id_manana] = {
                    'id': turno_id_manana,
                    'nombre': f"{nombres_dias} Mañana {hora_inicio_str}-{mitad:02d}:00",
                    'horaInicio': hora_inicio_str,
                    'horaFin': f"{mitad:02d}:00",
                    'duracionHoras': mitad - hora_inicio,
                    'tipo': 'laboral',
                    'diasSemanaValidos': dias_iso
                }

                # Turno de tarde
                turno_counter += 1
                turno_id_tarde = f"turno_{turno_counter}"
                turnos[turno_id_tarde] = {
                    'id': turno_id_tarde,
                    'nombre': f"{nombres_dias} Tarde {mitad:02d}:00-{hora_fin_str}",
                    'horaInicio': f"{mitad:02d}:00",
                    'horaFin': hora_fin_str,
                    'duracionHoras': hora_fin - mitad,
                    'tipo': 'laboral',
                    'diasSemanaValidos': dias_iso
                }

        logger.info(f"Generados {len(turnos)} turnos desde configuraciones de cobertura")
        return turnos

    def _generar_turnos_desde_horarios(self, horarios_habituales: list) -> Dict[str, Any]:
        """
        DEPRECADO: Usa _generar_turnos_desde_cobertura en su lugar.
        Genera definiciones de turnos desde los horarios habituales.
        Divide turnos largos en múltiples turnos de duración razonable (4-6 horas).

        Args:
            horarios_habituales: Lista de horarios habituales por día
                Ejemplo: [{'dia': 1, 'inicio': '09:00', 'fin': '22:00'}, ...]
                donde dia: 1=Lunes, 6=Sábado, 7=Domingo

        Returns:
            Diccionario de turnos con información completa
        """
        turnos = {}
        turno_counter = 0

        # Agrupar horarios por mismo patrón de horas (para reutilizar turnos)
        horarios_por_patron = {}
        for horario in horarios_habituales:
            hora_inicio = horario.get('inicio', '09:00')
            hora_fin = horario.get('fin', '17:00')
            dia_semana = horario.get('dia', 1)

            patron = (hora_inicio, hora_fin)
            if patron not in horarios_por_patron:
                horarios_por_patron[patron] = []
            horarios_por_patron[patron].append(dia_semana)

        # Generar turnos para cada patrón horario
        for (hora_inicio, hora_fin), dias_semana in horarios_por_patron.items():
            try:
                h_inicio = int(hora_inicio.split(':')[0])
                m_inicio = int(hora_inicio.split(':')[1])
                h_fin = int(hora_fin.split(':')[0])
                m_fin = int(hora_fin.split(':')[1])

                duracion_minutos = (h_fin * 60 + m_fin) - (h_inicio * 60 + m_inicio)
                duracion_horas = duracion_minutos / 60
            except:
                logger.warning(f"Error parseando horario {hora_inicio}-{hora_fin}, usando valores por defecto")
                h_inicio, m_inicio = 9, 0
                h_fin, m_fin = 17, 0
                duracion_horas = 8

            # Determinar nombre de días para el turno
            nombres_dias = self._obtener_nombres_dias(dias_semana)

            # Si el turno es corto (<=6 horas), crear un solo turno
            if duracion_horas <= 6:
                turno_counter += 1
                turno_id = f"turno_{turno_counter}"
                turnos[turno_id] = {
                    'id': turno_id,
                    'nombre': f"{nombres_dias} {hora_inicio}-{hora_fin}",
                    'horaInicio': hora_inicio,
                    'horaFin': hora_fin,
                    'duracionHoras': duracion_horas,
                    'tipo': 'laboral',
                    'diasSemanaValidos': dias_semana
                }
            else:
                # Turno largo: dividir en múltiples turnos de 4-6 horas
                turnos_divididos = self._dividir_turno_largo(
                    hora_inicio, hora_fin, dias_semana, nombres_dias
                )
                for turno_div in turnos_divididos:
                    turno_counter += 1
                    turno_id = f"turno_{turno_counter}"
                    turno_div['id'] = turno_id
                    turnos[turno_id] = turno_div

        logger.info(f"Generados {len(turnos)} turnos desde horarios habituales")
        return turnos

    def _dividir_turno_largo(
        self,
        hora_inicio: str,
        hora_fin: str,
        dias_semana: list,
        nombres_dias: str
    ) -> list:
        """
        Divide un turno largo en múltiples turnos de 4-6 horas

        Args:
            hora_inicio: Hora de inicio (HH:MM)
            hora_fin: Hora de fin (HH:MM)
            dias_semana: Lista de días de la semana válidos
            nombres_dias: Nombre descriptivo de los días

        Returns:
            Lista de definiciones de turnos
        """
        h_inicio = int(hora_inicio.split(':')[0])
        m_inicio = int(hora_inicio.split(':')[1])
        h_fin = int(hora_fin.split(':')[0])
        m_fin = int(hora_fin.split(':')[1])

        duracion_total_minutos = (h_fin * 60 + m_fin) - (h_inicio * 60 + m_inicio)

        # Calcular número de turnos (intentar turnos de ~6 horas)
        duracion_objetivo_horas = 6
        num_turnos = max(2, int(duracion_total_minutos / (duracion_objetivo_horas * 60) + 0.5))
        duracion_por_turno = duracion_total_minutos / num_turnos

        turnos = []
        minutos_actual = h_inicio * 60 + m_inicio

        etiquetas = ['Mañana', 'Tarde', 'Noche']

        for i in range(num_turnos):
            inicio_h = minutos_actual // 60
            inicio_m = minutos_actual % 60

            minutos_fin = int(minutos_actual + duracion_por_turno)
            fin_h = minutos_fin // 60
            fin_m = minutos_fin % 60

            inicio_str = f"{inicio_h:02d}:{inicio_m:02d}"
            fin_str = f"{fin_h:02d}:{fin_m:02d}"

            etiqueta = etiquetas[i] if i < len(etiquetas) else f"Turno {i+1}"

            turnos.append({
                'nombre': f"{nombres_dias} {etiqueta} {inicio_str}-{fin_str}",
                'horaInicio': inicio_str,
                'horaFin': fin_str,
                'duracionHoras': duracion_por_turno / 60,
                'tipo': 'laboral',
                'diasSemanaValidos': dias_semana
            })

            minutos_actual = minutos_fin

        return turnos

    def _obtener_nombres_dias(self, dias_semana: list) -> str:
        """
        Obtiene un nombre descriptivo para los días de la semana

        Args:
            dias_semana: Lista de números de día (1=Lunes, 7=Domingo)

        Returns:
            Nombre descriptivo (ej: "L-V", "Sábado", "L-D")
        """
        if not dias_semana:
            return "Todos"

        dias_semana_sorted = sorted(dias_semana)

        # Casos especiales comunes
        if dias_semana_sorted == [1, 2, 3, 4, 5]:
            return "L-V"
        elif dias_semana_sorted == [6]:
            return "Sábado"
        elif dias_semana_sorted == [7]:
            return "Domingo"
        elif dias_semana_sorted == [6, 7]:
            return "Fin de semana"
        elif len(dias_semana_sorted) == 7:
            return "L-D"
        else:
            # Nombres cortos de días
            nombres = {1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D'}
            return ','.join(nombres.get(d, str(d)) for d in dias_semana_sorted)

    def _generar_turnos_guardia(self, jornadas_guardia: list) -> Dict[str, Any]:
        """
        Genera turnos de guardia para fechas específicas

        Args:
            jornadas_guardia: Lista de jornadas de guardia
                Ejemplo: [{'fechaInicio': '2025-11-16', 'fechaFin': '2025-11-16',
                          'horaInicio': '09:00', 'horaFin': '22:00'}, ...]

        Returns:
            Diccionario de turnos de guardia
        """
        from datetime import datetime, timedelta

        turnos_guardia = {}
        turno_guardia_counter = 0

        for jornada in jornadas_guardia:
            # Soportar ambos formatos: 'fecha' (viejo) o 'fechaInicio' (nuevo)
            fecha_inicio = jornada.get('fechaInicio') or jornada.get('fecha')
            fecha_fin = jornada.get('fechaFin', fecha_inicio)
            hora_inicio = jornada.get('horaInicio', '09:00')
            hora_fin = jornada.get('horaFin', '22:00')

            if not fecha_inicio:
                logger.warning(f"Jornada de guardia sin fecha, omitiendo: {jornada}")
                continue

            try:
                # Calcular duración
                h_inicio = int(hora_inicio.split(':')[0])
                m_inicio = int(hora_inicio.split(':')[1])
                h_fin = int(hora_fin.split(':')[0])
                m_fin = int(hora_fin.split(':')[1])

                duracion_minutos = (h_fin * 60 + m_fin) - (h_inicio * 60 + m_inicio)
                duracion_horas = duracion_minutos / 60

                # Generar turnos para cada día del rango de fechas
                fecha_actual = datetime.strptime(fecha_inicio, '%Y-%m-%d')
                fecha_final = datetime.strptime(fecha_fin, '%Y-%m-%d')

                while fecha_actual <= fecha_final:
                    fecha_str = fecha_actual.strftime('%Y-%m-%d')
                    dia_semana = fecha_actual.isoweekday()  # 1=Lunes, 7=Domingo

                    # Si el turno de guardia es largo, dividirlo
                    if duracion_horas <= 6:
                        turno_guardia_counter += 1
                        turno_id = f"guardia_{turno_guardia_counter}"
                        turnos_guardia[turno_id] = {
                            'id': turno_id,
                            'nombre': f"Guardia {fecha_str} {hora_inicio}-{hora_fin}",
                            'horaInicio': hora_inicio,
                            'horaFin': hora_fin,
                            'duracionHoras': duracion_horas,
                            'tipo': 'guardia',
                            'diasSemanaValidos': [dia_semana],
                            'fechaEspecifica': fecha_str  # Campo especial para guardias
                        }
                    else:
                        # Dividir turno de guardia largo
                        turnos_divididos = self._dividir_turno_largo(
                            hora_inicio, hora_fin, [dia_semana], f"Guardia {fecha_str}"
                        )
                        for turno_div in turnos_divididos:
                            turno_guardia_counter += 1
                            turno_id = f"guardia_{turno_guardia_counter}"
                            turno_div['id'] = turno_id
                            turno_div['tipo'] = 'guardia'
                            turno_div['fechaEspecifica'] = fecha_str
                            turnos_guardia[turno_id] = turno_div

                    # Avanzar al siguiente día
                    fecha_actual += timedelta(days=1)

            except Exception as e:
                logger.warning(f"Error procesando jornada de guardia {jornada}: {e}")
                continue

        logger.info(f"Generados {len(turnos_guardia)} turnos de guardia")
        return turnos_guardia

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
