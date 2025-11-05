import { Usuario, Farmacia, ConfiguracionAlgoritmo, ResultadoAlgoritmo } from '@/types';
import { GreedyAlgorithm } from './greedyAlgorithm';
import { BacktrackingAlgorithm } from './backtrackingAlgorithm';
import { GeneticAlgorithm } from './geneticAlgorithm';

/**
 * Función principal para ejecutar el algoritmo de asignación de turnos
 * Selecciona la estrategia según la configuración y ejecuta el algoritmo
 */
export async function executeSchedulingAlgorithm(
  config: ConfiguracionAlgoritmo,
  farmacia: Farmacia,
  empleados: Usuario[],
  fechaInicio: Date,
  fechaFin: Date
): Promise<ResultadoAlgoritmo> {
  // Validaciones previas
  if (empleados.length === 0) {
    throw new Error('No hay empleados disponibles para asignar');
  }

  if (fechaInicio >= fechaFin) {
    throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
  }

  // Seleccionar algoritmo según estrategia configurada
  let algorithm: GreedyAlgorithm | BacktrackingAlgorithm | GeneticAlgorithm;

  switch (config.parametrosOptimizacion.estrategia) {
    case 'greedy':
      algorithm = new GreedyAlgorithm(config, farmacia, empleados);
      break;

    case 'backtracking':
      algorithm = new BacktrackingAlgorithm(config, farmacia, empleados);
      break;

    case 'genetico':
      algorithm = new GeneticAlgorithm(config, farmacia, empleados);
      break;

    default:
      throw new Error(`Estrategia desconocida: ${config.parametrosOptimizacion.estrategia}`);
  }

  // Ejecutar algoritmo
  console.log(`Ejecutando algoritmo ${config.parametrosOptimizacion.estrategia}...`);
  const resultado = await algorithm.execute(fechaInicio, fechaFin);

  console.log(`Algoritmo completado en ${resultado.tiempoEjecucion}ms`);
  console.log(`Score global: ${resultado.scoreGlobal}`);
  console.log(`Turnos generados: ${resultado.turnos.length}`);
  console.log(`Conflictos detectados: ${resultado.conflictos.length}`);

  return resultado;
}

// Exportar también los componentes individuales
export { GreedyAlgorithm } from './greedyAlgorithm';
export { BacktrackingAlgorithm } from './backtrackingAlgorithm';
export { GeneticAlgorithm } from './geneticAlgorithm';
export { HoursTracker } from './hoursTracker';
export { TurnoValidator } from './validation';
export { ScoringSystem } from './scoring';
export { ConflictDetector } from './conflictDetector';
