import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { crearFacadeAmbulancias } from './ambulances/ambulances.facade.js';
import { crearRutasAmbulancias } from './ambulances/ambulances.routes.js';
import health from './health/health.routes.js';
import type { FirebasePorts } from '../domain/puertos.js';

/**
 * Composición de módulos de la API: las rutas reciben servicios, no puertos de infraestructura.
 * Cada fase agrega aquí su módulo (`kpis`, `reports`).
 * (Registro explícito en lugar de `@fastify/autoload`: ver "Desviaciones" en docs/PROGRESO.md.)
 */
export function crearModulos(firebase: FirebasePorts, log: FastifyBaseLogger): FastifyPluginAsync[] {
  const ambulancias = crearFacadeAmbulancias(firebase, log);
  return [health, crearRutasAmbulancias(ambulancias)];
}
