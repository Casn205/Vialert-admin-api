import type { FastifyBaseLogger } from 'fastify';
import type { FirebasePorts } from '../../domain/puertos.js';
import { decorarConAuditoria } from './ambulances.audit-decorator.js';
import { crearServicioAmbulancias, type ServicioAmbulancias } from './ambulances.service.js';

export function crearFacadeAmbulancias(firebase: FirebasePorts, log: FastifyBaseLogger): ServicioAmbulancias {
  const servicio = crearServicioAmbulancias({
    cuentas: firebase.cuentas,
    store: firebase.ambulancias,
    log,
  });
  return decorarConAuditoria(servicio, firebase.ambulancias, log);
}
