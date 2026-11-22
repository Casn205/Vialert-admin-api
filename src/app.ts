import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { FirebasePorts } from './domain/puertos.js';
import { modulos } from './modules/index.js';
import { registrarAuth } from './plugins/auth.js';
import { registrarErrores } from './plugins/errors.js';

export interface OpcionesApp {
  /** Puertos hacia Firebase: los reales (`server.ts`) o los falsos de las pruebas. */
  firebase: FirebasePorts;
  corsOrigins?: string[];
  logger?: FastifyServerOptions['logger'];
}

/** Construye la aplicación sin ponerla a escuchar (así la usan `server.ts` y las pruebas con `inject`). */
export async function buildApp(opts: OpcionesApp): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  registrarErrores(app);
  await app.register(cors, {
    origin: opts.corsOrigins && opts.corsOrigins.length > 0 ? opts.corsOrigins : false,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'],
  });
  registrarAuth(app, { tokens: opts.firebase.tokens, roles: opts.firebase.roles });

  for (const modulo of modulos) {
    await app.register(modulo, { firebase: opts.firebase });
  }
  return app;
}
