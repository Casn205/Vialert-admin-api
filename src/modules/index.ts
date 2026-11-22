import type { FastifyPluginAsync } from 'fastify';
import ambulances from './ambulances/ambulances.routes.js';
import health from './health/health.routes.js';
import type { OpcionesModulo } from './tipos.js';

/**
 * Módulos de rutas de la API. Cada fase agrega el suyo aquí (`kpis`, `reports`).
 * (Registro explícito en lugar de `@fastify/autoload`: ver "Desviaciones" en docs/PROGRESO.md.)
 */
export const modulos: FastifyPluginAsync<OpcionesModulo>[] = [health, ambulances];
