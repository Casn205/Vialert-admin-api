import type { FastifyPluginAsync } from 'fastify';

const health: FastifyPluginAsync = async (app) => {
  // Público: lo usan el balanceador y el HEALTHCHECK del contenedor.
  app.get('/health', async () => ({ status: 'ok' }));
};

export default health;
