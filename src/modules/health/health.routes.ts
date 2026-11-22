import type { FastifyPluginAsync } from 'fastify';
import type { OpcionesModulo } from '../tipos.js';

const health: FastifyPluginAsync<OpcionesModulo> = async (app) => {
  // Público: lo usan el balanceador y el HEALTHCHECK del contenedor.
  app.get('/health', async () => ({ status: 'ok' }));
};

export default health;
