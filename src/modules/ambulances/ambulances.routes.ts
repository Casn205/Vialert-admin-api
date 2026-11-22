import type { FastifyPluginAsync } from 'fastify';
import type { OpcionesModulo } from '../tipos.js';
import { crearServicioAmbulancias } from './ambulances.service.js';
import { crearAmbulanciaDto, editarAmbulanciaDto, idParamDto, loteDto, passwordDto } from './dto.js';

const BASE = '/api/v1/ambulancias';

const ambulances: FastifyPluginAsync<OpcionesModulo> = async (app, { firebase }) => {
  const servicio = crearServicioAmbulancias({ cuentas: firebase.cuentas, store: firebase.ambulancias });
  const admin = { preHandler: [app.requireAdmin] };

  app.post(BASE, admin, async (req, reply) => {
    const dto = crearAmbulanciaDto.parse(req.body);
    return reply.code(201).send(await servicio.crear(req.adminUid, dto, req.log));
  });

  app.post(`${BASE}/lote`, admin, async (req) => {
    const dto = loteDto.parse(req.body);
    return servicio.crearLote(req.adminUid, dto, req.log);
  });

  app.patch(`${BASE}/:id`, admin, async (req, reply) => {
    const { id } = idParamDto.parse(req.params);
    await servicio.editar(req.adminUid, id, editarAmbulanciaDto.parse(req.body), req.log);
    return reply.code(204).send();
  });

  app.post(`${BASE}/:id/deshabilitar`, admin, async (req, reply) => {
    const { id } = idParamDto.parse(req.params);
    await servicio.deshabilitar(req.adminUid, id, req.log);
    return reply.code(204).send();
  });

  app.post(`${BASE}/:id/habilitar`, admin, async (req, reply) => {
    const { id } = idParamDto.parse(req.params);
    await servicio.habilitar(req.adminUid, id, req.log);
    return reply.code(204).send();
  });

  app.post(`${BASE}/:id/password`, admin, async (req, reply) => {
    const { id } = idParamDto.parse(req.params);
    const { password } = passwordDto.parse(req.body);
    await servicio.resetearPassword(req.adminUid, id, password, req.log);
    return reply.code(204).send();
  });

  app.post(`${BASE}/:id/cerrar-turno`, admin, async (req, reply) => {
    const { id } = idParamDto.parse(req.params);
    await servicio.cerrarTurno(req.adminUid, id, req.log);
    return reply.code(204).send();
  });
};

export default ambulances;
