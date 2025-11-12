/**
 * Hook para interactuar con el sistema de generación de horarios (OR-Tools)
 *
 * Proporciona funciones para:
 * - Generar horarios completos
 * - Ajustar horarios manualmente
 * - Validar configuración
 * - Tracking de progreso y errores
 */
import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

export interface MetricasHorario {
  horasPorEmpleado: Record<string, number>;
  guardiasPorEmpleado: Record<string, number>;
  festivosPorEmpleado: Record<string, number>;
  distribucionEquitativa: number;
  restriccionesVioladas: number;
  tiempoEjecucion: number;
  estadoSolver?: string;
}

export interface ResultadoGeneracion {
  success: boolean;
  horarioId: string;
  metricas: MetricasHorario;
  estado: string;
  mensaje: string;
  sugerencias?: string[];
}

export interface AjusteTurno {
  empleadoId: string;
  dia: string;
  turnoId: string;
}

export interface ValidacionConfiguracion {
  factible: boolean;
  errors: string[];
  warnings: string[];
}

export interface OpcionesGeneracion {
  timeout?: number;
  ajustesFijos?: Record<string, Record<string, string>>;
}

export interface SchedulerEngineState {
  loading: boolean;
  error: string | null;
  progress: string | null;
}

export const useSchedulerEngine = () => {
  const [state, setState] = useState<SchedulerEngineState>({
    loading: false,
    error: null,
    progress: null,
  });

  /**
   * Generar horarios completos para un mes
   *
   * @param empresaId - ID de la empresa
   * @param mes - Mes en formato YYYY-MM
   * @param empleadosIds - IDs de empleados (opcional, usa todos si no se especifica)
   * @param opciones - Opciones adicionales
   * @returns Resultado de la generación
   */
  const generarHorarios = useCallback(
    async (
      empresaId: string,
      mes: string,
      empleadosIds?: string[],
      opciones?: OpcionesGeneracion
    ): Promise<ResultadoGeneracion> => {
      setState({ loading: true, error: null, progress: 'Iniciando generación...' });

      try {
        // Validar entrada
        if (!empresaId || !mes) {
          throw new Error('empresaId y mes son requeridos');
        }

        // Validar formato de mes
        const mesRegex = /^\d{4}-\d{2}$/;
        if (!mesRegex.test(mes)) {
          throw new Error('Formato de mes inválido. Use YYYY-MM');
        }

        setState((prev) => ({ ...prev, progress: 'Conectando con el servidor...' }));

        // Llamar a la función de Firebase
        const generarHorariosFunction = httpsCallable<
          {
            empresaId: string;
            mes: string;
            empleadosIds?: string[];
            opciones?: OpcionesGeneracion;
          },
          ResultadoGeneracion
        >(functions, 'generarHorarios');

        setState((prev) => ({ ...prev, progress: 'Generando horarios con OR-Tools...' }));

        const result = await generarHorariosFunction({
          empresaId,
          mes,
          empleadosIds,
          opciones,
        });

        setState((prev) => ({ ...prev, progress: 'Horarios generados exitosamente' }));

        if (!result.data) {
          throw new Error('No se recibió respuesta del servidor');
        }

        setState({ loading: false, error: null, progress: null });

        return result.data;
      } catch (error: any) {
        console.error('Error generando horarios:', error);

        const errorMessage =
          error?.message ||
          error?.details?.detalle ||
          'Error desconocido al generar horarios';

        setState({
          loading: false,
          error: errorMessage,
          progress: null,
        });

        throw new Error(errorMessage);
      }
    },
    []
  );

  /**
   * Ajustar horarios con restricciones fijas del usuario
   *
   * @param empresaId - ID de la empresa
   * @param mes - Mes en formato YYYY-MM
   * @param ajustes - Lista de ajustes a aplicar
   * @returns Resultado del ajuste
   */
  const ajustarHorario = useCallback(
    async (
      empresaId: string,
      mes: string,
      ajustes: AjusteTurno[]
    ): Promise<ResultadoGeneracion> => {
      setState({ loading: true, error: null, progress: 'Aplicando ajustes...' });

      try {
        if (!empresaId || !mes || !ajustes || ajustes.length === 0) {
          throw new Error('empresaId, mes y ajustes son requeridos');
        }

        setState((prev) => ({ ...prev, progress: 'Regenerando horarios con ajustes...' }));

        const ajustarHorarioFunction = httpsCallable<
          {
            empresaId: string;
            mes: string;
            ajustes: AjusteTurno[];
          },
          ResultadoGeneracion
        >(functions, 'ajustarHorario');

        const result = await ajustarHorarioFunction({
          empresaId,
          mes,
          ajustes,
        });

        if (!result.data) {
          throw new Error('No se recibió respuesta del servidor');
        }

        setState({ loading: false, error: null, progress: null });

        return result.data;
      } catch (error: any) {
        console.error('Error ajustando horario:', error);

        const errorMessage =
          error?.message ||
          error?.details?.detalle ||
          'Error desconocido al ajustar horario';

        setState({
          loading: false,
          error: errorMessage,
          progress: null,
        });

        throw new Error(errorMessage);
      }
    },
    []
  );

  /**
   * Validar que la configuración sea factible
   *
   * @param empresaId - ID de la empresa
   * @param mes - Mes en formato YYYY-MM
   * @returns Resultado de la validación
   */
  const validarConfiguracion = useCallback(
    async (empresaId: string, mes: string): Promise<ValidacionConfiguracion> => {
      setState({ loading: true, error: null, progress: 'Validando configuración...' });

      try {
        if (!empresaId || !mes) {
          throw new Error('empresaId y mes son requeridos');
        }

        const validarConfiguracionFunction = httpsCallable<
          {
            empresaId: string;
            mes: string;
          },
          ValidacionConfiguracion
        >(functions, 'validarConfiguracion');

        const result = await validarConfiguracionFunction({
          empresaId,
          mes,
        });

        if (!result.data) {
          throw new Error('No se recibió respuesta del servidor');
        }

        setState({ loading: false, error: null, progress: null });

        return result.data;
      } catch (error: any) {
        console.error('Error validando configuración:', error);

        const errorMessage =
          error?.message ||
          error?.details?.detalle ||
          'Error desconocido al validar configuración';

        setState({
          loading: false,
          error: errorMessage,
          progress: null,
        });

        throw new Error(errorMessage);
      }
    },
    []
  );

  /**
   * Limpiar el estado de error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Resetear el estado completo
   */
  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      progress: null,
    });
  }, []);

  return {
    ...state,
    generarHorarios,
    ajustarHorario,
    validarConfiguracion,
    clearError,
    reset,
  };
};

export default useSchedulerEngine;
