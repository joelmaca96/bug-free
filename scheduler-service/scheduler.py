"""
Algoritmo de generación de horarios usando Google OR-Tools CP-SAT Solver
"""
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from ortools.sat.python import cp_model
from models import (
    Empleado,
    ConfiguracionTurnos,
    ConfiguracionAlgoritmo,
    ResultadoGeneracion,
    Metricas,
    TipoTurno,
    TurnoAsignado,
    EstadoTurno
)

logger = logging.getLogger(__name__)


class SchedulerORTools:
    """
    Generador de horarios usando Google OR-Tools CP-SAT Solver
    """

    def __init__(
        self,
        empleados: List[Empleado],
        configuracion_turnos: ConfiguracionTurnos,
        configuracion_algoritmo: ConfiguracionAlgoritmo,
        mes: str
    ):
        """
        Inicializar el generador de horarios

        Args:
            empleados: Lista de empleados disponibles
            configuracion_turnos: Configuración de turnos y cobertura
            configuracion_algoritmo: Configuración y restricciones del algoritmo
            mes: Mes a generar en formato YYYY-MM
        """
        self.empleados = empleados
        self.config_turnos = configuracion_turnos
        self.config_algo = configuracion_algoritmo
        self.mes = mes

        # Calcular días del mes
        self.dias = self._calcular_dias_mes(mes)
        self.num_dias = len(self.dias)
        self.num_empleados = len(empleados)

        # Mapeos para acceso rápido
        self.empleado_idx = {emp.uid: i for i, emp in enumerate(empleados)}
        self.turno_info = {tid: turno for tid, turno in configuracion_turnos.turnos.items()}

        # Modelo CP-SAT
        self.model = cp_model.CpModel()
        self.shifts = {}  # Variables de decisión: (empleado_idx, dia, turno_id)

        logger.info(
            f"Inicializado generador para {mes}: "
            f"{self.num_empleados} empleados, {self.num_dias} días"
        )

    def _calcular_dias_mes(self, mes: str) -> List[str]:
        """
        Calcular todos los días del mes

        Args:
            mes: Mes en formato YYYY-MM

        Returns:
            Lista de fechas en formato YYYY-MM-DD
        """
        year, month = map(int, mes.split('-'))
        start_date = datetime(year, month, 1)

        # Calcular último día del mes
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)

        dias = []
        current_date = start_date
        while current_date <= end_date:
            dias.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(days=1)

        return dias

    def generar_horarios(
        self,
        ajustes_fijos: Optional[Dict[str, Dict[str, str]]] = None,
        timeout_segundos: int = 60
    ) -> ResultadoGeneracion:
        """
        Generar horarios optimizados

        Args:
            ajustes_fijos: Turnos fijos del usuario {empleadoId -> {dia -> turnoId}}
            timeout_segundos: Tiempo máximo de ejecución del solver

        Returns:
            Resultado de la generación
        """
        tiempo_inicio = time.time()

        try:
            logger.info("Iniciando generación de horarios...")

            # Paso 1: Crear variables de decisión
            self._crear_variables()

            # Paso 2: Aplicar restricciones duras
            self._aplicar_restricciones_cobertura()
            self._aplicar_restricciones_horas_maximas()
            self._aplicar_restricciones_descanso()
            self._aplicar_restricciones_festivos_personales()
            self._aplicar_restriccion_un_turno_por_dia()

            # Paso 3: Aplicar ajustes fijos si existen
            if ajustes_fijos:
                self._aplicar_ajustes_fijos(ajustes_fijos)

            # Paso 4: Definir función objetivo (restricciones blandas)
            self._definir_funcion_objetivo()

            # Paso 5: Resolver
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = timeout_segundos
            solver.parameters.log_search_progress = False

            logger.info("Resolviendo modelo CP-SAT...")
            status = solver.Solve(self.model)

            tiempo_ejecucion = time.time() - tiempo_inicio

            # Paso 6: Procesar resultado
            if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
                logger.info(
                    f"Solución encontrada: {solver.StatusName(status)} "
                    f"(score: {solver.ObjectiveValue()})"
                )
                return self._construir_resultado(solver, status, tiempo_ejecucion)
            else:
                logger.warning(f"No se encontró solución: {solver.StatusName(status)}")
                return self._construir_resultado_infactible(status, tiempo_ejecucion)

        except Exception as e:
            logger.error(f"Error generando horarios: {e}", exc_info=True)
            raise

    def _crear_variables(self):
        """
        Crear variables de decisión para el modelo

        Variables: shifts[(e, d, t)] = 1 si empleado e trabaja turno t en día d
        Solo se crean variables para combinaciones válidas (día-turno)
        """
        logger.info("Creando variables de decisión...")

        for emp_idx, empleado in enumerate(self.empleados):
            for dia in self.dias:
                for turno_id, turno in self.turno_info.items():
                    # Solo crear variable si el turno es válido para este día
                    if turno.es_valido_para_dia(dia):
                        var_name = f'shift_e{emp_idx}_d{dia}_t{turno_id}'
                        self.shifts[(emp_idx, dia, turno_id)] = self.model.NewBoolVar(var_name)

        logger.info(f"Creadas {len(self.shifts)} variables de decisión")

    def _obtener_trabajadores_necesarios(self, fecha_str: str, turno: 'Turno') -> int:
        """
        Obtener el número de trabajadores necesarios para una fecha y turno específicos
        basándose en las configuraciones de cobertura por franjas horarias

        Args:
            fecha_str: Fecha en formato YYYY-MM-DD
            turno: Objeto Turno

        Returns:
            Número de trabajadores necesarios para este turno
        """
        configuraciones = self.config_turnos.configuraciones_cobertura

        # Si no hay configuraciones específicas, usar el valor global
        if not configuraciones:
            return self.config_turnos.cobertura_minima.get('trabajadoresMinimos', 1)

        # Obtener el día de la semana (0=Lunes, 6=Domingo en Python; convertir a 0=Domingo)
        fecha_obj = datetime.strptime(fecha_str, '%Y-%m-%d')
        dia_semana_python = fecha_obj.weekday()  # 0=Lunes, 6=Domingo
        dia_semana = (dia_semana_python + 1) % 7  # Convertir a 0=Domingo, 1=Lunes, ..., 6=Sábado

        # Obtener la hora de inicio del turno
        hora_inicio = int(turno.hora_inicio.split(':')[0])

        # Buscar configuración que aplique a este día/hora
        for config in configuraciones:
            dia_aplica = dia_semana in config.dias_semana
            hora_aplica = hora_inicio >= config.hora_inicio and hora_inicio < config.hora_fin

            if dia_aplica and hora_aplica:
                return config.trabajadores_minimos

        # Si no se encuentra configuración específica, usar valor global
        return self.config_turnos.cobertura_minima.get('trabajadoresMinimos', 1)

    def _aplicar_restricciones_cobertura(self):
        """
        RESTRICCIÓN DURA: Cobertura exacta por turno cada día
        Cada turno válido debe tener exactamente trabajadoresMinimos empleados asignados
        (puede variar según franja horaria si hay configuraciones de cobertura)
        """
        logger.info("Aplicando restricciones de cobertura...")

        for dia in self.dias:
            # Obtener turnos válidos para este día
            turnos_validos_dia = [
                turno_id for turno_id, turno in self.turno_info.items()
                if turno.es_valido_para_dia(dia)
            ]

            for turno_id in turnos_validos_dia:
                turno = self.turno_info[turno_id]

                # Obtener trabajadores necesarios para este turno específico
                trabajadores_necesarios = self._obtener_trabajadores_necesarios(dia, turno)

                # Recopilar variables que existen para este turno y día
                empleados_asignados = []
                for emp_idx in range(self.num_empleados):
                    if (emp_idx, dia, turno_id) in self.shifts:
                        empleados_asignados.append(self.shifts[(emp_idx, dia, turno_id)])

                if empleados_asignados:
                    # Restricción: exactamente trabajadoresNecesarios empleados
                    self.model.Add(sum(empleados_asignados) == trabajadores_necesarios)
                    logger.debug(f"Día {dia}, Turno {turno_id}: {trabajadores_necesarios} trabajadores requeridos")

    def _aplicar_restriccion_un_turno_por_dia(self):
        """
        RESTRICCIÓN DURA: Un empleado no puede trabajar turnos que se solapen
        Permite múltiples turnos consecutivos (ej: Mañana + Tarde) pero no solapados
        """
        logger.info("Aplicando restricción de no solapamiento de turnos...")

        for emp_idx in range(self.num_empleados):
            for dia in self.dias:
                # Obtener turnos asignables este día para este empleado
                turnos_dia = []
                for turno_id, turno in self.turno_info.items():
                    if (emp_idx, dia, turno_id) in self.shifts:
                        turnos_dia.append((turno_id, turno))

                # Para cada par de turnos que se solapan, solo uno puede estar activo
                for i, (turno_id1, turno1) in enumerate(turnos_dia):
                    for turno_id2, turno2 in turnos_dia[i+1:]:
                        if turno1.se_solapa_con(turno2):
                            # No pueden estar ambos asignados
                            self.model.Add(
                                self.shifts[(emp_idx, dia, turno_id1)] +
                                self.shifts[(emp_idx, dia, turno_id2)] <= 1
                            )

    def _aplicar_restricciones_horas_maximas(self):
        """
        RESTRICCIÓN DURA: Respetar límites de horas diarias, semanales y mensuales
        """
        logger.info("Aplicando restricciones de horas máximas...")

        for emp_idx, empleado in enumerate(self.empleados):
            # Restricción de horas diarias
            for dia in self.dias:
                horas_dia = []
                for turno_id, turno in self.turno_info.items():
                    if (emp_idx, dia, turno_id) in self.shifts:
                        horas_dia.append(
                            self.shifts[(emp_idx, dia, turno_id)] * int(turno.duracion_horas)
                        )

                if horas_dia:
                    self.model.Add(
                        sum(horas_dia) <= int(empleado.horas_maximas_diarias)
                    )

            # Restricción de horas semanales
            # Dividir el mes en semanas (lunes a domingo)
            semanas = self._agrupar_por_semanas(self.dias)
            for semana in semanas:
                horas_semana = []
                for dia in semana:
                    for turno_id, turno in self.turno_info.items():
                        if (emp_idx, dia, turno_id) in self.shifts:
                            horas_semana.append(
                                self.shifts[(emp_idx, dia, turno_id)] * int(turno.duracion_horas)
                            )

                if horas_semana:
                    self.model.Add(
                        sum(horas_semana) <= int(empleado.horas_maximas_semanales)
                    )

            # Restricción de horas mensuales
            horas_mes = []
            for dia in self.dias:
                for turno_id, turno in self.turno_info.items():
                    if (emp_idx, dia, turno_id) in self.shifts:
                        horas_mes.append(
                            self.shifts[(emp_idx, dia, turno_id)] * int(turno.duracion_horas)
                        )

            if horas_mes:
                self.model.Add(
                    sum(horas_mes) <= int(empleado.horas_maximas_mensuales)
                )

    def _aplicar_restricciones_descanso(self):
        """
        RESTRICCIÓN DURA: Descanso mínimo entre turnos y días de descanso semanales
        """
        logger.info("Aplicando restricciones de descanso...")

        restricciones = self.config_algo.restricciones

        # Descanso mínimo entre turnos (simplificado: no trabajar días consecutivos si se requiere)
        # Nota: OR-Tools no maneja bien horas continuas entre días,
        # simplificamos a: al menos N días de descanso por semana

        for emp_idx in range(self.num_empleados):
            semanas = self._agrupar_por_semanas(self.dias)

            for semana in semanas:
                # Contar días trabajados en la semana
                dias_trabajados = []
                for dia in semana:
                    # Un día está trabajado si tiene algún turno asignado
                    turnos_dia = [
                        self.shifts[(emp_idx, dia, turno_id)]
                        for turno_id in self.turno_info.keys()
                        if (emp_idx, dia, turno_id) in self.shifts
                    ]

                    if turnos_dia:
                        # Crear variable booleana: día_trabajado = 1 si sum(turnos) >= 1
                        dia_trabajado = self.model.NewBoolVar(f'trabajado_e{emp_idx}_d{dia}')
                        self.model.Add(sum(turnos_dia) >= 1).OnlyEnforceIf(dia_trabajado)
                        self.model.Add(sum(turnos_dia) == 0).OnlyEnforceIf(dia_trabajado.Not())
                        dias_trabajados.append(dia_trabajado)

                # Máximo de días trabajados = días de la semana - días de descanso requeridos
                if dias_trabajados:
                    max_dias_trabajados = len(semana) - restricciones.dias_descanso_semana
                    if max_dias_trabajados > 0:
                        self.model.Add(sum(dias_trabajados) <= max_dias_trabajados)

    def _aplicar_restricciones_festivos_personales(self):
        """
        RESTRICCIÓN DURA: No asignar empleados en sus festivos personales
        """
        logger.info("Aplicando restricciones de festivos personales...")

        for emp_idx, empleado in enumerate(self.empleados):
            for festivo in empleado.festivos_personales:
                if festivo in self.dias:
                    # No trabajar en festivo personal
                    for turno_id in self.turno_info.keys():
                        if (emp_idx, festivo, turno_id) in self.shifts:
                            self.model.Add(self.shifts[(emp_idx, festivo, turno_id)] == 0)

    def _aplicar_ajustes_fijos(self, ajustes_fijos: Dict[str, Dict[str, str]]):
        """
        Fijar turnos específicos según ajustes del usuario

        Args:
            ajustes_fijos: {empleadoId -> {dia -> turnoId}}
        """
        logger.info("Aplicando ajustes fijos del usuario...")

        for empleado_id, turnos_fijos in ajustes_fijos.items():
            if empleado_id not in self.empleado_idx:
                continue

            emp_idx = self.empleado_idx[empleado_id]

            for dia, turno_id in turnos_fijos.items():
                if dia not in self.dias or turno_id not in self.turno_info:
                    continue

                # Verificar que la variable existe
                if (emp_idx, dia, turno_id) not in self.shifts:
                    logger.warning(f"No se puede fijar turno {turno_id} para {empleado_id} en {dia}: turno no válido para ese día")
                    continue

                # Fijar este turno
                self.model.Add(self.shifts[(emp_idx, dia, turno_id)] == 1)

                # Asegurar que no tiene otros turnos ese día que se solapen
                turno_fijo = self.turno_info[turno_id]
                for otro_turno_id, otro_turno in self.turno_info.items():
                    if otro_turno_id != turno_id and (emp_idx, dia, otro_turno_id) in self.shifts:
                        if turno_fijo.se_solapa_con(otro_turno):
                            self.model.Add(self.shifts[(emp_idx, dia, otro_turno_id)] == 0)

    def _definir_funcion_objetivo(self):
        """
        Definir la función objetivo para optimizar (restricciones blandas)

        Objetivos:
        1. Distribución equitativa de guardias
        2. Distribución equitativa de fines de semana
        3. Minimizar cambios bruscos de horario
        4. Balancear horas totales entre empleados
        5. Maximizar preferencias de empleados
        """
        logger.info("Definiendo función objetivo...")

        pesos = self.config_algo.pesos_optimizacion
        terminos_objetivo = []

        # Pesos por defecto
        peso_equidad_guardias = pesos.get('equidad_guardias', 10)
        peso_equidad_horas = pesos.get('equidad_horas', 8)
        peso_preferencias = pesos.get('preferencias', 5)
        peso_continuidad = pesos.get('continuidad', 3)

        # 1. Distribución equitativa de guardias
        # Minimizar la diferencia entre el empleado con más guardias y el que tiene menos
        guardias_por_empleado = []
        for emp_idx in range(self.num_empleados):
            guardias = []
            for dia in self.dias:
                for turno_id, turno in self.turno_info.items():
                    if turno.tipo == TipoTurno.GUARDIA and (emp_idx, dia, turno_id) in self.shifts:
                        guardias.append(self.shifts[(emp_idx, dia, turno_id)])

            if guardias:
                # Variable auxiliar para contar guardias de este empleado
                num_guardias = self.model.NewIntVar(0, len(self.dias), f'guardias_e{emp_idx}')
                self.model.Add(num_guardias == sum(guardias))
                guardias_por_empleado.append(num_guardias)

        if guardias_por_empleado:
            # Variables para max y min
            max_guardias = self.model.NewIntVar(0, len(self.dias), 'max_guardias')
            min_guardias = self.model.NewIntVar(0, len(self.dias), 'min_guardias')

            self.model.AddMaxEquality(max_guardias, guardias_por_empleado)
            self.model.AddMinEquality(min_guardias, guardias_por_empleado)

            # Penalizar la diferencia
            diff_guardias = self.model.NewIntVar(0, len(self.dias), 'diff_guardias')
            self.model.Add(diff_guardias == max_guardias - min_guardias)

            terminos_objetivo.append(-int(peso_equidad_guardias) * diff_guardias)

        # 2. Distribución equitativa de horas totales
        horas_por_empleado = []
        for emp_idx in range(self.num_empleados):
            horas = []
            for dia in self.dias:
                for turno_id, turno in self.turno_info.items():
                    if (emp_idx, dia, turno_id) in self.shifts:
                        horas.append(
                            self.shifts[(emp_idx, dia, turno_id)] * int(turno.duracion_horas)
                        )

            if horas:
                num_horas = self.model.NewIntVar(0, 1000, f'horas_e{emp_idx}')
                self.model.Add(num_horas == sum(horas))
                horas_por_empleado.append(num_horas)

        if horas_por_empleado:
            max_horas = self.model.NewIntVar(0, 1000, 'max_horas')
            min_horas = self.model.NewIntVar(0, 1000, 'min_horas')

            self.model.AddMaxEquality(max_horas, horas_por_empleado)
            self.model.AddMinEquality(min_horas, horas_por_empleado)

            diff_horas = self.model.NewIntVar(0, 1000, 'diff_horas')
            self.model.Add(diff_horas == max_horas - min_horas)

            terminos_objetivo.append(-int(peso_equidad_horas) * diff_horas)

        # 3. Maximizar cobertura de turnos (término básico fundamental)
        # Incentiva asignar turnos para cubrir las necesidades
        # NOTA: Ya no es necesario porque la restricción de cobertura es EXACTA (==)
        # El solver automáticamente asignará exactamente trabajadoresMinimos empleados

        # 4. Maximizar cumplimiento de preferencias
        # (bonificar turnos favoritos y días libres preferidos)
        for emp_idx, empleado in enumerate(self.empleados):
            if empleado.turnos_favoritos:
                for dia in self.dias:
                    for turno_id in empleado.turnos_favoritos:
                        if turno_id in self.turno_info and (emp_idx, dia, turno_id) in self.shifts:
                            terminos_objetivo.append(
                                int(peso_preferencias) * self.shifts[(emp_idx, dia, turno_id)]
                            )

        # Objetivo: MAXIMIZAR la suma de términos
        if terminos_objetivo:
            self.model.Maximize(sum(terminos_objetivo))
            logger.info(f"Función objetivo definida con {len(terminos_objetivo)} términos")
        else:
            logger.warning("No se pudieron definir términos de optimización")

    def _agrupar_por_semanas(self, dias: List[str]) -> List[List[str]]:
        """
        Agrupar días por semanas (lunes a domingo)

        Args:
            dias: Lista de fechas en formato YYYY-MM-DD

        Returns:
            Lista de semanas, cada una con sus días
        """
        semanas = []
        semana_actual = []

        for dia in dias:
            fecha = datetime.strptime(dia, '%Y-%m-%d')
            dia_semana = fecha.weekday()  # 0 = lunes, 6 = domingo

            semana_actual.append(dia)

            # Si es domingo o último día, cerrar semana
            if dia_semana == 6 or dia == dias[-1]:
                semanas.append(semana_actual)
                semana_actual = []

        return semanas

    def _construir_resultado(
        self,
        solver: cp_model.CpSolver,
        status: int,
        tiempo_ejecucion: float
    ) -> ResultadoGeneracion:
        """
        Construir el resultado de la generación a partir de la solución

        Args:
            solver: Solver con la solución
            status: Estado del solver
            tiempo_ejecucion: Tiempo de ejecución

        Returns:
            Resultado de la generación
        """
        logger.info("Construyendo resultado...")

        # Extraer asignaciones
        horarios = defaultdict(dict)
        horas_por_empleado = defaultdict(float)
        guardias_por_empleado = defaultdict(int)
        festivos_por_empleado = defaultdict(int)

        for (emp_idx, dia, turno_id), var in self.shifts.items():
            if solver.Value(var) == 1:
                empleado = self.empleados[emp_idx]
                turno = self.turno_info[turno_id]

                horarios[empleado.uid][dia] = turno_id

                # Actualizar métricas
                horas_por_empleado[empleado.uid] += turno.duracion_horas

                if turno.tipo == TipoTurno.GUARDIA:
                    guardias_por_empleado[empleado.uid] += 1
                elif turno.tipo == TipoTurno.FESTIVO:
                    festivos_por_empleado[empleado.uid] += 1

        # Calcular equidad (desviación estándar normalizada)
        if horas_por_empleado:
            horas_values = list(horas_por_empleado.values())
            promedio = sum(horas_values) / len(horas_values)
            varianza = sum((h - promedio) ** 2 for h in horas_values) / len(horas_values)
            desviacion = varianza ** 0.5

            # Normalizar: 1 - (desviación / promedio) si promedio > 0
            equidad = 1.0 - (desviacion / promedio) if promedio > 0 else 1.0
            equidad = max(0.0, min(1.0, equidad))
        else:
            equidad = 1.0

        # Construir métricas
        metricas = Metricas(
            horas_por_empleado=dict(horas_por_empleado),
            guardias_por_empleado=dict(guardias_por_empleado),
            festivos_por_empleado=dict(festivos_por_empleado),
            distribucion_equitativa=equidad,
            restricciones_violadas=0,  # El solver garantiza 0 violaciones
            tiempo_ejecucion_segundos=tiempo_ejecucion,
            estado_solver=solver.StatusName(status)
        )

        resultado = ResultadoGeneracion(
            horarios=dict(horarios),
            metricas=metricas,
            estado='success',
            mensaje=f'Horarios generados exitosamente ({solver.StatusName(status)})'
        )

        logger.info(
            f"Resultado construido: {len(horarios)} empleados, "
            f"equidad={equidad:.2f}, tiempo={tiempo_ejecucion:.2f}s"
        )

        return resultado

    def _construir_resultado_infactible(
        self,
        status: int,
        tiempo_ejecucion: float
    ) -> ResultadoGeneracion:
        """
        Construir resultado cuando no hay solución factible

        Args:
            status: Estado del solver
            tiempo_ejecucion: Tiempo de ejecución

        Returns:
            Resultado indicando infactibilidad
        """
        metricas = Metricas(
            horas_por_empleado={},
            guardias_por_empleado={},
            festivos_por_empleado={},
            distribucion_equitativa=0.0,
            restricciones_violadas=-1,
            tiempo_ejecucion_segundos=tiempo_ejecucion,
            estado_solver=cp_model.CpSolver().StatusName(status)
        )

        sugerencias = [
            "Aumentar el número de empleados disponibles",
            "Reducir la cobertura mínima requerida por turno",
            "Aumentar las horas máximas permitidas (habilitar horas extra)",
            "Revisar festivos personales que puedan estar bloqueando asignaciones",
            "Reducir los días de descanso obligatorios por semana"
        ]

        return ResultadoGeneracion(
            horarios={},
            metricas=metricas,
            estado='infeasible',
            mensaje='No se pudo generar un horario que cumpla todas las restricciones',
            sugerencias=sugerencias
        )


