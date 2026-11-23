import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { crearFacadeAmbulancias } from './ambulances/ambulances.facade.js';
import { crearRutasAmbulancias } from './ambulances/ambulances.routes.js';
import health from './health/health.routes.js';
import { crearRutasKpis } from './kpis/kpis.routes.js';
import { crearServicioKpis } from './kpis/kpis.service.js';
import { crearRutasReportes } from './reports/reports.routes.js';
import { crearServicioReportes } from './reports/reports.service.js';
import type { FirebasePorts } from '../domain/puertos.js';
import type { ConfigKpi } from './tipos.js';

/**
 * Composición de módulos de la API: las rutas reciben servicios, no puertos de infraestructura.
 * Cada fase agrega aquí su módulo.
 * (Registro explícito en lugar de `@fastify/autoload`: ver "Desviaciones" en docs/PROGRESO.md.)
 */
export function crearModulos(firebase: FirebasePorts, log: FastifyBaseLogger, kpi: ConfigKpi): FastifyPluginAsync[] {
  const ambulancias = crearFacadeAmbulancias(firebase, log);
  return [
    health,
    crearRutasAmbulancias(ambulancias),
    crearRutasKpis(crearServicioKpis(firebase.kpis, kpi)),
    crearRutasReportes(crearServicioReportes(firebase.kpis)),
  ];
}
