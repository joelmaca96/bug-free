"""
Modelos de datos para el sistema de generación de horarios
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum


class TipoTurno(str, Enum):
    """Tipos de turno posibles"""
    LABORAL = "laboral"
    GUARDIA = "guardia"
    FESTIVO = "festivo"


class EstadoTurno(str, Enum):
    """Estados de un turno"""
    CONFIRMADO = "confirmado"
    PENDIENTE = "pendiente"
    CONFLICTO = "conflicto"


@dataclass
class Empleado:
    """Modelo de empleado"""
    uid: str
    nombre: str
    email: str
    horas_maximas_diarias: float
    horas_maximas_semanales: float
    horas_maximas_mensuales: float
    festivos_personales: List[str] = field(default_factory=list)  # Fechas ISO
    turnos_favoritos: List[str] = field(default_factory=list)
    dias_libres_preferidos: List[int] = field(default_factory=list)  # 0-6


@dataclass
class Turno:
    """Modelo de turno de trabajo"""
    id: str
    nombre: str
    hora_inicio: str  # HH:MM
    hora_fin: str  # HH:MM
    duracion_horas: float
    tipo: TipoTurno
    dias_semana_validos: List[int] = field(default_factory=list)  # 1=Lunes, 7=Domingo (ISO weekday)
    fecha_especifica: Optional[str] = None  # Para turnos de guardia en fechas específicas (YYYY-MM-DD)

    def es_valido_para_dia(self, fecha: str) -> bool:
        """
        Verificar si este turno es válido para una fecha específica

        Args:
            fecha: Fecha en formato YYYY-MM-DD

        Returns:
            True si el turno es válido para ese día de la semana o fecha específica
        """
        # Si es un turno de guardia con fecha específica, solo es válido ese día
        if self.fecha_especifica:
            return fecha == self.fecha_especifica

        # Si no hay restricción de días, es válido para cualquier día
        if not self.dias_semana_validos:
            return True

        from datetime import datetime
        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d')
        dia_semana = fecha_obj.isoweekday()  # 1=Lunes, 7=Domingo
        return dia_semana in self.dias_semana_validos

    def se_solapa_con(self, otro_turno: 'Turno') -> bool:
        """
        Verificar si este turno se solapa temporalmente con otro

        Args:
            otro_turno: Otro turno para comparar

        Returns:
            True si hay solapamiento de horarios
        """
        def hora_a_minutos(hora_str: str) -> int:
            """Convertir HH:MM a minutos desde medianoche"""
            h, m = map(int, hora_str.split(':'))
            return h * 60 + m

        inicio1 = hora_a_minutos(self.hora_inicio)
        fin1 = hora_a_minutos(self.hora_fin)
        inicio2 = hora_a_minutos(otro_turno.hora_inicio)
        fin2 = hora_a_minutos(otro_turno.hora_fin)

        # Hay solapamiento si un turno comienza antes de que termine el otro
        return not (fin1 <= inicio2 or fin2 <= inicio1)


@dataclass
class ConfiguracionTurnos:
    """Configuración de turnos disponibles y cobertura mínima"""
    turnos: Dict[str, Turno]
    cobertura_minima: Dict[str, int]  # turnoId -> número de empleados


@dataclass
class Restricciones:
    """Restricciones del algoritmo"""
    descanso_minimo_horas: int = 12
    dias_descanso_semana: int = 1
    horas_maximas_semanales: float = 40.0
    permitir_horas_extra: bool = False
    max_turnos_consecutivos: int = 7


@dataclass
class ConfiguracionAlgoritmo:
    """Configuración completa del algoritmo"""
    restricciones: Restricciones
    pesos_optimizacion: Dict[str, float] = field(default_factory=dict)


@dataclass
class TurnoAsignado:
    """Turno asignado a un empleado"""
    empleado_id: str
    fecha: str  # YYYY-MM-DD
    turno_id: str
    hora_inicio: int  # Hora en formato 24h
    hora_fin: int  # Hora en formato 24h
    duracion_minutos: int
    tipo: TipoTurno
    estado: EstadoTurno = EstadoTurno.CONFIRMADO


@dataclass
class Metricas:
    """Métricas del resultado de la generación"""
    horas_por_empleado: Dict[str, float]
    guardias_por_empleado: Dict[str, int]
    festivos_por_empleado: Dict[str, int]
    distribucion_equitativa: float  # 0-1, donde 1 es perfectamente equitativo
    restricciones_violadas: int
    tiempo_ejecucion_segundos: float
    estado_solver: str  # OPTIMAL, FEASIBLE, INFEASIBLE


@dataclass
class ResultadoGeneracion:
    """Resultado de la generación de horarios"""
    horarios: Dict[str, Dict[str, str]]  # empleadoId -> {dia -> turnoId}
    metricas: Metricas
    estado: str
    mensaje: Optional[str] = None
    sugerencias: List[str] = field(default_factory=list)


@dataclass
class SolicitudGeneracion:
    """Solicitud de generación de horarios"""
    empresa_id: str
    mes: str  # YYYY-MM
    empleados: List[Empleado]
    configuracion_turnos: ConfiguracionTurnos
    configuracion_algoritmo: ConfiguracionAlgoritmo
    ajustes_fijos: Optional[Dict[str, Dict[str, str]]] = None  # empleadoId -> {dia -> turnoId}


@dataclass
class SolicitudValidacion:
    """Solicitud de validación de configuración"""
    empresa_id: str
    mes: str
    empleados: List[Empleado]
    configuracion_turnos: ConfiguracionTurnos
    configuracion_algoritmo: ConfiguracionAlgoritmo