def validar_configuracion(
    empleados: List[Empleado],
    configuracion_turnos: ConfiguracionTurnos,
    configuracion_algoritmo: ConfiguracionAlgoritmo,
    mes: str
) -> Dict[str, any]:
    """
    Validar que la configuración es factible antes de intentar generar

    Args:
        empleados: Lista de empleados
        configuracion_turnos: Configuración de turnos
        configuracion_algoritmo: Configuración del algoritmo
        mes: Mes a validar

    Returns:
        Resultado de la validación con warnings/errores
    """
    warnings = []
    errors = []

    # 1. Verificar que hay suficientes empleados
    max_cobertura = max(configuracion_turnos.cobertura_minima.values())
    if len(empleados) < max_cobertura:
        errors.append(
            f"No hay suficientes empleados ({len(empleados)}) para cubrir "
            f"la cobertura mínima requerida ({max_cobertura})"
        )

    # 2. Verificar horas disponibles vs horas requeridas
    year, month = map(int, mes.split('-'))
    dias_mes = 31  # Aproximación
    if month in [4, 6, 9, 11]:
        dias_mes = 30
    elif month == 2:
        dias_mes = 29 if year % 4 == 0 else 28

    horas_requeridas_dia = sum(
        turno.duracion_horas * cobertura
        for turno_id, cobertura in configuracion_turnos.cobertura_minima.items()
        if turno_id in configuracion_turnos.turnos
        for turno in [configuracion_turnos.turnos[turno_id]]
    )

    horas_disponibles_mes = sum(
        emp.horas_maximas_mensuales for emp in empleados
    )

    horas_requeridas_mes = horas_requeridas_dia * dias_mes

    if horas_disponibles_mes < horas_requeridas_mes * 0.8:  # Margen del 20%
        warnings.append(
            f"Las horas disponibles ({horas_disponibles_mes}h) pueden ser insuficientes "
            f"para cubrir las horas requeridas ({horas_requeridas_mes}h)"
        )

    # 3. Verificar festivos que no bloqueen demasiados días
    for empleado in empleados:
        if len(empleado.festivos_personales) > dias_mes * 0.3:
            warnings.append(
                f"El empleado {empleado.nombre} tiene muchos festivos personales "
                f"({len(empleado.festivos_personales)} días)"
            )

    return {
        'factible': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }
