import type { FastifyPluginAsync } from 'fastify';
import { rankingQueryDto, resumenQueryDto, seriesQueryDto } from './dto.js';
import type { ServicioKpis } from './kpis.service.js';

const BASE = '/api/v1/kpis';

export function crearRutasKpis(servicio: ServicioKpis): FastifyPluginAsync {
  return async (app) => {
    const admin = { preHandler: [app.requireAdmin] };

    app.get(`${BASE}/resumen`, admin, async (req) => servicio.resumen(resumenQueryDto.parse(req.query)));

    app.get(`${BASE}/series`, admin, async (req) => {
      const { granularidad, ...f } = seriesQueryDto.parse(req.query);
      return servicio.series(f, granularidad);
    });

    app.get(`${BASE}/ranking`, admin, async (req) => {
      const { por, ...f } = rankingQueryDto.parse(req.query);
      return servicio.ranking(f, por);
    });
  };
}
