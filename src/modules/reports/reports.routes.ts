import type { FastifyPluginAsync } from 'fastify';
import { resumenQueryDto } from '../kpis/dto.js';
import type { ServicioReportes } from './reports.service.js';

const BASE = '/api/v1/reportes';

export function crearRutasReportes(servicio: ServicioReportes): FastifyPluginAsync {
  return async (app) => {
    const admin = { preHandler: [app.requireAdmin] };

    // Mismos filtros que /kpis/resumen.
    app.get(`${BASE}/alertas.csv`, admin, async (req, reply) => {
      const csv = await servicio.alertasCsv(resumenQueryDto.parse(req.query));
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="alertas.csv"')
        .send(csv);
    });
  };
}
