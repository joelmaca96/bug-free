import { Usuario, Farmacia, ConfiguracionAlgoritmo, ResultadoAlgoritmo, Turno } from '@/types';
import { UnifiedSchedulingAlgorithm } from './unifiedAlgorithm';

/**
 * Función principal para ejecutar el algoritmo de asignación de turnos
 * Utiliza un algoritmo unificado optimizado de múltiples fases
 *
 * @param turnosExistentes - Turnos existentes que deben respetarse (modo completar)
 */
export async function executeSchedulingAlgorithm(
  config: ConfiguracionAlgoritmo,
  farmacia: Farmacia,
  empleados: Usuario[],
  fechaInicio: Date,
  fechaFin: Date,
  turnosExistentes: Turno[] = []
): Promise<ResultadoAlgoritmo> {
  // Validaciones previas
  if (empleados.length === 0) {
    throw new Error('No hay empleados disponibles para asignar');
  }

  if (fechaInicio >= fechaFin) {
    throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
  }

  // Crear instancia del algoritmo unificado
  const algorithm = new UnifiedSchedulingAlgorithm(config, farmacia, empleados);

  // Ejecutar algoritmo
  console.log('Ejecutando algoritmo unificado de asignación de turnos...');
  if (turnosExistentes.length > 0) {
    console.log(`Modo completar: respetando ${turnosExistentes.length} turnos existentes`);
  }

  const resultado = await algorithm.execute(fechaInicio, fechaFin, turnosExistentes);

  console.log(`Algoritmo completado en ${resultado.tiempoEjecucion}ms`);
  console.log(`Score global: ${resultado.scoreGlobal}`);
  console.log(`Turnos generados: ${resultado.turnos.length}`);
  console.log(`Conflictos detectados: ${resultado.conflictos.length}`);

  return resultado;
}

// Exportar también los componentes individuales
export { UnifiedSchedulingAlgorithm } from './unifiedAlgorithm';
export { HoursTracker } from './hoursTracker';
export { TurnoValidator } from './validation';
export { ScoringSystem } from './scoring';
export { ConflictDetector } from './conflictDetector';
